import { criarCenario, criarCorretor, poolSystem } from "../db/ajudantes";
import type { ConvitePublico, Equipe, Eu } from "../../src/tipos-api";
import { TEST_ENV } from "../test-env";
import { appDeTeste, cookieDe, criarUsuarioVerificado, entrar, gestorComEscritorio, tokenDoEmail } from "./ajudantes";

beforeEach(async () => {
  await criarCenario();
});

const json = async <T>(r: Response) => (await r.json()) as T;

async function cenarioComFuncionaria() {
  const t = appDeTeste();
  const g = await gestorComEscritorio(t.req);
  await t.req(`/api/contas/${g.contaId}/convites`, { body: { email: "func@x.com", perfil: "funcionaria" }, cookie: g.cookie });
  const r = await t.req(`/api/convites/${tokenDoEmail(t.emails.at(-1))}/aceitar`, { body: { nome: "Func", senha: "senha-forte-1", aceitouTermos: true } });
  return { ...t, g, cookieF: cookieDe(r) };
}

test("gestor convida funcionária e o e-mail leva o link", async () => {
  const { req, emails } = appDeTeste();
  const g = await gestorComEscritorio(req);
  const r = await req(`/api/contas/${g.contaId}/convites`, { body: { email: "Func@X.com", perfil: "funcionaria" }, cookie: g.cookie });
  expect(r.status).toBe(201);
  expect(emails.at(-1)).toMatchObject({ para: "func@x.com", assunto: "Convite para Escritório Teste — Central do Correspondente" });
  expect(emails.at(-1)!.texto).toContain(`${TEST_ENV.APP_URL}/convite/`);
  const equipe = await json<Equipe>(await req(`/api/contas/${g.contaId}/equipe`, { cookie: g.cookie }));
  expect(equipe.membros).toEqual([expect.objectContaining({ email: g.email, perfil: "gestor", status: "ativo" })]);
  expect(equipe.convites).toEqual([expect.objectContaining({ email: "func@x.com", perfil: "funcionaria" })]);
});

test("segundo convite de funcionária é recusado", async () => {
  const { req } = appDeTeste();
  const g = await gestorComEscritorio(req);
  await req(`/api/contas/${g.contaId}/convites`, { body: { email: "a@x.com", perfil: "funcionaria" }, cookie: g.cookie });
  const r = await req(`/api/contas/${g.contaId}/convites`, { body: { email: "b@x.com", perfil: "funcionaria" }, cookie: g.cookie });
  expect(r.status).toBe(409);
  expect(await r.json()).toEqual({ erro: "limite_funcionaria" });
});

test("conta Simples não convida", async () => {
  const { req } = appDeTeste();
  const g = await gestorComEscritorio(req, "simples");
  const r = await req(`/api/contas/${g.contaId}/convites`, { body: { email: "a@x.com", perfil: "funcionaria" }, cookie: g.cookie });
  expect(r.status).toBe(409);
  expect(await r.json()).toEqual({ erro: "limite_plano" });
});

test("conta pendente não convida", async () => {
  const { req } = appDeTeste();
  const g = await gestorComEscritorio(req, "com_corretores", { ativa: false });
  const r = await req(`/api/contas/${g.contaId}/convites`, { body: { email: "a@x.com", perfil: "funcionaria" }, cookie: g.cookie });
  expect(r.status).toBe(403);
  expect(await r.json()).toEqual({ erro: "sem_permissao" });
});

test("convite de corretor exige o corretor", async () => {
  const { req } = appDeTeste();
  const g = await gestorComEscritorio(req);
  const r = await req(`/api/contas/${g.contaId}/convites`, { body: { email: "c@x.com", perfil: "corretor" }, cookie: g.cookie });
  expect(r.status).toBe(400);
  expect(await r.json()).toEqual({ erro: "validacao", campos: ["corretorId"] });
});

test("funcionária convida corretor, não funcionária", async () => {
  const { req, g, cookieF } = await cenarioComFuncionaria();
  const corretor = await criarCorretor(g.contaId, "Corretor");
  expect((await req(`/api/contas/${g.contaId}/convites`, { body: { email: "c@x.com", perfil: "corretor", corretorId: corretor }, cookie: cookieF })).status).toBe(201);
  expect((await req(`/api/contas/${g.contaId}/convites`, { body: { email: "f2@x.com", perfil: "funcionaria" }, cookie: cookieF })).status).toBe(403);
});

test("convidar quem já é membro ativo é recusado", async () => {
  const { req, g } = await cenarioComFuncionaria();
  const corretor = await criarCorretor(g.contaId, "Corretor");
  const r = await req(`/api/contas/${g.contaId}/convites`, { body: { email: "FUNC@x.com", perfil: "corretor", corretorId: corretor }, cookie: g.cookie });
  expect(r.status).toBe(409);
  expect(await r.json()).toEqual({ erro: "ja_membro" });
});

test("reenviar invalida o link antigo", async () => {
  const { req, emails } = appDeTeste();
  const g = await gestorComEscritorio(req);
  const r = await req(`/api/contas/${g.contaId}/convites`, { body: { email: "a@x.com", perfil: "funcionaria" }, cookie: g.cookie });
  const { id } = await json<{ id: string }>(r);
  const antigo = tokenDoEmail(emails.at(-1));
  expect((await req(`/api/contas/${g.contaId}/convites/${id}/reenviar`, { method: "POST", cookie: g.cookie })).status).toBe(200);
  const novo = tokenDoEmail(emails.at(-1));
  expect(novo).not.toBe(antigo);
  expect(await json<ConvitePublico>(await req(`/api/convites/${antigo}`))).toEqual({ estado: "invalido" });
  expect(await json<ConvitePublico>(await req(`/api/convites/${novo}`))).toEqual({
    estado: "aberto", nomeEscritorio: "Escritório Teste", email: "a@x.com", perfil: "funcionaria", temConta: false,
  });
});

