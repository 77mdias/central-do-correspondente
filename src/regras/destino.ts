import type { EscritorioResumo } from "../tipos-api";

/** Para onde vai quem acabou de entrar: criar escritório, o único que tem, o último usado ou a escolha. */
export function destinoAposEntrar(escritorios: EscritorioResumo[], ultimoContaId: string | null): string {
  if (escritorios.length === 0) return "/criar-escritorio";
  if (escritorios.length === 1) return `/e/${escritorios[0]!.contaId}`;
  return escritorios.some((e) => e.contaId === ultimoContaId) ? `/e/${ultimoContaId}` : "/escritorios";
}
