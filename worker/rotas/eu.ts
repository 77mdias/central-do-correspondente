import { Hono } from "hono";
import { TERMOS_VERSAO } from "../../src/regras/planos";
import type { EscritorioResumo, Eu } from "../../src/tipos-api";
import { type AppTipos, exigirUsuario } from "../contexto";
import { withUser } from "../db";

export const rotasEu = new Hono<AppTipos>();

rotasEu.get("/eu", exigirUsuario, async (c) => {
  const u = c.var.usuario!;
  const r = await withUser(c.var.pools.app, u.id, (db) =>
    db.query<EscritorioResumo>(
      `select m.conta_id as "contaId", c.nome_escritorio as "nomeEscritorio", m.perfil, c.plano,
              c.status_assinatura as "statusAssinatura", conta_ativa(c.id) as ativa
         from membros m join contas c on c.id = m.conta_id
        where m.usuario_id = meu_usuario_id() and m.status = 'ativo'
        order by c.nome_escritorio`,
    ),
  );
  // "user" não tem leitura para app_user: lido como app_system, sempre pelo id da sessão
  const t = await c.var.pools.system.query<{ pendentes: boolean }>(
    `select "termosVersao" is distinct from $1 as pendentes from "user" where id = $2`,
    [TERMOS_VERSAO, u.id],
  );
  return c.json<Eu>({ usuario: { id: u.id, nome: u.nome, email: u.email }, escritorios: r.rows, termosPendentes: t.rows[0]?.pendentes ?? true });
});
