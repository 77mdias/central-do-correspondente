import { Hono } from "hono";
import { converterPrototipo, esquemaArquivoPrototipo } from "../../src/regras/importacao";
import { type AppTipos, exigirUsuario } from "../contexto";
import { ehResposta, emTransacao, ErroRota, exigirEscritorio, ids } from "./comum";

export const rotasImportacao = new Hono<AppTipos>();
rotasImportacao.use("/contas/:contaId/*", exigirUsuario);

const TAMANHO_MAXIMO = 10 * 1024 * 1024;
/** Recusas de importar_prototipo que viram 409 (mensagem exata da função). */
const RECUSAS = new Set(["conta_inativa", "conta_nao_vazia", "ja_importado", "origem_usada"]);

export type ResultadoImportacao = { corretores: number; clientes: number; documentos: number; notas: number };

/** RF-90 (D-40): o arquivo do "Exportar JSON" do protótipo, convertido aqui e gravado pela função do banco. */
rotasImportacao.post("/contas/:contaId/importacao", async (c) => {
  const r = await emTransacao(c, async (db) => {
    const [conta] = ids(c, "contaId");
    await exigirEscritorio(db, conta!); // 404 para quem não é do escritório; a função recusa a funcionária
    const texto = await c.req.text();
    if (texto.length > TAMANHO_MAXIMO) throw new ErroRota(413, { erro: "arquivo_grande" });
    let json: unknown;
    try {
      json = JSON.parse(texto);
    } catch {
      throw new ErroRota(400, { erro: "arquivo_invalido", mensagem: "O arquivo não é um JSON" });
    }
    const arquivo = esquemaArquivoPrototipo.safeParse(json);
    if (!arquivo.success) throw new ErroRota(400, { erro: "arquivo_invalido", mensagem: arquivo.error.issues[0]?.message ?? "Arquivo inválido" });
    const { dados } = converterPrototipo(arquivo.data);
    try {
      const res = await db.query<{ r: ResultadoImportacao }>("select importar_prototipo($1, $2::jsonb) as r", [conta, JSON.stringify(dados)]);
      return res.rows[0]!.r;
    } catch (e) {
      const msg = (e as { message?: string }).message ?? "";
      if (RECUSAS.has(msg)) throw new ErroRota(409, { erro: msg });
      throw e;
    }
  });
  return ehResposta(r) ? r : c.json<ResultadoImportacao>(r);
});
