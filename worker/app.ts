import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { type Auth, criarAuth } from "./auth";
import { abrirPools, type Pools } from "./db";
import { criarEnvioMailpit, type Email, type EnviarEmail } from "./email";
import type { Env } from "./env";

export type Usuario = { id: string; email: string; nome: string };

export type AppTipos = {
  Bindings: Env;
  Variables: { pools: Pools; auth: Auth; enviar: (e: Email) => void; usuario: Usuario | null };
};

export const exigirUsuario = createMiddleware<AppTipos>(async (c, next) => {
  if (!c.var.usuario) return c.json({ erro: "nao_autenticado" }, 401);
  await next();
});

export function criarApp(deps: { enviarEmail?: EnviarEmail } = {}) {
  const app = new Hono<AppTipos>();

  app.get("/api/saude", (c) => c.json({ ok: true }));

  // Por pedido: conexões, Better Auth, envio de e-mail (depois da resposta) e a sessão.
  app.use("/api/*", async (c, next) => {
    const pools = abrirPools(c.env);
    const enviarEmail = deps.enviarEmail ?? criarEnvioMailpit(c.env.EMAIL_API_URL, c.env.EMAIL_REMETENTE);
    const enviar = (e: Email) =>
      c.executionCtx.waitUntil(enviarEmail(e).catch((err) => console.error("e-mail não enviado", e.assunto, err)));
    const auth = criarAuth(c.env, pools.system, enviar);
    c.set("pools", pools);
    c.set("enviar", enviar);
    c.set("auth", auth);
    try {
      if (c.req.path.startsWith("/api/auth/")) {
        c.set("usuario", null);
      } else {
        const s = await auth.api.getSession({ headers: c.req.raw.headers });
        c.set("usuario", s ? { id: s.user.id, email: s.user.email, nome: s.user.name } : null);
      }
      await next();
    } finally {
      c.executionCtx.waitUntil(pools.fechar());
    }
  });

  app.on(["GET", "POST"], "/api/auth/*", (c) => c.var.auth.handler(c.req.raw));

  app.onError((err, c) => {
    console.error(err);
    return c.json({ erro: "interno" }, 500);
  });

  return app;
}
