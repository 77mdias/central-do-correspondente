import type { Email } from "../../worker/email";
import { rotinaAnexos } from "../../worker/rotinas/anexos";
import { criarS3 } from "../../worker/s3";
import { criarCenario, poolSystem } from "../db/ajudantes";
import { TEST_ENV } from "../test-env";
import { escritorio, hojeBanco } from "./cenario";

beforeEach(async () => {
  await criarCenario();
});

type E = Awaited<ReturnType<typeof escritorio>>;
const s3 = criarS3(TEST_ENV);
const PDF = new TextEncoder().encode("%PDF-1.4 anexo");

/** Cliente com um anexo e a data de assinatura `dias` atrás (a exclusão fica para 30 − dias a partir de hoje). */
async function clienteComAnexo(e: E, nome: string, diasAtras: number) {
  const r = await e.req(`/api/contas/${e.conta}/clientes`, { body: { nome }, cookie: e.g });
  const { id } = (await r.json()) as { id: string };
  const f = new FormData();
  f.set("tipo", "rg");
  f.set("arquivo", new File([PDF], "rg.pdf", { type: "application/pdf" }));
  const a = (await (await e.enviar(`/api/contas/${e.conta}/clientes/${id}/arquivos`, f, e.g)).json()) as { id: string };
  await poolSystem.query("update clientes set data_assinatura = hoje_br() - $2::int, etapa = 'registro_cartorio' where id = $1", [id, diasAtras]);
  return { id, arquivo: a.id };
}

function rodar(emails: Email[] = [], agora = new Date()) {
  return rotinaAnexos({ pool: poolSystem, s3, enviar: async (m) => void emails.push(m), appUrl: TEST_ENV.APP_URL, agora });
}
const atualizadoEm = async (id: string) => (await poolSystem.query("select atualizado_em::text as t from clientes where id = $1", [id])).rows[0].t;

test("avisa G e F uma vez só, 5 dias antes", async () => {
  const e = await escritorio();
  const c = await clienteComAnexo(e, "Maria Aviso", 25);
  const antes = await atualizadoEm(c.id);
  const emails: Email[] = [];
  expect((await rodar(emails)).avisos).toBe(2);
  expect((await rodar(emails)).avisos).toBe(0);
  expect(emails).toHaveLength(2);
  expect(emails[0]!.assunto).toBe("Anexos serão apagados em breve — Escritório Teste");
  expect(emails[0]!.texto).toContain("• Maria Aviso: ");
  expect(emails[0]!.texto).toContain(`${TEST_ENV.APP_URL}/e/${e.conta}/clientes`);
  expect(await atualizadoEm(c.id)).toBe(antes); // RN-12: o aviso não conta como atualização
});

test("apaga no dia: objeto e linha marcada, documento continua recebido, nota de sistema", async () => {
  const e = await escritorio();
  const c = await clienteComAnexo(e, "Maria Vence", 30);
  const caminho = (await poolSystem.query("select caminho from arquivos where id = $1", [c.arquivo])).rows[0].caminho;
  const antes = await atualizadoEm(c.id);
  expect((await rodar()).apagados).toBe(1);
  expect((await fetch(await s3.linkTemporario(caminho, "x"))).ok).toBe(false);
  expect((await poolSystem.query("select apagado_em is not null as a from arquivos where id = $1", [c.arquivo])).rows[0].a).toBe(true);
  expect((await poolSystem.query("select recebido_em::text as r from documentos where cliente_id = $1 and tipo = 'rg'", [c.id])).rows[0].r).toBe(await hojeBanco());
  const h = await poolSystem.query("select texto from historico where cliente_id = $1 and tipo = 'sistema'", [c.id]);
  expect(h.rows).toEqual([{ texto: "Anexos apagados pelo prazo de 30 dias" }]);
  expect(await atualizadoEm(c.id)).toBe(antes); // não tira o processo de "parado"
  expect((await rodar()).apagados).toBe(0);
});

test("voltar para etapa ativa sem assinatura cancela a exclusão (RN-15)", async () => {
  const e = await escritorio();
  const c = await clienteComAnexo(e, "Maria Volta", 30);
  await poolSystem.query("update clientes set data_assinatura = null, etapa = 'conformidade' where id = $1", [c.id]);
  expect(await rodar()).toMatchObject({ avisos: 0, apagados: 0 });
  expect((await poolSystem.query("select apagado_em from arquivos where id = $1", [c.arquivo])).rows[0].apagado_em).toBeNull();
});

test("objeto sem linha com mais de 1 dia é recolhido; anexo vivo fica", async () => {
  const e = await escritorio();
  const c = await clienteComAnexo(e, "Maria Viva", 0);
  const vivo = (await poolSystem.query("select caminho from arquivos where id = $1", [c.arquivo])).rows[0].caminho;
  const orfao = `${e.conta}/${c.id}/${crypto.randomUUID()}.pdf`;
  await s3.enviar(orfao, PDF, "application/pdf");
  expect((await rodar([], new Date())).orfaos).toBe(0); // recém-criado: ainda não é lixo
  const r = await rodar([], new Date(Date.now() + 2 * 24 * 3600 * 1000));
  expect(r.orfaos).toBeGreaterThanOrEqual(1);
  expect((await fetch(await s3.linkTemporario(orfao, "x"))).ok).toBe(false);
  expect((await fetch(await s3.linkTemporario(vivo, "x"))).ok).toBe(true);
});

test("o aviso de uma conta não vai para a outra", async () => {
  const e = await escritorio();
  await clienteComAnexo(e, "Maria A", 25);
  const emails: Email[] = [];
  await rodar(emails);
  const daOutra = (await poolSystem.query<{ email: string }>(
    `select u.email from membros m join "user" u on u.id = m.usuario_id where m.conta_id = $1`, [e.contaOutro],
  )).rows.map((x) => x.email);
  expect(emails.some((m) => daOutra.includes(m.para))).toBe(false);
});
