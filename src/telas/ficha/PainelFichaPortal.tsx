import { useSearchParams } from "react-router";
import { PainelLateral } from "@/componentes/PainelLateral";
import { usePortalClientes } from "@/consultas-portal";
import type { EscritorioResumo } from "@/tipos-api";
import { FichaPortal } from "./FichaPortal";

/** Ficha do portal no painel lateral, aberta pelo endereço (`?cliente=<id>`). */
export function PainelFichaPortal({ escritorio }: { escritorio: EscritorioResumo }) {
  const [params, setParams] = useSearchParams();
  const id = params.get("cliente");
  const nome = usePortalClientes(escritorio.contaId).data?.find((c) => c.id === id)?.nome;
  const fechar = () => {
    const p = new URLSearchParams(params);
    p.delete("cliente");
    setParams(p);
  };
  return (
    <PainelLateral aberto={!!id} aoFechar={fechar} titulo={nome ?? "Cliente"}>
      {id && <FichaPortal key={id} escritorio={escritorio} id={id} />}
    </PainelLateral>
  );
}
