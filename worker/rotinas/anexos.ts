import type { Pool, PoolClient } from "pg";
import type { EnviarEmail } from "../email";
import { emailAvisoAnexos } from "../emails";
import type { S3 } from "../s3";

/** P-07: aviso 5 dias antes de apagar. */
export const DIAS_AVISO = 5;
/** Objeto sem linha em `arquivos` há mais que isto é lixo (upload que falhou depois do envio, cliente excluído). */
const IDADE_ORFAO_MS = 24 * 3600 * 1000;

export type ResultadoRotina = { avisos: number; apagados: number; orfaos: number; falhas: number };

type Deps = { pool: Pool; s3: S3; enviar: EnviarEmail; appUrl: string; agora?: Date };

/**
 * Rotina diária (Cron 6h UTC = 3h de Brasília), como app_system e sempre com conta_id explícito:
 * 1. avisa G e F 5 dias antes de apagar (uma vez por data de exclusão);
 * 2. apaga os anexos vencidos (RN-14), mantendo a ficha e a marcação de recebido;
 * 3. recolhe objetos do bucket sem linha em `arquivos`.
 */
export async function rotinaAnexos({ pool, s3, enviar, appUrl, agora = new Date() }: Deps): Promise<ResultadoRotina> {
  const r: ResultadoRotina = { avisos: 0, apagados: 0, orfaos: 0, falhas: 0 };
  const db = await pool.connect();
  try {
    await db.query("begin");
    await db.query("select set_config('app.importando', 'on', true)"); // RN-12: rotina do sistema não é atualização
    r.avisos = await avisar(db, enviar, appUrl);
    const { apagados, falhas } = await apagarVencidos(db, s3);
    r.apagados = apagados;
    r.falhas = falhas;
    await db.query("commit");
  } catch (e) {
    await db.query("rollback").catch(() => undefined);
    throw e;
  } finally {
    db.release();
  }
  r.orfaos = await recolherOrfaos(pool, s3, agora);
  return r;
}

async function avisar(db: PoolClient, enviar: EnviarEmail, appUrl: string): Promise<number> {
  // na janela de 5 dias e ainda sem aviso para esta data (se a data mudar, avisa de novo)
  const contas = await db.query<{ conta: string; escritorio: string; clientes: { id: string; nome: string; data: string }[] }>(
    `select c.conta_id as conta, ct.nome_escritorio as escritorio,
            json_agg(json_build_object('id', c.id, 'nome', c.nome, 'data', to_char(c.anexos_apagar_em, 'DD/MM/YYYY'))
                     order by c.anexos_apagar_em, c.nome) as clientes
       from clientes c join contas ct on ct.id = c.conta_id
      where c.anexos_apagar_em > hoje_br() and c.anexos_apagar_em <= hoje_br() + $1::int
        and (c.anexos_aviso_em is null or c.anexos_aviso_em < c.anexos_apagar_em - $1::int)
        and exists (select 1 from arquivos a where a.cliente_id = c.id and a.apagado_em is null)
      group by c.conta_id, ct.nome_escritorio`,
    [DIAS_AVISO],
  );
  let enviados = 0;
  for (const conta of contas.rows) {
    const pessoas = await db.query<{ email: string; nome: string }>(
      `select u.email, u.name as nome from membros m join "user" u on u.id = m.usuario_id
        where m.conta_id = $1 and m.status = 'ativo' and m.perfil in ('gestor', 'funcionaria')`,
      [conta.conta],
    );
    for (const p of pessoas.rows) {
      await enviar({ para: p.email, ...emailAvisoAnexos(p.nome, conta.escritorio, conta.clientes, `${appUrl}/e/${conta.conta}/clientes`) });
      enviados++;
    }
    await db.query("update clientes set anexos_aviso_em = hoje_br() where conta_id = $1 and id = any($2::uuid[])", [
      conta.conta,
      conta.clientes.map((c) => c.id),
    ]);
  }
  return enviados;
}

async function apagarVencidos(db: PoolClient, s3: S3): Promise<{ apagados: number; falhas: number }> {
  const vencidos = await db.query<{ id: string; caminho: string; conta: string; cliente: string }>(
    `select a.id, a.caminho, a.conta_id as conta, a.cliente_id as cliente
       from arquivos a join clientes c on c.id = a.cliente_id and c.conta_id = a.conta_id
      where c.anexos_apagar_em <= hoje_br() and a.apagado_em is null`,
  );
  let apagados = 0;
  let falhas = 0;
  const clientes = new Map<string, string>();
  for (const a of vencidos.rows) {
    try {
      await s3.apagar(a.caminho);
    } catch (e) {
      console.error("anexo vencido não apagado; tenta de novo amanhã", a.id, e);
      falhas++;
      continue;
    }
    await db.query("update arquivos set apagado_em = now() where conta_id = $1 and id = $2", [a.conta, a.id]);
    clientes.set(a.cliente, a.conta);
    apagados++;
  }
  for (const [cliente, conta] of clientes)
    await db.query(`insert into historico (conta_id, cliente_id, tipo, texto) values ($1, $2, 'sistema', 'Anexos apagados pelo prazo de 30 dias')`, [
      conta,
      cliente,
    ]);
  return { apagados, falhas };
}

async function recolherOrfaos(pool: Pool, s3: S3, agora: Date): Promise<number> {
  const velhos: string[] = [];
  for await (const o of s3.listar()) if (agora.getTime() - o.criadoEm.getTime() > IDADE_ORFAO_MS) velhos.push(o.caminho);
  let n = 0;
  for (let i = 0; i < velhos.length; i += 500) {
    const lote = velhos.slice(i, i + 500);
    const vivos = await pool.query<{ caminho: string }>("select caminho from arquivos where caminho = any($1) and apagado_em is null", [lote]);
    const manter = new Set(vivos.rows.map((x) => x.caminho));
    for (const caminho of lote.filter((c) => !manter.has(c))) {
      await s3.apagar(caminho).then(() => n++, (e) => console.error("órfão não apagado", caminho, e));
    }
  }
  return n;
}
