import { readFileSync } from "node:fs";
import { converterPrototipo, esquemaArquivoPrototipo, esquemaDadosImportacao } from "./importacao";

const EXEMPLO = JSON.parse(readFileSync(new URL("../../tests/fixtures/prototipo-exemplo.json", import.meta.url), "utf8"));
const AGORA = new Date("2026-11-22T15:00:00Z");
const converter = (json: unknown = EXEMPLO) => converterPrototipo(esquemaArquivoPrototipo.parse(json), AGORA);
const cliente = (id: string) => converter().dados.clientes.find((c) => c.idOrigem === id)!;

test("o exemplo converte com as contagens certas", () => {
  expect(converter().previa).toEqual({ corretores: 2, clientes: 4, documentos: 3, notas: 4, anexosParaReenviar: 2, percentual: 1.2 });
});

test("a saída passa no esquema da função do banco", () => {
  expect(esquemaDadosImportacao.safeParse(converter().dados).success).toBe(true);
});

test("arquivo de outro formato, de outra versão ou sem origem é recusado", () => {
  expect(esquemaArquivoPrototipo.safeParse({ ...EXEMPLO, formato: "x" }).success).toBe(false);
  expect(esquemaArquivoPrototipo.safeParse({ ...EXEMPLO, versao: 2 }).success).toBe(false);
  expect(esquemaArquivoPrototipo.safeParse({ ...EXEMPLO, origem: undefined }).success).toBe(false);
});

test("valores em reais viram centavos; 'valor' antigo cai no valor do imóvel", () => {
  const c = cliente("c1");
  expect([c.valor_imovel_centavos, c.valor_financiado_centavos, c.valor_avaliacao_centavos, c.fgts_centavos]).toEqual([25000000, 20000000, 26000000, 1000000]);
  expect(cliente("c2").valor_imovel_centavos).toBe(40000000);
});

test("nomes de etapa e modalidade viram os códigos", () => {
  expect([cliente("c1").etapa, cliente("c1").modalidade]).toEqual(["concluido", "mcmv"]);
  expect([cliente("c2").etapa, cliente("c2").modalidade]).toEqual(["documentacao_pendente", "sbpe"]);
});

test("documento marcado às 22h30 de Brasília cai no dia certo; false é pendente", () => {
  expect(cliente("c1").documentos).toEqual([
    { tipo: "rg", recebidoEm: "2026-01-16" },
    { tipo: "cpf", recebidoEm: "2026-01-16" },
  ]);
});

test("telefone com DDI 55 perde o 55; CPF com máscara fica só com dígitos; e-mail em minúsculas", () => {
  const c = cliente("c1");
  expect([c.whatsapp, c.cpf, c.email]).toEqual(["11977776666", "52998224725", "carla@exemplo.com"]);
});

test("remuneração recebida usa o dia da nota (em Brasília) e o contrato guarda o percentual", () => {
  expect(cliente("c1").remuneracao).toEqual({ pctContrato: 1, pctProprio: null, recebidaEm: "2026-04-01" });
  expect(cliente("c2").remuneracao.pctProprio).toBe(1.5);
});

test("remuneração recebida sem nota usa a data de hoje", () => {
  const j = structuredClone(EXEMPLO);
  j.clientes[0].historico = [];
  expect(converter(j).dados.clientes[0]!.remuneracao.recebidaEm).toBe("2026-11-22");
});

test("CPF e telefone que não cabem no banco viram nota e aviso, sem barrar", () => {
  const { dados, avisos } = converter();
  const c = dados.clientes.find((x) => x.idOrigem === "c2")!;
  expect([c.cpf, c.whatsapp]).toEqual([null, null]);
  expect(c.historico).toEqual([{ texto: "Dado do protótipo não importado · CPF: 1234567890 · Telefone: 9999-1111", criadoEm: null }]);
  expect(avisos.filter((a) => a.cliente === "Diego Inventado").map((a) => a.campo)).toEqual(["cpf", "whatsapp"]);
});

test("corretor removido vira cliente direto com aviso; modalidade desconhecida vira 'outra'", () => {
  const { avisos } = converter();
  const c = cliente("c3");
  expect([c.corretorIdOrigem, c.modalidade, c.etapa]).toEqual([null, "outra", "reprovado_cancelado"]);
  expect(avisos.filter((a) => a.cliente === "Elisa Inventada").map((a) => a.campo)).toEqual(["modalidade", "corretorId"]);
});

test("sem nome, etapa desconhecida e intervalo inválido entram com padrão e aviso", () => {
  const { avisos } = converter();
  const c = cliente("c4");
  expect([c.nome, c.etapa, c.intervalo_cobranca]).toEqual(["Sem nome", "documentacao_pendente", 3]);
  expect(avisos.filter((a) => a.cliente === "Sem nome").map((a) => a.campo)).toEqual(["etapa", "intervaloCobranca"]);
});

test("corretor sem telefone e sem imobiliária fica com nulos", () => {
  expect(converter().dados.corretores[1]).toEqual({
    idOrigem: "kB", nome: "Bruno Exemplo", imobiliaria: null, whatsapp: null, creci: null, email: null, criadoEm: "2026-02-01T12:00:00.000Z",
  });
});
