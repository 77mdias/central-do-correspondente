import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { ErroApi } from "@/api";
import { useEu } from "@/consultas";
import type { Eu } from "@/tipos-api";
import { Carregando } from "./Esqueleto";

/** Só mostra `children` com sessão; sem sessão, vai para /entrar e volta depois. */
export function ExigeSessao({ children }: { children: (eu: Eu) => ReactNode }) {
  const eu = useEu();
  const local = useLocation();
  if (eu.isPending) return <Carregando casca="app" />;
  if (eu.error instanceof ErroApi && eu.error.status === 401)
    return <Navigate to={`/entrar?volta=${encodeURIComponent(local.pathname)}`} replace />;
  if (eu.error) return <p className="p-6 text-perigo" role="alert">Não foi possível carregar. Tente de novo em instantes.</p>;
  return <>{children(eu.data)}</>;
}
