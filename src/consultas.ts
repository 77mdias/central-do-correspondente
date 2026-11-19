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

/**
 * Pista por aparelho de que há sessão aberta (não é a sessão: essa fica no cookie). Só decide o que
 * mostrar enquanto /api/eu responde: quem nunca entrou vê a landing na hora, sem esperar.
 * A mesma chave é lida no index.html, antes do JS.
 */
export const sessaoProvavel = {
  ler: (): boolean => {
    try {
      return localStorage.getItem("sessaoProvavel") !== null;
    } catch {
      return false;
    }
  },
  marcar: (sim: boolean) => {
    try {
      if (sim) localStorage.setItem("sessaoProvavel", "1");
      else localStorage.removeItem("sessaoProvavel");
    } catch {
      /* sem armazenamento: só não lembra */
    }
  },
};
