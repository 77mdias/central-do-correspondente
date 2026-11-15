import { Link, Navigate } from "react-router";
import { TelaSimples } from "@/componentes/ui";
import { ROTULO_PERFIL } from "@/regras/rotulos";
import type { Eu } from "@/tipos-api";

export function EscolherEscritorio({ eu }: { eu: Eu }) {
  if (eu.escritorios.length === 0) return <Navigate to="/criar-escritorio" replace />;
  return (
    <TelaSimples titulo="Escolha o escritório">
      <ul className="flex flex-col gap-2">
        {eu.escritorios.map((e) => (
          <li key={e.contaId}>
            <Link to={`/e/${e.contaId}`} className="flex flex-col rounded-md border border-borda bg-superficie p-4 hover:border-marca">
              <span className="font-medium">{e.nomeEscritorio}</span>
              <span className="text-sm text-texto-2">{ROTULO_PERFIL[e.perfil]}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link to="/criar-escritorio" className="text-sm text-marca underline">Criar outro escritório</Link>
    </TelaSimples>
  );
}
