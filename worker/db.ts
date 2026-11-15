import pg, { type Pool, type PoolClient } from "pg";
import type { Env } from "./env";

// shortcut: bigint vira number; seguro até 2^53 (valores em centavos), revisar se somas passarem disso
pg.types.setTypeParser(20, Number);

export type Pools = { app: Pool; system: Pool; fechar(): Promise<void> };

/** Conexões do pedido (o Hyperdrive guarda o pool de verdade; no Worker, I/O não passa de um pedido para outro). */
export function abrirPools(env: Pick<Env, "DB_APP" | "DB_SYSTEM">): Pools {
  const app = new pg.Pool({ connectionString: env.DB_APP.connectionString, max: 1 });
  // o Better Auth segura uma conexão em transação enquanto chama os ganchos (ex.: e-mail), que consultam de novo
  const system = new pg.Pool({ connectionString: env.DB_SYSTEM.connectionString, max: 3 });
  return { app, system, fechar: async () => void (await Promise.all([app.end(), system.end()])) };
}

/**
 * Roda `fn` numa transação em que as políticas de RLS enxergam `usuarioId` (vem sempre da sessão).
 * O `set_config(..., true)` vale só para esta transação, então funciona atrás de pooler em modo transação.
 */
export async function withUser<T>(pool: Pool, usuarioId: string, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("select set_config('app.usuario_id', $1, true)", [usuarioId]);
    const r = await fn(c);
    await c.query("commit");
    return r;
  } catch (e) {
    await c.query("rollback").catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
}

const ERROS_409 = ["limite_plano", "limite_funcionaria", "ja_membro", "convite_invalido", "convite_email_diferente"] as const;
export type ErroConhecido = (typeof ERROS_409)[number] | "sem_permissao";

/** Erro do banco que vira resposta: regra de negócio (409) ou RLS (403). Outros: null (sobe como 500). */
export function erroDoBanco(e: unknown): { status: 403 | 409; erro: ErroConhecido } | null {
  const { code, message = "", constraint } = (e ?? {}) as { code?: string; message?: string; constraint?: string };
  const regra = ERROS_409.find((x) => message === x);
  if (regra) return { status: 409, erro: regra };
  if (code === "23505" && constraint === "membros_uma_funcionaria") return { status: 409, erro: "limite_funcionaria" };
  if (code === "42501" || message.includes("row-level security")) return { status: 403, erro: "sem_permissao" };
  return null;
}
