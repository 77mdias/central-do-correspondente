// Valores fixos de desenvolvimento para testes e CI (não são segredos). Postgres do compose na porta 5435.
import type { Env } from "../worker/env";

const pg = (papel: string, banco: string) => `postgres://${papel}:${papel}@localhost:5435/${banco}`;
const hd = (connectionString: string) => ({ connectionString }) as unknown as Hyperdrive;

export const URL_OWNER_TEST = "postgres://postgres:postgres@localhost:5435/cc_test?sslmode=disable";
export const URL_OWNER_E2E = "postgres://postgres:postgres@localhost:5435/cc_e2e?sslmode=disable";

export const TEST_ENV = {
  DB_APP: hd(pg("app_user", "cc_test")),
  DB_SYSTEM: hd(pg("app_system", "cc_test")),
  APP_URL: "http://localhost:3002",
  BETTER_AUTH_SECRET: "segredo-fixo-de-teste-com-mais-de-32-caracteres",
  EMAIL_API_URL: "http://localhost:8028/api/v1/send",
  EMAIL_REMETENTE: "Central do Correspondente <nao-responda@localhost>",
} satisfies Omit<Env, "ASSETS">;

export const E2E_ENV = {
  CLOUDFLARE_ENV: "e2e",
  CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_DB_APP: pg("app_user", "cc_e2e"),
  CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_DB_SYSTEM: pg("app_system", "cc_e2e"),
  DATABASE_URL_OWNER: URL_OWNER_E2E,
  BETTER_AUTH_SECRET: TEST_ENV.BETTER_AUTH_SECRET,
  EMAIL_API_URL: TEST_ENV.EMAIL_API_URL,
};
