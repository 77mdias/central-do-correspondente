import { Hono } from "hono";
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
  return c.json<Eu>({ usuario: { id: u.id, nome: u.nome, email: u.email }, escritorios: r.rows });
});
