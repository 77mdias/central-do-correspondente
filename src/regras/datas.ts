// "Hoje" é sempre o dia em America/Sao_Paulo (RNF-05), igual ao hoje_br() do banco, e não o dia do aparelho.

const DIA = 864e5;
const formatoDia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });

/** Dia de hoje em Brasília, `AAAA-MM-DD`. */
export const hojeBr = (agora: Date = new Date()): string => formatoDia.format(agora);

/** Dia em Brasília de um instante ISO (ex.: data em que um documento foi marcado no protótipo). */
export const diaBr = (instante: string): string => formatoDia.format(new Date(instante));

const utc = (dia: string) => {
  const [a, m, d] = dia.split("-").map(Number);
  return Date.UTC(a!, m! - 1, d!);
};

/** `AAAA-MM-DD` + n dias. */
export const somarDias = (dia: string, n: number): string => new Date(utc(dia) + n * DIA).toISOString().slice(0, 10);

/** Dias de `hoje` até `dia` (negativo = já passou). */
export const diasAte = (dia: string, hoje: string): number => Math.round((utc(dia) - utc(hoje)) / DIA);

/** Dias inteiros desde um instante, como o `dias()` do protótipo (conta horas, não o calendário). */
export const diasDesde = (instante: string | null | undefined, agora: Date = new Date()): number =>
  instante ? Math.floor((agora.getTime() - new Date(instante).getTime()) / DIA) : 0;

/** `AAAA-MM-DD` → `DD/MM/AAAA`. */
export const dataBr = (dia: string | null | undefined): string => (dia ? dia.split("-").reverse().join("/") : "");

/** `AAAA-MM-DD` → `DD/MM`. */
export const dataCurta = (dia: string | null | undefined): string => (dia ? dia.split("-").reverse().slice(0, 2).join("/") : "");
