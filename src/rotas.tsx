import { createBrowserRouter, Navigate } from "react-router";
import { Casca } from "./componentes/Casca";
import { ExigeSessao } from "./componentes/Sessao";
import { ultimoEscritorio } from "./consultas";
import { destinoAposEntrar } from "./regras/destino";
import { AceitarConvite } from "./telas/AceitarConvite";
import { ConfirmeEmail } from "./telas/ConfirmeEmail";
import { CriarEscritorio } from "./telas/CriarEscritorio";
import { Entrar } from "./telas/Entrar";
import { Equipe } from "./telas/Equipe";
import { EscolherEscritorio } from "./telas/EscolherEscritorio";
import { EsqueciSenha } from "./telas/EsqueciSenha";
import { Inicio } from "./telas/Inicio";
import { NovaSenha } from "./telas/NovaSenha";

export const rotas = createBrowserRouter([
  { path: "/", element: <ExigeSessao>{(eu) => <Navigate to={destinoAposEntrar(eu.escritorios, ultimoEscritorio.ler())} replace />}</ExigeSessao> },
  {
    path: "/e/:contaId",
    element: <ExigeSessao>{(eu) => <Casca eu={eu} />}</ExigeSessao>,
    children: [
      { index: true, element: <Inicio /> },
      { path: "equipe", element: <Equipe /> },
    ],
  },
  { path: "/criar-escritorio", element: <CriarEscritorio /> },
  { path: "/entrar", element: <Entrar /> },
  { path: "/confirme-o-email", element: <ConfirmeEmail /> },
  { path: "/esqueci-a-senha", element: <EsqueciSenha /> },
  { path: "/nova-senha", element: <NovaSenha /> },
  { path: "/convite/:token", element: <AceitarConvite /> },
  { path: "/escritorios", element: <ExigeSessao>{(eu) => <EscolherEscritorio eu={eu} />}</ExigeSessao> },
  { path: "*", element: <Navigate to="/" replace /> },
]);
