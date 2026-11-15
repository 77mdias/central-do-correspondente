import { Pool } from "pg";
import { TEST_ENV, URL_OWNER_TEST } from "../test-env";

// Uma conexão por papel: prova que nada vaza de uma transação para outra.
export const poolOwner = new Pool({ connectionString: URL_OWNER_TEST, max: 1 });
export const poolSystem = new Pool({ connectionString: TEST_ENV.DB_SYSTEM.connectionString, max: 1 });
export const poolApp = new Pool({ connectionString: TEST_ENV.DB_APP.connectionString, max: 1 });

export type Cenario = {
  contaA: string; contaB: string; contaSimples: string;
  gA: string; fA: string; c1A: string; c2A: string; gB: string; gS: string;
  corretor1A: string; corretor2A: string;
  cliente1A: string; cliente2A: string; clienteDiretoA: string; cliente1B: string;
};

async function um(sql: string, params: unknown[] = []): Promise<string> {
  const r = await poolSystem.query<{ id: string }>(sql, params);
  return r.rows[0]!.id;
}

/** Usuário de login já confirmado (app_system, como o Better Auth grava). */
export function criarUsuario(email: string, nome = email): Promise<string> {
  return um(`insert into "user" (name, email, "emailVerified") values ($1, $2, true) returning id`, [nome, email]);
}

export function criarConta(plano: "simples" | "com_corretores", status = "ativa"): Promise<string> {
  return um(
    `with c as (insert into contas (nome_escritorio, documento_titular, plano, status_assinatura)
                values ('Escritório ' || $1, '12345678909', $1::plano, $2::status_assinatura) returning id)
     insert into contas_config (conta_id, percentual_atual) select id, 1.5 from c returning conta_id as id`,
    [plano, status],
  );
}

export function criarMembro(conta: string, usuario: string, perfil: string, corretor: string | null = null): Promise<string> {
  return um(`insert into membros (conta_id, usuario_id, perfil, corretor_id) values ($1, $2, $3, $4) returning id`, [conta, usuario, perfil, corretor]);
}

export function criarCorretor(conta: string, nome: string): Promise<string> {
  return um(`insert into corretores (conta_id, nome) values ($1, $2) returning id`, [conta, nome]);
}

export async function criarCliente(conta: string, nome: string, corretor: string | null): Promise<string> {
  const id = await um(`insert into clientes (conta_id, corretor_id, nome) values ($1, $2, $3) returning id`, [conta, corretor, nome]);
  await poolSystem.query(`insert into clientes_remuneracao (cliente_id, conta_id) values ($1, $2)`, [id, conta]);
  return id;
}

/** Apaga tudo (como dono) e monta: conta A (com corretores, completa), conta B (só gestor) e conta Simples. */
export async function criarCenario(): Promise<Cenario> {
  await poolOwner.query(`truncate "user", contas, tipos_documento restart identity cascade`);
  const [contaA, contaB, contaSimples] = [await criarConta("com_corretores"), await criarConta("com_corretores"), await criarConta("simples")];
  const [gA, fA, c1A, c2A, gB, gS] = await Promise.all(
    ["ga@a.com", "fa@a.com", "c1@a.com", "c2@a.com", "gb@b.com", "gs@s.com"].map((e) => criarUsuario(e, e.split("@")[0])),
  ) as [string, string, string, string, string, string];
  const corretor1A = await criarCorretor(contaA, "Corretor Um");
  const corretor2A = await criarCorretor(contaA, "Corretor Dois");
  await criarMembro(contaA, gA, "gestor");
  await criarMembro(contaA, fA, "funcionaria");
  await criarMembro(contaA, c1A, "corretor", corretor1A);
  await criarMembro(contaA, c2A, "corretor", corretor2A);
  await criarMembro(contaB, gB, "gestor");
  await criarMembro(contaSimples, gS, "gestor");
  return {
    contaA, contaB, contaSimples, gA, fA, c1A, c2A, gB, gS, corretor1A, corretor2A,
    cliente1A: await criarCliente(contaA, "Cliente Um", corretor1A),
    cliente2A: await criarCliente(contaA, "Cliente Dois", corretor2A),
    clienteDiretoA: await criarCliente(contaA, "Cliente Direto", null),
    cliente1B: await criarCliente(contaB, "Cliente B", null),
  };
}
