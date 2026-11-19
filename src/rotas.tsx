import { createBrowserRouter, Navigate } from "react-router";
import { ErroApi } from "./api";
import { Casca } from "./componentes/Casca";
import { ExigeSessao } from "./componentes/Sessao";
import { ultimoEscritorio, useEu } from "./consultas";
import { destinoAposEntrar } from "./regras/destino";
import { AceitarConvite } from "./telas/AceitarConvite";
import { ConfirmeEmail } from "./telas/ConfirmeEmail";
import { CriarEscritorio } from "./telas/CriarEscritorio";
import { Entrar } from "./telas/Entrar";
import { Equipe } from "./telas/Equipe";
import { EscolherEscritorio } from "./telas/EscolherEscritorio";
import { EsqueciSenha } from "./telas/EsqueciSenha";
import { Inicio } from "./telas/Inicio";
import { Landing } from "./telas/Landing";
import { NovaSenha } from "./telas/NovaSenha";
import { Privacidade, Termos } from "./telas/TermosPrivacidade";

/** Raiz: mostra a Landing quando sem sessão e envia direto ao escritório quando autenticado. */
export function Entrada() {
  const eu = useEu();
  if (eu.isPending) return <p className="p-6 text-texto-2" role="status">Carregando…</p>;
  if (eu.data) return <Navigate to={destinoAposEntrar(eu.data.escritorios, ultimoEscritorio.ler())} replace />;
  if (eu.error && !(eu.error instanceof ErroApi && eu.error.status === 401)) return <Landing />;
  return <Landing />;
}

export const rotas = createBrowserRouter([
  { path: "/", element: <Entrada /> },
  { path: "/landing", element: <Landing /> },
  { path: "/termos", element: <Termos /> },
  { path: "/privacidade", element: <Privacidade /> },
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
