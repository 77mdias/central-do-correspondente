import { criarCenario, criarUsuario, poolSystem } from "./ajudantes";

test("uma só funcionária ativa por conta", async () => {
  const s = await criarCenario();
  const outra = await criarUsuario("outra@x.com");
  await expect(
    poolSystem.query("insert into membros (conta_id, usuario_id, perfil) values ($1, $2, 'funcionaria')", [s.contaA, outra]),
  ).rejects.toThrow(/unique|duplicate/);
});

test("corretor sem corretor_id é recusado", async () => {
  const s = await criarCenario();
  const outro = await criarUsuario("outro@x.com");
  await expect(
    poolSystem.query("insert into membros (conta_id, usuario_id, perfil) values ($1, $2, 'corretor')", [s.contaA, outro]),
  ).rejects.toThrow(/check/);
});

test("convite com e-mail em maiúsculas é recusado pelo banco", async () => {
  const s = await criarCenario();
  await expect(
    poolSystem.query(
      "insert into convites (conta_id, email, perfil, token_hash) values ($1, 'A@X.com', 'funcionaria', 'h')",
      [s.contaB],
    ),
  ).rejects.toThrow(/check/);
});

test("corretor de outra conta não pode ser ligado ao cliente", async () => {
  const s = await criarCenario();
  await expect(
    poolSystem.query("insert into clientes (conta_id, corretor_id, nome) values ($1, $2, 'X')", [s.contaB, s.corretor1A]),
  ).rejects.toThrow(/foreign key/);
});
