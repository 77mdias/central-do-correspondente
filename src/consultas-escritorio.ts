// Consultas da fase 2. Sem tempo real (D-32): listas a cada 30 s, ao voltar para a aba e depois de gravar.
import { type QueryClient, useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { AtualizacaoRecente, ClienteLista, Corretor, Ficha } from "./tipos-api";

export const chavesEscritorio = {
  clientes: (conta: string) => ["clientes", conta] as const,
  ficha: (conta: string, id: string) => ["ficha", conta, id] as const,
  corretores: (conta: string) => ["corretores", conta] as const,
  historico: (conta: string) => ["historico", conta] as const,
};

const LISTA = { refetchInterval: 30_000 } as const;

export const useClientes = (conta: string) =>
  useQuery({ queryKey: chavesEscritorio.clientes(conta), queryFn: () => api<ClienteLista[]>(`/api/contas/${conta}/clientes`), ...LISTA });

export const useCorretores = (conta: string) =>
  useQuery({ queryKey: chavesEscritorio.corretores(conta), queryFn: () => api<Corretor[]>(`/api/contas/${conta}/corretores`), ...LISTA });

export const useHistoricoRecente = (conta: string) =>
  useQuery({ queryKey: chavesEscritorio.historico(conta), queryFn: () => api<AtualizacaoRecente[]>(`/api/contas/${conta}/historico`), ...LISTA });

export const useFicha = (conta: string, id: string | null) =>
  useQuery({
    queryKey: chavesEscritorio.ficha(conta, id ?? ""),
    queryFn: () => api<Ficha>(`/api/contas/${conta}/clientes/${id}`),
    enabled: !!id,
  });

/** Depois de gravar algo de um cliente: lista, ficha e últimas atualizações. */
export function recarregarCliente(qc: QueryClient, conta: string, id?: string) {
  void qc.invalidateQueries({ queryKey: chavesEscritorio.clientes(conta) });
  void qc.invalidateQueries({ queryKey: chavesEscritorio.historico(conta) });
  if (id) void qc.invalidateQueries({ queryKey: chavesEscritorio.ficha(conta, id) });
}

/** Troca o cliente na lista em cache sem esperar a próxima leitura. */
export function atualizarNaLista(qc: QueryClient, conta: string, c: ClienteLista) {
  qc.setQueryData<ClienteLista[]>(chavesEscritorio.clientes(conta), (l) => l?.map((x) => (x.id === c.id ? c : x)));
}
