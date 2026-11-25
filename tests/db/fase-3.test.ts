import { type Cenario, como, criarCenario, linha, poolSystem } from "./ajudantes";

let s: Cenario;
beforeEach(async () => {
  s = await criarCenario();
});

const ver = (usuario: string, conta: string, entidadeId: string | null, entidade = "cliente") =>
  como(usuario, "insert into auditoria (conta_id, usuario_id, acao, entidade, entidade_id) values ($1, $2, 'ver', $3, $4)", [
    conta, usuario, entidade, entidadeId,
  ]);

test("corretor registra 'ver' do próprio cliente (fase 3, spec §7)", async () => {
  await ver(s.c1A, s.contaA, s.cliente1A);
  const r = await linha<{ n: number }>(
    "select count(*)::int as n from auditoria where acao = 'ver' and usuario_id = $1 and entidade_id = $2",
    [s.c1A, s.cliente1A],
  );
  expect(r.n).toBe(1);
});

test("corretor não registra 'ver' de cliente de outro corretor", async () => {
  await expect(ver(s.c1A, s.contaA, s.cliente2A)).rejects.toThrow(/row-level security/);
});

test("corretor não registra 'ver' de cliente direto nem sem cliente", async () => {
  await expect(ver(s.c1A, s.contaA, s.clienteDiretoA)).rejects.toThrow(/row-level security/);
  await expect(ver(s.c1A, s.contaA, null)).rejects.toThrow(/row-level security/);
});

test("corretor não registra 'ver' de cliente de outra conta", async () => {
  await expect(ver(s.c1A, s.contaB, s.cliente1B)).rejects.toThrow(/row-level security/);
  await expect(ver(s.c1A, s.contaA, s.cliente1B)).rejects.toThrow(/row-level security/);
});

test("corretor desativado não registra 'ver'", async () => {
  await poolSystem.query("update membros set status = 'desativado' where usuario_id = $1", [s.c1A]);
  await expect(ver(s.c1A, s.contaA, s.cliente1A)).rejects.toThrow(/row-level security/);
});

test("corretor não registra 'ver' com outra entidade, mesmo com o id do próprio cliente", async () => {
  const arq = (await linha<{ id: string }>("select id from arquivos where cliente_id = $1", [s.cliente1A])).id;
  await expect(ver(s.c1A, s.contaA, arq, "arquivo")).rejects.toThrow(/row-level security/);
  await expect(ver(s.c1A, s.contaA, s.cliente1A, "arquivo")).rejects.toThrow(/row-level security/);
});

test("corretor não registra 'ver' em nome de outro", async () => {
  await expect(
    como(s.c1A, "insert into auditoria (conta_id, usuario_id, acao, entidade, entidade_id) values ($1, $2, 'ver', 'cliente', $3)", [
      s.contaA, s.gA, s.cliente1A,
    ]),
  ).rejects.toThrow(/row-level security/);
});

test("escritório continua registrando 'ver' como na fase 2", async () => {
  await ver(s.gA, s.contaA, s.cliente2A);
  await ver(s.fA, s.contaA, s.clienteDiretoA);
  await expect(ver(s.gB, s.contaA, s.cliente1A)).rejects.toThrow(/row-level security/);
});
