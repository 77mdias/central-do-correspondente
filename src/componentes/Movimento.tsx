import { type ReactNode, useState } from "react";
import { cn } from "@/lib/cn";
import "./movimento.css";

/*
 * Loops de motion da landing, em CSS puro (movimento.css). Sem vídeo e sem dependência:
 * texto real, nítido em qualquer tela, pausável e parado (cena completa) com prefers-reduced-motion.
 * Os botões desenhados são <span>: a cena é ilustração (role="img"), não controle.
 */

/** Moldura de um loop: descreve a cena para leitor de tela e oferece pausa (WCAG 2.2.2). */
function Palco({ rotulo, className, children }: { rotulo: string; className?: string; children: ReactNode }) {
  const [pausado, setPausado] = useState(false);
  return (
    <div className={cn("relative", pausado && "mv-pausado", className)}>
      <div role="img" aria-label={rotulo} className="flex h-full flex-col justify-center">
        {children}
      </div>
      <button
        type="button"
        onClick={() => setPausado((p) => !p)}
        aria-label={pausado ? "Retomar animação" : "Pausar animação"}
        className="absolute top-1 right-1 grid size-7 place-items-center rounded-md border border-[#e5e5e5] bg-white/90 text-[#4a4a4a] transition-colors hover:text-[#111111] motion-reduce:hidden"
      >
        <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3 fill-current">
          {pausado ? <path d="M3 1.5v9l7.5-4.5z" /> : <path d="M2.5 1.5H5v9H2.5zM7 1.5h2.5v9H7z" />}
        </svg>
      </button>
    </div>
  );
}

const PALCO_GARGALO = "rounded-2xl border border-[#d9e2ec] bg-[#dce6f2] p-6 sm:aspect-[4/3] sm:p-8";
const PILULA = "font-mono-tabular inline-block rounded-full px-2.5 py-0.5 text-xs font-medium";
const AMBAR = "bg-[#ffedd5] text-[#9a3412]";
const NEUTRA = "bg-[#f4f4f4] text-[#4a4a4a]";

/* ── Slot A ─────────────────────────────────────────────────────────── */

const FILA = [
  { sigla: "MF", nome: "Marcelo Ferreira", resumo: "R$ 340.000,00 · 3/12 docs" },
  { sigla: "PA", nome: "Patrícia Alves", resumo: "R$ 410.000,00 · 7/12 docs" },
  { sigla: "DM", nome: "Diego Mendes", resumo: "R$ 265.000,00 · sem telefone" },
  { sigla: "CS", nome: "Camila Santana", resumo: "R$ 380.000,00 · 11/12 docs" },
];