test("cancelar convite fecha o link", async () => {
  const { req, emails } = appDeTeste();
  const g = await gestorComEscritorio(req);
  const { id } = await json<{ id: string }>(await req(`/api/contas/${g.contaId}/convites`, { body: { email: "a@x.com", perfil: "funcionaria" }, cookie: g.cookie }));
  expect((await req(`/api/contas/${g.contaId}/convites/${id}`, { method: "DELETE", cookie: g.cookie })).status).toBe(204);
  expect(await json(await req(`/api/convites/${tokenDoEmail(emails.at(-1))}`))).toEqual({ estado: "invalido" });
});

test("aceitar sem conta cria usuário confirmado e entra", async () => {
  const { req, g, cookieF } = await cenarioComFuncionaria();
  expect(cookieF).toContain("better-auth.session_token");
  const u = await poolSystem.query(`select "emailVerified" as v, "termosVersao" as t from "user" where email = 'func@x.com'`);
  expect(u.rows[0]).toEqual({ v: true, t: "rascunho-1" });
  const eu = await json<Eu>(await req("/api/eu", { cookie: cookieF }));
  expect(eu.escritorios).toEqual([expect.objectContaining({ contaId: g.contaId, perfil: "funcionaria" })]);
});

test("aceitar sem conta, com e-mail que já tem conta, pede para entrar", async () => {
  const { req, emails } = appDeTeste();
  const g = await gestorComEscritorio(req);
  await criarUsuarioVerificado("tem@x.com", "senha-forte-1", "Tem");
  await req(`/api/contas/${g.contaId}/convites`, { body: { email: "tem@x.com", perfil: "funcionaria" }, cookie: g.cookie });
  const token = tokenDoEmail(emails.at(-1));
  expect(await json<ConvitePublico>(await req(`/api/convites/${token}`))).toMatchObject({ estado: "aberto", temConta: true });
  const r = await req(`/api/convites/${token}/aceitar`, { body: { nome: "Xavier", senha: "outra-senha-1", aceitouTermos: true } });
  expect(r.status).toBe(409);
  expect(await r.json()).toEqual({ erro: "entre_primeiro" });
  const cookie = await entrar(req, "tem@x.com", "senha-forte-1");
  const ok = await req(`/api/convites/${token}/aceitar`, { body: { aceitouTermos: true }, cookie });
  expect(await ok.json()).toEqual({ contaId: g.contaId });
});

test("aceitar logado com outro e-mail é recusado", async () => {
  const { req, emails } = appDeTeste();
  const g = await gestorComEscritorio(req);
  await req(`/api/contas/${g.contaId}/convites`, { body: { email: "a@x.com", perfil: "funcionaria" }, cookie: g.cookie });
  const r = await req(`/api/convites/${tokenDoEmail(emails.at(-1))}/aceitar`, { body: { aceitouTermos: true }, cookie: g.cookie });
  expect(r.status).toBe(409);
  expect(await r.json()).toEqual({ erro: "convite_email_diferente" });
});

test("link expirado mostra inválido, sem 500", async () => {
  const { req, emails } = appDeTeste();
  const g = await gestorComEscritorio(req);
  await req(`/api/contas/${g.contaId}/convites`, { body: { email: "a@x.com", perfil: "funcionaria" }, cookie: g.cookie });
  await poolSystem.query("update convites set expira_em = now() - interval '1 minute' where conta_id = $1", [g.contaId]);
  const token = tokenDoEmail(emails.at(-1));
  expect(await json(await req(`/api/convites/${token}`))).toEqual({ estado: "invalido" });
  const r = await req(`/api/convites/${token}/aceitar`, { body: { nome: "Ana", senha: "senha-forte-1", aceitouTermos: true } });
  expect(r.status).toBe(409);
  expect(await r.json()).toEqual({ erro: "convite_invalido" });
  expect((await req("/api/convites/qualquer-coisa")).status).toBe(200);
});

test("gestor não se desativa", async () => {
  const { req } = appDeTeste();
  const g = await gestorComEscritorio(req);
  const equipe = await json<Equipe>(await req(`/api/contas/${g.contaId}/equipe`, { cookie: g.cookie }));
  const r = await req(`/api/contas/${g.contaId}/membros/${equipe.membros[0]!.id}/desativar`, { method: "POST", cookie: g.cookie });
  expect(r.status).toBe(409);
  expect(await r.json()).toEqual({ erro: "gestor_nao_desativa" });
});

test("membro desativado perde o acesso na hora", async () => {
  const { req, g, cookieF } = await cenarioComFuncionaria();
  const equipe = await json<Equipe>(await req(`/api/contas/${g.contaId}/equipe`, { cookie: g.cookie }));
  const func = equipe.membros.find((m) => m.perfil === "funcionaria")!;
  expect((await req(`/api/contas/${g.contaId}/membros/${func.id}/desativar`, { method: "POST", cookie: g.cookie })).status).toBe(200);
  expect((await req(`/api/contas/${g.contaId}/equipe`, { cookie: cookieF })).status).toBe(404);
  expect((await json<Eu>(await req("/api/eu", { cookie: cookieF }))).escritorios).toEqual([]);
});

test("sessão de outra conta não abre a equipe", async () => {
  const { req } = appDeTeste();
  const g1 = await gestorComEscritorio(req);
  const g2 = await gestorComEscritorio(req);
  const r = await req(`/api/contas/${g1.contaId}/equipe`, { cookie: g2.cookie });
  expect(r.status).toBe(404);
  expect(await r.json()).toEqual({ erro: "escritorio_nao_encontrado" });
});
