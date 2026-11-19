import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    passWithNoTests: true,
    // o cenário dos testes de banco recria tudo; sob carga passa de 10 s, e um hook vencido deixa o próximo cenário colidir
    hookTimeout: 30_000,
    projects: [
      { extends: true, test: { name: "unit", include: ["src/**/*.test.ts", "worker/**/*.test.ts"] } },
      { extends: true, test: { name: "db", include: ["tests/db/**/*.test.ts"], fileParallelism: false, globalSetup: ["tests/db/global-setup.ts"] } },
      { extends: true, test: { name: "worker", include: ["tests/worker/**/*.test.ts"], fileParallelism: false, globalSetup: ["tests/db/global-setup.ts"] } },
    ],
  },
});
