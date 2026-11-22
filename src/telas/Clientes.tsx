import { useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router";
import { classeEntrada } from "@/componentes/campos";
import { OssosLista } from "@/componentes/Esqueleto";
import { Aviso } from "@/componentes/ui";
import { useClientes, useCorretores } from "@/consultas-escritorio";
import { cn } from "@/lib/cn";
import { DOCUMENTOS, ETAPAS, nomeEtapa, nomeModalidade, type Etapa } from "@/regras/catalogo";
import { diasDesde, hojeBr } from "@/regras/datas";
import { formatarReaisCurto } from "@/regras/dinheiro";
import { ativo, type Card, daOrigem, faltando, filtrar, nomeOrigem, ordenar, parado, resumo, situacaoCobranca } from "@/regras/processo";
import type { ClienteLista, EscritorioResumo } from "@/tipos-api";

const CARDS: Card[] = ["ativos", "hoje", "pend", "parados", "fim"];

/** Cor da etapa como no protótipo (etapaCls). */
export function classeEtapa(e: Etapa) {
  if (e === "concluido") return "bg-ok-fundo text-ok-texto";
  if (e === "reprovado_cancelado") return "border border-perigo text-perigo";
  if (e === "documentacao_pendente") return "bg-aviso-fundo text-aviso-texto";
  if (e === "assinatura_contrato" || e === "registro_cartorio") return "bg-acento-suave text-acento";
  return "bg-superficie-sutil text-texto-2";
}

/** Clientes (RF-12 a RF-14): busca, origem, etapa e os cards do resumo, com a ordem do protótipo. */
export function Clientes({ titulo = "Clientes", cardFixo }: { titulo?: string; cardFixo?: Card }) {
  const escritorio = useOutletContext<EscritorioResumo>();
  const conta = escritorio.contaId;
  const clientes = useClientes(conta);
  const corretores = useCorretores(conta).data ?? [];
  const [params, setParams] = useSearchParams();
  const [busca, setBusca] = useState("");
  const origem = params.get("origem") ?? "todos";
  const etapa = params.get("etapa") ?? "";
  const card = cardFixo ?? ((params.get("card") as Card | null) ?? "ativos");
  const hoje = hojeBr();
  const agora = new Date();
  const ehGestor = escritorio.perfil === "gestor";
  const lista = clientes.data ?? [];

  const mudar = (chave: string, valor: string, padrao: string) => {
    const p = new URLSearchParams(params);
    if (valor === padrao) p.delete(chave);
    else p.set(chave, valor);
    setParams(p, { replace: true });
  };

  const daOrigemEscolhida = lista.filter((c) => daOrigem(c, origem));
  const r = resumo(daOrigemEscolhida, hoje, agora);
  const visiveis = ordenar(filtrar(lista, { busca, origem, etapa, card }, corretores, hoje, agora), hoje, agora);
  const ativosDe = (o: string) => lista.filter((c) => ativo(c) && daOrigem(c, o)).length;
  const valoresCard: Record<Card, { n: number; rotulo: string; extra?: string; tom: string }> = {
    todos: { n: lista.length, rotulo: "Todos", tom: "" },
    ativos: { n: r.ativos, rotulo: "Processos ativos", extra: ehGestor ? `VGV ${formatarReaisCurto(r.vgvAtivoCentavos)}` : undefined, tom: "text-texto" },
    hoje: { n: r.hoje, rotulo: "Cobrar hoje", tom: "text-acento" },
    pend: { n: r.pendentes, rotulo: "Com documento faltando", tom: "text-aviso-texto" },
    parados: { n: r.parados, rotulo: "Parados há 7+ dias", tom: "text-perigo" },
    fim: { n: r.finalizados, rotulo: "Finalizados", tom: "text-ok-texto" },
  };
  const novo = new URLSearchParams(params);
  novo.set("novo", "1");

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-borda pb-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-medium tracking-[-0.03em] text-texto">{titulo}</h1>
          <p className="text-sm text-texto-2">Processos de financiamento, documentos e cobranças</p>
        </div>
        {escritorio.ativa && (
          <Link to={{ search: novo.toString() }} className="inline-flex min-h-10 items-center rounded-lg bg-marca px-3.5 text-sm font-medium text-marca-texto hover:bg-marca-forte">
            + Novo cliente
          </Link>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_14rem_14rem]">
        <input
          type="search"
          aria-label="Buscar"
          placeholder="Buscar por nome, CPF, telefone ou nº do contrato"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className={classeEntrada}
        />
        <select aria-label="Origem" value={origem} onChange={(e) => mudar("origem", e.target.value, "todos")} className={classeEntrada}>
          <option value="todos">Todas as origens ({ativosDe("todos")})</option>
          <option value="diretos">Clientes diretos ({ativosDe("diretos")})</option>
          {corretores.length > 0 && (
            <optgroup label="Corretores parceiros">
              {[...corretores]
                .sort((a, b) => a.nome.localeCompare(b.nome))
                .map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.nome}
                    {k.imobiliaria ? ` · ${k.imobiliaria}` : ""} ({ativosDe(k.id)})
                  </option>
                ))}
            </optgroup>
          )}
        </select>
        <select aria-label="Etapa" value={etapa} onChange={(e) => mudar("etapa", e.target.value, "")} className={classeEntrada}>
          <option value="">Todas as etapas</option>
          {ETAPAS.map((e) => (
            <option key={e.codigo} value={e.codigo}>
              {e.nome}
            </option>
          ))}
        </select>
      </div>

      {!cardFixo && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" role="group" aria-label="Filtrar pelo resumo">
          {CARDS.map((k) => {
            const v = valoresCard[k];
            return (
              <button
                key={k}
                type="button"
                aria-pressed={card === k}
                onClick={() => mudar("card", card === k && k !== "ativos" ? "ativos" : k, "ativos")}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-xl border bg-superficie p-3 text-left transition-colors",
                  card === k ? "border-acento ring-1 ring-acento" : "border-borda hover:border-borda-campo",
                )}
              >
                <strong className={cn("font-mono-tabular text-2xl font-medium", v.tom)}>{v.n}</strong>
                <span className="text-xs uppercase tracking-wide text-texto-2">{v.rotulo}</span>
                {v.extra && <span className="font-mono-tabular text-xs text-texto-2">{v.extra}</span>}
              </button>
            );
          })}
        </div>
      )}

      {clientes.error && <Aviso tom="erro">Os dados ainda não carregaram. Verifique a conexão; a página continua tentando.</Aviso>}
      {clientes.isPending ? (
        <OssosLista linhas={5} />
      ) : !lista.length ? (
        <div className="rounded-xl border border-borda bg-superficie p-8 text-center">
          <h2 className="text-lg font-medium">Nenhum cliente cadastrado ainda</h2>
          <p className="mt-1 text-sm text-texto-2">Use + Novo cliente para cadastrar o primeiro processo.</p>
        </div>
      ) : !visiveis.length ? (
        <div className="rounded-xl border border-borda bg-superficie p-8 text-center">
          <h2 className="text-lg font-medium">{card === "hoje" ? "Nenhuma cobrança para hoje" : "Nada neste filtro"}</h2>
          <p className="mt-1 text-sm text-texto-2">Troque a origem, a etapa ou o card do resumo.</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-borda overflow-hidden rounded-xl border border-borda bg-superficie">
          {visiveis.map((c) => (
            <Linha key={c.id} c={c} corretores={corretores} hoje={hoje} agora={agora} />
          ))}
        </ul>
      )}
      <p className="text-xs text-texto-2">Tudo é salvo automaticamente. Processos sem atualização há 7 dias ou mais aparecem em vermelho.</p>
    </section>
  );
}

