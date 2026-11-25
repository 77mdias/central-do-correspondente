// Logs do Worker sem dados pessoais (spec da fase 3, §12.4). Vão para o Workers Logs em produção.
// Nunca: nome, CPF, e-mail, telefone, conteúdo de ficha, nome de arquivo nem o `detail` de erro do Postgres.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /[^\s"'<>(),;:]+@[^\s"'<>(),;:]+\.[^\s"'<>(),;:]+/g;
// 8 dígitos ou mais, com ou sem separadores: CPF, CNPJ, telefone, CEP
const NUMERO = /\+?\d(?:[\d.\-/() ]{6,}\d)/g;

/** Tira e-mails e números longos de um texto livre e corta o tamanho. */
export function limpar(texto: string, max = 300): string {
  return texto.replace(EMAIL, "[e-mail]").replace(NUMERO, "[número]").slice(0, max);
}

type ErroPg = { code?: unknown; severity?: unknown; routine?: unknown; constraint?: unknown; table?: unknown; column?: unknown };

/** Erro do driver do Postgres: tem `code` de 5 caracteres e campos que só ele preenche. */
function ehErroPg(e: unknown): e is Error & ErroPg {
  const x = (e ?? {}) as ErroPg;
  return typeof x.code === "string" && /^[0-9A-Z]{5}$/.test(x.code) && ("severity" in x || "routine" in x);
}

export type Resumo = {
  nome: string;
  mensagem?: string;
  codigo?: string;
  constraint?: string;
  tabela?: string;
  coluna?: string;
  pilha?: string[];
};

/**
 * O que pode ir para o log de um erro. Do Postgres, só código, constraint, tabela e coluna: a mensagem
 * (ex.: "invalid input syntax … \"<valor>\"") e o `detail` (a linha inteira) podem trazer dados.
 * Dos outros, a mensagem limpa e as linhas da pilha (que só têm arquivo e linha).
 */
export function resumir(e: unknown): Resumo {
  if (ehErroPg(e)) {
    const r: Resumo = { nome: "ErroPostgres", codigo: e.code as string };
    if (typeof e.constraint === "string") r.constraint = e.constraint;
    if (typeof e.table === "string") r.tabela = e.table;
    if (typeof e.column === "string") r.coluna = e.column;
    return r;
  }
  if (e instanceof Error) {
    const pilha = (e.stack ?? "")
      .split("\n")
      .filter((l) => l.trim().startsWith("at "))
      .slice(0, 6)
      .map((l) => limpar(l.trim(), 200));
    return { nome: e.name, mensagem: limpar(e.message), ...(pilha.length ? { pilha } : {}) };
  }
  return { nome: typeof e };
}

/** Só ids (uuid) e números passam; qualquer outro valor é descartado. */
function soIds(extra: Record<string, unknown>): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(extra).filter(([, v]) => (typeof v === "number" && Number.isFinite(v)) || (typeof v === "string" && UUID.test(v))),
  ) as Record<string, string | number>;
}

/** `onde` é um texto fixo do código (ex.: "rota GET /api/contas/:contaId/clientes"), nunca um valor do pedido. */
export function registrarErro(onde: string, e: unknown, extra: Record<string, unknown> = {}): void {
  console.error({ onde, ...soIds(extra), ...resumir(e) });
}

/** Logger do Better Auth: avisos e erros dele passam pela mesma limpeza. */
export function logAuth(nivel: string, mensagem: string, ...args: unknown[]): void {
  if (nivel !== "warn" && nivel !== "error") return;
  const erro = args.find((a) => a instanceof Error);
  const linha = { onde: "auth", nivel, mensagem: limpar(mensagem), ...(erro ? { erro: resumir(erro) } : {}) };
  if (nivel === "error") console.error(linha);
  else console.warn(linha);
}
