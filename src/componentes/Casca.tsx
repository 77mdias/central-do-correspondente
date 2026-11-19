import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Navigate, NavLink, Outlet, useNavigate, useParams } from "react-router";
import { authCliente } from "@/auth-cliente";
import { ultimoEscritorio } from "@/consultas";
import { cn } from "@/lib/cn";
import { ROTULO_PERFIL } from "@/regras/rotulos";
import type { Eu } from "@/tipos-api";
import { AvisoConta } from "./AvisoConta";
import { Botao, Marca } from "./ui";

/** Casca do escritório: menu lateral 240px (gaveta abaixo de 900 px), aviso de conta e tela da rota. */
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
          className={({ isActive }) =>
            cn(
              "rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-acento-suave text-acento"
                : "text-texto-2 hover:bg-superficie-sutil hover:text-texto",
            )
          }
        >
          {i.rotulo}
        </NavLink>
      ))}
      {eu.escritorios.length > 1 && (
        <NavLink
          to="/escritorios"
          onClick={() => gaveta.current?.close()}
          className="rounded-lg px-3 py-2.5 text-sm text-texto-2 hover:bg-superficie-sutil hover:text-texto"
        >
          Trocar de escritório
        </NavLink>
      )}
    </nav>
  );

  const cabecalhoMarca = (
    <div className="flex flex-col gap-2 px-2">
      <div className="flex items-center gap-2.5 text-sm font-medium tracking-tight text-texto">
        <Marca />
        <span>Central do Correspondente</span>
      </div>
      <div className="flex items-center justify-between gap-2 rounded-lg border border-borda bg-fundo px-2.5 py-1.5">
        <span className="truncate text-xs font-medium text-texto">{escritorio.nomeEscritorio}</span>
        <span className="font-mono-tabular shrink-0 rounded bg-acento-suave px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-acento">
          {ROTULO_PERFIL[escritorio.perfil]}
        </span>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh min-[900px]:grid min-[900px]:grid-cols-[15rem_1fr]">
      <aside className="hidden border-r border-borda bg-superficie p-4 min-[900px]:flex min-[900px]:flex-col min-[900px]:gap-6">
        {cabecalhoMarca}
        {menu}
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="flex h-14 items-center justify-between gap-3 border-b border-borda bg-superficie px-4 min-[900px]:px-8">
          <Botao variante="fantasma" className="min-[900px]:hidden" onClick={() => gaveta.current?.showModal()} aria-haspopup="dialog">
            Menu
          </Botao>
          <div className="flex min-w-0 items-center gap-2.5">
            <p className="truncate text-sm font-medium text-texto">{escritorio.nomeEscritorio}</p>
            <span className="font-mono-tabular hidden text-xs text-texto-2 sm:inline">
              · {escritorio.plano === "com_corretores" ? "Plano Com corretores" : "Plano Simples"}
            </span>
          </div>
          <Botao variante="secundario" className="min-h-9 px-3 text-xs" onClick={sair}>Sair</Botao>
        </header>
        <dialog ref={gaveta} aria-label="Menu" className="m-0 h-dvh max-h-none w-72 border-r border-borda bg-superficie p-4 text-texto backdrop:bg-black/40">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-texto">
              <Marca />
              <span>Central</span>
            </div>
            <Botao variante="fantasma" className="min-h-9 px-3 text-xs" onClick={() => gaveta.current?.close()}>Fechar</Botao>
          </div>
          <div className="mb-4">{cabecalhoMarca}</div>
          {menu}
        </dialog>
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 min-[900px]:p-8">
          <AvisoConta escritorio={escritorio} />
          <Outlet context={escritorio} />
        </main>
      </div>
    </div>
  );
}
