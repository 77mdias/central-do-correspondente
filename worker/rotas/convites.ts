import { Hono } from "hono";
import { camposComErro, esquemaAceite } from "../../src/regras/esquemas";
import { TERMOS_VERSAO } from "../../src/regras/planos";
import type { ConvitePublico } from "../../src/tipos-api";
import type { AppTipos } from "../contexto";
import { hashToken } from "../convites";
import { erroDoBanco } from "../db";

// Rotas públicas do link do convite. O token prova que a pessoa recebeu o e-mail.
export const rotasConvites = new Hono<AppTipos>();

type Aberto = Extract<ConvitePublico, { estado: "aberto" }>;

async function conviteAberto(c: { var: AppTipos["Variables"] }, token: string): Promise<(Aberto & { hash: string }) | null> {
  const hash = await hashToken(token);
  const r = await c.var.pools.system.query<Omit<Aberto, "estado">>(
    `select ct.nome_escritorio as "nomeEscritorio", v.email, v.perfil,
            exists (select 1 from "user" u where lower(u.email) = v.email) as "temConta"
       from convites v join contas ct on ct.id = v.conta_id
      where v.token_hash = $1 and v.aceito_em is null and v.revogado_em is null and v.expira_em > now()`,
    [hash],
  );
  return r.rows[0] ? { estado: "aberto", ...r.rows[0], hash } : null;
}

rotasConvites.get("/convites/:token", async (c) => {
  const v = await conviteAberto(c, c.req.param("token"));
  if (!v) return c.json<ConvitePublico>({ estado: "invalido" });
  return c.json<ConvitePublico>({ estado: "aberto", nomeEscritorio: v.nomeEscritorio, email: v.email, perfil: v.perfil, temConta: v.temConta });
});

rotasConvites.post("/convites/:token/aceitar", async (c) => {
  const dados = esquemaAceite.safeParse(await c.req.json().catch(() => ({})));
  if (!dados.success) return c.json({ erro: "validacao", campos: camposComErro(dados.error) }, 400);
  const v = await conviteAberto(c, c.req.param("token"));
  if (!v) return c.json({ erro: "convite_invalido" }, 409);
  const system = c.var.pools.system;
  const aceitar = async (usuarioId: string) => {
    const r = await system.query<{ conta: string }>("select aceitar_convite($1, $2) as conta", [v.hash, usuarioId]);
    await system.query(`update "user" set "termosVersao" = $1, "termosAceitosEm" = now() where id = $2`, [TERMOS_VERSAO, usuarioId]);
    return r.rows[0]!.conta;
  };

  try {
    if (c.var.usuario) return c.json({ contaId: await aceitar(c.var.usuario.id) });

    if (v.temConta) return c.json({ erro: "entre_primeiro" }, 409);
    const { nome, senha } = dados.data;
    if (!nome || !senha) return c.json({ erro: "validacao", campos: [!nome && "nome", !senha && "senha"].filter(Boolean) }, 400);
    const base = new URL(c.req.url);
    const pelo = (caminho: string, corpo: object) =>
      c.var.auth.handler(new Request(new URL(caminho, base), { method: "POST", headers: c.req.raw.headers, body: JSON.stringify(corpo) }));

    const cad = await pelo("/api/auth/sign-up/email", { name: nome, email: v.email, password: senha });
    if (cad.status === 429) return c.json({ erro: "muitas_tentativas" }, 429);
    if (!cad.ok) return c.json({ erro: "validacao", campos: ["senha"] }, 400);
    const { user } = (await cad.json()) as { user: { id: string } };
    // o link do convite prova que ela recebeu o e-mail: conta confirmada
    const conf = await system.query(`update "user" set "emailVerified" = true where id = $1 returning id`, [user.id]);
    if (!conf.rowCount) return c.json({ erro: "entre_primeiro" }, 409); // conta criada por outro caminho no meio do caminho
    const contaId = await aceitar(user.id);

    const login = await pelo("/api/auth/sign-in/email", { email: v.email, password: senha });
    const resp = c.json({ contaId });
    for (const ck of login.headers.getSetCookie()) resp.headers.append("set-cookie", ck);
    return resp;
  } catch (e) {
    const erro = erroDoBanco(e);
    if (erro) return c.json({ erro: erro.erro }, erro.status);
    throw e;
  }
});
