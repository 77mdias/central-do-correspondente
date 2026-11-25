import { Hono } from "hono";
import type { ClientePortal, FichaPortal } from "../../src/tipos-api";
import { type AppTipos, exigirUsuario } from "../contexto";
import { ehResposta, emTransacao, exigirCorretor, ids, naoEncontrado } from "./comum";

// Portal do corretor (fase 3, RF-80 a RF-83). A RLS decide QUAIS clientes ele vê (os dele);
// esta lista decide QUAIS CAMPOS saem. Escrita à mão, coluna por coluna, e não derivada do
// SELECT_CLIENTE: uma coluna nova no escritório não entra aqui sem alguém decidir (CAMPOS_PORTAL).
export const rotasPortal = new Hono<AppTipos>();
rotasPortal.use("/contas/:contaId/portal/*", exigirUsuario);

const SELECT_PORTAL = `
  c.id, c.nome, c.whatsapp, c.email, c.modalidade, c.etapa,
  c.valor_imovel_centavos as "valorImovelCentavos", c.valor_financiado_centavos as "valorFinanciadoCentavos",
  c.criado_em as "criadoEm", c.atualizado_em as "atualizadoEm",
  coalesce((select jsonb_object_agg(d.tipo, to_char(d.recebido_em, 'YYYY-MM-DD')) from documentos d where d.cliente_id = c.id), '{}') as documentos,
  coalesce((select jsonb_object_agg(t.tipo, t.n) from (
    select coalesce(a.tipo_documento, 'outros') as tipo, count(*)::int as n from arquivos a
     where a.cliente_id = c.id and a.apagado_em is null group by 1) t), '{}') as anexos`;

rotasPortal.get("/contas/:contaId/portal/clientes", async (c) => {
  const r = await emTransacao(c, async (db) => {
    const [conta] = ids(c, "contaId");
    await exigirCorretor(db, conta!);
    return (await db.query<ClientePortal>(`select ${SELECT_PORTAL} from clientes c where c.conta_id = $1 order by c.nome`, [conta])).rows;
  });
  return ehResposta(r) ? r : c.json<ClientePortal[]>(r);
});

rotasPortal.get("/contas/:contaId/portal/clientes/:id", async (c) => {
  const r = await emTransacao(c, async (db): Promise<FichaPortal> => {
    const [conta, id] = ids(c, "contaId", "id");
    await exigirCorretor(db, conta!);
    const cli = await db.query<ClientePortal>(`select ${SELECT_PORTAL} from clientes c where c.conta_id = $1 and c.id = $2`, [conta, id]);
    if (!cli.rowCount) throw naoEncontrado();
    const anexos = await db.query<FichaPortal["anexos"][number]>(
      `select id, coalesce(tipo_documento, 'outros') as tipo, nome, tamanho, mime, enviado_em as "enviadoEm"
         from arquivos where cliente_id = $1 and apagado_em is null order by enviado_em`,
      [id],
    );
    // sem filtro de tipo aqui: a RLS (historico_ler) já entrega ao corretor só etapa e documento (D-41)
    const historico = await db.query<FichaPortal["historico"][number]>(
      `select id, tipo, texto, criado_em as "criadoEm" from historico where cliente_id = $1 order by criado_em desc, id`,
      [id],
    );
    await db.query(`insert into auditoria (conta_id, usuario_id, acao, entidade, entidade_id) values ($1, meu_usuario_id(), 'ver', 'cliente', $2)`, [conta, id]);
    return { cliente: cli.rows[0]!, anexos: anexos.rows, historico: historico.rows };
  });
  return ehResposta(r) ? r : c.json<FichaPortal>(r);
});
