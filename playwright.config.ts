import { defineConfig } from "@playwright/test";
import { E2E_ENV } from "./tests/test-env";

// O e2e sobe o app com o Worker no workerd (vite dev) na porta 3102, contra o banco cc_e2e recriado do zero,
// com os valores fixos de teste (sem CriptEnv). Precisa do Postgres e do Mailpit do compose.
const dbmate = "pnpm exec dbmate --migrations-dir db/migrations --no-dump-schema";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 }, // a primeira carga do vite dev compila sob demanda
  use: { baseURL: "http://localhost:3102", locale: "pt-BR" },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: `(${dbmate} drop || true) && ${dbmate} up && pnpm dev --port 3102`,
    env: { ...E2E_ENV, DATABASE_URL: E2E_ENV.DATABASE_URL_OWNER },
    url: "http://localhost:3102/api/saude",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
