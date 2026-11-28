import { useEffect } from "react";
import { createBrowserRouter, Navigate } from "react-router";
import { ErroApi } from "./api";
import { Casca } from "./componentes/Casca";
import { Carregando } from "./componentes/Esqueleto";
import { Indice, SoEscritorio } from "./componentes/PorPerfil";
import { ExigeSessao } from "./componentes/Sessao";
import { sessaoProvavel, ultimoEscritorio, useEu } from "./consultas";
import { destinoAposEntrar } from "./regras/destino";
import { AceitarConvite } from "./telas/AceitarConvite";
import { Clientes } from "./telas/Clientes";
import { CobrarHoje } from "./telas/CobrarHoje";
import { Corretores } from "./telas/Corretores";
import { Importar } from "./telas/Importar";
import { Vgv } from "./telas/Vgv";
import { ConfirmeEmail } from "./telas/ConfirmeEmail";
import { CriarEscritorio } from "./telas/CriarEscritorio";
import { Entrar } from "./telas/Entrar";
import { Equipe } from "./telas/Equipe";
import { EscolherEscritorio } from "./telas/EscolherEscritorio";
import { EsqueciSenha } from "./telas/EsqueciSenha";
import { Landing } from "./telas/Landing";
import { NovaSenha } from "./telas/NovaSenha";
import { Privacidade, Termos } from "./telas/TermosPrivacidade";

/**
 * Raiz: Landing para quem não tem sessão, escritório para quem tem. A landing é pública e não espera
 * a sessão: só quem já entrou neste aparelho vê a casca do app enquanto /api/eu responde.
 */
export function Entrada() {
  const eu = useEu();
  const semSessao = eu.error instanceof ErroApi && eu.error.status === 401;
  useEffect(() => {
    if (semSessao) sessaoProvavel.marcar(false);
  }, [semSessao]);
  if (eu.data) return <Navigate to={destinoAposEntrar(eu.data.escritorios, ultimoEscritorio.ler())} replace />;
  // isFetching e não isPending: logo depois de entrar, a consulta antiga (401) ainda existe enquanto a nova não chega.
  if (eu.isFetching && sessaoProvavel.ler()) return <Carregando casca="app" />;
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
      { index: true, element: <Indice /> },
      { path: "clientes", element: <SoEscritorio><Clientes /></SoEscritorio> },
      { path: "cobrar", element: <SoEscritorio><CobrarHoje /></SoEscritorio> },
      { path: "corretores", element: <SoEscritorio><Corretores /></SoEscritorio> },
      { path: "vgv", element: <SoEscritorio><Vgv /></SoEscritorio> },
      { path: "importar", element: <SoEscritorio><Importar /></SoEscritorio> },
      { path: "equipe", element: <SoEscritorio><Equipe /></SoEscritorio> },
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
