import type { ReactNode } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router";
import { BotaoCobrar } from "@/componentes/Enviou";
import { OssosLista } from "@/componentes/Esqueleto";
import { Aviso, Cartao } from "@/componentes/ui";
import { useClientes, useCorretores, useHistoricoRecente } from "@/consultas-escritorio";
import { cn } from "@/lib/cn";
import { nomeEtapa } from "@/regras/catalogo";
import { diasDesde, hojeBr } from "@/regras/datas";
import { ativo, faltando, nomeOrigem, parado, porOrigem, resumo, situacaoCobranca } from "@/regras/processo";
import { ROTULO_PERFIL } from "@/regras/rotulos";
import type { ClienteLista, EscritorioResumo } from "@/tipos-api";

const dataHora = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "America/Sao_Paulo" });

/** Início (RF-01 a RF-05), na ordem do protótipo. */
export function Inicio() {
  const escritorio = useOutletContext<EscritorioResumo>();
  const conta = escritorio.contaId;
  const clientes = useClientes(conta);
  const corretores = useCorretores(conta);
  const recentes = useHistoricoRecente(conta);
  const hoje = hojeBr();
  const agora = new Date();
  const ks = corretores.data ?? [];
  const lista = clientes.data ?? [];
  const r = resumo(lista, hoje, agora);
  const cobrar = lista
    .filter((c) => situacaoCobranca(c, hoje)?.vence)
    .sort((a, b) => (a.proximaCobranca ?? "").localeCompare(b.proximaCobranca ?? ""));
  const parados = lista.filter((c) => parado(c, agora)).sort((a, b) => diasDesde(b.atualizadoEm, agora) - diasDesde(a.atualizadoEm, agora));
  const faltam = lista.filter((c) => ativo(c) && faltando(c).length).sort((a, b) => faltando(b).length - faltando(a).length);
  const origens = porOrigem(lista, ks, hoje, agora);
  const dataLonga = agora.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" });
  const raiz = `/e/${conta}`;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-borda pb-5">
        <div className="flex flex-col gap-1">
          <p className="font-mono-tabular text-xs uppercase tracking-wider text-texto-2">
            Visão geral · {ROTULO_PERFIL[escritorio.perfil]}
          </p>
          <h1 className="text-2xl font-medium tracking-[-0.03em] text-texto">{escritorio.nomeEscritorio}</h1>
          <p className="text-sm capitalize text-texto-2">{dataLonga}</p>
        </div>
        <Link
          to={`${raiz}/clientes?novo=1`}
          className="inline-flex min-h-10 items-center rounded-lg bg-marca px-3.5 text-sm font-medium text-marca-texto hover:bg-marca-forte"
        >
          + Novo cliente
        </Link>
      </div>

      {clientes.error && <Aviso tom="erro">Não foi possível carregar os clientes. A página continua tentando.</Aviso>}
      {clientes.isPending ? (
        <OssosLista linhas={4} />
      ) : lista.length === 0 ? (
        <Cartao className="flex flex-col items-start gap-3">
          <h2 className="text-lg font-medium">Nenhum cliente cadastrado ainda</h2>
          <p className="text-sm text-texto-2">Cadastre o primeiro processo para acompanhar documentos, cobranças e etapas.</p>
          <Link to={`${raiz}/clientes?novo=1`} className="text-sm font-medium text-acento hover:underline">
            Cadastrar primeiro cliente
          </Link>
        </Cartao>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Contador para={`${raiz}/clientes?card=ativos`} valor={r.ativos} rotulo="Processos ativos" />
            <Contador para={`${raiz}/cobrar`} valor={r.hoje} rotulo="Cobrar hoje" tom="acento" />
            <Contador para={`${raiz}/clientes?card=pend`} valor={r.pendentes} rotulo="Com documento faltando" tom="aviso" />
            <Contador para={`${raiz}/clientes?card=parados`} valor={r.parados} rotulo="Parados há 7+ dias" tom="perigo" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Painel titulo="Cobranças de hoje" mais={cobrar.length > 6 ? { para: `${raiz}/cobrar`, rotulo: `ver todas (${cobrar.length})` } : undefined}>
              {cobrar.slice(0, 6).map((c) => {
                const f = faltando(c).length;
                return (
                  <Item key={c.id} cliente={c} detalhe={`${nomeOrigem(c.corretorId, ks)} · faltam ${f} doc${f === 1 ? "" : "s"}`} situacao={situacaoCobranca(c, hoje)!.texto}>
                    <BotaoCobrar cliente={c} desativado={!escritorio.ativa} />
                  </Item>
                );
              })}
              {!cobrar.length && <Vazio>Nenhuma cobrança para hoje. Tudo em dia.</Vazio>}
            </Painel>
            <Painel titulo="Parados há 7+ dias" mais={parados.length > 6 ? { para: `${raiz}/clientes?card=parados`, rotulo: `ver todos (${parados.length})` } : undefined}>
              {parados.slice(0, 6).map((c) => (
                <Item
                  key={c.id}
                  cliente={c}
                  detalhe={`${nomeOrigem(c.corretorId, ks)} · ${nomeEtapa(c.etapa)}`}
                  situacao={`Sem atualização há ${diasDesde(c.atualizadoEm, agora)} dias`}
                />
              ))}
              {!parados.length && <Vazio>Nenhum processo parado.</Vazio>}
            </Painel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Painel titulo="Documentos faltando" mais={faltam.length > 6 ? { para: `${raiz}/clientes?card=pend`, rotulo: `ver todos (${faltam.length})` } : undefined}>
              {faltam.slice(0, 6).map((c) => {
                const f = faltando(c);
                return (
                  <Item
                    key={c.id}
                    cliente={c}
                    detalhe={`Falta: ${f.slice(0, 3).map((d) => d.nome).join(", ")}${f.length > 3 ? ` e mais ${f.length - 3}` : ""}`}
                  >
                    <span className="font-mono-tabular rounded-full bg-aviso-fundo px-2 py-0.5 text-xs text-aviso-texto">{f.length}</span>
                  </Item>
                );
              })}
              {!faltam.length && <Vazio>Nenhum documento pendente.</Vazio>}
            </Painel>
            <Painel titulo="Por origem">
              <div className="-mx-1 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-texto-2">
                    <tr>
                      <th className="px-1 py-2 font-medium">Origem</th>
                      <th className="px-1 py-2 text-right font-medium">Ativos</th>
                      <th className="px-1 py-2 text-right font-medium">Cobrar</th>
                      <th className="px-1 py-2 text-right font-medium">Pendência</th>
                      <th className="px-1 py-2 text-right font-medium">Parados</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono-tabular">
                    {origens.map((o) => (
                      <tr key={o.id} className="border-t border-borda">
                        <td className="px-1 py-2 font-sans">
                          <Link to={`${raiz}/clientes?origem=${o.id}`} className="font-medium text-texto hover:underline">
                            {o.nome}
                          </Link>
                          {o.casa && <span className="block text-xs text-texto-2">{o.casa}</span>}
                        </td>
                        <td className="px-1 py-2 text-right">{o.ativos}</td>
                        <td className="px-1 py-2 text-right">{o.hoje || "·"}</td>
                        <td className="px-1 py-2 text-right">{o.pendentes || "·"}</td>
                        <td className="px-1 py-2 text-right">{o.parados || "·"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Painel>
          </div>

          <Painel titulo="Últimas atualizações">
            {(recentes.data ?? []).map((u) => (
              <p key={u.id} className="flex gap-3 py-1.5 text-sm">
                <time className="font-mono-tabular shrink-0 text-xs leading-5 text-texto-2">{dataHora(u.criadoEm)}</time>
                <span className="min-w-0">
                  <LinkFicha id={u.clienteId} className="font-medium text-acento hover:underline">
                    {u.nome}
                  </LinkFicha>{" "}
                  · {u.texto}
                </span>
              </p>
            ))}
            {recentes.data?.length === 0 && <Vazio>Nada ainda.</Vazio>}
          </Painel>
        </>
      )}
    </section>
  );
}

const TONS = { neutro: "text-texto", acento: "text-acento", aviso: "text-aviso-texto", perigo: "text-perigo" };

function Contador({ para, valor, rotulo, tom = "neutro" }: { para: string; valor: number; rotulo: string; tom?: keyof typeof TONS }) {
  return (
    <Link to={para} className="flex flex-col gap-1 rounded-xl border border-borda bg-superficie p-4 transition-colors hover:border-borda-campo">
      <strong className={cn("font-mono-tabular text-3xl font-medium tracking-tight", TONS[tom])}>{valor}</strong>
      <span className="text-xs uppercase tracking-wide text-texto-2">{rotulo}</span>
    </Link>
  );
}

function Painel({ titulo, mais, children }: { titulo: string; mais?: { para: string; rotulo: string }; children: ReactNode }) {
  return (
    <Cartao className="flex min-w-0 flex-col gap-2 p-5">
      <div className="flex items-center justify-between gap-2 border-b border-borda pb-3">
        <h2 className="text-base font-medium text-texto">{titulo}</h2>
        {mais && (
          <Link to={mais.para} className="text-xs text-texto-2 hover:text-texto">
            {mais.rotulo}
          </Link>
        )}
      </div>
      <div className="flex flex-col divide-y divide-borda">{children}</div>
    </Cartao>
  );
}

/** Link que abre a ficha do cliente no painel lateral, na tela em que se está. */
export function LinkFicha({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  const [params] = useSearchParams();
  const p = new URLSearchParams(params);
  p.set("cliente", id);
  p.delete("novo");
  return (
    <Link to={{ search: p.toString() }} className={className}>
      {children}
    </Link>
  );
}

function Item({ cliente, detalhe, situacao, children }: { cliente: ClienteLista; detalhe: string; situacao?: string; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <LinkFicha id={cliente.id} className="flex min-w-0 flex-col text-left">
        <b className="truncate text-sm font-medium text-texto">{cliente.nome}</b>
        <span className="truncate text-xs text-texto-2">{detalhe}</span>
        {situacao && <span className="text-xs text-perigo">{situacao}</span>}
      </LinkFicha>
      {children}
    </div>
  );
}

function Vazio({ children }: { children: ReactNode }) {
  return <p className="py-2 text-sm text-texto-2">{children}</p>;
}
