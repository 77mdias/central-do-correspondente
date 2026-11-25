import { Hono } from "hono";
import type { PoolClient } from "pg";
import { DOCUMENTOS } from "../../src/regras/catalogo";
import type { ArquivoResumo } from "../../src/tipos-api";
import { type AppTipos, exigirUsuario } from "../contexto";
import { criarS3, ErroS3 } from "../s3";
import { ehResposta, emTransacao, ErroRota, ids, naoEncontrado, semPermissao } from "./comum";

export const rotasArquivos = new Hono<AppTipos>();
rotasArquivos.use("/contas/:contaId/*", exigirUsuario);

export const TAMANHO_MAXIMO = 20 * 1024 * 1024; // RF-22

/** Tipo pelo conteúdo (o que o navegador declara não vale): PDF, JPG, PNG, WebP e HEIC. */
export function tipoPeloConteudo(b: Uint8Array): { mime: string; ext: string } | null {
  const ascii = (i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));
  if (ascii(0, 5) === "%PDF-") return { mime: "application/pdf", ext: "pdf" };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b[0] === 0x89 && ascii(1, 3) === "PNG") return { mime: "image/png", ext: "png" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (ascii(4, 4) === "ftyp" && ["heic", "heix", "mif1", "msf1", "heis"].includes(ascii(8, 4))) return { mime: "image/heic", ext: "heic" };
  return null;
}

/** Só confirma que o cliente existe para quem pede (RLS); não lê colunas, que variam por perfil. */
async function existeCliente(db: PoolClient, conta: string, id: string) {
  const r = await db.query("select 1 from clientes where conta_id = $1 and id = $2", [conta, id]);
  if (!r.rowCount) throw naoEncontrado();
}

const TIPOS = new Set<string>(DOCUMENTOS.map((d) => d.codigo));
const nomeDoTipo = (t: string | null) => (t ? DOCUMENTOS.find((d) => d.codigo === t)!.nome : "Outros arquivos");

/** RF-22/RF-23: grava a linha sob RLS, envia ao S3 e só então confirma; se o S3 falhar, nada fica. */
rotasArquivos.post("/contas/:contaId/clientes/:id/arquivos", async (c) => {
  const s3 = criarS3(c.env);
  const r = await emTransacao(c, async (db): Promise<ArquivoResumo> => {
    const [conta, cliente] = ids(c, "contaId", "id");
    await existeCliente(db, conta!, cliente!); // 404 para quem não enxerga o cliente (escritório ou corretor dele)
    const form = await c.req.formData().catch(() => null);
    const arquivo = form?.get("arquivo");
    const tipoForm = String(form?.get("tipo") ?? "");
    if (!(arquivo instanceof File) || !(tipoForm === "outros" || TIPOS.has(tipoForm)))
      throw new ErroRota(400, { erro: "validacao", campos: ["arquivo", "tipo"] });
    if (arquivo.size > TAMANHO_MAXIMO) throw new ErroRota(413, { erro: "arquivo_grande" });
    if (arquivo.size === 0) throw new ErroRota(400, { erro: "validacao", campos: ["arquivo"] });
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    const tipoArq = tipoPeloConteudo(bytes);
    if (!tipoArq) throw new ErroRota(415, { erro: "tipo_nao_aceito" });

    const id = crypto.randomUUID();
    const tipo = tipoForm === "outros" ? null : tipoForm;
    const nome = (arquivo.name || `arquivo.${tipoArq.ext}`).slice(0, 200);
    const caminho = `${conta}/${cliente}/${id}.${tipoArq.ext}`;
    const ins = await db.query<{ enviadoEm: string }>(
      `insert into arquivos (id, conta_id, cliente_id, tipo_documento, nome, caminho, tamanho, mime, enviado_por)
       values ($1, $2, $3, $4, $5, $6, $7, $8, meu_usuario_id()) returning enviado_em as "enviadoEm"`,
      [id, conta, cliente, tipo, nome, caminho, bytes.byteLength, tipoArq.mime],
    );
    try {
      await s3.enviar(caminho, bytes, tipoArq.mime);
    } catch (e) {
      if (e instanceof ErroS3 || e instanceof TypeError) throw new ErroRota(502, { erro: "armazenamento" });
      throw e;
    }
    return { id, tipo: tipo ?? "outros", nome, tamanho: bytes.byteLength, mime: tipoArq.mime, enviadoEm: ins.rows[0]!.enviadoEm } as ArquivoResumo;
  });
  return ehResposta(r) ? r : c.json<ArquivoResumo>(r, 201);
});

type LinhaArquivo = { caminho: string; nome: string; tipo: string | null; cliente: string };
async function lerArquivo(db: PoolClient, conta: string, id: string): Promise<LinhaArquivo> {
  const r = await db.query<LinhaArquivo>(
    `select caminho, nome, tipo_documento as tipo, cliente_id as cliente from arquivos where conta_id = $1 and id = $2 and apagado_em is null`,
    [conta, id],
  );
  if (!r.rowCount) throw naoEncontrado();
  return r.rows[0]!;
}

/** RF-26: link de até 5 minutos, com auditoria de quem baixou. */
rotasArquivos.get("/contas/:contaId/arquivos/:id/link", async (c) => {
  const r = await emTransacao(c, async (db) => {
    const [conta, id] = ids(c, "contaId", "id");
    const a = await lerArquivo(db, conta!, id!);
    await db.query(`insert into auditoria (conta_id, usuario_id, acao, entidade, entidade_id) values ($1, meu_usuario_id(), 'baixar', 'arquivo', $2)`, [conta, id]);
    return { url: await criarS3(c.env).linkTemporario(a.caminho, a.nome) };
  });
  return ehResposta(r) ? r : c.json(r);
});

/** RF-24: remove o anexo; o documento continua recebido, como no protótipo. */
rotasArquivos.delete("/contas/:contaId/arquivos/:id", async (c) => {
  const r = await emTransacao(c, async (db) => {
    const [conta, id] = ids(c, "contaId", "id");
    const a = await lerArquivo(db, conta!, id!);
    const del = await db.query("delete from arquivos where conta_id = $1 and id = $2", [conta, id]);
    if (!del.rowCount) throw semPermissao();
    await db.query(`insert into historico (conta_id, cliente_id, usuario_id, tipo, texto) values ($1, $2, meu_usuario_id(), 'nota', $3)`, [
      conta, a.cliente, `Arquivo removido: ${nomeDoTipo(a.tipo)} (${a.nome})`,
    ]);
    return a.caminho;
  });
  if (ehResposta(r)) return r;
  c.executionCtx.waitUntil(criarS3(c.env).apagar(r).catch((e) => console.error("objeto não apagado; a rotina diária recolhe", e)));
  return c.body(null, 204);
});
