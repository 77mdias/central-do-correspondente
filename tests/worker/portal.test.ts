import { CAMPOS_PORTAL, type ClientePortal, type FichaPortal } from "../../src/tipos-api";
import { criarCenario, poolSystem } from "../db/ajudantes";
import { gestorComEscritorio } from "./ajudantes";
import { corretorLogado, escritorio } from "./cenario";

beforeEach(async () => {
  await criarCenario();
});

type E = Awaited<ReturnType<typeof escritorio>>;
const PDF = new TextEncoder().encode("%PDF-1.4\n%conteúdo de teste\n");

async function novoCliente(e: E, corpo: Record<string, unknown>, conta = e.conta, cookie = e.g) {
  const r = await e.req(`/api/contas/${conta}/clientes`, { body: corpo, cookie });
  if (r.status !== 201) throw new Error(`cliente: ${r.status} ${await r.text()}`);
  return ((await r.json()) as { id: string }).id;
}
const portal = (e: E, cookie: string, conta = e.conta) => e.req(`/api/contas/${conta}/portal/clientes`, { cookie });
const fichaPortal = (e: E, cookie: string, id: string, conta = e.conta) => e.req(`/api/contas/${conta}/portal/clientes/${id}`, { cookie });

/** Escritório com um corretor logado, um cliente dele (com tudo preenchido), um de outro corretor e um direto. */
async function comCorretor() {
  const e = await escritorio();
  const k = await corretorLogado(e, { conta: e.conta, gestora: e.g, nome: "Ana Corretora" });
  const outro = (await e.json<{ id: string }>(e.req(`/api/contas/${e.conta}/corretores`, { body: { nome: "Outro" }, cookie: e.g }))).id;
  const meu = await novoCliente(e, {
    nome: "Maria Souza", cpf: "529.982.247-25", whatsapp: "(11) 98888-7777", email: "maria@x.com", modalidade: "mcmv",
    corretorId: k.corretorId, valorImovelCentavos: 25000000, valorFinanciadoCentavos: 20000000,
  });
  await e.req(`/api/contas/${e.conta}/clientes/${meu}`, {
    method: "PATCH",
    body: { observacoes: "nota interna", numeroContrato: "123", dataAssinatura: "2026-03-10", valorAvaliacaoCentavos: 26000000, fgtsCentavos: 1000 },
    cookie: e.g,
  });
  const deOutro = await novoCliente(e, { nome: "Pedro de Outro", corretorId: outro });
  const direto = await novoCliente(e, { nome: "Carla Direta" });
  return { e, k, meu, deOutro, direto };
}

test("portal lista só os clientes do corretor, com a lista fechada de campos (RF-80)", async () => {
  const { e, k, meu } = await comCorretor();
  const segundo = await novoCliente(e, { nome: "Bruno Segundo", corretorId: k.corretorId });
  const r = await portal(e, k.cookie);
  expect(r.status).toBe(200);
  const lista = (await r.json()) as ClientePortal[];
  expect(lista.map((c) => c.id).sort()).toEqual([meu, segundo].sort());
  for (const c of lista) expect(Object.keys(c).sort()).toEqual([...CAMPOS_PORTAL].sort());
  const m = lista.find((c) => c.id === meu)!;
  expect(m).toMatchObject({ nome: "Maria Souza", whatsapp: "11988887777", email: "maria@x.com", valorImovelCentavos: 25000000, valorFinanciadoCentavos: 20000000 });
  // nada do que é do escritório, nem por acaso em texto
  expect(JSON.stringify(lista)).not.toMatch(/52998224725|nota interna|2026-03-10|26000000/);
});

test("ficha do portal: lista fechada, anexos e histórico só de etapa e documento (D-41)", async () => {
  const { e, k, meu } = await comCorretor();
  await e.req(`/api/contas/${e.conta}/clientes/${meu}/historico`, { body: { texto: "anotação da gestora" }, cookie: e.g });
  await e.req(`/api/contas/${e.conta}/clientes/${meu}/cobrancas`, { body: { meio: "whatsapp" }, cookie: e.g });
  await e.req(`/api/contas/${e.conta}/clientes/${meu}`, { method: "PATCH", body: { etapa: "analise_credito" }, cookie: e.g });
  const f = new FormData();
  f.set("tipo", "rg");
  f.set("arquivo", new File([PDF], "rg.pdf", { type: "application/pdf" }));
  expect((await e.enviar(`/api/contas/${e.conta}/clientes/${meu}/arquivos`, f, e.f)).status).toBe(201);

  const r = await fichaPortal(e, k.cookie, meu);
  expect(r.status).toBe(200);
  const ficha = (await r.json()) as FichaPortal;
  expect(Object.keys(ficha).sort()).toEqual(["anexos", "cliente", "historico"]);
  expect(Object.keys(ficha.cliente).sort()).toEqual([...CAMPOS_PORTAL].sort());
  expect(ficha.cliente.documentos.rg).toBeTruthy();
  expect(ficha.anexos).toEqual([expect.objectContaining({ tipo: "rg", nome: "rg.pdf" })]);
  expect(ficha.anexos[0]).not.toHaveProperty("caminho");
  expect(new Set(ficha.historico.map((h) => h.tipo))).toEqual(new Set(["etapa", "documento"]));
  expect(JSON.stringify(ficha)).not.toMatch(/anotação da gestora|nota interna|Cliente cadastrado|52998224725/);
});

