import { Hono } from "hono";
import type { Pool } from "pg";
import { camposComErro, esquemaCredenciais, esquemaEscritorio } from "../../src/regras/esquemas";
import { TERMOS_VERSAO } from "../../src/regras/planos";
import type { AppTipos } from "../contexto";

export const rotasCadastro = new Hono<AppTipos>();

type Escritorio = { nomeEscritorio: string; documento: string; plano: string };

/** Conta pendente + configuração + gestor + aceite dos termos, num comando só (atômico). */
async function criarEscritorio(system: Pool, usuarioId: string, e: Escritorio): Promise<string> {
  const r = await system.query<{ id: string }>(
    `with c as (insert into contas (nome_escritorio, documento_titular, plano) values ($1, $2, $3::text::plano) returning id),
          cfg as (insert into contas_config (conta_id) select id from c),
          m as (insert into membros (conta_id, usuario_id, perfil) select id, $4, 'gestor' from c),
          u as (update "user" set "termosVersao" = $5, "termosAceitosEm" = now() where id = $4)
     select id from c`,
    [e.nomeEscritorio, e.documento, e.plano, usuarioId, TERMOS_VERSAO],
  );
  return r.rows[0]!.id;
}

// Cadastro aberto (D-33). Deslogado: cria a credencial pelo Better Auth e, se o usuário for novo, o escritório.
// A resposta é a mesma para e-mail novo e existente: não revela quem tem conta.
rotasCadastro.post("/cadastro", async (c) => {
  const corpo = await c.req.json().catch(() => ({}));
  const escritorio = esquemaEscritorio.safeParse(corpo);
  const usuario = c.var.usuario;
  const credenciais = usuario ? null : esquemaCredenciais.safeParse(corpo);
  const erros = [
    ...(credenciais && !credenciais.success ? camposComErro(credenciais.error) : []),
    ...(escritorio.success ? [] : camposComErro(escritorio.error)),
  ];
  if (erros.length || !escritorio.success) return c.json({ erro: "validacao", campos: erros }, 400);

  if (usuario) {
    const contaId = await criarEscritorio(c.var.pools.system, usuario.id, escritorio.data);
    return c.json({ contaId }, 201);
  }

  const { nome, email, senha } = credenciais!.data!;
  // Pelo handler do Better Auth (e não auth.api) para valer o limite de cadastros por IP
  const r = await c.var.auth.handler(
    new Request(new URL("/api/auth/sign-up/email", c.req.url), {
      method: "POST",
      headers: c.req.raw.headers,
      body: JSON.stringify({ name: nome, email, password: senha }),
    }),
  );
  if (r.status === 429) return c.json({ erro: "muitas_tentativas" }, 429);
  if (!r.ok) return c.json({ erro: "validacao", campos: ["senha"] }, 400);
  const { user } = (await r.json()) as { user: { id: string } };
  // e-mail existente: o Better Auth devolve um usuário fictício, que não está no banco
  const novo = await c.var.pools.system.query(
    `select 1 from "user" u where u.id = $1 and not exists (select 1 from membros where usuario_id = u.id)`,
    [user.id],
  );
  if (novo.rowCount) await criarEscritorio(c.var.pools.system, user.id, escritorio.data);
  return c.json({ ok: true });
});
