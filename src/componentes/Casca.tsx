import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Navigate, NavLink, Outlet, useNavigate, useParams } from "react-router";
import { authCliente } from "@/auth-cliente";
import { ultimoEscritorio } from "@/consultas";
import { cn } from "@/lib/cn";
import type { Eu } from "@/tipos-api";
import { AvisoConta } from "./AvisoConta";
import { Botao } from "./ui";

/** Casca do escritório: menu lateral (gaveta abaixo de 900 px), aviso de conta e a tela da rota. */
export function Casca({ eu }: { eu: Eu }) {
  const { contaId } = useParams();
  const escritorio = eu.escritorios.find((e) => e.contaId === contaId);
  const gaveta = useRef<HTMLDialogElement>(null);
  const navegar = useNavigate();
  const consultas = useQueryClient();
  useEffect(() => {
    if (escritorio) ultimoEscritorio.guardar(escritorio.contaId);
  }, [escritorio]);
  if (!escritorio) return <Navigate to="/" replace />;

  const sair = async () => {
    await authCliente.signOut();
    consultas.clear();
    navegar("/entrar");
  };
  const itens = [
    { para: `/e/${escritorio.contaId}`, rotulo: "Início", fim: true },
    ...(escritorio.perfil === "gestor" ? [{ para: `/e/${escritorio.contaId}/equipe`, rotulo: "Equipe e acessos", fim: false }] : []),
  ];
  const menu = (
    <nav aria-label="Menu principal" className="flex flex-col gap-1">
      {itens.map((i) => (
        <NavLink
          key={i.para}
          to={i.para}
          end={i.fim}
          onClick={() => gaveta.current?.close()}
          className={({ isActive }) => cn("rounded-md px-3 py-2 text-sm", isActive ? "bg-fundo font-semibold text-marca" : "hover:bg-fundo")}
        >
          {i.rotulo}
        </NavLink>
      ))}
      {eu.escritorios.length > 1 && (
        <NavLink to="/escritorios" className="rounded-md px-3 py-2 text-sm hover:bg-fundo">Trocar de escritório</NavLink>
      )}
    </nav>
  );

  return (
    <div className="min-h-dvh min-[900px]:grid min-[900px]:grid-cols-[15rem_1fr]">
      <aside className="hidden border-r border-borda bg-superficie p-4 min-[900px]:flex min-[900px]:flex-col min-[900px]:gap-6">
        <p className="px-3 text-sm font-semibold text-marca">Central do Correspondente</p>
        {menu}
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-borda bg-superficie px-4 py-3">
          <Botao variante="fantasma" className="min-[900px]:hidden" onClick={() => gaveta.current?.showModal()} aria-haspopup="dialog">
            Menu
          </Botao>
          <p className="truncate font-medium">{escritorio.nomeEscritorio}</p>
          <Botao variante="secundario" onClick={sair}>Sair</Botao>
        </header>
        <dialog ref={gaveta} aria-label="Menu" className="m-0 h-dvh max-h-none w-72 bg-superficie p-4 text-texto backdrop:bg-black/40">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-marca">Central do Correspondente</p>
            <Botao variante="fantasma" onClick={() => gaveta.current?.close()}>Fechar</Botao>
          </div>
          {menu}
        </dialog>
        <main className="flex flex-col gap-6 p-4 min-[900px]:p-8">
          <AvisoConta escritorio={escritorio} />
          <Outlet context={escritorio} />
        </main>
      </div>
    </div>
  );
}
