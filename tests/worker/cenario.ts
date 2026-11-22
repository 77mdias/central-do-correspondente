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
