import { Hono } from "hono";
import type { PoolClient } from "pg";
import { z } from "zod";
import { DOCUMENTOS } from "../../src/regras/catalogo";
import { dataCurta } from "../../src/regras/datas";
import { esquemaClienteParcial, esquemaDocumento, esquemaNota, esquemaNovoCliente, esquemaRemuneracao } from "../../src/regras/esquemas";
import { faltando, situacaoCobranca } from "../../src/regras/processo";
import type { AtualizacaoRecente, ClienteLista, Ficha } from "../../src/tipos-api";
import { type AppTipos, exigirUsuario } from "../contexto";
import { criarS3 } from "../s3";
import { corpo, ehResposta, emTransacao, ErroRota, exigirEscritorio, ids, naoEncontrado, semPermissao } from "./comum";

export const rotasClientes = new Hono<AppTipos>();
rotasClientes.use("/contas/:contaId/*", exigirUsuario);

const dia = (col: string) => `to_char(${col}, 'YYYY-MM-DD')`;

/** Colunas de `ClienteLista` (sem nada de percentual ou remuneração, RN-17). */
export const SELECT_CLIENTE = `
  c.id, c.corretor_id as "corretorId", c.nome, c.cpf, c.whatsapp, c.email, c.modalidade, c.etapa,
  c.valor_imovel_centavos as "valorImovelCentavos", c.valor_financiado_centavos as "valorFinanciadoCentavos",
  c.valor_avaliacao_centavos as "valorAvaliacaoCentavos", c.entrada_centavos as "entradaCentavos",
  c.fgts_centavos as "fgtsCentavos", c.subsidio_centavos as "subsidioCentavos",
  c.numero_contrato as "numeroContrato", ${dia("c.data_assinatura")} as "dataAssinatura",
  ${dia("c.proxima_cobranca")} as "proximaCobranca", c.intervalo_cobranca as "intervaloCobranca",
  c.qtd_cobrancas as "qtdCobrancas", c.ultima_cobranca as "ultimaCobranca", c.observacoes,
  c.finalizado_em as "finalizadoEm", ${dia("c.anexos_apagar_em")} as "anexosApagarEm",
  c.criado_em as "criadoEm", c.atualizado_em as "atualizadoEm",
  coalesce((select jsonb_object_agg(d.tipo, ${dia("d.recebido_em")}) from documentos d where d.cliente_id = c.id), '{}') as documentos,
  coalesce((select jsonb_object_agg(t.tipo, t.n) from (
    select coalesce(a.tipo_documento, 'outros') as tipo, count(*)::int as n from arquivos a
     where a.cliente_id = c.id and a.apagado_em is null group by 1) t), '{}') as anexos`;

export async function lerCliente(db: PoolClient, conta: string, id: string): Promise<ClienteLista> {
  const r = await db.query<ClienteLista>(`select ${SELECT_CLIENTE} from clientes c where c.conta_id = $1 and c.id = $2`, [conta, id]);
  if (!r.rowCount) throw naoEncontrado();
  return r.rows[0]!;
}

/** Campos do PATCH → colunas (lista fechada: nada fora dela chega ao SQL). */
const COLUNA: Record<string, string> = {
  nome: "nome", cpf: "cpf", whatsapp: "whatsapp", email: "email", modalidade: "modalidade", corretorId: "corretor_id",
  etapa: "etapa", valorImovelCentavos: "valor_imovel_centavos", valorFinanciadoCentavos: "valor_financiado_centavos",
  valorAvaliacaoCentavos: "valor_avaliacao_centavos", entradaCentavos: "entrada_centavos", fgtsCentavos: "fgts_centavos",
  subsidioCentavos: "subsidio_centavos", numeroContrato: "numero_contrato", dataAssinatura: "data_assinatura",
  proximaCobranca: "proxima_cobranca", intervaloCobranca: "intervalo_cobranca", observacoes: "observacoes",
};

async function origemTexto(db: PoolClient, conta: string, corretorId: string | null | undefined): Promise<string> {
  if (!corretorId) return "Cliente direto";
  const r = await db.query<{ nome: string; imobiliaria: string | null }>("select nome, imobiliaria from corretores where conta_id = $1 and id = $2", [conta, corretorId]);
  const k = r.rows[0];
  if (!k) throw new ErroRota(400, { erro: "validacao", campos: ["corretorId"] });
  return k.imobiliaria ? `${k.nome} (${k.imobiliaria})` : k.nome;
}

