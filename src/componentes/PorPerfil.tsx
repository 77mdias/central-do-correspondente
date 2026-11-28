import type { ReactNode } from "react";
import { Navigate, useOutletContext } from "react-router";
import { Inicio } from "@/telas/Inicio";
import { MeusClientes } from "@/telas/MeusClientes";
import type { EscritorioResumo } from "@/tipos-api";

/** Início do escritório ou "Meus clientes" do corretor (RF-80), no mesmo endereço `/e/:contaId`. */
export function Indice() {
  const escritorio = useOutletContext<EscritorioResumo>();
  return escritorio.perfil === "corretor" ? <MeusClientes /> : <Inicio />;
}

/** Telas só do escritório: o corretor volta para "Meus clientes". */
export function SoEscritorio({ children }: { children: ReactNode }) {
  const escritorio = useOutletContext<EscritorioResumo>();
  if (escritorio.perfil === "corretor") return <Navigate to={`/e/${escritorio.contaId}`} replace />;
  return <>{children}</>;
}
