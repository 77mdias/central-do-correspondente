// Achados da revisão final: cada teste reproduz um achado (views, conta suspensa) ou fecha a lacuna dos testes de escrita.
import { type Cenario, como, criarCenario, linha, poolOwner, poolSystem } from "./ajudantes";

let s: Cenario;
beforeEach(async () => {
  s = await criarCenario();
});

test("filtro que dá erro nas views não vaza linhas de outra conta", async () => {
  for (const v of ["vw_remuneracao", "vw_vgv_origem"]) {
    await expect(
      // divisão por zero só nas linhas de outra conta (não é constante: o planejador não calcula antes)
      como(s.gB, `select 1 from ${v} where 1 / (case when conta_id <> $1 then 0 else 1 end) = 1`, [s.contaB]),
      v,
    ).resolves.toBeTruthy();
  }
});

test("conta suspensa ainda tira o acesso de alguém, mas não devolve", async () => {
  await poolOwner.query("update contas set status_assinatura = 'suspensa', ativa_ate = null where id = $1", [s.contaA]);
  expect((await como(s.gA, "update membros set status = 'desativado' where usuario_id = $1 returning id", [s.fA])).rowCount).toBe(1);
  await expect(como(s.gA, "update membros set status = 'ativo' where usuario_id = $1", [s.fA])).rejects.toThrow(/row-level security/);
});

describe("escrita por perfil (spec §9)", () => {
  test("gestor de outra conta não grava na conta A", async () => {
    await expect(como(s.gB, "insert into clientes (conta_id, nome) values ($1, 'X')", [s.contaA])).rejects.toThrow(/row-level security/);
    expect((await como(s.gB, "update clientes set nome = 'X' where conta_id = $1 returning id", [s.contaA])).rowCount).toBe(0);
    expect((await como(s.gB, "update contas_config set percentual_atual = 9 where conta_id = $1 returning conta_id", [s.contaA])).rowCount).toBe(0);
    expect((await como(s.gB, "update membros set status = 'desativado' where conta_id = $1 returning id", [s.contaA])).rowCount).toBe(0);
    expect((await como(s.gB, "delete from corretores where conta_id = $1 returning id", [s.contaA])).rowCount).toBe(0);
    await expect(
      como(s.gB, "insert into convites (conta_id, email, perfil, corretor_id, token_hash, convidado_por) values ($1, 'x@x.com', 'corretor', $2, 'tk', $3)", [s.contaA, s.corretor1A, s.gB]),
    ).rejects.toThrow(/row-level security/);
  });

  test("corretor não edita ficha nem anexa em cliente de outro corretor", async () => {
    expect((await como(s.c1A, "update clientes set nome = 'X' where id = $1 returning id", [s.cliente1A])).rowCount).toBe(0);
    await expect(como(s.c1A, "insert into clientes (conta_id, nome) values ($1, 'X')", [s.contaA])).rejects.toThrow(/row-level security/);
    await expect(como(s.c1A, "insert into documentos (conta_id, cliente_id, tipo, recebido_em) values ($1, $2, 'rg', current_date)", [s.contaA, s.cliente1A])).rejects.toThrow(/row-level security/);
    await expect(
      como(s.c1A, "insert into arquivos (conta_id, cliente_id, nome, caminho, tamanho, mime, enviado_por) values ($1, $2, 'a.pdf', 'c/x/a.pdf', 1, 'application/pdf', $3)", [s.contaA, s.cliente2A, s.c1A]),
    ).rejects.toThrow(/row-level security/);
    expect((await como(s.c1A, "delete from arquivos where cliente_id = $1 returning id", [s.cliente1A])).rowCount).toBe(0);
  });

  test("histórico: só G e F anotam, em nome próprio, tipos nota e cobrança", async () => {
    const anotar = (quem: string, autor: string, tipo: string) =>
      como(quem, "insert into historico (conta_id, cliente_id, usuario_id, tipo, texto) values ($1, $2, $3, $4, 'x')", [s.contaA, s.cliente1A, autor, tipo]);
    await expect(anotar(s.fA, s.fA, "nota")).resolves.toBeTruthy();
    await expect(anotar(s.fA, s.gA, "nota")).rejects.toThrow(/row-level security/);
    await expect(anotar(s.fA, s.fA, "etapa")).rejects.toThrow(/row-level security/);
    await expect(anotar(s.c1A, s.c1A, "nota")).rejects.toThrow(/row-level security/);
  });

  test("push: cada um só as próprias inscrições", async () => {
    await expect(como(s.c1A, "insert into push_inscricoes (usuario_id, endpoint, chaves) values ($1, 'https://p/1', '{}')", [s.c1A])).resolves.toBeTruthy();
    await expect(como(s.c1A, "insert into push_inscricoes (usuario_id, endpoint, chaves) values ($1, 'https://p/2', '{}')", [s.gA])).rejects.toThrow(/row-level security/);
    expect((await como(s.gA, "select 1 from push_inscricoes")).rowCount).toBe(0);
  });

  test("views e equipe da conta A não abrem para a conta B nem para o corretor", async () => {
    for (const v of ["vw_remuneracao", "vw_vgv_periodo", "vw_vgv_origem"])
      expect((await como(s.gB, `select 1 from ${v} where conta_id = $1`, [s.contaA])).rowCount, v).toBe(0);
    expect((await como(s.gB, "select * from equipe_membros($1)", [s.contaA])).rowCount).toBe(0);
    expect((await como(s.c1A, "select * from equipe_membros($1)", [s.contaA])).rowCount).toBe(0);
    expect((await como(s.fA, "select * from equipe_membros($1)", [s.contaA])).rowCount).toBe(4);
  });
});

test("contas aceita CNPJ alfanumérico (IN RFB 2.229/2024)", async () => {
  await expect(
    poolSystem.query("insert into contas (nome_escritorio, documento_titular, plano) values ('Nova', '12ABC34501DE35', 'simples') returning id"),
  ).resolves.toBeTruthy();
  expect(await linha("select count(*)::int as n from contas where documento_titular = '12ABC34501DE35'")).toEqual({ n: 1 });
});