// ── lista e cadastro ──────────────────────────────────────────────────────

/** RF-05: as 7 últimas entradas de histórico de todos os clientes, para o Início. */
rotasClientes.get("/contas/:contaId/historico", async (c) => {
  const r = await emTransacao(c, async (db) => {
    const [conta] = ids(c, "contaId");
    await exigirEscritorio(db, conta!);
    const q = await db.query<AtualizacaoRecente>(
      `select h.id, h.cliente_id as "clienteId", c.nome, h.tipo, h.texto, h.criado_em as "criadoEm"
         from historico h join clientes c on c.id = h.cliente_id and c.conta_id = h.conta_id
        where h.conta_id = $1 order by h.criado_em desc, h.id limit 7`,
      [conta],
    );
    return q.rows;
  });
  return ehResposta(r) ? r : c.json<AtualizacaoRecente[]>(r);
});

rotasClientes.get("/contas/:contaId/clientes", async (c) => {
  const r = await emTransacao(c, async (db) => {
    const [conta] = ids(c, "contaId");
    await exigirEscritorio(db, conta!);
    return (await db.query<ClienteLista>(`select ${SELECT_CLIENTE} from clientes c where c.conta_id = $1 order by c.nome`, [conta])).rows;
  });
  return ehResposta(r) ? r : c.json<ClienteLista[]>(r);
});

rotasClientes.post("/contas/:contaId/clientes", async (c) => {
  const r = await emTransacao(c, async (db) => {
    const [conta] = ids(c, "contaId");
    await exigirEscritorio(db, conta!);
    const d = await corpo(c, esquemaNovoCliente);
    const origem = await origemTexto(db, conta!, d.corretorId);
    // RF-11: entra em Documentação pendente, com cobrança hoje e intervalo de 3 dias
    const ins = await db.query<{ id: string }>(
      `insert into clientes (conta_id, corretor_id, nome, cpf, whatsapp, email, modalidade, valor_imovel_centavos, valor_financiado_centavos,
                             etapa, proxima_cobranca, intervalo_cobranca)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'documentacao_pendente', hoje_br(), 3) returning id`,
      [conta, d.corretorId ?? null, d.nome, d.cpf ?? null, d.whatsapp ?? null, d.email ?? null, d.modalidade ?? null,
       d.valorImovelCentavos ?? null, d.valorFinanciadoCentavos ?? null],
    );
    const id = ins.rows[0]!.id;
    await db.query(`insert into historico (conta_id, cliente_id, usuario_id, tipo, texto) values ($1, $2, meu_usuario_id(), 'nota', $3)`, [
      conta, id, `Cliente cadastrado · ${origem}`,
    ]);
    return { id };
  });
  return ehResposta(r) ? r : c.json(r, 201);
});

// ── ficha ─────────────────────────────────────────────────────────────────

rotasClientes.get("/contas/:contaId/clientes/:id", async (c) => {
  const r = await emTransacao(c, async (db): Promise<Ficha> => {
    const [conta, id] = ids(c, "contaId", "id");
    await exigirEscritorio(db, conta!);
    const cliente = await lerCliente(db, conta!, id!);
    const anexos = await db.query<Ficha["anexos"][number]>(
      `select id, coalesce(tipo_documento, 'outros') as tipo, nome, tamanho, mime, enviado_em as "enviadoEm"
         from arquivos where cliente_id = $1 and apagado_em is null order by enviado_em`,
      [id],
    );
    const historico = await db.query<Ficha["historico"][number]>(
      `select id, tipo, texto, criado_em as "criadoEm" from historico where cliente_id = $1 order by criado_em desc, id`,
      [id],
    );
    // vw_remuneracao só devolve linhas ao gestor (RN-17): para a funcionária, a chave nem aparece
    const rem = await db.query<{ pctUsado: string | null; remuneracaoCentavos: number | null; pctContrato: string | null; pctProprio: string | null; recebidaEm: string | null }>(
      `select v.pct_usado::text as "pctUsado", v.remuneracao_centavos as "remuneracaoCentavos", r.pct_contrato::text as "pctContrato",
              r.pct_proprio::text as "pctProprio", ${dia("r.remuneracao_recebida_em")} as "recebidaEm"
         from vw_remuneracao v left join clientes_remuneracao r on r.cliente_id = v.cliente_id where v.cliente_id = $1`,
      [id],
    );
    await db.query(`insert into auditoria (conta_id, usuario_id, acao, entidade, entidade_id) values ($1, meu_usuario_id(), 'ver', 'cliente', $2)`, [conta, id]);
    const num = (v: string | null) => (v == null ? null : Number(v));
    const x = rem.rows[0];
    return {
      cliente,
      anexos: anexos.rows,
      historico: historico.rows,
      ...(x ? { remuneracao: { pctUsado: num(x.pctUsado), remuneracaoCentavos: x.remuneracaoCentavos, pctContrato: num(x.pctContrato), pctProprio: num(x.pctProprio), recebidaEm: x.recebidaEm } } : {}),
    };
  });
  return ehResposta(r) ? r : c.json<Ficha>(r);
});

