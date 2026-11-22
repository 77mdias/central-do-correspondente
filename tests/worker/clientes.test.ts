import type { ClienteLista, Ficha } from "../../src/tipos-api";
import { DOCUMENTOS } from "../../src/regras/catalogo";
import { criarCenario, poolSystem } from "../db/ajudantes";
import { escritorio, hojeBanco, somarDiasBanco } from "./cenario";

beforeEach(async () => {
  await criarCenario();
});

type E = Awaited<ReturnType<typeof escritorio>>;
const base = (e: E) => `/api/contas/${e.conta}/clientes`;
async function novo(e: E, body: Record<string, unknown> = { nome: "Maria Souza" }, cookie = e.g) {
  const r = await e.req(base(e), { body, cookie });
  expect(r.status).toBe(201);
  return ((await r.json()) as { id: string }).id;
}
const lista = (e: E, cookie = e.g) => e.json<ClienteLista[]>(e.req(base(e), { cookie }));
const ficha = (e: E, id: string, cookie = e.g) => e.json<Ficha>(e.req(`${base(e)}/${id}`, { cookie }));

test("gestora cadastra e o cliente nasce como no RF-11, com a nota de cadastro", async () => {
  const e = await escritorio();
  const id = await novo(e, { nome: " Maria Souza ", cpf: "529.982.247-25", whatsapp: "(11) 98888-7777", valorImovelCentavos: 35000000 });
  const f = await ficha(e, id);
  expect(f.cliente).toMatchObject({
    nome: "Maria Souza", cpf: "52998224725", whatsapp: "11988887777", etapa: "documentacao_pendente",
    intervaloCobranca: 3, proximaCobranca: await hojeBanco(), qtdCobrancas: 0, valorImovelCentavos: 35000000,
  });
  expect(f.historico.map((h) => h.texto)).toEqual(["Cliente cadastrado · Cliente direto"]);
});

test("funcionária cadastra, lista e edita", async () => {
  const e = await escritorio();
  const id = await novo(e, { nome: "João" }, e.f);
  const r = await e.req(`${base(e)}/${id}`, { method: "PATCH", body: { etapa: "analise_credito" }, cookie: e.f });
  expect(r.status).toBe(200);
  expect((await lista(e, e.f)).map((c) => [c.nome, c.etapa])).toEqual([["João", "analise_credito"]]);
});

test("a lista não traz nenhum campo de percentual ou remuneração (RN-17)", async () => {
  const e = await escritorio();
  await novo(e);
  const [c] = await lista(e, e.f);
  expect(Object.keys(c!).filter((k) => /pct|percent|remunera/i.test(k))).toEqual([]);
});

test("ficha da funcionária sem remuneração; da gestora com", async () => {
  const e = await escritorio();
  const id = await novo(e, { nome: "X", valorFinanciadoCentavos: 20000000 });
  expect("remuneracao" in (await ficha(e, id, e.f))).toBe(false);
  expect((await ficha(e, id)).remuneracao).toEqual({ pctUsado: 0, remuneracaoCentavos: 0, pctContrato: null, pctProprio: null, recebidaEm: null });
});

test("abrir a ficha grava auditoria 'ver' em nome de quem abriu", async () => {
  const e = await escritorio();
  const id = await novo(e);
  await ficha(e, id, e.f);
  const r = await poolSystem.query("select acao, entidade from auditoria where entidade_id = $1 and acao = 'ver'", [id]);
  expect(r.rows).toEqual([{ acao: "ver", entidade: "cliente" }]);
});

test("dois PATCH em campos diferentes mantêm os dois", async () => {
  const e = await escritorio();
  const id = await novo(e);
  await Promise.all([
    e.req(`${base(e)}/${id}`, { method: "PATCH", body: { email: "m@x.com" }, cookie: e.g }),
    e.req(`${base(e)}/${id}`, { method: "PATCH", body: { observacoes: "liga à tarde" }, cookie: e.f }),
  ]);
  expect((await ficha(e, id)).cliente).toMatchObject({ nome: "Maria Souza", email: "m@x.com", observacoes: "liga à tarde" });
});

test("CPF inválido no PATCH dá 400 com o campo", async () => {
  const e = await escritorio();
  const id = await novo(e);
  const r = await e.req(`${base(e)}/${id}`, { method: "PATCH", body: { cpf: "123.456.789-00" }, cookie: e.g });
  expect(r.status).toBe(400);
  expect(await r.json()).toEqual({ erro: "validacao", campos: ["cpf"] });
});

test("mudar a etapa para concluído grava a data de assinatura e o histórico (gatilho, RN-06)", async () => {
  const e = await escritorio();
  const id = await novo(e);
  const c = await e.json<ClienteLista>(e.req(`${base(e)}/${id}`, { method: "PATCH", body: { etapa: "concluido" }, cookie: e.g }));
  expect(c.dataAssinatura).toBe(await hojeBanco());
  expect((await ficha(e, id)).historico.map((h) => h.tipo)).toEqual(expect.arrayContaining(["etapa", "contrato"]));
});

test("marcar documento grava hoje e a nota; o último fecha a documentação", async () => {
  const e = await escritorio();
  const id = await novo(e);
  for (const d of DOCUMENTOS.slice(0, -1)) await e.req(`${base(e)}/${id}/documentos/${d.codigo}`, { method: "PUT", body: { recebido: true }, cookie: e.f });
  const c = await e.json<ClienteLista>(e.req(`${base(e)}/${id}/documentos/form`, { method: "PUT", body: { recebido: true }, cookie: e.f }));
  expect(c.documentos.form).toBe(await hojeBanco());
  expect((await ficha(e, id)).historico[0]!.texto).toBe("Recebido: Formulários assinados · documentação completa");
  const d = await e.json<ClienteLista>(e.req(`${base(e)}/${id}/documentos/form`, { method: "PUT", body: { recebido: false }, cookie: e.f }));
  expect(d.documentos.form).toBeNull();
  expect((await e.req(`${base(e)}/${id}/documentos/xyz`, { method: "PUT", body: { recebido: true }, cookie: e.f })).status).toBe(404);
});

