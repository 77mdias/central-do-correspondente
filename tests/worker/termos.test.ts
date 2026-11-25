import { TERMOS_VERSAO } from "../../src/regras/planos";
import type { Eu } from "../../src/tipos-api";
import { criarCenario, poolSystem } from "../db/ajudantes";
import { escritorio } from "./cenario";

beforeEach(async () => {
  await criarCenario();
});

type E = Awaited<ReturnType<typeof escritorio>>;
const eu = (e: E, cookie: string) => e.json<Eu>(e.req("/api/eu", { cookie }));
const termos = async (id: string) =>
  (await poolSystem.query<{ v: string | null; em: Date | null }>(`select "termosVersao" as v, "termosAceitosEm" as em from "user" where id = $1`, [id])).rows[0]!;
const versaoAntiga = (id: string) => poolSystem.query(`update "user" set "termosVersao" = 'antiga', "termosAceitosEm" = '2026-01-01' where id = $1`, [id]);

test("quem acabou de se cadastrar ou de aceitar convite não tem termos pendentes", async () => {
  const e = await escritorio();
  expect((await eu(e, e.g)).termosPendentes).toBe(false);
  expect((await eu(e, e.f)).termosPendentes).toBe(false);
});

test("usuário com versão antiga (ou nenhuma) tem termos pendentes (RF-67)", async () => {
  const e = await escritorio();
  await versaoAntiga(e.gId);
  expect((await eu(e, e.g)).termosPendentes).toBe(true);
  await poolSystem.query(`update "user" set "termosVersao" = null where id = $1`, [e.gId]);
  expect((await eu(e, e.g)).termosPendentes).toBe(true);
});

test("aceitar grava a versão atual e a data, só para quem está na sessão", async () => {
  const e = await escritorio();
  const fId = (await poolSystem.query<{ id: string }>(`select usuario_id as id from membros where conta_id = $1 and perfil = 'funcionaria'`, [e.conta])).rows[0]!.id;
  await versaoAntiga(e.gId);
  await versaoAntiga(fId);
  const antes = Date.now();
  const r = await e.req("/api/termos/aceitar", { body: {}, cookie: e.g });
  expect(r.status).toBe(204);
  const g = await termos(e.gId);
  expect(g.v).toBe(TERMOS_VERSAO);
  expect(g.em!.getTime()).toBeGreaterThanOrEqual(antes - 5000);
  expect((await eu(e, e.g)).termosPendentes).toBe(false);
  expect((await termos(fId)).v).toBe("antiga"); // a funcionária continua pendente
  expect((await eu(e, e.f)).termosPendentes).toBe(true);
});

test("aceitar é idempotente e ignora corpo com outro usuário", async () => {
  const e = await escritorio();
  const fId = (await poolSystem.query<{ id: string }>(`select usuario_id as id from membros where conta_id = $1 and perfil = 'funcionaria'`, [e.conta])).rows[0]!.id;
  await versaoAntiga(fId);
  for (let i = 0; i < 2; i++) {
    expect((await e.req("/api/termos/aceitar", { body: { usuarioId: fId, versao: "qualquer" }, cookie: e.g })).status).toBe(204);
  }
  expect((await termos(e.gId)).v).toBe(TERMOS_VERSAO);
  expect((await termos(fId)).v).toBe("antiga");
});

test("aceitar sem sessão dá 401", async () => {
  const e = await escritorio();
  expect((await e.req("/api/termos/aceitar", { body: {} })).status).toBe(401);
});
