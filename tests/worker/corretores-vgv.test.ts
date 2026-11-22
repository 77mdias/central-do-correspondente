import type { Corretor, Vgv } from "../../src/tipos-api";
import { criarCenario, poolSystem } from "../db/ajudantes";
import { escritorio } from "./cenario";

beforeEach(async () => {
  await criarCenario();
});

type E = Awaited<ReturnType<typeof escritorio>>;
const corretores = (e: E, cookie = e.g) => e.json<Corretor[]>(e.req(`/api/contas/${e.conta}/corretores`, { cookie }));
async function novoCorretor(e: E, body: Record<string, unknown> = { nome: "Ana Corretora", email: "ana@x.com" }, cookie = e.g) {
  const r = await e.req(`/api/contas/${e.conta}/corretores`, { body, cookie });
  expect(r.status).toBe(201);
  return ((await r.json()) as { id: string }).id;
}

test("funcionária cadastra corretor; começa 'sem_acesso'", async () => {
  const e = await escritorio();
  await novoCorretor(e, { nome: "Ana", imobiliaria: "Casa Boa", whatsapp: "(11) 98888-7777" }, e.f);
  expect(await corretores(e, e.f)).toEqual([
    expect.objectContaining({ nome: "Ana", imobiliaria: "Casa Boa", whatsapp: "11988887777", acesso: "sem_acesso" }),
  ]);
});

test("convite aberto vira 'convidado' (RF-45)", async () => {
  const e = await escritorio();
  const id = await novoCorretor(e);
  const r = await e.req(`/api/contas/${e.conta}/convites`, { body: { email: "ana@x.com", perfil: "corretor", corretorId: id }, cookie: e.f });
  expect(r.status).toBe(201);
  expect((await corretores(e))[0]!.acesso).toBe("convidado");
});

test("editar corretor", async () => {
  const e = await escritorio();
  const id = await novoCorretor(e);
  const r = await e.req(`/api/contas/${e.conta}/corretores/${id}`, { method: "PATCH", body: { creci: "123-F" }, cookie: e.f });
  expect(await r.json()).toMatchObject({ nome: "Ana Corretora", creci: "123-F" });
});

test("corretor com cliente não é removido (RF-44); sem cliente, é", async () => {
  const e = await escritorio();
  const id = await novoCorretor(e);
  await e.req(`/api/contas/${e.conta}/clientes`, { body: { nome: "Maria", corretorId: id }, cookie: e.g });
  const r = await e.req(`/api/contas/${e.conta}/corretores/${id}`, { method: "DELETE", cookie: e.g });
  expect(r.status).toBe(409);
  expect(await r.json()).toEqual({ erro: "corretor_com_clientes" });
  const livre = await novoCorretor(e, { nome: "Bruno" });
  expect((await e.req(`/api/contas/${e.conta}/corretores/${livre}`, { method: "DELETE", cookie: e.g })).status).toBe(204);
  expect((await corretores(e)).map((k) => k.nome)).toEqual(["Ana Corretora"]);
});

test("cliente com corretor de outra conta é recusado", async () => {
  const e = await escritorio();
  const r = await e.req(`/api/contas/${e.contaOutro}/corretores`, { body: { nome: "Do outro" }, cookie: e.outro });
  const deFora = ((await r.json()) as { id: string }).id;
  const c = await e.req(`/api/contas/${e.conta}/clientes`, { body: { nome: "Maria", corretorId: deFora }, cookie: e.g });
  expect(c.status).toBe(400);
  expect(await c.json()).toEqual({ erro: "validacao", campos: ["corretorId"] });
});

