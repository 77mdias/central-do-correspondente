// Regras de exibição do processo, copiadas do protótipo regra por regra
// (docs/prototipo/prototipo.html: ativo, faltando, cobranca, parado, contratado, visiveis, resumo).
import type { ClienteLista, CorretorResumo } from "../tipos-api";
import { DIAS_PARADO, DOCUMENTOS, ETAPAS_FIM } from "./catalogo";
import { dataCurta, diasAte, diasDesde } from "./datas";

type Cliente = Pick<ClienteLista, "etapa" | "documentos" | "proximaCobranca" | "atualizadoEm" | "dataAssinatura">;

/** RN-02. */
export const ativo = (c: Pick<ClienteLista, "etapa">) => !ETAPAS_FIM.includes(c.etapa);

/** Documentos do checklist ainda sem data de recebimento, na ordem. */
export const faltando = (c: Pick<ClienteLista, "documentos">) => DOCUMENTOS.filter((d) => !c.documentos[d.codigo]);

export type SituacaoCobranca = { classe: "atrasada" | "hoje" | "depois"; texto: string; vence: boolean };

/** RN-04: só há cobrança com processo ativo e documento faltando. Sem data, cobra hoje. */
export function situacaoCobranca(c: Cliente, hoje: string): SituacaoCobranca | null {
  if (!ativo(c) || !faltando(c).length) return null;
  const p = c.proximaCobranca ?? hoje;
  const n = diasAte(p, hoje);
  if (n < 0) return { classe: "atrasada", texto: `Cobrança atrasada ${-n} dia${n === -1 ? "" : "s"}`, vence: true };
  if (n === 0) return { classe: "hoje", texto: "Cobrar hoje", vence: true };
  return { classe: "depois", texto: `Próxima cobrança ${dataCurta(p)}`, vence: false };
}

/** RN-03. */
export const parado = (c: Cliente, agora: Date) => ativo(c) && diasDesde(c.atualizadoEm, agora) >= DIAS_PARADO;

/** RN-05. */
export const contratado = (c: Pick<ClienteLista, "dataAssinatura" | "etapa">) => !!c.dataAssinatura && c.etapa !== "reprovado_cancelado";

const vence = (c: Cliente, hoje: string) => (situacaoCobranca(c, hoje)?.vence ? 1 : 0);

/** RF-14: ativos primeiro, depois cobrança vencida, depois mais dias sem atualização. */
export function ordenar<T extends Cliente>(lista: readonly T[], hoje: string, agora: Date): T[] {
  return [...lista].sort(
    (a, b) =>
      Number(ativo(b)) - Number(ativo(a)) ||
      vence(b, hoje) - vence(a, hoje) ||
      diasDesde(b.atualizadoEm, agora) - diasDesde(a.atualizadoEm, agora),
  );
}

export type Resumo = { ativos: number; hoje: number; pendentes: number; parados: number; finalizados: number; vgvAtivoCentavos: number };

/** Contadores do Início e dos cards (RF-01, RF-13). VGV ativo = soma do valor do imóvel dos ativos. */
export function resumo(lista: readonly (Cliente & Pick<ClienteLista, "valorImovelCentavos">)[], hoje: string, agora: Date): Resumo {
  const at = lista.filter(ativo);
  return {
    ativos: at.length,
    hoje: at.filter((c) => situacaoCobranca(c, hoje)?.vence).length,
    pendentes: at.filter((c) => faltando(c).length).length,
    parados: at.filter((c) => parado(c, agora)).length,
    finalizados: lista.length - at.length,
    vgvAtivoCentavos: at.reduce((s, c) => s + (c.valorImovelCentavos ?? 0), 0),
  };
}

/** "todos", "diretos" ou o id de um corretor. */
export type Origem = "todos" | "diretos" | (string & {});
export type Card = "todos" | "ativos" | "hoje" | "pend" | "parados" | "fim";

export const daOrigem = (c: Pick<ClienteLista, "corretorId">, o: Origem) => o === "todos" || (c.corretorId ?? "") === (o === "diretos" ? "" : o);

/** Nome que aparece como origem do cliente. */
export function nomeOrigem(corretorId: string | null, corretores: readonly CorretorResumo[]): string {
  if (!corretorId) return "Cliente direto";
  return corretores.find((k) => k.id === corretorId)?.nome ?? "Corretor removido";
}

function casaOrigem(corretorId: string | null, corretores: readonly CorretorResumo[]): string {
  if (!corretorId) return "Sem corretor";
  return corretores.find((k) => k.id === corretorId)?.imobiliaria ?? "";
}

export type Filtro = { busca: string; origem: Origem; etapa: string; card: Card };

/**
 * RF-12 e RF-13. A busca procura em nome, nº do contrato, nome do corretor e imobiliária; com 3 dígitos ou mais,
 * também no CPF e no telefone.
 */
export function filtrar<T extends ClienteLista>(
  lista: readonly T[],
  f: Filtro,
  corretores: readonly CorretorResumo[],
  hoje: string,
  agora: Date,
): T[] {
  const q = f.busca.trim().toLowerCase();
  const qd = q.replace(/\D/g, "");
  return lista.filter((c) => {
    if (!daOrigem(c, f.origem)) return false;
    if (f.etapa && c.etapa !== f.etapa) return false;
    if (f.card === "ativos" && !ativo(c)) return false;
    if (f.card === "hoje" && !situacaoCobranca(c, hoje)?.vence) return false;
    if (f.card === "pend" && !(ativo(c) && faltando(c).length)) return false;
    if (f.card === "parados" && !parado(c, agora)) return false;
    if (f.card === "fim" && ativo(c)) return false;
    if (q) {
      const texto = [c.nome, c.numeroContrato ?? "", nomeOrigem(c.corretorId, corretores), casaOrigem(c.corretorId, corretores)]
        .join(" ")
        .toLowerCase();
      const digitos = `${(c.cpf ?? "").replace(/\D/g, "")} ${(c.whatsapp ?? "").replace(/\D/g, "")}`;
      if (!(texto.includes(q) || (qd.length >= 3 && digitos.includes(qd)))) return false;
    }
    return true;
  });
}
