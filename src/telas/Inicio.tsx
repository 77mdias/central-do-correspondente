import { useOutletContext } from "react-router";
import type { EscritorioResumo } from "@/tipos-api";

export function Inicio() {
  const escritorio = useOutletContext<EscritorioResumo>();
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">{escritorio.nomeEscritorio}</h1>
      <p className="text-texto-2">Em breve aqui: as cobranças do dia, os processos parados e os documentos que faltam.</p>
    </section>
  );
}
