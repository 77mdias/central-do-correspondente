import { createBrowserRouter, Navigate } from "react-router";
import { Casca } from "./componentes/Casca";
import { ExigeSessao } from "./componentes/Sessao";
import { ultimoEscritorio } from "./consultas";
import { destinoAposEntrar } from "./regras/destino";
import { Inicio } from "./telas/Inicio";

export const rotas = createBrowserRouter([
  { path: "/", element: <ExigeSessao>{(eu) => <Navigate to={destinoAposEntrar(eu.escritorios, ultimoEscritorio.ler())} replace />}</ExigeSessao> },
  {
    path: "/e/:contaId",
    element: <ExigeSessao>{(eu) => <Casca eu={eu} />}</ExigeSessao>,
    children: [{ index: true, element: <Inicio /> }],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
