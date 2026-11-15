import { Hono } from "hono";
import { camposComErro, esquemaConvite } from "../../src/regras/esquemas";
import type { Equipe } from "../../src/tipos-api";
import { type AppTipos, exigirUsuario } from "../contexto";
import { gerarToken } from "../convites";
import { erroDoBanco, withUser } from "../db";
import { emailConvite } from "../emails";

export const rotasEquipe = new Hono<AppTipos>();
rotasEquipe.use("/contas/:contaId/*", exigirUsuario);

const naoEncontrado = { erro: "escritorio_nao_encontrado" } as const;

rotasEquipe.get("/contas/:contaId/equipe", async (c) => {
  const conta = c.req.param("contaId");
  const r = await withUser(c.var.pools.app, c.var.usuario!.id, async (db) => {
    const p = await db.query<{ ok: boolean }>("select coalesce(sou_escritorio($1), false) as ok", [conta]);
    if (!p.rows[0]!.ok) return null;
    const membros = await db.query<Equipe["membros"][number]>("select * from equipe_membros($1)", [conta]);
    const convites = await db.query<Equipe["convites"][number]>(
      `select id, email, perfil, expira_em as "expiraEm" from convites
        where conta_id = $1 and aceito_em is null and revogado_em is null and expira_em > now() order by criado_em`,
      [conta],
    );
    return { membros: membros.rows, convites: convites.rows };
  }).catch(() => null); // id que não é uuid cai aqui também
  return r ? c.json<Equipe>(r) : c.json(naoEncontrado, 404);
});

rotasEquipe.post("/contas/:contaId/convites", async (c) => {
  const conta = c.req.param("contaId");
  const u = c.var.usuario!;
  const dados = esquemaConvite.safeParse(await c.req.json().catch(() => ({})));
  if (!dados.success) return c.json({ erro: "validacao", campos: camposComErro(dados.error) }, 400);
  const { email, perfil, corretorId } = dados.data;
  if (perfil === "corretor" && !corretorId) return c.json({ erro: "validacao", campos: ["corretorId"] }, 400);

  const { token, hash } = await gerarToken();
  try {
    const r = await withUser(c.var.pools.app, u.id, async (db) => {
      const conta_ = await db.query<{ nome: string }>("select nome_escritorio as nome from contas where id = $1", [conta]);
      if (!conta_.rowCount) return null;
      // já é membro ativo? (o e-mail mora na tabela do Better Auth: consulta de sistema filtrada pela conta)
      const ja = await c.var.pools.system.query(
        `select 1 from membros m join "user" u on u.id = m.usuario_id where m.conta_id = $1 and lower(u.email) = $2 and m.status = 'ativo'`,
        [conta, email],
      );
      if (ja.rowCount) throw new Error("ja_membro");
      const ins = await db.query<{ id: string }>(
        `insert into convites (conta_id, email, perfil, corretor_id, token_hash, convidado_por) values ($1, $2, $3, $4, $5, $6) returning id`,
        [conta, email, perfil, corretorId ?? null, hash, u.id],
      );
      return { id: ins.rows[0]!.id, nomeEscritorio: conta_.rows[0]!.nome };
    });
    if (!r) return c.json(naoEncontrado, 404);
    c.var.enviar({ para: email, ...emailConvite(`${c.env.APP_URL}/convite/${token}`, r.nomeEscritorio, perfil) });
    return c.json({ id: r.id }, 201);
  } catch (e) {
    const erro = erroDoBanco(e);
    if (erro) return c.json({ erro: erro.erro }, erro.status);
    throw e;
  }
});

rotasEquipe.post("/contas/:contaId/convites/:id/reenviar", async (c) => {
  const { contaId, id } = c.req.param();
  const { token, hash } = await gerarToken();
  try {
    const r = await withUser(c.var.pools.app, c.var.usuario!.id, async (db) => {
      const up = await db.query<{ email: string; perfil: "funcionaria" | "corretor" }>(
        `update convites set token_hash = $1, expira_em = now() + interval '7 days'
          where id = $2 and conta_id = $3 and aceito_em is null and revogado_em is null returning email, perfil`,
        [hash, id, contaId],
      );
      const nome = await db.query<{ nome: string }>("select nome_escritorio as nome from contas where id = $1", [contaId]);
      return up.rows[0] ? { ...up.rows[0], nomeEscritorio: nome.rows[0]!.nome } : null;
    });
    if (!r) return c.json({ erro: "convite_nao_encontrado" }, 404);
    c.var.enviar({ para: r.email, ...emailConvite(`${c.env.APP_URL}/convite/${token}`, r.nomeEscritorio, r.perfil) });
    return c.json({ ok: true });
  } catch (e) {
    const erro = erroDoBanco(e);
    if (erro) return c.json({ erro: erro.erro }, erro.status);
    throw e;
  }
});

rotasEquipe.delete("/contas/:contaId/convites/:id", async (c) => {
  const { contaId, id } = c.req.param();
  const r = await withUser(c.var.pools.app, c.var.usuario!.id, (db) =>
    db.query("update convites set revogado_em = now() where id = $1 and conta_id = $2 and revogado_em is null and aceito_em is null returning id", [id, contaId]),
  );
  return r.rowCount ? c.body(null, 204) : c.json({ erro: "convite_nao_encontrado" }, 404);
});

rotasEquipe.post("/contas/:contaId/membros/:id/desativar", async (c) => {
  const { contaId, id } = c.req.param();
  const r = await withUser(c.var.pools.app, c.var.usuario!.id, async (db) => {
    const alvo = await db.query<{ perfil: string }>("select perfil from membros where id = $1 and conta_id = $2", [id, contaId]);
    if (!alvo.rows[0]) return "nao_encontrado" as const;
    if (alvo.rows[0].perfil === "gestor") return "gestor" as const;
    const up = await db.query("update membros set status = 'desativado' where id = $1 and conta_id = $2 returning id", [id, contaId]);
    return up.rowCount ? ("ok" as const) : ("sem_permissao" as const);
  });
  if (r === "ok") return c.json({ ok: true });
  if (r === "gestor") return c.json({ erro: "gestor_nao_desativa" }, 409);
  if (r === "sem_permissao") return c.json({ erro: "sem_permissao" }, 403);
  return c.json({ erro: "membro_nao_encontrado" }, 404);
});
