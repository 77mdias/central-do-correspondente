import { readFileSync } from "node:fs";
import { withUser } from "../../worker/db";
import { type Cenario, como, criarCenario, criarConta, criarMembro, criarUsuario, linha, poolApp, poolSystem } from "./ajudantes";

const FIXTURE = JSON.parse(readFileSync(new URL("../fixtures/importacao-normalizada.json", import.meta.url), "utf8"));

let s: Cenario;
let conta: string;
let gestor: string;
beforeEach(async () => {
  s = await criarCenario();
  conta = await criarConta("com_corretores");
  gestor = await criarUsuario("gi@i.com", "Gestora Importa");
  await criarMembro(conta, gestor, "gestor");
});

const importar = (usuario: string, c: string, dados: unknown = FIXTURE) =>
  como(usuario, "select importar_prototipo($1, $2::jsonb) as r", [c, JSON.stringify(dados)]).then((x) => x.rows[0].r);

const cliente = (nome: string, campos = "*") => linha(`select ${campos} from clientes where conta_id = $1 and nome = $2`, [conta, nome]);

test("gestor importa e as contagens voltam", async () => {
  expect(await importar(gestor, conta)).toEqual({ corretores: 2, clientes: 4, documentos: 3, notas: 3 });
});

test("as datas originais ficam", async () => {
  await importar(gestor, conta);
  const c = await cliente(
    "Carla Concluída",
    "to_json(criado_em) #>> '{}' as criado, to_json(atualizado_em) #>> '{}' as atualizado, data_assinatura::text as assinatura, qtd_cobrancas, to_json(finalizado_em) #>> '{}' as finalizado",
  );
  expect(c).toEqual({
    criado: "2026-01-15T12:00:00+00:00",
    atualizado: "2026-04-02T18:30:00+00:00",
    assinatura: "2026-03-10",
    qtd_cobrancas: 4,
    finalizado: "2026-04-02T18:30:00+00:00",
  });
  const h = await linha<{ criado: string }>(
    "select to_json(h.criado_em) #>> '{}' as criado from historico h join clientes c on c.id = h.cliente_id where c.nome = 'Carla Concluída' and h.texto like 'Remuneração%'",
  );
  expect(h.criado).toBe("2026-04-01T12:00:00+00:00");
});

test("pct_contrato vem do arquivo, não do percentual atual", async () => {
  await importar(gestor, conta);
  const r = await linha<{ pct: string; atual: string }>(
    `select r.pct_contrato::text as pct, cfg.percentual_atual::text as atual
       from clientes c join clientes_remuneracao r on r.cliente_id = c.id join contas_config cfg on cfg.conta_id = c.conta_id
      where c.conta_id = $1 and c.nome = 'Carla Concluída'`,
    [conta],
  );
  expect(r).toEqual({ pct: "1.000", atual: "1.200" });
  const h = await poolSystem.query("select percentual::text from historico_percentual where conta_id = $1 order by criado_em", [conta]);
  expect(h.rows.map((x) => x.percentual)).toEqual(["1.000", "1.200"]);
});

test("sem histórico automático: só as notas do arquivo e uma nota de sistema por cliente", async () => {
  await importar(gestor, conta);
  const r = await poolSystem.query<{ tipo: string; n: number }>(
    "select tipo::text, count(*)::int as n from historico where conta_id = $1 group by tipo order by tipo",
    [conta],
  );
  expect(r.rows).toEqual([{ tipo: "nota", n: 3 }, { tipo: "sistema", n: 4 }]);
});

test("uma auditoria só, a da importação", async () => {
  await importar(gestor, conta);
  const r = await poolSystem.query<{ entidade: string; usuario_id: string }>("select entidade, usuario_id from auditoria where conta_id = $1 and entidade <> 'membro'", [conta]);
  expect(r.rows).toEqual([{ entidade: "importacao", usuario_id: gestor }]);
});

