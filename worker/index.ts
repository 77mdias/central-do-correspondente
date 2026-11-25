import { criarApp } from "./app";
import { abrirPools } from "./db";
import { criarEnvio } from "./email";
import { registrarErro } from "./log";
import type { Env } from "./env";
import { rotinaAnexos } from "./rotinas/anexos";
import { criarS3 } from "./s3";

/** Cron diário (wrangler.jsonc, 6h UTC = 3h de Brasília): rotina de anexos (RF-27). */
async function rotinasDiarias(env: Env) {
  const pools = abrirPools(env);
  try {
    const r = await rotinaAnexos({ pool: pools.system, s3: criarS3(env), enviar: criarEnvio(env), appUrl: env.APP_URL });
    console.log("rotina de anexos", r); // só contagens
  } catch (e) {
    // sem relançar: o erro sem tratamento iria para o log com a mensagem inteira
    registrarErro("rotina diária", e);
  } finally {
    await pools.fechar();
  }
}

export default {
  fetch: criarApp().fetch,
  scheduled(_evento, env, ctx) {
    ctx.waitUntil(rotinasDiarias(env));
  },
} satisfies ExportedHandler<Env>;