test("abrir a ficha do portal grava 'ver' na auditoria", async () => {
  const { e, k, meu } = await comCorretor();
  await fichaPortal(e, k.cookie, meu);
  const r = await poolSystem.query("select acao, entidade from auditoria where usuario_id = $1 and entidade_id = $2", [k.usuarioId, meu]);
  expect(r.rows).toEqual([{ acao: "ver", entidade: "cliente" }]);
});

test("cliente de outro corretor ou direto pela URL dá 404, sem auditoria", async () => {
  const { e, k, deOutro, direto } = await comCorretor();
  for (const id of [deOutro, direto, crypto.randomUUID(), "nao-e-uuid"]) {
    const r = await fichaPortal(e, k.cookie, id);
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ erro: "nao_encontrado" });
  }
  const n = await poolSystem.query("select 1 from auditoria where usuario_id = $1", [k.usuarioId]);
  expect(n.rowCount).toBe(0);
});

test("corretor que atende duas contas vê em cada uma só os clientes dele ali", async () => {
  const { e, k, meu } = await comCorretor();
  const b = await gestorComEscritorio(e.req);
  await corretorLogado(e, { conta: b.contaId, gestora: b.cookie, email: k.email, cookie: k.cookie });
  const kB = (await poolSystem.query<{ id: string }>("select corretor_id as id from membros where conta_id = $1 and usuario_id = $2", [b.contaId, k.usuarioId])).rows[0]!.id;
  const emB = await novoCliente(e, { nome: "Cliente em B", corretorId: kB }, b.contaId, b.cookie);

  expect(((await (await portal(e, k.cookie)).json()) as ClientePortal[]).map((c) => c.id)).toEqual([meu]);
  expect(((await (await portal(e, k.cookie, b.contaId)).json()) as ClientePortal[]).map((c) => c.id)).toEqual([emB]);
  expect((await fichaPortal(e, k.cookie, emB)).status).toBe(404); // id de B na URL de A
  expect((await fichaPortal(e, k.cookie, meu, b.contaId)).status).toBe(404);
});

test("gestora, funcionária e gestora de outra conta recebem 404 no portal", async () => {
  const { e, meu } = await comCorretor();
  for (const cookie of [e.g, e.f, e.outro]) {
    expect((await portal(e, cookie)).status).toBe(404);
    expect((await fichaPortal(e, cookie, meu)).status).toBe(404);
  }
  expect((await e.req(`/api/contas/${e.conta}/portal/clientes`)).status).toBe(401);
});

test("corretor recebe 404 nas rotas do escritório", async () => {
  const { e, k, meu } = await comCorretor();
  const base = `/api/contas/${e.conta}`;
  for (const caminho of [`${base}/clientes`, `${base}/clientes/${meu}`, `${base}/historico`, `${base}/corretores`, `${base}/vgv`]) {
    expect((await e.req(caminho, { cookie: k.cookie })).status, caminho).toBe(404);
  }
  expect((await e.req(`${base}/clientes`, { body: { nome: "Novo" }, cookie: k.cookie })).status).toBe(404);
  expect((await e.req(`${base}/clientes/${meu}`, { method: "PATCH", body: { nome: "Outro" }, cookie: k.cookie })).status).toBe(404);
});

test("corretor desativado: portal dá 404", async () => {
  const { e, k, meu } = await comCorretor();
  const m = (await poolSystem.query<{ id: string }>("select id from membros where usuario_id = $1 and conta_id = $2", [k.usuarioId, e.conta])).rows[0]!.id;
  expect((await e.req(`/api/contas/${e.conta}/membros/${m}/desativar`, { body: {}, cookie: e.g })).status).toBe(200);
  expect((await portal(e, k.cookie)).status).toBe(404);
  expect((await fichaPortal(e, k.cookie, meu)).status).toBe(404);
});
