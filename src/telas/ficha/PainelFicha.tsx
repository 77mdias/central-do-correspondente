import { useSearchParams } from "react-router";
import { PainelLateral } from "@/componentes/PainelLateral";
import { useClientes } from "@/consultas-escritorio";
import type { EscritorioResumo } from "@/tipos-api";
import { Ficha } from "./Ficha";
import { NovoCliente } from "./NovoCliente";

/** Ficha ou novo cliente no painel lateral, aberto pelo endereço em qualquer tela do escritório. */
export function PainelFicha({ escritorio }: { escritorio: EscritorioResumo }) {
  const [params, setParams] = useSearchParams();
  const id = params.get("cliente");
  const novo = params.get("novo") === "1";
  const clientes = useClientes(escritorio.contaId);
  const nome = clientes.data?.find((c) => c.id === id)?.nome;

  const mudar = (f: (p: URLSearchParams) => void, substituir = false) => {
    const p = new URLSearchParams(params);
    f(p);
    setParams(p, { replace: substituir });
  };
  const fechar = () =>
    mudar((p) => {
      p.delete("cliente");
      p.delete("novo");
    });
  const origem = params.get("origem");

  return (
    <PainelLateral aberto={!!id || novo} aoFechar={fechar} titulo={novo ? "Novo cliente" : (nome ?? "Cliente")}>
      {novo ? (
        <NovoCliente
          escritorio={escritorio}
          corretorInicial={origem && origem !== "todos" && origem !== "diretos" ? origem : null}
          aoCriar={(novoId) =>
            mudar((p) => {
              p.delete("novo");
              p.set("cliente", novoId);
            }, true)
          }
        />
      ) : (
        id && <Ficha key={id} escritorio={escritorio} id={id} aoExcluir={fechar} />
      )}
    </PainelLateral>
  );
}
