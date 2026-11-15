import { Hono } from "hono";
import type { Env } from "./env";

export type AppTipos = { Bindings: Env };

export function criarApp() {
  const app = new Hono<AppTipos>();
  app.get("/api/saude", (c) => c.json({ ok: true }));
  return app;
}
