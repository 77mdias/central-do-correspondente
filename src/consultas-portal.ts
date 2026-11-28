// Consultas do portal do corretor (fase 3). Como no escritório: sem tempo real (D-32), lista a cada 30 s.
import { type QueryClient, useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { ClientePortal, FichaPortal } from "./tipos-api";

export const chavesPortal = {
  clientes: (conta: string) => ["portal", conta] as const,
  ficha: (conta: string, id: string) => ["portal-ficha", conta, id] as const,
};

export const usePortalClientes = (conta: string) =>
  useQuery({
    queryKey: chavesPortal.clientes(conta),
    queryFn: () => api<ClientePortal[]>(`/api/contas/${conta}/portal/clientes`),
    refetchInterval: 30_000,
  });

export const useFichaPortal = (conta: string, id: string | null) =>
  useQuery({
    queryKey: chavesPortal.ficha(conta, id ?? ""),
    queryFn: () => api<FichaPortal>(`/api/contas/${conta}/portal/clientes/${id}`),
    enabled: !!id,
  });

/** Depois de anexar: lista e ficha do portal. */
export function recarregarPortal(qc: QueryClient, conta: string, id: string) {
  void qc.invalidateQueries({ queryKey: chavesPortal.clientes(conta) });
  void qc.invalidateQueries({ queryKey: chavesPortal.ficha(conta, id) });
}
