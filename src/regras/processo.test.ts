import type { ClienteLista, CorretorResumo } from "../tipos-api";
import { DOCUMENTOS } from "./catalogo";
import { ativo, contratado, faltando, type Filtro, filtrar, nomeOrigem, ordenar, parado, resumo, situacaoCobranca } from "./processo";

const HOJE = "2026-11-22";
const AGORA = new Date("2026-11-22T15:00:00Z");
const todos = Object.fromEntries(DOCUMENTOS.map((d) => [d.codigo, "2026-11-01"]));

function cliente(p: Partial<ClienteLista> = {}): ClienteLista {
  return {
    id: p.id ?? Math.random().toString(36).slice(2),
    corretorId: null, nome: "Fulano de Tal", cpf: null, whatsapp: null, email: null, modalidade: "mcmv",
    etapa: "documentacao_pendente", valorImovelCentavos: null, valorFinanciadoCentavos: null, valorAvaliacaoCentavos: null,
    entradaCentavos: null, fgtsCentavos: null, subsidioCentavos: null, numeroContrato: null, dataAssinatura: null,
    proximaCobranca: HOJE, intervaloCobranca: 3, qtdCobrancas: 0, ultimaCobranca: null, observacoes: null,
    finalizadoEm: null, anexosApagarEm: null, criadoEm: "2026-11-01T12:00:00Z", atualizadoEm: "2026-11-21T12:00:00Z",
    documentos: {}, anexos: {},
    ...p,
  };
}

const corretores: CorretorResumo[] = [{ id: "k1", nome: "Ana Corretora", imobiliaria: "Casa Boa" }];

test("ativo exclui concluído e cancelado (RN-02)", () => {
  expect(ativo(cliente())).toBe(true);
  expect(ativo(cliente({ etapa: "concluido" }))).toBe(false);
  expect(ativo(cliente({ etapa: "reprovado_cancelado" }))).toBe(false);
});

test("faltando lista os pendentes na ordem do checklist", () => {
  const f = faltando(cliente({ documentos: { rg: "2026-11-01", cpf: null } }));
  expect(f.map((d) => d.codigo).slice(0, 3)).toEqual(["cpf", "civil", "resid"]);
  expect(f).toHaveLength(11);
});

test("cliente sem documento faltando não tem cobrança (RN-04)", () => {
  expect(situacaoCobranca(cliente({ documentos: todos }), HOJE)).toBeNull();
  expect(situacaoCobranca(cliente({ etapa: "concluido" }), HOJE)).toBeNull();
});

test("cobrança atrasada, de hoje e futura", () => {
  expect(situacaoCobranca(cliente({ proximaCobranca: "2026-11-21" }), HOJE)).toEqual({ classe: "atrasada", texto: "Cobrança atrasada 1 dia", vence: true });
  expect(situacaoCobranca(cliente({ proximaCobranca: "2026-11-19" }), HOJE)?.texto).toBe("Cobrança atrasada 3 dias");
  expect(situacaoCobranca(cliente({ proximaCobranca: HOJE }), HOJE)).toEqual({ classe: "hoje", texto: "Cobrar hoje", vence: true });
  expect(situacaoCobranca(cliente({ proximaCobranca: "2026-11-25" }), HOJE)).toEqual({ classe: "depois", texto: "Próxima cobrança 25/11", vence: false });
  expect(situacaoCobranca(cliente({ proximaCobranca: null }), HOJE)?.classe).toBe("hoje");
});

test("parado com 7 dias ou mais, só se ativo (RN-03)", () => {
  expect(parado(cliente({ atualizadoEm: "2026-11-15T15:00:00Z" }), AGORA)).toBe(true);
  expect(parado(cliente({ atualizadoEm: "2026-11-16T15:00:00Z" }), AGORA)).toBe(false);
  expect(parado(cliente({ atualizadoEm: "2026-01-01T00:00:00Z", etapa: "concluido" }), AGORA)).toBe(false);
});

