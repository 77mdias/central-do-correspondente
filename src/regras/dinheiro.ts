const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const reaisInteiros = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const formatarReais = (centavos: number) => reais.format(centavos / 100);

/** Valor digitado ("R$ 1.234,56", "1234,5", "350.000", "350000") → centavos; vazio ou inválido → null. Como o `num()` do protótipo. */
export function lerReais(v: string | number | null | undefined): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v * 100) : null;
  if (v == null) return null;
  let s = String(v).replace(/[R$\s]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** Valor curto dos cards (`Rk` do protótipo): "R$ 1,25 mi", "R$ 350 mil", "R$ 9.800". */
export function formatarReaisCurto(centavos: number | null | undefined): string {
  if (centavos == null) return "—";
  const v = centavos / 100;
  if (v >= 1e6) return "R$ " + (v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " mi";
  if (v >= 1e4) return "R$ " + (v / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + " mil";
  return reaisInteiros.format(v);
}

/** Percentual com até 3 casas (`P` do protótipo): 1,2 → "1,2%". */
export const formatarPercentual = (p: number | null | undefined) =>
  p == null ? "—" : p.toLocaleString("pt-BR", { maximumFractionDigits: 3 }) + "%";