function Linha({ c, corretores, hoje, agora }: { c: ClienteLista; corretores: Parameters<typeof nomeOrigem>[1]; hoje: string; agora: Date }) {
  const [params] = useSearchParams();
  const p = new URLSearchParams(params);
  p.set("cliente", c.id);
  const f = faltando(c).length;
  const total = DOCUMENTOS.length;
  const pc = Math.round(((total - f) / total) * 100);
  const cob = situacaoCobranca(c, hoje);
  const d = diasDesde(c.atualizadoEm, agora);
  const casa = c.corretorId ? (corretores.find((k) => k.id === c.corretorId)?.imobiliaria ?? "") : "Sem corretor";
  return (
    <li>
      <Link to={{ search: p.toString() }} className="grid gap-2 p-3.5 text-sm hover:bg-superficie-sutil md:grid-cols-[1.6fr_1.3fr_1fr_1.6fr_auto] md:items-center md:gap-4">
        <span className="flex min-w-0 flex-col">
          <b className="truncate font-medium text-texto">{c.nome}</b>
          <span className="truncate text-xs text-texto-2">
            {c.modalidade ? nomeModalidade(c.modalidade) : ""}
            {c.numeroContrato ? ` · nº ${c.numeroContrato}` : ""}
          </span>
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate">{nomeOrigem(c.corretorId, corretores)}</span>
          <span className="truncate text-xs text-texto-2">{casa}</span>
        </span>
        <span>
          <span className={cn("font-mono-tabular inline-flex rounded-full px-2 py-0.5 text-xs", classeEtapa(c.etapa))}>{nomeEtapa(c.etapa)}</span>
        </span>
        <span className="flex flex-col gap-1">
          <span className="flex items-center gap-2 text-xs text-texto-2">
            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-superficie-sutil">
              <i className={cn("block h-full", pc < 60 ? "bg-aviso-texto" : "bg-ok-texto")} style={{ width: `${pc}%` }} />
            </span>
            <span className="font-mono-tabular">
              {total - f}/{total}
              {f ? ` · faltam ${f}` : " completo"}
            </span>
          </span>
          {cob && <span className={cn("text-xs", cob.vence ? "text-perigo" : "text-texto-2")}>{cob.texto}</span>}
        </span>
        <span className="flex items-center justify-between gap-3 md:flex-col md:items-end">
          <span className="font-mono-tabular text-xs">{formatarReaisCurto(c.valorImovelCentavos)}</span>
          <span className={cn("font-mono-tabular text-xs", parado(c, agora) ? "text-perigo" : "text-texto-2")}>{d === 0 ? "hoje" : d === 1 ? "ontem" : `há ${d}d`}</span>
        </span>
      </Link>
    </li>
  );
}
