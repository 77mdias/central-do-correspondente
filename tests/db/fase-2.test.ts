import { type Cenario, como, criarCenario, linha, poolSystem } from "./ajudantes";

let s: Cenario;
beforeEach(async () => {
  s = await criarCenario();
});

const auditar = (usuario: string, conta: string, acao: string, dono = usuario, entidadeId: string | null = null) =>
  como(usuario, "insert into auditoria (conta_id, usuario_id, acao, entidade, entidade_id) values ($1, $2, $3, 'cliente', $4)", [
    conta, dono, acao, entidadeId,
  ]);

test("os 12 tipos estão no banco na ordem do protótipo (P-01)", async () => {
  const r = await poolSystem.query<{ codigo: string }>("select codigo from tipos_documento order by grupo, ordem");
  expect(r.rows.map((x) => x.codigo)).toEqual(["rg", "cpf", "civil", "resid", "renda", "ctps", "ir", "fgts", "matr", "iptu", "vend", "form"]);
});

test("arquivo acima de 20 MB é recusado", async () => {
  await expect(
    poolSystem.query(
      "insert into arquivos (conta_id, cliente_id, nome, caminho, tamanho, mime) values ($1, $2, 'g.pdf', 'g', 20971521, 'application/pdf')",
      [s.contaA, s.cliente1A],
    ),
  ).rejects.toThrow(/arquivos_tamanho_check/);
});

test("a mesma cópia do protótipo não entra em duas contas (D-40)", async () => {
  await poolSystem.query("update contas set prototipo_origem = 'x' where id = $1", [s.contaA]);
  await expect(poolSystem.query("update contas set prototipo_origem = 'x' where id = $1", [s.contaB])).rejects.toThrow(/unique|duplicate/);
});

test("gestor e funcionária registram 'ver' na própria conta", async () => {
  await auditar(s.gA, s.contaA, "ver");
  await auditar(s.fA, s.contaA, "ver");
  const r = await linha<{ n: number }>("select count(*)::int as n from auditoria where acao = 'ver' and usuario_id in ($1, $2)", [s.gA, s.fA]);
  expect(r.n).toBe(2);
});

test("ninguém registra 'alterar' nem 'excluir' à mão", async () => {
  await expect(auditar(s.gA, s.contaA, "alterar")).rejects.toThrow(/row-level security/);
  await expect(auditar(s.gA, s.contaA, "excluir")).rejects.toThrow(/row-level security/);
});

test("não registra auditoria em nome de outro", async () => {
  await expect(auditar(s.gA, s.contaA, "ver", s.fA)).rejects.toThrow(/row-level security/);
});

test("não registra auditoria em outra conta", async () => {
  await expect(auditar(s.gB, s.contaA, "ver")).rejects.toThrow(/row-level security/);
});

test("corretor registra 'baixar' só de arquivo do próprio cliente", async () => {
  const arq = (await linha<{ id: string }>("select id from arquivos where cliente_id = $1", [s.cliente1A])).id;
  await auditar(s.c1A, s.contaA, "baixar", s.c1A, arq);
  await expect(auditar(s.c2A, s.contaA, "baixar", s.c2A, arq)).rejects.toThrow(/row-level security/);
  await expect(auditar(s.c1A, s.contaA, "ver")).rejects.toThrow(/row-level security/);
});