test("anexos_apagar_em calculado para concluído e cancelado; corretor e cliente direto ligados", async () => {
  await importar(gestor, conta);
  expect(await cliente("Carla Concluída", "anexos_apagar_em::text as d")).toEqual({ d: "2026-04-09" });
  expect(await cliente("Elisa Cancelada", "anexos_apagar_em::text as d")).toEqual({ d: "2026-06-19" });
  expect(await cliente("Diego Pendente", "anexos_apagar_em as d, finalizado_em as f")).toEqual({ d: null, f: null });
  const cor = await linha<{ nome: string }>(
    "select k.nome from clientes c join corretores k on k.id = c.corretor_id where c.conta_id = $1 and c.nome = 'Diego Pendente'",
    [conta],
  );
  expect(cor.nome).toBe("Bruno Corretor");
  expect(await cliente("Fábio Direto", "corretor_id")).toEqual({ corretor_id: null });
});

test("a conta fica marcada com a origem", async () => {
  await importar(gestor, conta);
  const r = await linha<{ origem: string; em: boolean }>(
    "select prototipo_origem as origem, importado_prototipo_em is not null as em from contas where id = $1",
    [conta],
  );
  expect(r).toEqual({ origem: FIXTURE.origem, em: true });
});

test("funcionária não importa", async () => {
  const f = await criarUsuario("fi@i.com");
  await criarMembro(conta, f, "funcionaria");
  await expect(importar(f, conta)).rejects.toThrow(/sem_permissao/);
});

test("gestor de outra conta não importa nesta", async () => {
  await expect(importar(s.gB, conta)).rejects.toThrow(/sem_permissao/);
});

test("conta pendente não importa", async () => {
  await poolSystem.query("update contas set status_assinatura = 'pendente', ativa_ate = null where id = $1", [conta]);
  await expect(importar(gestor, conta)).rejects.toThrow(/conta_inativa/);
});

test("conta com cliente não importa", async () => {
  await expect(importar(s.gA, s.contaA, { ...FIXTURE, origem: "outra" })).rejects.toThrow(/conta_nao_vazia/);
});

test("segunda importação na mesma conta é recusada", async () => {
  await importar(gestor, conta);
  await poolSystem.query("delete from clientes where conta_id = $1; ", [conta]);
  await poolSystem.query("delete from corretores where conta_id = $1", [conta]);
  await expect(importar(gestor, conta, { ...FIXTURE, origem: "outra" })).rejects.toThrow(/ja_importado/);
});

test("a mesma origem em outra conta é recusada e nada é gravado lá", async () => {
  await importar(gestor, conta);
  const outra = await criarConta("com_corretores");
  const g2 = await criarUsuario("g2@i.com");
  await criarMembro(outra, g2, "gestor");
  await expect(importar(g2, outra)).rejects.toThrow(/origem_usada/);
  expect((await poolSystem.query("select 1 from clientes where conta_id = $1", [outra])).rowCount).toBe(0);
});

test("um erro no meio não grava nada", async () => {
  const ruim = structuredClone(FIXTURE);
  ruim.clientes[3].documentos = [{ tipo: "nao_existe", recebidoEm: "2026-11-01" }];
  await expect(importar(gestor, conta, ruim)).rejects.toThrow(/foreign key/);
  expect((await poolSystem.query("select 1 from clientes where conta_id = $1", [conta])).rowCount).toBe(0);
  expect((await poolSystem.query("select 1 from corretores where conta_id = $1", [conta])).rowCount).toBe(0);
  expect(await linha("select importado_prototipo_em as em from contas where id = $1", [conta])).toEqual({ em: null });
});

test("fora da importação os gatilhos continuam valendo", async () => {
  await importar(gestor, conta);
  // mesma conexão (max: 1): a marca não pode ter sobrado da transação anterior
  const r = await withUser(poolApp, gestor, async (c) => {
    const marca = await c.query("select em_importacao() as m");
    await c.query("update clientes set etapa = 'credito_aprovado' where conta_id = $1 and nome = 'Fábio Direto'", [conta]);
    return marca.rows[0].m;
  });
  expect(r).toBe(false);
  const h = await linha<{ n: number }>(
    "select count(*)::int as n from historico h join clientes c on c.id = h.cliente_id where c.nome = 'Fábio Direto' and h.tipo = 'etapa'",
  );
  expect(h.n).toBe(1);
  const a = await linha<{ n: number }>("select count(*)::int as n from auditoria where conta_id = $1 and entidade = 'cliente'", [conta]);
  expect(a.n).toBe(1);
});
