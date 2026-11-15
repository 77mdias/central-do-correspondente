import { withUser } from "../../worker/db";
import { type Cenario, criarCenario, poolApp, poolOwner, poolSystem } from "./ajudantes";

let s: Cenario;
beforeEach(async () => {
  s = await criarCenario();
});

const ler = (usuario: string, sql: string, params: unknown[] = []) => withUser(poolApp, usuario, (c) => c.query(sql, params));

test("conta B não lê nada da conta A", async () => {
  for (const t of ["contas", "contas_config", "membros", "convites", "corretores", "clientes", "clientes_remuneracao", "documentos", "arquivos", "historico", "auditoria", "historico_percentual"]) {
    const col = t === "contas" ? "id" : "conta_id";
    const r = await ler(s.gB, `select 1 from ${t} where ${col} = $1`, [s.contaA]);
    expect(r.rowCount, t).toBe(0);
  }
});

test("funcionária não lê receita", async () => {
  for (const t of ["clientes_remuneracao", "contas_config", "historico_percentual", "vw_remuneracao", "vw_vgv_periodo", "vw_vgv_origem"]) {
    expect((await ler(s.fA, `select 1 from ${t}`)).rowCount, t).toBe(0);
  }
});

test("gestor lê a remuneração da própria conta", async () => {
  expect((await ler(s.gA, "select 1 from clientes_remuneracao")).rowCount).toBe(3);
  const r = await ler(s.gA, "select percentual_atual from contas_config");
  expect(r.rows).toEqual([{ percentual_atual: "1.500" }]);
  expect((await ler(s.gA, "select 1 from vw_remuneracao")).rowCount).toBe(3);
});

test("funcionária lê todos os clientes da conta e o histórico", async () => {
  expect((await ler(s.fA, "select 1 from clientes")).rowCount).toBe(3);
  expect((await ler(s.fA, "select 1 from historico")).rowCount).toBeGreaterThan(0);
});

test("corretor lê só os próprios clientes", async () => {
  const r = await ler(s.c1A, "select id from clientes");
  expect(r.rows.map((x) => x.id)).toEqual([s.cliente1A]);
  expect((await ler(s.c2A, "select 1 from documentos")).rowCount).toBe(0);
  expect((await ler(s.c1A, "select 1 from documentos")).rowCount).toBe(1);
});

test("corretor não lê membros de outros nem auditoria", async () => {
  const r = await ler(s.c1A, "select usuario_id from membros");
  expect(r.rows).toEqual([{ usuario_id: s.c1A }]);
  expect((await ler(s.c1A, "select 1 from auditoria")).rowCount).toBe(0);
  expect((await ler(s.c1A, "select 1 from corretores")).rowCount).toBe(0);
});

test("conta pendente não grava", async () => {
  await poolOwner.query("update contas set status_assinatura = 'pendente', ativa_ate = null where id = $1", [s.contaA]);
  await expect(ler(s.gA, "insert into clientes (conta_id, nome) values ($1, 'Novo')", [s.contaA])).rejects.toThrow(/row-level security/);
});

test("cortesia com ativa_ate no futuro libera escrita", async () => {
  await poolOwner.query("update contas set status_assinatura = 'pendente', ativa_ate = current_date + 1 where id = $1", [s.contaA]);
  await expect(ler(s.gA, "insert into clientes (conta_id, nome) values ($1, 'Novo')", [s.contaA])).resolves.toBeTruthy();
});

test("app_user não muda plano, status nem ativa_ate", async () => {
  for (const set of ["plano = 'simples'", "status_assinatura = 'ativa'", "ativa_ate = '2099-12-31'"]) {
    await expect(ler(s.gA, `update contas set ${set} where id = $1`, [s.contaA]), set).rejects.toThrow(/permission denied/);
  }
});

test("gestor renomeia o escritório; funcionária não", async () => {
  await ler(s.gA, "update contas set nome_escritorio = 'Novo nome' where id = $1", [s.contaA]);
  await ler(s.fA, "update contas set nome_escritorio = 'Outro' where id = $1", [s.contaA]);
  const r = await poolSystem.query("select nome_escritorio from contas where id = $1", [s.contaA]);
  expect(r.rows[0].nome_escritorio).toBe("Novo nome");
});

test("membro desativado não lê nada", async () => {
  await poolSystem.query("update membros set status = 'desativado' where usuario_id = $1", [s.fA]);
  expect((await ler(s.fA, "select 1 from clientes")).rowCount).toBe(0);
  expect((await ler(s.fA, "select 1 from contas")).rowCount).toBe(0);
});

test("funcionária não convida funcionária, convida corretor", async () => {
  const conv = (perfil: string, corretor: string | null) =>
    ler(s.fA, "insert into convites (conta_id, email, perfil, corretor_id, token_hash, convidado_por) values ($1, 'novo@x.com', $2, $3, md5(random()::text), $4)", [s.contaA, perfil, corretor, s.fA]);
  await expect(conv("funcionaria", null)).rejects.toThrow(/row-level security/);
  await expect(conv("corretor", s.corretor2A)).resolves.toBeTruthy();
});

test("ninguém lê token_hash pelo app", async () => {
  await expect(ler(s.gA, "select token_hash from convites")).rejects.toThrow(/permission denied/);
});

test("gestor desativa funcionária; ninguém desativa gestor", async () => {
  const desativar = (quem: string, alvo: string) => ler(quem, "update membros set status = 'desativado' where usuario_id = $1 returning id", [alvo]);
  expect((await desativar(s.gA, s.gA)).rowCount).toBe(0);
  expect((await desativar(s.fA, s.c1A)).rowCount).toBe(1);
  expect((await desativar(s.gA, s.fA)).rowCount).toBe(1);
});
