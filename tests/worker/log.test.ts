import { appDeTeste } from "./ajudantes";

test("erro sem tratamento numa rota: 500 genérico e log sem dados da linha", async () => {
  const t = appDeTeste();
  t.app.get("/api/teste-erro/:id", () => {
    throw Object.assign(new Error('invalid input syntax for type uuid: "Maria 52998224725"'), {
      code: "22P02", severity: "ERROR", routine: "string_to_uuid", detail: "Failing row contains (maria@x.com)",
    });
  });
  const espiao = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const r = await t.req(`/api/teste-erro/${crypto.randomUUID()}`);
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ erro: "interno" });
    const s = JSON.stringify(espiao.mock.calls);
    expect(s).not.toMatch(/Maria|52998224725|maria@x\.com|Failing/);
    expect(espiao.mock.calls[0]![0]).toEqual({ onde: "rota GET /api/teste-erro/:id", nome: "ErroPostgres", codigo: "22P02" });
  } finally {
    espiao.mockRestore();
  }
});
