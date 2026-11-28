import type { Context } from "hono";
import type { PoolClient } from "pg";
import { z } from "zod";
import { camposComErro } from "../../src/regras/esquemas";
import type { AppTipos } from "../contexto";
import { erroDoBanco, withUser } from "../db";

export const NAO_ENCONTRADO = { erro: "nao_encontrado" } as const;
export const SEM_PERMISSAO = { erro: "sem_permissao" } as const;

/** Erro de rota com status e corpo (sai como resposta, desfazendo a transação). */
export class ErroRota extends Error {
  constructor(
    public status: 400 | 403 | 404 | 409 | 413 | 415 | 502,
    public corpo: Record<string, unknown>,
  ) {
    super(String(corpo.erro));
  }
}
export const naoEncontrado = () => new ErroRota(404, NAO_ENCONTRADO);
export const semPermissao = () => new ErroRota(403, SEM_PERMISSAO);

const uuid = z.uuid();
/** Ids da URL: o que não é uuid é 404, sem ir ao banco. */
export function ids(c: Context<AppTipos>, ...nomes: string[]): string[] {
  return nomes.map((n) => {
    const v = c.req.param(n);
    if (!uuid.safeParse(v).success) throw naoEncontrado();
    return v!;
  });
}

/** Corpo JSON validado pelo esquema; erro de validação vira 400 com os campos. */
export async function corpo<T extends z.ZodType>(c: Context<AppTipos>, esquema: T): Promise<z.infer<T>> {
  const r = esquema.safeParse(await c.req.json().catch(() => ({})));
  if (!r.success) throw new ErroRota(400, { erro: "validacao", campos: camposComErro(r.error) });
  return r.data;
}

/** Perfil do usuário na conta; 404 se não é do escritório (gestor ou funcionária). */
export async function exigirEscritorio(db: PoolClient, conta: string): Promise<"gestor" | "funcionaria"> {
  const r = await db.query<{ perfil: string | null }>("select meu_perfil($1)::text as perfil", [conta]);
  const p = r.rows[0]?.perfil;
  if (p !== "gestor" && p !== "funcionaria") throw naoEncontrado();
  return p;
}

/** Portal (fase 3): 404 se não é corretor ativo da conta (desativado já não tem perfil). */
export async function exigirCorretor(db: PoolClient, conta: string): Promise<void> {
  const r = await db.query<{ perfil: string | null }>("select meu_perfil($1)::text as perfil", [conta]);
  if (r.rows[0]?.perfil !== "corretor") throw naoEncontrado();
}

/** Roda a rota numa transação sob RLS e converte os erros conhecidos em resposta. */
export async function emTransacao<T>(c: Context<AppTipos>, fn: (db: PoolClient) => Promise<T>): Promise<T | Response> {
  try {
    return await withUser(c.var.pools.app, c.var.usuario!.id, fn);
  } catch (e) {
    return responderErro(c, e);
  }
}

export function responderErro(c: Context<AppTipos>, e: unknown): Response {
  if (e instanceof ErroRota) return c.json(e.corpo, e.status);
  const conhecido = erroDoBanco(e);
  if (conhecido) return c.json({ erro: conhecido.erro }, conhecido.status);
  const { code, constraint } = (e ?? {}) as { code?: string; constraint?: string };
  if (code === "23503" && constraint?.includes("corretor")) return c.json({ erro: "validacao", campos: ["corretorId"] }, 400);
  if (code === "23514" || code === "22P02") return c.json({ erro: "validacao", campos: [] }, 400);
  throw e;
}

export const ehResposta = (x: unknown): x is Response => x instanceof Response;
