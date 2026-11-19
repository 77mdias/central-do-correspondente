import { type Cenario, como, criarCenario, linha, poolSystem } from "./ajudantes";

let s: Cenario;
beforeEach(async () => {
  s = await criarCenario();
});

const cliente = (cols: string) => linha(`select ${cols} from clientes where id = $1`, [s.cliente1A]);
const pctContrato = async () => (await linha<{ p: string | null }>("select pct_contrato as p from clientes_remuneracao where cliente_id = $1", [s.cliente1A])).p;
const setCliente = (set: string, params: unknown[] = []) => como(s.fA, `update clientes set ${set} where id = $1`, [s.cliente1A, ...params]);

test("RN-06: entrar em registro_cartorio sem data grava hoje", async () => {
  await setCliente("etapa = 'registro_cartorio'");
  expect(await cliente("data_assinatura = hoje_br() as ok")).toEqual({ ok: true });
});

test("RN-07: assinatura congela o percentual", async () => {
  await setCliente("data_assinatura = '2026-11-01'");
  await como(s.gA, "update contas_config set percentual_atual = 2.0 where conta_id = $1", [s.contaA]);
  expect(await pctContrato()).toBe("1.500");
});

test("RN-11: mudar a data mantém; apagar limpa; regravar congela o vigente", async () => {
  await setCliente("data_assinatura = '2026-11-01'");
  await como(s.gA, "update contas_config set percentual_atual = 2.0 where conta_id = $1", [s.contaA]);
  await setCliente("data_assinatura = '2026-11-05'");
  expect(await pctContrato()).toBe("1.500");
  await setCliente("data_assinatura = null");
  expect(await pctContrato()).toBeNull();
  await setCliente("data_assinatura = '2026-11-10'");
  expect(await pctContrato()).toBe("2.000");
  const h = await linha<{ n: string }>("select count(*) as n from historico where cliente_id = $1 and tipo = 'contrato'", [s.cliente1A]);
  expect(Number(h.n)).toBe(4);
});

test("RN-12: nota no histórico atualiza clientes.atualizado_em", async () => {
  const antes = (await cliente("atualizado_em")).atualizado_em as Date;
  await como(s.fA, "insert into historico (conta_id, cliente_id, usuario_id, tipo, texto) values ($1, $2, $3, 'nota', 'ligou')", [s.contaA, s.cliente1A, s.fA]);
  const depois = (await cliente("atualizado_em")).atualizado_em as Date;
  expect(depois.getTime()).toBeGreaterThan(antes.getTime());
});

test("RN-14/15: anexos_apagar_em", async () => {
  await setCliente("data_assinatura = '2026-11-01'");
  expect(await cliente("anexos_apagar_em::text as d")).toEqual({ d: "2026-12-01" });
  await setCliente("data_assinatura = null");
  expect(await cliente("anexos_apagar_em as d")).toEqual({ d: null });
  await setCliente("etapa = 'reprovado_cancelado'");
  expect(await cliente("anexos_apagar_em = (finalizado_em at time zone 'America/Sao_Paulo')::date + 30 as ok")).toEqual({ ok: true });
  await setCliente("etapa = 'analise_credito'");
  expect(await cliente("anexos_apagar_em as d, finalizado_em as f")).toEqual({ d: null, f: null });
});

test("RF-23: anexar marca recebido e escreve o histórico com o nome", async () => {
  await poolSystem.query("insert into tipos_documento (codigo, nome, grupo, ordem) values ('cpf', 'CPF', 'comprador', 2)");
  const anexar = (tipo: string, nome: string) =>
    como(s.c1A, "insert into arquivos (conta_id, cliente_id, tipo_documento, nome, caminho, tamanho, mime, enviado_por) values ($1, $2, $3, $4, $5, 10, 'image/jpeg', $6)",
      [s.contaA, s.cliente1A, tipo, nome, `${s.contaA}/${s.cliente1A}/${nome}`, s.c1A]);
  await anexar("rg", "rg.jpg");
  await anexar("cpf", "cpf.jpg"); // tipo ainda sem linha em documentos: cria
  const d = await poolSystem.query("select tipo, recebido_em = hoje_br() as hoje, marcado_por from documentos where cliente_id = $1 order by tipo", [s.cliente1A]);
  expect(d.rows).toEqual([{ tipo: "cpf", hoje: true, marcado_por: s.c1A }, { tipo: "rg", hoje: true, marcado_por: s.c1A }]);
  const h = await linha<{ texto: string }>("select texto from historico where cliente_id = $1 and tipo = 'documento' and texto like '%rg.jpg%'", [s.cliente1A]);
  expect(h.texto).toContain("c1");
});

test("RN-18: conta Simples recusa funcionária e corretor", async () => {
  const outra = (await linha<{ id: string }>(`insert into "user" (name, email, "emailVerified") values ('x', 'x@s.com', true) returning id`)).id;
  await expect(poolSystem.query("insert into membros (conta_id, usuario_id, perfil) values ($1, $2, 'funcionaria')", [s.contaSimples, outra])).rejects.toThrow(/limite_plano/);
  await expect(
    como(s.gS, "insert into convites (conta_id, email, perfil, token_hash, convidado_por) values ($1, 'f@s.com', 'funcionaria', 'h1', $2)", [s.contaSimples, s.gS]),
  ).rejects.toThrow(/limite_plano/);
});

test("RN-18: convite pendente de funcionária conta no limite", async () => {
  const convidar = (quem: string, conta: string, email: string, token: string) =>
    como(quem, "insert into convites (conta_id, email, perfil, token_hash, convidado_por) values ($1, $2, 'funcionaria', $3, $4)", [conta, email, token, quem]);
  await expect(convidar(s.gB, s.contaB, "f1@b.com", "t1")).resolves.toBeTruthy();
  await expect(convidar(s.gB, s.contaB, "f2@b.com", "t2")).rejects.toThrow(/limite_funcionaria/);
  await expect(convidar(s.gA, s.contaA, "f3@a.com", "t3")).rejects.toThrow(/limite_funcionaria/);
});

test("convite revogado libera a vaga e o reaberto volta a contar", async () => {
  await como(s.gB, "insert into convites (conta_id, email, perfil, token_hash, convidado_por) values ($1, 'f1@b.com', 'funcionaria', 't1', $2)", [s.contaB, s.gB]);
  await como(s.gB, "update convites set revogado_em = now() where conta_id = $1", [s.contaB]);
  await expect(
    como(s.gB, "insert into convites (conta_id, email, perfil, token_hash, convidado_por) values ($1, 'f2@b.com', 'funcionaria', 't2', $2)", [s.contaB, s.gB]),
  ).resolves.toBeTruthy();
});

test("auditoria grava os campos alterados, sem valores", async () => {
  await setCliente("nome = 'Outro Nome'");
  const a = await linha("select acao, entidade, entidade_id, usuario_id, detalhe from auditoria where entidade_id = $1 order by id desc limit 1", [s.cliente1A]);
  expect(a).toEqual({ acao: "alterar", entidade: "cliente", entidade_id: s.cliente1A, usuario_id: s.fA, detalhe: { campos: ["nome"] } });
});

test("percentual alterado vai para historico_percentual", async () => {
  await como(s.gA, "update contas_config set percentual_atual = 2.25 where conta_id = $1", [s.contaA]);
  expect(await linha("select percentual, alterado_por from historico_percentual where conta_id = $1", [s.contaA])).toEqual({ percentual: "2.250", alterado_por: s.gA });
});
