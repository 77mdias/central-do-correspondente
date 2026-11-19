// pnpm conta:liberar <id-da-conta | email-do-gestor> <AAAA-MM-DD>
// Libera uma conta pendente até a data (cortesia, D-07/D-33), enquanto não existem o painel do sistema e o Asaas.
// Roda com a conexão de dono: criptenv run -e <ambiente> -p central-do-correspondente -- pnpm conta:liberar ...
import { pathToFileURL } from "node:url";
import pg, { type Pool } from "pg";

export type Resultado =
  | { ok: true; contaId: string }
  | { ok: false; motivo: "nao_encontrada" }
  | { ok: false; motivo: "ambigua"; contas: { id: string; nome: string }[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function liberarConta(pool: Pool, alvo: string, ate: string): Promise<Resultado> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ate) || Number.isNaN(Date.parse(ate))) throw new Error("data inválida: use AAAA-MM-DD");
  const contas = UUID.test(alvo)
    ? await pool.query<{ id: string; nome: string }>("select id, nome_escritorio as nome from contas where id = $1", [alvo])
    : await pool.query<{ id: string; nome: string }>(
        `select c.id, c.nome_escritorio as nome from contas c
           join membros m on m.conta_id = c.id and m.perfil = 'gestor' and m.status = 'ativo'
           join "user" u on u.id = m.usuario_id
          where lower(u.email) = lower($1) order by c.criado_em`,
        [alvo],
      );
  if (contas.rows.length === 0) return { ok: false, motivo: "nao_encontrada" };
  if (contas.rows.length > 1) return { ok: false, motivo: "ambigua", contas: contas.rows };
  const contaId = contas.rows[0]!.id;
  await pool.query("update contas set ativa_ate = $1 where id = $2", [ate, contaId]);
  return { ok: true, contaId };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [alvo, ate] = process.argv.slice(2);
  if (!alvo || !ate || !process.env.DATABASE_URL_OWNER) {
    console.error("uso: DATABASE_URL_OWNER=... pnpm conta:liberar <id-da-conta | email-do-gestor> <AAAA-MM-DD>");
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL_OWNER });
  try {
    const r = await liberarConta(pool, alvo, ate);
    if (r.ok) console.log(`Conta ${r.contaId} liberada até ${ate}.`);
    else if (r.motivo === "nao_encontrada") console.error("Nenhuma conta encontrada (o e-mail precisa ser de um gestor ativo).");
    else console.error(`E-mail gestor de mais de uma conta; use o id:\n${r.contas.map((c) => `  ${c.id}  ${c.nome}`).join("\n")}`);
    process.exitCode = r.ok ? 0 : 1;
  } finally {
    await pool.end();
  }
}
