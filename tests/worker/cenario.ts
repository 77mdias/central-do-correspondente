import { poolSystem } from "../db/ajudantes";
import { appDeTeste, cookieDe, gestorComEscritorio, tokenDoEmail } from "./ajudantes";

const sorteio = () => Math.random().toString(36).slice(2, 8);

/** Escritório liberado com gestora e funcionária logadas, mais a gestora de outro escritório. */
export async function escritorio(envExtra: Parameters<typeof appDeTeste>[0] = {}) {
  const t = appDeTeste(envExtra);
  const g = await gestorComEscritorio(t.req);
  await t.req(`/api/contas/${g.contaId}/convites`, { body: { email: `f-${sorteio()}@x.com`, perfil: "funcionaria" }, cookie: g.cookie });
  const aceite = await t.req(`/api/convites/${tokenDoEmail(t.emails.at(-1))}/aceitar`, {
    body: { nome: "Func", senha: "senha-forte-1", aceitouTermos: true },
  });
  const outro = await gestorComEscritorio(t.req);
  const json = async <T>(r: Response | Promise<Response>) => (await (await r).json()) as T;
  return { ...t, json, conta: g.contaId, g: g.cookie, gId: g.usuarioId, f: cookieDe(aceite), outro: outro.cookie, contaOutro: outro.contaId };
}

export const hojeBanco = async () => (await poolSystem.query<{ h: string }>("select hoje_br()::text as h")).rows[0]!.h;
export const somarDiasBanco = async (n: number) => (await poolSystem.query<{ h: string }>("select (hoje_br() + $1::int)::text as h", [n])).rows[0]!.h;

const SENHA_CORRETOR = "senha-forte-1";

/**
 * Corretor com acesso ao portal: a gestora cadastra (com e-mail) e convida; o corretor aceita pelo token do e-mail.
 * Com `cookie`, o corretor já tem conta e aceita logado (um segundo escritório).
 */
export async function corretorLogado(
  e: Pick<Awaited<ReturnType<typeof escritorio>>, "req" | "emails">,
  { conta, gestora, nome = "Ana Corretora", email = `c-${sorteio()}@x.com`, cookie }: { conta: string; gestora: string; nome?: string; email?: string; cookie?: string },
) {
  const k = await e.req(`/api/contas/${conta}/corretores`, { body: { nome, email }, cookie: gestora });
  const { id: corretorId } = (await k.json()) as { id: string };
  const conv = await e.req(`/api/contas/${conta}/convites`, { body: { email, perfil: "corretor", corretorId }, cookie: gestora });
  if (conv.status !== 201) throw new Error(`convite falhou: ${conv.status} ${await conv.text()}`);
  const token = tokenDoEmail(e.emails.at(-1));
  const aceite = await e.req(`/api/convites/${token}/aceitar`, {
    body: cookie ? { aceitouTermos: true } : { nome, senha: SENHA_CORRETOR, aceitouTermos: true },
    cookie,
  });
  if (aceite.status !== 200) throw new Error(`aceite falhou: ${aceite.status} ${await aceite.text()}`);
  const usuarioId = (await poolSystem.query<{ id: string }>(`select id from "user" where email = $1`, [email])).rows[0]!.id;
  return { cookie: cookie ?? cookieDe(aceite), corretorId, usuarioId, email };
}
