import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, type ReactNode, useState } from "react";
import { Link, Navigate, useOutletContext } from "react-router";
import { api } from "@/api";
import { classeEntrada } from "@/componentes/campos";
import { OssosLista } from "@/componentes/Esqueleto";
import { Aviso, Botao, Cartao } from "@/componentes/ui";
import { chavesEscritorio, useCorretores } from "@/consultas-escritorio";
import { cn } from "@/lib/cn";
import { hojeBr } from "@/regras/datas";
import { formatarPercentual, formatarReais, formatarReaisCurto } from "@/regras/dinheiro";
import { esquemaPercentual } from "@/regras/esquemas";
import { NOME_PERIODO, type Periodo, porEtapa, porOrigemVgv, resumoVgv } from "@/regras/vgv";
import type { EscritorioResumo, Vgv as TVgv } from "@/tipos-api";
import { LinkFicha } from "./Inicio";

const inteiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const R = (c: number) => inteiro.format(c / 100);
const dataCurta = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "America/Sao_Paulo" });

/** VGV e comissões (RF-50 a RF-56), só a gestora. */
export function Vgv() {
  const escritorio = useOutletContext<EscritorioResumo>();
  const conta = escritorio.contaId;
  const vgv = useQuery({ queryKey: ["vgv", conta], queryFn: () => api<TVgv>(`/api/contas/${conta}/vgv`), refetchInterval: 30_000, enabled: escritorio.perfil === "gestor" });
  const corretores = useCorretores(conta).data ?? [];
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  if (escritorio.perfil !== "gestor") return <Navigate to={`/e/${conta}`} replace />;

  const hoje = hojeBr();
  const linhas = vgv.data?.linhas ?? [];
  const r = resumoVgv(linhas, periodo, hoje);
  const origens = porOrigemVgv(linhas, corretores, periodo, hoje);
  const etapas = porEtapa(linhas);
  const maxEtapa = Math.max(1, ...etapas.map((e) => e.vgv));
  const aReceber = linhas.filter((l) => l.contratado && !l.recebidaEm);

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 border-b border-borda pb-5">
        <h1 className="text-2xl font-medium tracking-[-0.03em] text-texto">VGV e comissões</h1>
        <p className="text-sm text-texto-2">Contratos Caixa, valores financiados e o que o correspondente recebe</p>
      </div>
      {vgv.error && <Aviso tom="erro">Não foi possível carregar o VGV. A página continua tentando.</Aviso>}
      {vgv.isPending ? (
        <OssosLista linhas={4} />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Percentual escritorio={escritorio} vgv={vgv.data!} />
            <Painel titulo="Pipeline (ainda não contratado)">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Numero valor={formatarReaisCurto(r.pipeline.vgv)} rotulo="VGV em andamento" extra={`${r.pipeline.n} processo${r.pipeline.n === 1 ? "" : "s"}`} />
                <Numero valor={formatarReaisCurto(r.pipeline.financiado)} rotulo="Financiamento previsto" />
                <Numero valor={formatarReaisCurto(r.pipeline.remuneracao)} rotulo="Remuneração prevista" destaque />
              </div>
              {r.semValor > 0 && (
                <p className="text-xs text-texto-2">
                  {r.semValor} processo{r.semValor === 1 ? "" : "s"} sem valor do imóvel ou valor financiado. Preencha na ficha do cliente para o resumo ficar completo.
                </p>
              )}
              {r.aReceber.n > 0 && (
                <p className="text-xs text-texto-2">
                  <b>{r.aReceber.n}</b> contrato{r.aReceber.n === 1 ? "" : "s"} com remuneração a receber: <b className="font-mono-tabular">{formatarReais(r.aReceber.total)}</b>
                </p>
              )}
            </Painel>
          </div>

          <Painel
            titulo={`VGV contratado · ${NOME_PERIODO[periodo]}`}
            acao={
              <div role="group" aria-label="Período" className="flex overflow-hidden rounded-lg border border-borda text-xs">
                {(["mes", "ant", "ano", "tudo"] as Periodo[]).map((p) => (
                  <button key={p} type="button" aria-pressed={periodo === p} onClick={() => setPeriodo(p)} className={cn("px-3 py-1.5", periodo === p ? "bg-marca text-marca-texto" : "hover:bg-superficie-sutil")}>
                    {p === "tudo" ? "Tudo" : NOME_PERIODO[p]}
                  </button>
                ))}
              </div>
            }
          >
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <Numero valor={R(r.contratado.vgv)} rotulo="VGV contratado" extra={`${r.contratado.n} contrato${r.contratado.n === 1 ? "" : "s"} assinado${r.contratado.n === 1 ? "" : "s"}`} />
              <Numero valor={R(r.contratado.financiado)} rotulo="Valor financiado Caixa" extra={r.contratado.cotaMedia != null ? `Cota média ${formatarPercentual(Math.round(r.contratado.cotaMedia * 1000) / 1000)}` : undefined} />
              <Numero valor={formatarReais(r.contratado.remuneracao)} rotulo="Remuneração do correspondente" extra={`Recebido ${formatarReais(r.contratado.recebida)}`} destaque />
              <Numero valor={r.contratado.ticketMedio != null ? R(r.contratado.ticketMedio) : "—"} rotulo="Ticket médio" />
            </div>
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[44rem] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-texto-2">
                  <tr>
                    {["Origem", "Imobiliária"].map((h) => (
                      <th key={h} className="px-1 py-2 font-medium">
                        {h}
                      </th>
                    ))}
                    {["Contratos", "VGV contratado", "Financiado", "Remuneração", "Em andamento", "VGV em andamento"].map((h) => (
                      <th key={h} className="px-1 py-2 text-right font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="font-mono-tabular">
                  {origens.map((l) => (
                    <tr key={l.id} className="border-t border-borda">
                      <td className="px-1 py-2 font-sans">
                        <Link to={`/e/${conta}/clientes?origem=${l.id}&card=todos`} className="font-medium hover:underline">
                          {l.nome}
                        </Link>
                      </td>
                      <td className="px-1 py-2 font-sans text-texto-2">{l.casa}</td>
                      <td className="px-1 py-2 text-right">{l.n}</td>
                      <td className="px-1 py-2 text-right">{R(l.vgv)}</td>
                      <td className="px-1 py-2 text-right">{R(l.fin)}</td>
                      <td className="px-1 py-2 text-right">{formatarReais(l.rem)}</td>
                      <td className="px-1 py-2 text-right">{l.np}</td>
                      <td className="px-1 py-2 text-right">{R(l.vgvP)}</td>
                    </tr>
                  ))}
                  {!origens.length && (
                    <tr>
                      <td colSpan={8} className="px-1 py-3 font-sans text-texto-2">
                        Nenhum processo com valor ainda.
                      </td>
                    </tr>
                  )}
                  {origens.length > 0 && (
                    <tr className="border-t-2 border-borda font-medium">
                      <td colSpan={2} className="px-1 py-2 font-sans">
                        Total
                      </td>
                      <td className="px-1 py-2 text-right">{r.contratado.n}</td>
                      <td className="px-1 py-2 text-right">{R(r.contratado.vgv)}</td>
                      <td className="px-1 py-2 text-right">{R(r.contratado.financiado)}</td>
                      <td className="px-1 py-2 text-right">{formatarReais(r.contratado.remuneracao)}</td>
                      <td className="px-1 py-2 text-right">{r.pipeline.n}</td>
                      <td className="px-1 py-2 text-right">{R(r.pipeline.vgv)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Painel>

          {aReceber.length > 0 && <AReceber conta={conta} linhas={aReceber} ativa={escritorio.ativa} />}

          <Painel titulo="VGV por etapa do processo" acao={<span className="text-xs text-texto-2">Soma do valor do imóvel dos processos em cada etapa hoje</span>}>
            <div className="flex flex-col gap-1.5">
              {etapas.map((e) => (
                <div key={e.etapa} className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-3 text-sm max-sm:grid-cols-[minmax(0,8rem)_1fr_auto]">
                  <span className="truncate">
                    {e.nome} <span className="text-xs text-texto-2">({e.n})</span>
                  </span>
                  <span className="h-2 overflow-hidden rounded-full bg-superficie-sutil">
                    <i
                      className={cn("block h-full", e.etapa === "registro_cartorio" || e.etapa === "concluido" ? "bg-ok-texto" : "bg-acento")}
                      style={{ width: `${e.vgv ? Math.max(2, (e.vgv / maxEtapa) * 100) : 0}%` }}
                    />
                  </span>
                  <span className="font-mono-tabular text-xs">{R(e.vgv)}</span>
                </div>
              ))}
            </div>
          </Painel>
        </>
      )}
    </section>
  );
}

function Percentual({ escritorio, vgv }: { escritorio: EscritorioResumo; vgv: TVgv }) {
  const qc = useQueryClient();
  const [erro, setErro] = useState("");
  const salvar = useMutation({
    mutationFn: (percentual: number) => api(`/api/contas/${escritorio.contaId}/percentual`, { method: "PUT", body: { percentual } }),
    onSuccess: () => {
      setErro("");
      void qc.invalidateQueries({ queryKey: ["vgv", escritorio.contaId] });
      void qc.invalidateQueries({ queryKey: chavesEscritorio.clientes(escritorio.contaId) });
    },
    onError: () => setErro("Não foi possível salvar o percentual."),
  });
  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const bruto = String(new FormData(e.currentTarget).get("percentual") ?? "").trim().replace(",", ".");
    const v = esquemaPercentual.safeParse({ percentual: bruto === "" ? Number.NaN : Number(bruto) });
    if (!v.success) return setErro("Use um número de 0 a 100, com até 3 casas (ex.: 1,2).");
    salvar.mutate(v.data.percentual);
  }
  return (
    <Painel titulo="Percentual atual de remuneração Caixa">
      <div className="flex flex-wrap items-end gap-4">
        <span className="font-mono-tabular text-4xl font-medium tracking-tight">{formatarPercentual(vgv.percentualAtual)}</span>
        {escritorio.ativa && (
          <form onSubmit={enviar} className="flex items-end gap-2">
            <label className="flex flex-col gap-1 text-sm">
              Atualizar percentual (%)
              <input
                key={vgv.percentualAtual}
                name="percentual"
                inputMode="decimal"
                placeholder="Ex.: 1,2"
                defaultValue={String(vgv.percentualAtual).replace(".", ",")}
                className={cn(classeEntrada, "w-32")}
              />
            </label>
            <Botao type="submit" carregando={salvar.isPending}>
              Salvar
            </Botao>
          </form>
        )}
      </div>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      <p className="text-xs text-texto-2">
        Aplicado sobre o <b>valor financiado</b>. Quando um contrato é assinado, o percentual daquele dia fica guardado nele, então mudar aqui não altera contratos antigos. Um cliente
        também pode ter percentual próprio na ficha.
      </p>
      {vgv.historicoPercentual.length > 0 && (
        <ul className="flex flex-col divide-y divide-borda text-sm">
          {vgv.historicoPercentual.slice(0, 5).map((h) => (
            <li key={h.criadoEm} className="flex gap-3 py-1.5">
              <time className="font-mono-tabular text-xs leading-5 text-texto-2">{dataCurta(h.criadoEm)}</time>
              <span className="font-mono-tabular">{formatarPercentual(h.percentual)}</span>
            </li>
          ))}
        </ul>
      )}
    </Painel>
  );
}

/** RF-56: contratos com remuneração a receber, com "Marcar recebida". */
function AReceber({ conta, linhas, ativa }: { conta: string; linhas: TVgv["linhas"]; ativa: boolean }) {
  const qc = useQueryClient();
  const marcar = useMutation({
    mutationFn: (id: string) => api(`/api/contas/${conta}/clientes/${id}/remuneracao`, { method: "PATCH", body: { recebidaEm: hojeBr() } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vgv", conta] }),
  });
  return (
    <Painel titulo={`Remuneração a receber · ${linhas.length}`}>
      {marcar.isError && <Aviso tom="erro">Não foi possível marcar como recebida.</Aviso>}
      <ul className="flex flex-col divide-y divide-borda">
        {linhas.map((l) => (
          <li key={l.clienteId} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
            <LinkFicha id={l.clienteId} className="flex flex-col">
              <b className="font-medium">{l.nome}</b>
              <span className="text-xs text-texto-2">Assinado em {l.dataAssinatura?.split("-").reverse().join("/")}</span>
            </LinkFicha>
            <span className="flex items-center gap-3">
              <span className="font-mono-tabular">{l.remuneracaoCentavos == null ? "—" : formatarReais(l.remuneracaoCentavos)}</span>
              {ativa && (
                <Botao variante="secundario" className="min-h-9 px-3 text-xs" carregando={marcar.isPending && marcar.variables === l.clienteId} onClick={() => marcar.mutate(l.clienteId)}>
                  Marcar recebida
                </Botao>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Painel>
  );
}

function Painel({ titulo, acao, children }: { titulo: string; acao?: ReactNode; children: ReactNode }) {
  return (
    <Cartao className="flex min-w-0 flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borda pb-3">
        <h2 className="text-base font-medium">{titulo}</h2>
        {acao}
      </div>
      {children}
    </Cartao>
  );
}

function Numero({ valor, rotulo, extra, destaque }: { valor: string; rotulo: string; extra?: string; destaque?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-0.5 rounded-lg border border-borda p-3", destaque && "bg-acento-suave")}>
      <strong className={cn("font-mono-tabular text-xl font-medium", destaque && "text-acento")}>{valor}</strong>
      <span className="text-xs uppercase tracking-wide text-texto-2">{rotulo}</span>
      {extra && <span className="text-xs text-texto-2">{extra}</span>}
    </div>
  );
}
