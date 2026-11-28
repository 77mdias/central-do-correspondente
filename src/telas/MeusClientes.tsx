import { useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router";
import { classeEntrada } from "@/componentes/campos";
import { OssosLista } from "@/componentes/Esqueleto";
import { Aviso } from "@/componentes/ui";
import { usePortalClientes } from "@/consultas-portal";
import { cn } from "@/lib/cn";
import { ETAPAS, nomeEtapa, nomeModalidade } from "@/regras/catalogo";
import { diasDesde } from "@/regras/datas";
import { ativo, faltando, filtrarPortal, ordenarPortal, parado } from "@/regras/processo";
import type { ClientePortal, EscritorioResumo } from "@/tipos-api";
import { classeEtapa } from "./Clientes";

/** "Meus clientes" do corretor (RF-80): busca por nome, filtro por etapa, ativos primeiro. */
export function MeusClientes() {
  const escritorio = useOutletContext<EscritorioResumo>();
  const clientes = usePortalClientes(escritorio.contaId);
  const [busca, setBusca] = useState("");
  const [etapa, setEtapa] = useState("");
  const agora = new Date();
  const lista = clientes.data ?? [];
  const visiveis = ordenarPortal(filtrarPortal(lista, { busca, etapa }), agora);
  const ativos = lista.filter(ativo).length;

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 border-b border-borda pb-5">
        <p className="font-mono-tabular text-xs uppercase tracking-wider text-texto-2">Portal do corretor</p>
        <h1 className="text-2xl font-medium tracking-[-0.03em] text-texto">Meus clientes</h1>
        <p className="text-sm text-texto-2">
          Clientes que você indicou para {escritorio.nomeEscritorio}
          {lista.length ? ` · ${ativos} com processo ativo` : ""}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_16rem]">
        <input
          type="search"
          aria-label="Buscar cliente"
          placeholder="Buscar pelo nome"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className={classeEntrada}
        />
        <select aria-label="Etapa" value={etapa} onChange={(e) => setEtapa(e.target.value)} className={classeEntrada}>
          <option value="">Todas as etapas</option>
          {ETAPAS.map((e) => (
            <option key={e.codigo} value={e.codigo}>
              {e.nome}
            </option>
          ))}
        </select>
      </div>

      {clientes.error && <Aviso tom="erro">Não foi possível carregar seus clientes. A página continua tentando.</Aviso>}
      {clientes.isPending ? (
        <OssosLista linhas={4} />
      ) : !lista.length ? (
        <div className="rounded-xl border border-borda bg-superficie p-8 text-center">
          <h2 className="text-lg font-medium">Nenhum cliente seu neste escritório ainda</h2>
          <p className="mt-1 text-sm text-texto-2">Quando o escritório cadastrar um cliente indicado por você, ele aparece aqui.</p>
        </div>
      ) : !visiveis.length ? (
        <div className="rounded-xl border border-borda bg-superficie p-8 text-center">
          <h2 className="text-lg font-medium">Nada neste filtro</h2>
          <p className="mt-1 text-sm text-texto-2">Troque a busca ou a etapa.</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-borda overflow-hidden rounded-xl border border-borda bg-superficie" aria-label="Meus clientes">
          {visiveis.map((c) => (
            <Linha key={c.id} c={c} agora={agora} />
          ))}
        </ul>
      )}
      <p className="text-xs text-texto-2">A lista se atualiza sozinha. Processos sem atualização há 7 dias ou mais aparecem em vermelho.</p>
    </section>
  );
}

function Linha({ c, agora }: { c: ClientePortal; agora: Date }) {
  const [params] = useSearchParams();
  const p = new URLSearchParams(params);
  p.set("cliente", c.id);
  const f = faltando(c).length;
  const d = diasDesde(c.atualizadoEm, agora);
  const atrasado = parado(c, agora);
  return (
    <li>
      <Link to={{ search: p.toString() }} className="grid gap-2 p-3.5 text-sm hover:bg-superficie-sutil sm:grid-cols-[1.6fr_1fr_1.2fr_auto] sm:items-center sm:gap-4">
        <span className="flex min-w-0 flex-col">
          <b className="truncate font-medium text-texto">{c.nome}</b>
          <span className="truncate text-xs text-texto-2">{c.modalidade ? nomeModalidade(c.modalidade) : "Modalidade não informada"}</span>
        </span>
        <span>
          <span className={cn("font-mono-tabular inline-flex rounded-full px-2 py-0.5 text-xs", classeEtapa(c.etapa))}>{nomeEtapa(c.etapa)}</span>
        </span>
        <span className={cn("text-xs", ativo(c) && f ? "text-aviso-texto" : "text-texto-2")}>
          {!ativo(c) ? "Processo encerrado" : f ? `${f} documento${f === 1 ? "" : "s"} pendente${f === 1 ? "" : "s"}` : "Documentação completa"}
        </span>
        <span className={cn("font-mono-tabular text-xs sm:text-right", atrasado ? "text-perigo" : "text-texto-2")}>
          {d === 0 ? "atualizado hoje" : `há ${d} dia${d === 1 ? "" : "s"} sem atualização`}
        </span>
      </Link>
    </li>
  );
}