test("contratado tem data de assinatura e não está cancelado (RN-05)", () => {
  expect(contratado(cliente({ dataAssinatura: "2026-03-10", etapa: "concluido" }))).toBe(true);
  expect(contratado(cliente({ dataAssinatura: "2026-03-10", etapa: "reprovado_cancelado" }))).toBe(false);
  expect(contratado(cliente())).toBe(false);
});

test("ordenação: ativos, depois cobrança vencida, depois mais dias parado (RF-14)", () => {
  const fim = cliente({ id: "fim", etapa: "concluido", atualizadoEm: "2026-01-01T00:00:00Z" });
  const vencido = cliente({ id: "vencido", proximaCobranca: "2026-11-20", atualizadoEm: "2026-11-21T00:00:00Z" });
  const velho = cliente({ id: "velho", proximaCobranca: "2026-12-01", atualizadoEm: "2026-10-01T00:00:00Z" });
  const novo = cliente({ id: "novo", proximaCobranca: "2026-12-01", atualizadoEm: "2026-11-21T00:00:00Z" });
  expect(ordenar([fim, novo, velho, vencido], HOJE, AGORA).map((c) => c.id)).toEqual(["vencido", "velho", "novo", "fim"]);
});

test("resumo dos cards e VGV ativo", () => {
  const r = resumo(
    [
      cliente({ valorImovelCentavos: 100 }),
      cliente({ valorImovelCentavos: 200, atualizadoEm: "2026-11-01T00:00:00Z", proximaCobranca: "2026-12-30" }),
      cliente({ valorImovelCentavos: 999, etapa: "concluido" }),
      cliente({ documentos: todos }),
    ],
    HOJE,
    AGORA,
  );
  expect(r).toEqual({ ativos: 3, hoje: 1, pendentes: 2, parados: 1, finalizados: 1, vgvAtivoCentavos: 300 });
});

const filtroBase: Filtro = { busca: "", origem: "todos", etapa: "", card: "todos" };

test("busca por nome, contrato, corretor e imobiliária", () => {
  const lista = [
    cliente({ id: "a", nome: "Maria Souza", numeroContrato: "8.4444" }),
    cliente({ id: "b", nome: "João", corretorId: "k1" }),
  ];
  const ids = (busca: string) => filtrar(lista, { ...filtroBase, busca }, corretores, HOJE, AGORA).map((c) => c.id);
  expect(ids("souza")).toEqual(["a"]);
  expect(ids("8.4444")).toEqual(["a"]);
  expect(ids("casa boa")).toEqual(["b"]);
  expect(ids("cliente direto")).toEqual(["a"]);
});

test("busca por 3 dígitos do telefone ou CPF; com 2 dígitos não usa dígitos", () => {
  const lista = [cliente({ id: "a", nome: "Ana", whatsapp: "11988887777", cpf: "52998224725" })];
  const n = (busca: string) => filtrar(lista, { ...filtroBase, busca }, corretores, HOJE, AGORA).length;
  expect(n("988")).toBe(1);
  expect(n("(11) 98888")).toBe(1);
  expect(n("529.982")).toBe(1);
  expect(n("98")).toBe(0);
});

test("filtro por origem, etapa e card", () => {
  const lista = [
    cliente({ id: "dir" }),
    cliente({ id: "k", corretorId: "k1", etapa: "analise_credito" }),
    cliente({ id: "fim", etapa: "concluido" }),
  ];
  const ids = (f: Partial<Filtro>) => filtrar(lista, { ...filtroBase, ...f }, corretores, HOJE, AGORA).map((c) => c.id);
  expect(ids({ origem: "diretos" })).toEqual(["dir", "fim"]);
  expect(ids({ origem: "k1" })).toEqual(["k"]);
  expect(ids({ etapa: "analise_credito" })).toEqual(["k"]);
  expect(ids({ card: "ativos" })).toEqual(["dir", "k"]);
  expect(ids({ card: "fim" })).toEqual(["fim"]);
  expect(ids({ card: "hoje" })).toEqual(["dir", "k"]);
});

test("nome da origem", () => {
  expect(nomeOrigem(null, corretores)).toBe("Cliente direto");
  expect(nomeOrigem("k1", corretores)).toBe("Ana Corretora");
  expect(nomeOrigem("sumiu", corretores)).toBe("Corretor removido");
});