/** Lê sob RLS (404 se não existe) e depois grava; 0 linhas gravadas = conta sem escrita (403). */
async function exigirGravado(n: number | null) {
  if (!n) throw semPermissao();
}

rotasClientes.patch("/contas/:contaId/clientes/:id", async (c) => {
  const r = await emTransacao(c, async (db) => {
    const [conta, id] = ids(c, "contaId", "id");
    await exigirEscritorio(db, conta!);
    const d = await corpo(c, esquemaClienteParcial);
    await lerCliente(db, conta!, id!);
    const campos = Object.entries(d).filter(([k]) => k in COLUNA);
    const sets = campos.map(([k], i) => `${COLUNA[k]} = $${i + 3}`).join(", ");
    const up = await db.query(`update clientes set ${sets} where conta_id = $1 and id = $2`, [conta, id, ...campos.map(([, v]) => v)]);
    await exigirGravado(up.rowCount);
    return lerCliente(db, conta!, id!);
  });
  return ehResposta(r) ? r : c.json<ClienteLista>(r);
});

rotasClientes.delete("/contas/:contaId/clientes/:id", async (c) => {
  const r = await emTransacao(c, async (db) => {
    const [conta, id] = ids(c, "contaId", "id");
    await exigirEscritorio(db, conta!);
    await lerCliente(db, conta!, id!);
    const caminhos = (await db.query<{ caminho: string }>("select caminho from arquivos where cliente_id = $1 and apagado_em is null", [id])).rows;
    const del = await db.query("delete from clientes where conta_id = $1 and id = $2", [conta, id]);
    await exigirGravado(del.rowCount);
    return caminhos.map((x) => x.caminho);
  });
  if (ehResposta(r)) return r;
  // depois do commit: o que falhar aqui a rotina diária recolhe (objeto sem linha)
  const s3 = criarS3(c.env);
  c.executionCtx.waitUntil(Promise.allSettled(r.map((caminho) => s3.apagar(caminho))));
  return c.body(null, 204);
});

// ── documentos, histórico, cobrança e remuneração ─────────────────────────

const TIPOS_DOC = new Set<string>(DOCUMENTOS.map((d) => d.codigo));

rotasClientes.put("/contas/:contaId/clientes/:id/documentos/:tipo", async (c) => {
  const r = await emTransacao(c, async (db) => {
    const [conta, id] = ids(c, "contaId", "id");
    const tipo = c.req.param("tipo");
    if (!TIPOS_DOC.has(tipo)) throw naoEncontrado();
    await exigirEscritorio(db, conta!);
    const { recebido } = await corpo(c, esquemaDocumento);
    await lerCliente(db, conta!, id!);
    // marcar de novo um documento já recebido mantém a data original
    const up = await db.query(
      `insert into documentos (conta_id, cliente_id, tipo, recebido_em, marcado_por)
       values ($1, $2, $3, case when $4 then hoje_br() end, meu_usuario_id())
       on conflict (cliente_id, tipo) do update
         set recebido_em = case when excluded.recebido_em is null then null else coalesce(documentos.recebido_em, excluded.recebido_em) end,
             marcado_por = excluded.marcado_por`,
      [conta, id, tipo, recebido],
    );
    await exigirGravado(up.rowCount);
    const cliente = await lerCliente(db, conta!, id!);
    const nome = DOCUMENTOS.find((d) => d.codigo === tipo)!.nome;
    const completa = recebido && faltando(cliente).length === 0;
    await db.query(`insert into historico (conta_id, cliente_id, usuario_id, tipo, texto) values ($1, $2, meu_usuario_id(), 'nota', $3)`, [
      conta, id, `${recebido ? "Recebido" : "Desmarcado"}: ${nome}${completa ? " · documentação completa" : ""}`,
    ]);
    return lerCliente(db, conta!, id!);
  });
  return ehResposta(r) ? r : c.json<ClienteLista>(r);
});

