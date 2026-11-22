// VGV e comissões (RF-51 a RF-56), como o renderVGV do protótipo. Entram as linhas de vw_remuneracao
// (só a gestora as recebe); remuneração e percentual já vêm calculados pelo banco (RN-08 a RN-10).
import type { CorretorResumo, LinhaRemuneracao } from "../tipos-api";
import { ETAPAS, ETAPAS_FIM, type Etapa } from "./catalogo";

export type Periodo = "mes" | "ant" | "ano" | "tudo";
export const NOME_PERIODO: Record<Periodo, string> = { mes: "Este mês", ant: "Mês anterior", ano: "Este ano", tudo: "Todo o período" };

/** Data de assinatura dentro do período, contado a partir de `hoje` (AAAA-MM-DD, em Brasília). */
export function noPeriodo(dia: string | null, periodo: Periodo, hoje: string): boolean {
  if (!dia) return false;
  if (periodo === "tudo") return true;
  if (periodo === "mes") return dia.slice(0, 7) === hoje.slice(0, 7);
  if (periodo === "ano") return dia.slice(0, 4) === hoje.slice(0, 4);
  const [a, m] = hoje.split("-").map(Number) as [number, number];
  const anterior = m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
  return dia.slice(0, 7) === anterior;
}

const soma = (l: readonly LinhaRemuneracao[], f: (x: LinhaRemuneracao) => number | null) => l.reduce((s, x) => s + (f(x) ?? 0), 0);
const ativo = (e: Etapa) => !ETAPAS_FIM.includes(e);

export type ResumoVgv = {
  pipeline: { n: number; vgv: number; financiado: number; remuneracao: number };
  contratado: { n: number; vgv: number; financiado: number; cotaMedia: number | null; remuneracao: number; recebida: number; ticketMedio: number | null };
  semValor: number;
  aReceber: { n: number; total: number };
};

/** Valores em centavos; cota média em % (financiado ÷ VGV). */
export function resumoVgv(linhas: readonly LinhaRemuneracao[], periodo: Periodo, hoje: string): ResumoVgv {
  const ct = linhas.filter((l) => l.contratado && noPeriodo(l.dataAssinatura, periodo, hoje));
  const pipe = linhas.filter((l) => ativo(l.etapa) && !l.contratado);
  const aReceber = linhas.filter((l) => l.contratado && !l.recebidaEm);
  const vgv = soma(ct, (l) => l.valorImovelCentavos);
  const fin = soma(ct, (l) => l.valorFinanciadoCentavos);
  return {
    pipeline: { n: pipe.length, vgv: soma(pipe, (l) => l.valorImovelCentavos), financiado: soma(pipe, (l) => l.valorFinanciadoCentavos), remuneracao: soma(pipe, (l) => l.remuneracaoCentavos) },
    contratado: {
      n: ct.length,
      vgv,
      financiado: fin,
      cotaMedia: vgv ? (fin / vgv) * 100 : null,
      remuneracao: soma(ct, (l) => l.remuneracaoCentavos),
      recebida: soma(ct.filter((l) => l.recebidaEm), (l) => l.remuneracaoCentavos),
      ticketMedio: ct.length ? Math.round(vgv / ct.length) : null,
    },
    semValor: linhas.filter((l) => l.etapa !== "reprovado_cancelado" && (l.valorImovelCentavos == null || l.valorFinanciadoCentavos == null)).length,
    aReceber: { n: aReceber.length, total: soma(aReceber, (l) => l.remuneracaoCentavos) },
  };
}

export type LinhaOrigemVgv = { id: string; nome: string; casa: string; n: number; vgv: number; fin: number; rem: number; np: number; vgvP: number };

/** RF-54: por origem (clientes diretos e cada corretor), só as que têm contrato no período ou processo em andamento. */
export function porOrigemVgv(linhas: readonly LinhaRemuneracao[], corretores: readonly CorretorResumo[], periodo: Periodo, hoje: string): LinhaOrigemVgv[] {
  const ct = linhas.filter((l) => l.contratado && noPeriodo(l.dataAssinatura, periodo, hoje));
  const pipe = linhas.filter((l) => ativo(l.etapa) && !l.contratado);
  const origens = [
    { id: "diretos", nome: "Clientes diretos", casa: "—" },
    ...[...corretores].sort((a, b) => a.nome.localeCompare(b.nome)).map((k) => ({ id: k.id, nome: k.nome, casa: k.imobiliaria || "—" })),
  ];
  const da = (o: string) => (l: LinhaRemuneracao) => (l.corretorId ?? "diretos") === o;
  return origens
    .map((o) => {
      const c1 = ct.filter(da(o.id));
      const p1 = pipe.filter(da(o.id));
      return {
        ...o,
        n: c1.length,
        vgv: soma(c1, (l) => l.valorImovelCentavos),
        fin: soma(c1, (l) => l.valorFinanciadoCentavos),
        rem: soma(c1, (l) => l.remuneracaoCentavos),
        np: p1.length,
        vgvP: soma(p1, (l) => l.valorImovelCentavos),
      };
    })
    .filter((l) => l.n || l.np);
}

/** RF-55: VGV por etapa hoje (sem os cancelados). */
export function porEtapa(linhas: readonly LinhaRemuneracao[]): { etapa: Etapa; nome: string; n: number; vgv: number }[] {
  return ETAPAS.filter((e) => e.codigo !== "reprovado_cancelado").map((e) => {
    const cs = linhas.filter((l) => l.etapa === e.codigo);
    return { etapa: e.codigo, nome: e.nome, n: cs.length, vgv: soma(cs, (l) => l.valorImovelCentavos) };
  });
}
