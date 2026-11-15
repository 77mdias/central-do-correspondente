import type { Pool, PoolClient } from "pg";

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
