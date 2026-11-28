import { TERMOS_VERSAO } from "../../src/regras/planos";
import { criarCenario, linha, poolSystem } from "../db/ajudantes";
import type { Eu } from "../../src/tipos-api";
import { emailContaExistente } from "../../worker/emails";
import { appDeTeste, criarUsuarioVerificado, entrar } from "./ajudantes";

beforeEach(async () => {
  await criarCenario();
});

const escritorio = { nomeEscritorio: "Escritório Novo", documento: "123.456.789-09", plano: "com_corretores", aceitouTermos: true };
const novo = { nome: "Gestora Nova", email: "gestora@x.com", senha: "senha-forte-1", ...escritorio };
const contas = async () => Number((await linha<{ n: string }>("select count(*) as n from contas")).n);

test("cadastro deslogado cria usuário, conta pendente e gestor", async () => {
  const { req, emails } = appDeTeste();
  const r = await req("/api/cadastro", { body: novo });
  expect(r.status).toBe(200);
  expect(await r.json()).toEqual({ ok: true });
  const u = await linha(`select id, "emailVerified" as v, "termosVersao" as t from "user" where email = 'gestora@x.com'`);
  expect(u).toMatchObject({ v: false, t: TERMOS_VERSAO });
  const c = await linha(
    "select c.status_assinatura, c.plano, c.documento_titular, m.perfil, m.status from contas c join membros m on m.conta_id = c.id where m.usuario_id = $1",
    [u.id],
  );
  expect(c).toEqual({ status_assinatura: "pendente", plano: "com_corretores", documento_titular: "12345678909", perfil: "gestor", status: "ativo" });
  expect(emails.map((e) => e.assunto)).toEqual(["Confirme seu e-mail — Central do Correspondente"]);
});

test("cadastro com e-mail existente responde igual e não cria conta", async () => {
  const { req, emails } = appDeTeste();
  await criarUsuarioVerificado("gestora@x.com", "outra-senha-1", "Já Existe");
  const antes = await contas();
  const r = await req("/api/cadastro", { body: novo });
  expect(r.status).toBe(200);
  expect(await r.json()).toEqual({ ok: true });
  expect(await contas()).toBe(antes);
  expect(emails.map((e) => e.assunto)).toEqual([emailContaExistente("", "").assunto]);
});

test("documento inválido devolve os campos", async () => {
  const { req } = appDeTeste();
  const r = await req("/api/cadastro", { body: { ...novo, documento: "111.111.111-11" } });
  expect(r.status).toBe(400);
  expect(await r.json()).toEqual({ erro: "validacao", campos: ["documento"] });
});

test("sem aceitar os termos não cadastra", async () => {
  const { req } = appDeTeste();
  const r = await req("/api/cadastro", { body: { ...novo, aceitouTermos: false } });
  expect(await r.json()).toEqual({ erro: "validacao", campos: ["aceitouTermos"] });
});

test("deslogado sem credenciais devolve os campos que faltam", async () => {
  const { req } = appDeTeste();
  const r = await req("/api/cadastro", { body: escritorio });
  expect(r.status).toBe(400);
  expect(((await r.json()) as { campos: string[] }).campos).toEqual(["nome", "email", "senha"]);
});

test("logado cria outro escritório", async () => {
  const { req } = appDeTeste();
  await criarUsuarioVerificado("logada@x.com", "senha-forte-1", "Logada");
  const cookie = await entrar(req, "logada@x.com", "senha-forte-1");
  for (const nome of ["Primeiro", "Segundo"]) {
    const r = await req("/api/cadastro", { body: { ...escritorio, nomeEscritorio: nome }, cookie });
    expect(r.status).toBe(201);
    expect(((await r.json()) as { contaId: string }).contaId).toMatch(/^[0-9a-f-]{36}$/);
  }
  const eu = (await (await req("/api/eu", { cookie })).json()) as Eu;
  expect(eu.escritorios.map((e) => e.nomeEscritorio)).toEqual(["Primeiro", "Segundo"]);
  expect(eu.escritorios[0]).toMatchObject({ perfil: "gestor", plano: "com_corretores", statusAssinatura: "pendente", ativa: false });
});

test("/api/eu sem sessão responde 401", async () => {
  const { req } = appDeTeste();
  const r = await req("/api/eu");
  expect(r.status).toBe(401);
  expect(await r.json()).toEqual({ erro: "nao_autenticado" });
});

test("/api/eu não lista escritório de membro desativado", async () => {
  const s = await criarCenario();
  const { req } = appDeTeste();
  const id = await criarUsuarioVerificado("dupla@x.com", "senha-forte-1", "Dupla");
  await poolSystem.query("insert into membros (conta_id, usuario_id, perfil) values ($1, $2, 'funcionaria')", [s.contaB, id]);
  const cookie = await entrar(req, "dupla@x.com", "senha-forte-1");
  expect(((await (await req("/api/eu", { cookie })).json()) as Eu).escritorios).toHaveLength(1);
  await poolSystem.query("update membros set status = 'desativado' where usuario_id = $1", [id]);
  expect(((await (await req("/api/eu", { cookie })).json()) as Eu).escritorios).toHaveLength(0);
});
