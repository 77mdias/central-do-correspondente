import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    passWithNoTests: true, // os testes de unidade só chegam na tarefa 8
    projects: [
      { extends: true, test: { name: "unit", include: ["src/**/*.test.ts"] } },
      { extends: true, test: { name: "db", include: ["tests/db/**/*.test.ts"], fileParallelism: false, globalSetup: ["tests/db/global-setup.ts"] } },
      { extends: true, test: { name: "worker", include: ["tests/worker/**/*.test.ts"], fileParallelism: false, globalSetup: ["tests/db/global-setup.ts"] } },
    ],
  },
});