rotasClientes.post("/contas/:contaId/clientes/:id/historico", async (c) => {
  const r = await emTransacao(c, async (db) => {
    const [conta, id] = ids(c, "contaId", "id");
    await exigirEscritorio(db, conta!);
    const { texto } = await corpo(c, esquemaNota);
    await lerCliente(db, conta!, id!);
    const ins = await db.query<{ id: string }>(
      `insert into historico (conta_id, cliente_id, usuario_id, tipo, texto) values ($1, $2, meu_usuario_id(), 'nota', $3) returning id`,
      [conta, id, texto],
    );
    return { id: ins.rows[0]!.id };
  });
  return ehResposta(r) ? r : c.json(r, 201);
});

const esquemaCobranca = z.object({ meio: z.enum(["whatsapp", "copiada"]) });

/** RN-13, depois do "Enviou?" (D-39): última = agora, contador + 1, próxima = hoje + intervalo. */
rotasClientes.post("/contas/:contaId/clientes/:id/cobrancas", async (c) => {
  const r = await emTransacao(c, async (db) => {
    const [conta, id] = ids(c, "contaId", "id");
    await exigirEscritorio(db, conta!);
    const { meio } = await corpo(c, esquemaCobranca);
    const antes = await lerCliente(db, conta!, id!);
    const hoje = (await db.query<{ hoje: string }>("select hoje_br()::text as hoje")).rows[0]!.hoje;
    if (!situacaoCobranca(antes, hoje)) throw new ErroRota(409, { erro: "sem_cobranca" });
    const up = await db.query<{ proxima: string }>(
      `update clientes set ultima_cobranca = now(), qtd_cobrancas = qtd_cobrancas + 1, proxima_cobranca = hoje_br() + intervalo_cobranca
        where conta_id = $1 and id = $2 returning ${dia("proxima_cobranca")} as proxima`,
      [conta, id],
    );
    await exigirGravado(up.rowCount);
    const docs = faltando(antes).map((d) => d.nome).join(", ");
    const como = meio === "whatsapp" ? "enviada pelo WhatsApp" : "feita";
    await db.query(`insert into historico (conta_id, cliente_id, usuario_id, tipo, texto) values ($1, $2, meu_usuario_id(), 'cobranca', $3)`, [
      conta, id, `Cobrança ${como}: ${docs}. Próxima em ${dataCurta(up.rows[0]!.proxima)}`,
    ]);
    return lerCliente(db, conta!, id!);
  });
  return ehResposta(r) ? r : c.json<ClienteLista>(r);
});

rotasClientes.patch("/contas/:contaId/clientes/:id/remuneracao", async (c) => {
  const r = await emTransacao(c, async (db) => {
    const [conta, id] = ids(c, "contaId", "id");
    if ((await exigirEscritorio(db, conta!)) !== "gestor") throw semPermissao();
    const d = await corpo(c, esquemaRemuneracao);
    await lerCliente(db, conta!, id!);
    const pct = "pctProprio" in d;
    const rec = "recebidaEm" in d;
    const up = await db.query(
      `insert into clientes_remuneracao (cliente_id, conta_id, pct_proprio, remuneracao_recebida_em) values ($1, $2, $3, $4)
       on conflict (cliente_id) do update set
         pct_proprio = case when $5 then excluded.pct_proprio else clientes_remuneracao.pct_proprio end,
         remuneracao_recebida_em = case when $6 then excluded.remuneracao_recebida_em else clientes_remuneracao.remuneracao_recebida_em end`,
      [id, conta, d.pctProprio ?? null, d.recebidaEm ?? null, pct, rec],
    );
    await exigirGravado(up.rowCount);
    return { ok: true };
  });
  return ehResposta(r) ? r : c.json(r);
});

