import { Pool } from "pg";
import { criarApp } from "../../worker/app";
import { criarAuth } from "../../worker/auth";
import type { Email } from "../../worker/email";
import { poolSystem } from "../db/ajudantes";
import { TEST_ENV } from "../test-env";

export const ctxDeTeste = { waitUntil: (p: Promise<unknown>) => void p.catch(() => undefined), passThroughOnException() {}, props: {} } as unknown as ExecutionContext;

/** App com e-mails coletados em memória. `req` manda JSON, a origem certa e o cookie, se houver. */
export function appDeTeste() {
  const emails: Email[] = [];
  const app = criarApp({ enviarEmail: async (e) => void emails.push(e) });
  const ip = `198.51.100.${Math.floor(Math.random() * 250) + 1}`; // um IP por app de teste: o limite de login é por IP
  const req = (caminho: string, init: { method?: string; body?: unknown; cookie?: string } = {}) =>
    app.request(
      caminho,
      {
        method: init.method ?? (init.body === undefined ? "GET" : "POST"),
        headers: { origin: TEST_ENV.APP_URL, "content-type": "application/json", "cf-connecting-ip": ip, ...(init.cookie ? { cookie: init.cookie } : {}) },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      },
      TEST_ENV,
      ctxDeTeste,
    );
  return { app, req, emails };
}

// pool próprio do Better Auth nos testes: o poolSystem tem uma conexão só, e o Better Auth precisa de mais de uma
const poolAuth = new Pool({ connectionString: TEST_ENV.DB_SYSTEM.connectionString, max: 3 });

/** Auth avulso (fora de um pedido), para preparar usuários. */
export const authDeTeste = (emails: Email[] = []) => criarAuth(TEST_ENV, poolAuth, (e) => void emails.push(e));

export async function criarUsuarioVerificado(email: string, senha: string, nome: string): Promise<string> {
  await authDeTeste().api.signUpEmail({ body: { email, password: senha, name: nome } });
  const r = await poolSystem.query<{ id: string }>(`update "user" set "emailVerified" = true where email = $1 returning id`, [email]);
  return r.rows[0]!.id;
}

/** Entra pela rota do Better Auth e devolve o cookie de sessão. */
export async function entrar(req: ReturnType<typeof appDeTeste>["req"], email: string, senha: string): Promise<string> {
  const r = await req("/api/auth/sign-in/email", { body: { email, password: senha } });
  if (r.status !== 200) throw new Error(`login falhou: ${r.status} ${await r.text()}`);
  return r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

type Req = ReturnType<typeof appDeTeste>["req"];

/** Gestora com senha, sessão e um escritório (liberado, salvo `ativa: false`). */
export async function gestorComEscritorio(req: Req, plano: "simples" | "com_corretores" = "com_corretores", { ativa = true } = {}) {
  const email = `g-${Math.random().toString(36).slice(2, 10)}@x.com`;
  const usuarioId = await criarUsuarioVerificado(email, "senha-forte-1", "Gestora");
  const cookie = await entrar(req, email, "senha-forte-1");
  const r = await req("/api/cadastro", {
    body: { nomeEscritorio: "Escritório Teste", documento: "123.456.789-09", plano, aceitouTermos: true },
    cookie,
  });
  const { contaId } = (await r.json()) as { contaId: string };
  if (ativa) await poolSystem.query("update contas set ativa_ate = '2099-12-31' where id = $1", [contaId]);
  return { cookie, contaId, usuarioId, email };
}

export const tokenDoEmail = (e: Email | undefined) => /\/convite\/([A-Za-z0-9_-]+)/.exec(e?.texto ?? "")?.[1] ?? "";

/** Cookie de sessão de uma resposta. */
export const cookieDe = (r: Response) => r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