/** Hero: Cobrar hoje · 08:00. Seleciona Marcelo, abre a mensagem, confirma "Enviou?" e segue para Patrícia. */
export function LoopHero() {
  return (
    <Palco
      rotulo="Animação da lista Cobrar hoje às 08:00: Marcelo Ferreira, R$ 340.000,00, 3 de 12 documentos, recebe a mensagem pronta via wa.me com intervalo de 3 dias. Ao responder Sim, registrar cobrança na pergunta Enviou?, o próximo retorno passa para daqui a 3 dias e a lista segue para Patrícia Alves."
      className="mv-hero overflow-hidden rounded-xl border border-black/15 bg-white shadow-[0_0_0_4px_rgba(17,17,17,0.05)] md:h-[340px]"
    >
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-[#e5e5e5] bg-[#f8f8f7] pr-10 pl-3.5 text-xs text-[#4a4a4a]">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex gap-1.5" aria-hidden="true">
            <i className="block size-2 rounded-full bg-[#d4d4d4]" />
            <i className="block size-2 rounded-full bg-[#d4d4d4]" />
            <i className="block size-2 rounded-full bg-[#d4d4d4]" />
          </span>
          <span>
            <strong className="font-medium text-[#111111]">Cobrar hoje</strong> · <span className="font-mono-tabular">08:00</span>
          </span>
        </div>
        <span className="font-mono-tabular grid">
          <span className="mv-a mv-h-antes [grid-area:1/1]">4 pendências</span>
          <span className="mv-a mv-h-depois [grid-area:1/1]">3 pendências</span>
        </span>
      </div>

      <div className="grid min-h-0 flex-1 md:grid-cols-[270px_1fr]">
        <div className="flex flex-col gap-0.5 border-b border-[#e5e5e5] bg-[#fafafa] p-2 md:border-r md:border-b-0">
          {FILA.map((it, i) => (
            <div key={it.sigla} className="relative grid grid-cols-[28px_1fr_auto] items-center gap-x-2.5 gap-y-0.5 rounded-lg px-2.5 py-2">
              {i < 2 && (
                <span
                  className={cn("mv-a absolute inset-0 rounded-lg bg-white ring-1 ring-[#1a4be0] ring-inset", i === 0 ? "mv-h-sel1" : "mv-h-sel2")}
                />
              )}
              <span className="relative row-span-2 grid size-7 place-items-center rounded-full bg-[#eff6ff] text-xs font-medium text-[#1a4be0]">
                {it.sigla}
              </span>
              <span className="relative truncate text-xs font-medium text-[#111111]">{it.nome}</span>
              <span className="font-mono-tabular relative grid text-right text-[11px] text-[#4a4a4a]">
                {i === 0 ? (
                  <>
                    <span className="mv-a mv-h-antes [grid-area:1/1]">hoje</span>
                    <span className="mv-a mv-h-depois [grid-area:1/1] text-[#15803d]">+3d</span>
                  </>
                ) : (
                  "hoje"
                )}
              </span>
              <span className="font-mono-tabular relative col-span-2 truncate text-[11px] text-[#4a4a4a]">{it.resumo}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 p-4 sm:p-5">
          <div className="grid">
            <div className="mv-a mv-h-cab1 flex flex-wrap items-center justify-between gap-2 [grid-area:1/1]">
              <span className="text-sm font-medium text-[#111111]">
                Marcelo Ferreira · <span className="font-mono-tabular">R$ 340.000,00</span>
              </span>
              <span className="grid justify-items-end">
                <span className={cn("mv-a mv-h-b1 [grid-area:1/1]", PILULA, "bg-[#eff6ff] text-[#1a4be0]")}>Cobrar hoje</span>
                <span className={cn("mv-a mv-h-b2 [grid-area:1/1]", PILULA, "bg-[#dcfce7] text-[#15803d]")}>Próximo retorno em +3 dias</span>
              </span>
            </div>
            <div className="mv-a mv-h-cab2 flex flex-wrap items-center justify-between gap-2 [grid-area:1/1]">
              <span className="text-sm font-medium text-[#111111]">
                Patrícia Alves · <span className="font-mono-tabular">R$ 410.000,00</span>
              </span>
              <span className={cn(PILULA, "bg-[#eff6ff] text-[#1a4be0]")}>Cobrar hoje</span>
            </div>
          </div>

          <div className="mv-a mv-h-card rounded-lg border border-[#e5e5e5] bg-white p-3">
            <div className="flex items-center gap-2 text-xs text-[#4a4a4a]">
              <img src="/icons/whatsapp.svg" alt="" width={16} height={16} />
              <span>
                Mensagem pronta via wa.me · <span className="font-mono-tabular">intervalo 3 dias</span>
              </span>
            </div>
            <p className="mt-2 rounded-md bg-[#f4f4f4] px-3 py-2 text-xs leading-relaxed text-[#111111]">
              Olá, Marcelo! Faltam o comprovante de renda e a matrícula do imóvel para seguir com o financiamento.
            </p>
          </div>

          <div className="grid">
            <div className="mv-a mv-h-dlg rounded-lg border border-[#e5e5e5] bg-[#f4f4f4] p-3 [grid-area:1/1]">
              <p className="text-sm font-medium text-[#111111]">Enviou a cobrança para Marcelo Ferreira?</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <span className="mv-a mv-h-btn inline-block rounded-md bg-[#1a4be0] px-3 py-1.5 text-xs font-medium text-white">
                  Sim, registrar cobrança
                </span>
                <span className="inline-block rounded-md border border-[#d4d4d4] bg-white px-3 py-1.5 text-xs font-medium text-[#111111]">
                  Não enviei
                </span>
              </div>
            </div>
            <p className="mv-a mv-h-ok flex items-center gap-2 self-start rounded-lg border border-[#e5e5e5] bg-white p-3 text-sm text-[#111111] [grid-area:1/1]">
              <span className="font-medium text-[#15803d]">✓</span>
              Cobrança registrada para Marcelo Ferreira.
            </p>
          </div>
        </div>
      </div>
    </Palco>
  );
}

/* ── Slot B ─────────────────────────────────────────────────────────── */

function Notificacao({ anim, icone, titulo, hora, children }: { anim: string; icone: ReactNode; titulo: string; hora: string; children: ReactNode }) {
  return (
    <div className={cn("mv-a flex items-center justify-between gap-3 rounded-xl border border-[#e5e5e5] bg-white p-3.5", anim)}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#f4f4f4] text-[#111111]">{icone}</span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[#111111]">{titulo}</p>
          <div className="mt-0.5 text-xs text-[#4a4a4a]">{children}</div>
        </div>
      </div>
      <span className="font-mono-tabular shrink-0 text-xs text-[#4a4a4a]">{hora}</span>
    </div>
  );
}

const TRACO = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Gargalo 1: a rotina das 08:00 em três notificações, com o próximo retorno em +3 dias em destaque. */
export function LoopCobranca() {
  return (
    <Palco
      rotulo="Animação das notificações da rotina das 08:00: aviso com 4 cobranças do dia, cobrança de Marcelo F. registrada às 08:14 com próximo retorno em 3 dias, e mensagem copiada para Diego M., que está sem telefone."
      className={PALCO_GARGALO}
    >
      <div className="flex flex-col gap-2.5">
        <Notificacao
          anim="mv-b-1"
          titulo="Aviso das 08:00"
          hora="08:00"
          icone={
            <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" {...TRACO}>
              <path d="M4 11V7a4 4 0 0 1 8 0v4l1 1.5H3zM6.5 14a1.5 1.5 0 0 0 3 0" />
            </svg>
          }
        >
          <span className="font-mono-tabular">4</span> cobranças para hoje
        </Notificacao>
        <Notificacao anim="mv-b-2" titulo="Cobrança · Marcelo F." hora="08:14" icone={<img src="/icons/whatsapp.svg" alt="" width={16} height={16} />}>
          <span className="mv-a mv-b-dest font-mono-tabular inline-block rounded-full bg-[#dcfce7] px-2 py-0.5 font-medium text-[#15803d]">
            Próximo retorno em +3 dias
          </span>
        </Notificacao>
        <Notificacao
          anim="mv-b-3"
          titulo="Sem telefone · Diego M."
          hora="08:16"
          icone={
            <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" {...TRACO}>
              <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
              <path d="M10.5 3.5v-.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h.5" />
            </svg>
          }
        >
          Mensagem copiada
        </Notificacao>
      </div>
    </Palco>
  );
}

/* ── Slot C ─────────────────────────────────────────────────────────── */

// Alturas fixas (h-9, h-11, gap/padding 1.5, caixas a gap-2.5): os deslocamentos de movimento.css dependem delas.
const CAIXA = "rounded-xl border border-[#e5e5e5] bg-white";
const CAB_CAIXA = "flex h-9 items-center justify-between border-b border-[#e5e5e5] px-3 text-xs text-[#4a4a4a]";
const LINHA = "flex h-11 shrink-0 items-center justify-between gap-3 rounded-lg border border-[#e5e5e5] bg-white px-3";

function Ficha({ anim, nome, etapa, children }: { anim?: string; nome: string; etapa: string; children: ReactNode }) {
  return (
    <div className={cn(LINHA, anim && `mv-a ${anim}`)}>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-medium text-[#111111]">{nome}</p>
        <p className="truncate text-xs text-[#4a4a4a]">{etapa}</p>
      </div>
      {children}
    </div>
  );
}

/** Gargalo 2: Patrícia passa de 6d para 7d parado e sobe para o topo de "Parados há 7+ dias". */
export function LoopParados() {
  return (
    <Palco
      rotulo="Animação do alerta de processos parados: a ficha de Patrícia Alves, em análise de crédito, passa de 6 para 7 dias sem movimento e sobe para o topo de Parados há 7+ dias, acima de Diego Mendes, parado há 8 dias."
      className={PALCO_GARGALO}
    >
      <div className="mv-a mv-c-tudo flex flex-col gap-2.5">
        <div className={CAIXA}>
          <div className={CAB_CAIXA}>
            <strong className="font-medium text-[#111111]">Parados há 7+ dias</strong>
            <span className="font-mono-tabular grid justify-items-end">
              <span className="mv-a mv-c-n1 [grid-area:1/1]">1 ficha</span>
              <span className="mv-a mv-c-n2 [grid-area:1/1]">2 fichas</span>
            </span>
          </div>
          <div className="relative flex flex-col gap-1.5 p-1.5">
            <span className="mv-a mv-c-vazio absolute inset-x-1.5 bottom-1.5 grid h-11 place-items-center text-xs text-[#4a4a4a]">
              Nenhuma outra ficha parada
            </span>
            <Ficha anim="mv-c-pat relative z-10" nome="Patrícia Alves" etapa="Análise de crédito · Direto">
              <span className="grid justify-items-end">
                <span className={cn("mv-a mv-c-6d [grid-area:1/1]", PILULA, NEUTRA)}>6d</span>
                <span className={cn("mv-a mv-c-7d [grid-area:1/1]", PILULA, AMBAR)}>7d parado</span>
              </span>
            </Ficha>
            <Ficha anim="mv-c-die" nome="Diego Mendes" etapa="Doc. pendente · M. Prado">
              <span className={cn(PILULA, AMBAR)}>8d parado</span>
            </Ficha>
          </div>
        </div>

        <div className={CAIXA}>
          <div className={CAB_CAIXA}>
            <strong className="font-medium text-[#111111]">Em andamento</strong>
          </div>
          <div className="flex flex-col gap-1.5 p-1.5">
            <Ficha anim="mv-c-raf" nome="Rafael Camargo" etapa="Avaliação · C. Lima">
              <span className={cn(PILULA, NEUTRA)}>3d</span>
            </Ficha>
            <Ficha anim="mv-c-cam" nome="Camila Santana" etapa="Conformidade · R. Nogueira">
              <span className={cn(PILULA, NEUTRA)}>1d</span>
            </Ficha>
          </div>
        </div>
      </div>
    </Palco>
  );
}

/* ── Slot D ─────────────────────────────────────────────────────────── */

const ARQUIVOS = [
  { nome: "Holerite_Out.pdf", tipo: "Renda" },
  { nome: "Matricula_4821.pdf", tipo: "Imóvel" },
];

/** Gargalo 3: o corretor envia dois PDFs pelo portal e a ficha marca cada um como recebido. */
export function LoopAnexos() {
  return (
    <Palco
      rotulo="Animação do portal do corretor: C. Lima envia Holerite_Out.pdf, de renda, e Matricula_4821.pdf, do imóvel, na ficha do cliente, e os dois aparecem como recebidos."
      className={PALCO_GARGALO}
    >
      <div className="mv-a mv-d-tudo rounded-xl border border-[#e5e5e5] bg-white p-4">
        <div className="flex items-center justify-between gap-2 border-b border-[#e5e5e5] pb-2.5 text-xs">
          <span className="inline-flex items-center gap-2 font-medium text-[#111111]">
            <span className="size-2 rounded-full bg-[#1a4be0]" aria-hidden="true" />
            Anexos · C. Lima
          </span>
          <span className="rounded-full bg-[#f4f4f4] px-2 py-0.5 text-[#4a4a4a]">Portal do corretor</span>
        </div>
        <ul className="mt-3 flex flex-col gap-2">
          {ARQUIVOS.map((a, i) => (
            <li key={a.nome} className="rounded-lg border border-[#e5e5e5] px-3 py-2.5 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex min-w-0 items-center gap-2 font-medium text-[#111111]">
                  <img src="/icons/pdf.svg" alt="" width={16} height={16} />
                  <span className="truncate">
                    {a.nome} <span className="font-normal text-[#4a4a4a]">· {a.tipo}</span>
                  </span>
                </span>
                <span className="font-mono-tabular grid shrink-0 justify-items-end">
                  <span className={`mv-a mv-d-env${i + 1} text-[#4a4a4a] [grid-area:1/1]`}>Enviando…</span>
                  <span className={`mv-a mv-d-ok${i + 1} font-medium text-[#15803d] [grid-area:1/1]`}>Recebido ✓</span>
                </span>
              </div>
              <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-[#e5e5e5]">
                <div className={`mv-a mv-d-barra${i + 1} h-full origin-left bg-[#1a4be0]`} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Palco>
  );
}

/* ── Bônus · banda VGV ──────────────────────────────────────────────── */

/** Selo da taxa congelada: o arco do cadeado fecha quando o painel entra na tela (movimento.css). */
export function SeloTaxa() {
  return (
    <span className="mv-selo font-mono-tabular inline-flex items-center gap-1.5 rounded-full border border-[#313131] px-2.5 py-1 text-xs font-medium text-[#6798ff]">
      <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3" {...TRACO} strokeWidth={1.25}>
        <path className="mv-arco" d="M4 5.5V4a2 2 0 0 1 4 0v1.5" />
        <rect x="2.5" y="5.5" width="7" height="5" rx="1" />
      </svg>
      Taxa congelada · 1,400%
    </span>
  );
}
