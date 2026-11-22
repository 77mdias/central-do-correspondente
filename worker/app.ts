import { Hono } from "hono";
import { criarAuth } from "./auth";
import type { AppTipos } from "./contexto";
import { abrirPools } from "./db";
import { criarEnvio, type Email, type EnviarEmail } from "./email";
import { rotasArquivos } from "./rotas/arquivos";
import { rotasCadastro } from "./rotas/cadastro";
import { rotasClientes } from "./rotas/clientes";
import { rotasConvites } from "./rotas/convites";
import { rotasCorretores } from "./rotas/corretores";
import { rotasEquipe } from "./rotas/equipe";
import { rotasEu } from "./rotas/eu";
import { rotasImportacao } from "./rotas/importacao";
import { rotasVgv } from "./rotas/vgv";

export function criarApp(deps: { enviarEmail?: EnviarEmail } = {}) {
  const app = new Hono<AppTipos>();

  app.get("/api/saude", (c) => c.json({ ok: true }));

  // Por pedido: conexões, Better Auth, envio de e-mail (depois da resposta) e a sessão.
  app.use("/api/*", async (c, next) => {
    const pools = abrirPools(c.env);
    const enviarEmail = deps.enviarEmail ?? criarEnvio(c.env);
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
  app.route("/api", rotasCadastro);
  app.route("/api", rotasEu);
  app.route("/api", rotasEquipe);
  app.route("/api", rotasConvites);
  app.route("/api", rotasClientes);
  app.route("/api", rotasArquivos);
  app.route("/api", rotasCorretores);
  app.route("/api", rotasVgv);
  app.route("/api", rotasImportacao);

  app.onError((err, c) => {
    console.error(err);
    return c.json({ erro: "interno" }, 500);
  });

  return app;
}
