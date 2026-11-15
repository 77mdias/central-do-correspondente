import { createMiddleware } from "hono/factory";
import type { Auth } from "./auth";
import type { Pools } from "./db";
import type { Email } from "./email";
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
