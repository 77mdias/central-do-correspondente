import { execSync } from "node:child_process";
import { URL_OWNER_TEST } from "../test-env";

/** Recria o banco de teste do zero com as migrations, uma vez por execução. */
export default function setup() {
  const env = { ...process.env, DATABASE_URL: URL_OWNER_TEST };
  const dbmate = "pnpm exec dbmate --migrations-dir db/migrations --no-dump-schema";
  execSync(`${dbmate} drop`, { env, stdio: "ignore" });
  execSync(`${dbmate} up`, { env, stdio: "pipe" });
}
