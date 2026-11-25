import { Hono } from "hono";
import { TERMOS_VERSAO } from "../../src/regras/planos";
import { type AppTipos, exigirUsuario } from "../contexto";

// RF-67: novo aceite quando a versão dos termos muda. Grava como app_system ("user" não tem update para
// app_user), sempre e só para o usuário da sessão; o corpo do pedido é ignorado.
export const rotasTermos = new Hono<AppTipos>();

rotasTermos.post("/termos/aceitar", exigirUsuario, async (c) => {
  await c.var.pools.system.query(`update "user" set "termosVersao" = $1, "termosAceitosEm" = now() where id = $2`, [TERMOS_VERSAO, c.var.usuario!.id]);
  return c.body(null, 204);
});
