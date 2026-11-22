import { readFileSync } from "node:fs";
import type { ClienteLista, Corretor } from "../../src/tipos-api";
import { criarCenario } from "../db/ajudantes";
import { escritorio } from "./cenario";

const EXEMPLO = readFileSync(new URL("../fixtures/prototipo-exemplo.json", import.meta.url), "utf8");

beforeEach(async () => {
  await criarCenario();
});

type E = Awaited<ReturnType<typeof escritorio>>;
const importar = (e: E, corpo: unknown = JSON.parse(EXEMPLO), cookie = e.g, conta = e.conta) =>
  e.req(`/api/contas/${conta}/importacao`, { body: corpo, cookie });

test("gestora importa o exemplo e as telas passam a ver os dados", async () => {
  const e = await escritorio();
  const r = await importar(e);
  expect(r.status).toBe(200);
  expect(await r.json()).toEqual({ corretores: 2, clientes: 4, documentos: 3, notas: 4 });
  const clientes = await e.json<ClienteLista[]>(e.req(`/api/contas/${e.conta}/clientes`, { cookie: e.f }));
  expect(clientes.map((c) => c.nome)).toEqual(["Carla Inventada", "Diego Inventado", "Elisa Inventada", "Sem nome"]);
  const corretores = await e.json<Corretor[]>(e.req(`/api/contas/${e.conta}/corretores`, { cookie: e.f }));
  expect(corretores.map((k) => k.nome)).toEqual(["Ana Exemplo", "Bruno Exemplo"]);
});

test("segunda vez na mesma conta: 409 ja_importado", async () => {
  const e = await escritorio();
  await importar(e);
  const r = await importar(e);
  expect(r.status).toBe(409);
  expect(await r.json()).toEqual({ erro: "ja_importado" }); // conferido antes de "conta não vazia"
});

test("a mesma cópia do protótipo em outra conta: 409 origem_usada", async () => {
  const e = await escritorio();
  await importar(e);
  const r = await importar(e, JSON.parse(EXEMPLO), e.outro, e.contaOutro);
  expect(r.status).toBe(409);
  expect(await r.json()).toEqual({ erro: "origem_usada" });
});

test("arquivo de outro formato ou que não é JSON: 400", async () => {
  const e = await escritorio();
  const r = await importar(e, { ...JSON.parse(EXEMPLO), formato: "outra-coisa" });
  expect(r.status).toBe(400);
  expect(await r.json()).toMatchObject({ erro: "arquivo_invalido", mensagem: "Este arquivo não é uma exportação do protótipo" });
  const t = await e.app.request(
    `/api/contas/${e.conta}/importacao`,
    { method: "POST", headers: { origin: "http://localhost:3002", cookie: e.g }, body: "{não é json" },
    (await import("../test-env")).TEST_ENV,
    (await import("./ajudantes")).ctxDeTeste,
  );
  expect(t.status).toBe(400);
});

test("funcionária: 403; outra conta: 404", async () => {
  const e = await escritorio();
  expect((await importar(e, JSON.parse(EXEMPLO), e.f)).status).toBe(403);
  expect((await importar(e, JSON.parse(EXEMPLO), e.outro)).status).toBe(404);
});
