import { Hono } from "hono";
import { esquemaPercentual } from "../../src/regras/esquemas";
import type { LinhaRemuneracao, Vgv } from "../../src/tipos-api";
import { type AppTipos, exigirUsuario } from "../contexto";
import { corpo, ehResposta, emTransacao, exigirEscritorio, ids, semPermissao } from "./comum";

export const rotasVgv = new Hono<AppTipos>();
rotasVgv.use("/contas/:contaId/*", exigirUsuario);

type LinhaBanco = Omit<LinhaRemuneracao, "pctUsado" | "cota"> & { pctUsado: string | null; cota: string | null };
const num = (v: string | null) => (v == null ? null : Number(v));

/** VGV e comissões (RF-50 a RF-56): só a gestora. A view já filtra por perfil; a rota responde 403 à funcionária. */
rotasVgv.get("/contas/:contaId/vgv", async (c) => {
  const r = await emTransacao(c, async (db): Promise<Vgv> => {
    const [conta] = ids(c, "contaId");
    if ((await exigirEscritorio(db, conta!)) !== "gestor") throw semPermissao();
    const cfg = await db.query<{ p: string }>("select percentual_atual::text as p from contas_config where conta_id = $1", [conta]);
    const hist = await db.query<{ percentual: string; criadoEm: string }>(
      `select percentual::text as percentual, criado_em as "criadoEm" from historico_percentual where conta_id = $1 order by criado_em desc`,
      [conta],
    );
    const linhas = await db.query<LinhaBanco>(
      `select cliente_id as "clienteId", nome, corretor_id as "corretorId", etapa, to_char(data_assinatura, 'YYYY-MM-DD') as "dataAssinatura",
              valor_imovel_centavos as "valorImovelCentavos", valor_financiado_centavos as "valorFinanciadoCentavos", contratado,
              pct_usado::text as "pctUsado", remuneracao_centavos as "remuneracaoCentavos", cota::text as cota,
              to_char(remuneracao_recebida_em, 'YYYY-MM-DD') as "recebidaEm"
         from vw_remuneracao where conta_id = $1 order by nome`,
      [conta],
    );
    return {
      percentualAtual: Number(cfg.rows[0]?.p ?? 0),
      historicoPercentual: hist.rows.map((h) => ({ percentual: Number(h.percentual), criadoEm: h.criadoEm })),
      linhas: linhas.rows.map((l) => ({ ...l, pctUsado: num(l.pctUsado), cota: num(l.cota) })),
    };
  });
  return ehResposta(r) ? r : c.json<Vgv>(r);
});

rotasVgv.put("/contas/:contaId/percentual", async (c) => {
  const r = await emTransacao(c, async (db) => {
    const [conta] = ids(c, "contaId");
    if ((await exigirEscritorio(db, conta!)) !== "gestor") throw semPermissao();
    const { percentual } = await corpo(c, esquemaPercentual);
    const up = await db.query("update contas_config set percentual_atual = $2 where conta_id = $1", [conta, percentual]);
    if (!up.rowCount) throw semPermissao();
    return { percentual };
  });
  return ehResposta(r) ? r : c.json(r);
});