test("cobrança registrada: contador, próxima pelo intervalo e nota do tipo cobrança", async () => {
  const e = await escritorio();
  const id = await novo(e);
  await e.req(`${base(e)}/${id}`, { method: "PATCH", body: { intervaloCobranca: 7 }, cookie: e.g });
  const c = await e.json<ClienteLista>(e.req(`${base(e)}/${id}/cobrancas`, { body: { meio: "whatsapp" }, cookie: e.f }));
  expect(c).toMatchObject({ qtdCobrancas: 1, proximaCobranca: await somarDiasBanco(7) });
  const h = (await ficha(e, id)).historico[0]!;
  expect(h.tipo).toBe("cobranca");
  expect(h.texto).toMatch(/^Cobrança enviada pelo WhatsApp: RG ou CNH, CPF, .*\. Próxima em \d\d\/\d\d$/);
});

test("cobrança sem documento faltando dá 409", async () => {
  const e = await escritorio();
  const id = await novo(e);
  for (const d of DOCUMENTOS) await e.req(`${base(e)}/${id}/documentos/${d.codigo}`, { method: "PUT", body: { recebido: true }, cookie: e.g });
  const r = await e.req(`${base(e)}/${id}/cobrancas`, { body: { meio: "copiada" }, cookie: e.g });
  expect(r.status).toBe(409);
  expect(await r.json()).toEqual({ erro: "sem_cobranca" });
});

test("nota livre no histórico", async () => {
  const e = await escritorio();
  const id = await novo(e);
  expect((await e.req(`${base(e)}/${id}/historico`, { body: { texto: "Ligou, vai mandar amanhã" }, cookie: e.f })).status).toBe(201);
  expect((await ficha(e, id)).historico[0]!.texto).toBe("Ligou, vai mandar amanhã");
});

test("remuneração: gestora define percentual próprio; funcionária não", async () => {
  const e = await escritorio();
  const id = await novo(e, { nome: "X", valorFinanciadoCentavos: 20000000 });
  expect((await e.req(`${base(e)}/${id}/remuneracao`, { method: "PATCH", body: { pctProprio: 1.5 }, cookie: e.f })).status).toBe(403);
  expect((await e.req(`${base(e)}/${id}/remuneracao`, { method: "PATCH", body: { pctProprio: 1.5 }, cookie: e.g })).status).toBe(200);
  expect((await ficha(e, id)).remuneracao).toMatchObject({ pctProprio: 1.5, pctUsado: 1.5, remuneracaoCentavos: 300000 });
});

test("excluir apaga o cliente", async () => {
  const e = await escritorio();
  const id = await novo(e);
  expect((await e.req(`${base(e)}/${id}`, { method: "DELETE", cookie: e.f })).status).toBe(204);
  expect(await lista(e)).toEqual([]);
});

test("cliente de outra conta: 404 em todas as rotas", async () => {
  const e = await escritorio();
  const id = await novo(e);
  const outroBase = `/api/contas/${e.conta}/clientes`;
  const pedidos: [string, string, unknown?][] = [
    ["GET", outroBase], ["GET", `${outroBase}/${id}`], ["PATCH", `${outroBase}/${id}`, { nome: "Y" }],
    ["DELETE", `${outroBase}/${id}`], ["PUT", `${outroBase}/${id}/documentos/rg`, { recebido: true }],
    ["POST", `${outroBase}/${id}/historico`, { texto: "x" }], ["POST", `${outroBase}/${id}/cobrancas`, { meio: "whatsapp" }],
  ];
  for (const [method, url, body] of pedidos) expect((await e.req(url, { method, body, cookie: e.outro })).status, `${method} ${url}`).toBe(404);
  // o próprio escritório dela com o id do cliente da conta A também não abre
  expect((await e.req(`/api/contas/${e.contaOutro}/clientes/${id}`, { cookie: e.outro })).status).toBe(404);
  expect((await e.req(`${outroBase}/nao-e-uuid`, { cookie: e.g })).status).toBe(404);
});

test("conta pendente não grava (403), mas lê", async () => {
  const e = await escritorio();
  const id = await novo(e);
  await poolSystem.query("update contas set ativa_ate = null, status_assinatura = 'pendente' where id = $1", [e.conta]);
  expect((await e.req(base(e), { body: { nome: "Novo" }, cookie: e.g })).status).toBe(403);
  expect((await e.req(`${base(e)}/${id}`, { method: "PATCH", body: { nome: "Y" }, cookie: e.g })).status).toBe(403);
  expect((await e.req(`${base(e)}/${id}/documentos/rg`, { method: "PUT", body: { recebido: true }, cookie: e.g })).status).toBe(403);
  expect((await e.req(`${base(e)}/${id}/historico`, { body: { texto: "x" }, cookie: e.g })).status).toBe(403);
  expect((await e.req(`${base(e)}/${id}/cobrancas`, { body: { meio: "whatsapp" }, cookie: e.g })).status).toBe(403);
  expect((await e.req(`${base(e)}/${id}`, { method: "DELETE", cookie: e.g })).status).toBe(403);
  expect((await lista(e)).length).toBe(1);
});
