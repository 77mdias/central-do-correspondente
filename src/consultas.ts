import { QueryClient, useQuery } from "@tanstack/react-query";
import { api, ErroApi } from "./api";
import type { Equipe, Eu } from "./tipos-api";

export const clienteConsultas = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true, // sem tempo real: atualiza ao voltar para a aba (D-32)
      retry: (n, e) => !(e instanceof ErroApi && e.status < 500) && n < 2,
    },
  },
});

export const chaves = { eu: ["eu"] as const, equipe: (contaId: string) => ["equipe", contaId] as const };

export const useEu = () => useQuery({ queryKey: chaves.eu, queryFn: () => api<Eu>("/api/eu") });

export const useEquipe = (contaId: string) =>
  useQuery({ queryKey: chaves.equipe(contaId), queryFn: () => api<Equipe>(`/api/contas/${contaId}/equipe`), refetchInterval: 30_000 });

/** Último escritório usado (conveniência por aparelho; pode falhar em aba anônima). */
export const ultimoEscritorio = {
  ler: (): string | null => {
    try {
      return localStorage.getItem("ultimoEscritorio");
    } catch {
      return null;
    }
  },
  guardar: (id: string) => {
    try {
      localStorage.setItem("ultimoEscritorio", id);
    } catch {
      /* sem armazenamento: só não lembra */
    }
  },
};
