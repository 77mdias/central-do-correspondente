import type { LinhaRemuneracao } from "../tipos-api";
import { noPeriodo, porEtapa, porOrigemVgv, resumoVgv } from "./vgv";

const HOJE = "2026-11-22";
function linha(p: Partial<LinhaRemuneracao>): LinhaRemuneracao {
  return {
    clienteId: Math.random().toString(36).slice(2), nome: "X", corretorId: null, etapa: "documentacao_pendente", dataAssinatura: null,
    valorImovelCentavos: null, valorFinanciadoCentavos: null, contratado: false, pctUsado: 1, remuneracaoCentavos: null, cota: null, recebidaEm: null,
    ...p,
  };
}

test("período: este mês, mês anterior (inclusive virada de ano), este ano e tudo", () => {
  expect(noPeriodo("2026-11-01", "mes", HOJE)).toBe(true);
  expect(noPeriodo("2026-10-31", "mes", HOJE)).toBe(false);
  expect(noPeriodo("2026-10-31", "ant", HOJE)).toBe(true);
  expect(noPeriodo("2025-12-15", "ant", "2026-01-10")).toBe(true);
  expect(noPeriodo("2026-01-02", "ano", HOJE)).toBe(true);
  expect(noPeriodo("2025-12-31", "ano", HOJE)).toBe(false);
  expect(noPeriodo("2020-01-01", "tudo", HOJE)).toBe(true);
  expect(noPeriodo(null, "tudo", HOJE)).toBe(false);
});

// conjunto de exemplo, calculado à mão com as fórmulas do renderVGV do protótipo
const LINHAS = [
  linha({ corretorId: "k1", etapa: "concluido", contratado: true, dataAssinatura: "2026-11-05", valorImovelCentavos: 25000000, valorFinanciadoCentavos: 20000000, remuneracaoCentavos: 240000, recebidaEm: "2026-11-20" }),
  linha({ etapa: "registro_cartorio", contratado: true, dataAssinatura: "2026-11-10", valorImovelCentavos: 15000000, valorFinanciadoCentavos: 12000000, remuneracaoCentavos: 144000 }),
  linha({ corretorId: "k1", etapa: "concluido", contratado: true, dataAssinatura: "2026-10-03", valorImovelCentavos: 30000000, valorFinanciadoCentavos: 21000000, remuneracaoCentavos: 210000 }),
  linha({ corretorId: "k1", etapa: "analise_credito", valorImovelCentavos: 40000000, valorFinanciadoCentavos: 30000000, remuneracaoCentavos: 360000 }),
  linha({ etapa: "documentacao_pendente", valorImovelCentavos: 18000000 }),
  linha({ etapa: "reprovado_cancelado", valorImovelCentavos: 99900000 }),
];

test("resumo do mês: VGV, financiado, cota média, remuneração, recebida, ticket, pipeline e a receber", () => {
  expect(resumoVgv(LINHAS, "mes", HOJE)).toEqual({
    pipeline: { n: 2, vgv: 58000000, financiado: 30000000, remuneracao: 360000 },
    contratado: { n: 2, vgv: 40000000, financiado: 32000000, cotaMedia: 80, remuneracao: 384000, recebida: 240000, ticketMedio: 20000000 },
    semValor: 1,
    aReceber: { n: 2, total: 354000 },
  });
});

test("tabela por origem no mês", () => {
  expect(porOrigemVgv(LINHAS, [{ id: "k1", nome: "Ana", imobiliaria: "Casa Boa" }], "mes", HOJE)).toEqual([
    { id: "diretos", nome: "Clientes diretos", casa: "—", n: 1, vgv: 15000000, fin: 12000000, rem: 144000, np: 1, vgvP: 18000000 },
    { id: "k1", nome: "Ana", casa: "Casa Boa", n: 1, vgv: 25000000, fin: 20000000, rem: 240000, np: 1, vgvP: 40000000 },
  ]);
});

test("VGV por etapa sem os cancelados", () => {
  const e = porEtapa(LINHAS);
  expect(e).toHaveLength(9);
  expect(e.find((x) => x.etapa === "concluido")).toMatchObject({ n: 2, vgv: 55000000 });
});
