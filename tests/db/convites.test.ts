import { type Cenario, criarCenario, criarCorretor, criarUsuario, linha, poolApp, poolSystem } from "./ajudantes";

let s: Cenario;
beforeEach(async () => {
  s = await criarCenario();
});

async function convite(conta: string, email: string, perfil: string, corretor: string | null = null, extra = ""): Promise<string> {
  const token = `t-${Math.random()}`;
  await poolSystem.query(
    `insert into convites (conta_id, email, perfil, corretor_id, token_hash, convidado_por) values ($1, $2, $3, $4, $5, $6)`,
    [conta, email, perfil, corretor, token, s.gA],
  );
  if (extra) await poolSystem.query(`update convites set ${extra} where token_hash = $1`, [token]);
  return token;
}
const aceitar = (token: string, usuario: string) => poolSystem.query("select aceitar_convite($1, $2) as conta", [token, usuario]);

test("aceita convite aberto e cria o membro", async () => {
  const corretor3 = await criarCorretor(s.contaA, "Corretor Três");
  const token = await convite(s.contaA, "novo@a.com", "corretor", corretor3);
  const novo = await criarUsuario("novo@a.com");
  expect((await aceitar(token, novo)).rows[0].conta).toBe(s.contaA);
  expect(await linha("select perfil, corretor_id, status from membros where usuario_id = $1", [novo])).toEqual({ perfil: "corretor", corretor_id: corretor3, status: "ativo" });
  expect(await linha("select aceito_em is not null as ok from convites where token_hash = $1", [token])).toEqual({ ok: true });
});

test("e-mail compara sem diferenciar maiúsculas", async () => {
  const token = await convite(s.contaB, "fulana@x.com", "funcionaria");
  const fulana = await criarUsuario("Fulana@X.com");
  await expect(aceitar(token, fulana)).resolves.toBeTruthy();
});

test("e-mail diferente é recusado", async () => {
  const token = await convite(s.contaB, "fulana@x.com", "funcionaria");
  const outra = await criarUsuario("outra@x.com");
  await expect(aceitar(token, outra)).rejects.toThrow(/convite_email_diferente/);
});

test("expirado, revogado ou já usado é inválido", async () => {
  const u = await criarUsuario("f@b.com");
  for (const extra of ["expira_em = now() - interval '1 minute'", "revogado_em = now()", "aceito_em = now()"]) {
    await poolSystem.query("delete from convites where conta_id = $1", [s.contaB]);
    const token = await convite(s.contaB, "f@b.com", "funcionaria", null, extra);
    await expect(aceitar(token, u), extra).rejects.toThrow(/convite_invalido/);
  }
  await expect(aceitar("token-que-nao-existe", u)).rejects.toThrow(/convite_invalido/);
});

test("membro desativado convidado de novo volta ativo com o perfil do convite", async () => {
  await poolSystem.query("update membros set status = 'desativado' where usuario_id = $1", [s.fA]);
  const token = await convite(s.contaA, "fa@a.com", "funcionaria");
  await aceitar(token, s.fA);
  const r = await poolSystem.query("select perfil, status from membros where conta_id = $1 and usuario_id = $2", [s.contaA, s.fA]);
  expect(r.rows).toEqual([{ perfil: "funcionaria", status: "ativo" }]);
});

test("membro ativo não aceita convite de novo (gestor não vira corretor)", async () => {
  const corretor3 = await criarCorretor(s.contaA, "Corretor Três");
  const token = await convite(s.contaA, "ga@a.com", "corretor", corretor3);
  await expect(aceitar(token, s.gA)).rejects.toThrow(/ja_membro/);
  expect(await linha("select perfil from membros where usuario_id = $1", [s.gA])).toEqual({ perfil: "gestor" });
});

test("app_user não executa aceitar_convite", async () => {
  await expect(poolApp.query("select aceitar_convite('x', $1)", [s.gA])).rejects.toThrow(/permission denied/);
});
