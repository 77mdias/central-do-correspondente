import { criarApp } from "../../worker/app";
import { TEST_ENV } from "../test-env";

test("GET /api/saude responde ok", async () => {
  const r = await criarApp().request("/api/saude", {}, TEST_ENV);
  expect(r.status).toBe(200);
  expect(await r.json()).toEqual({ ok: true });
});