test("outra conta não vê nem mexe nos corretores", async () => {
  const e = await escritorio();
  const id = await novoCorretor(e);
  expect((await e.req(`/api/contas/${e.conta}/corretores`, { cookie: e.outro })).status).toBe(404);
  expect((await e.req(`/api/contas/${e.contaOutro}/corretores/${id}`, { method: "PATCH", body: { nome: "X" }, cookie: e.outro })).status).toBe(404);
  expect((await e.req(`/api/contas/${e.contaOutro}/corretores/${id}`, { method: "DELETE", cookie: e.outro })).status).toBe(404);
});

test("VGV da gestora bate com a view (RN-09: financiado × percentual ÷ 100)", async () => {
  const e = await escritorio();
  await e.req(`/api/contas/${e.conta}/percentual`, { method: "PUT", body: { percentual: 1.2 }, cookie: e.g });
  const r = await e.req(`/api/contas/${e.conta}/clientes`, { body: { nome: "Maria", valorImovelCentavos: 25000000, valorFinanciadoCentavos: 20000000 }, cookie: e.g });
  const { id } = (await r.json()) as { id: string };
  await e.req(`/api/contas/${e.conta}/clientes/${id}`, { method: "PATCH", body: { dataAssinatura: "2026-03-10" }, cookie: e.g });
  const v = await e.json<Vgv>(e.req(`/api/contas/${e.conta}/vgv`, { cookie: e.g }));
  expect(v.percentualAtual).toBe(1.2);
  expect(v.historicoPercentual.map((h) => h.percentual)).toEqual([1.2]);
  expect(v.linhas).toEqual([
    expect.objectContaining({ nome: "Maria", contratado: true, pctUsado: 1.2, remuneracaoCentavos: 240000, cota: 0.8, dataAssinatura: "2026-03-10" }),
  ]);
});

test("mudar o percentual não muda contrato já assinado (RN-07)", async () => {
  const e = await escritorio();
  await e.req(`/api/contas/${e.conta}/percentual`, { method: "PUT", body: { percentual: 1 }, cookie: e.g });
  const r = await e.req(`/api/contas/${e.conta}/clientes`, { body: { nome: "Maria", valorFinanciadoCentavos: 10000000 }, cookie: e.g });
  const { id } = (await r.json()) as { id: string };
  await e.req(`/api/contas/${e.conta}/clientes/${id}`, { method: "PATCH", body: { dataAssinatura: "2026-03-10" }, cookie: e.g });
  await e.req(`/api/contas/${e.conta}/percentual`, { method: "PUT", body: { percentual: 2 }, cookie: e.g });
  const v = await e.json<Vgv>(e.req(`/api/contas/${e.conta}/vgv`, { cookie: e.g }));
  expect(v.linhas[0]).toMatchObject({ pctUsado: 1, remuneracaoCentavos: 100000 });
  expect(v.historicoPercentual.map((h) => h.percentual)).toEqual([2, 1]);
});

test("funcionária não vê VGV nem muda percentual (403); outra conta, 404", async () => {
  const e = await escritorio();
  expect((await e.req(`/api/contas/${e.conta}/vgv`, { cookie: e.f })).status).toBe(403);
  expect((await e.req(`/api/contas/${e.conta}/percentual`, { method: "PUT", body: { percentual: 5 }, cookie: e.f })).status).toBe(403);
  expect((await e.req(`/api/contas/${e.conta}/vgv`, { cookie: e.outro })).status).toBe(404);
});

test("percentual inválido dá 400; conta pendente não muda (403)", async () => {
  const e = await escritorio();
  expect((await e.req(`/api/contas/${e.conta}/percentual`, { method: "PUT", body: { percentual: 101 }, cookie: e.g })).status).toBe(400);
  await poolSystem.query("update contas set ativa_ate = null, status_assinatura = 'pendente' where id = $1", [e.conta]);
  expect((await e.req(`/api/contas/${e.conta}/percentual`, { method: "PUT", body: { percentual: 2 }, cookie: e.g })).status).toBe(403);
  expect((await e.req(`/api/contas/${e.conta}/corretores`, { body: { nome: "X" }, cookie: e.g })).status).toBe(403);
});
