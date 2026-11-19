import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { formatarReais } from "@/regras/dinheiro";
import { PLANOS } from "@/regras/planos";
import { ETAPAS, type Estado, FECHA, hora, porcento, TAXA_ATUAL } from "./expediente";

// As vistas da "superfície viva": cada uma desenha o estado calculado em expediente.ts para o horário atual.

const TONS = {
  neutra: "bg-[#f4f4f4] text-[#4a4a4a]",
  azul: "bg-[#eff6ff] text-[#1a4be0]",
  ambar: "bg-[#ffedd5] text-[#9a3412]",
  verde: "bg-[#dcfce7] text-[#15803d]",
};

function Pilula({ tom, children }: { tom: keyof typeof TONS; children: ReactNode }) {
  return <span className={cn("font-mono-tabular inline-block shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium", TONS[tom])}>{children}</span>;
}

function Janela({ id, titulo, lado, className, children }: { id?: string; titulo: ReactNode; lado?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div id={id} className={cn("overflow-hidden rounded-xl border border-[#e5e5e5] bg-white", className)}>
      <div className="flex h-10 items-center justify-between gap-3 border-b border-[#e5e5e5] bg-[#f8f8f7] px-4 text-xs text-[#4a4a4a]">
        <span className="font-medium text-[#111111]">{titulo}</span>
        {lado}
      </div>
      {children}
    </div>
  );
}

/** Fatos curtos lado a lado, separados por linha fina (sem cartões). */
export function Fatos({ itens, escuro = false, className }: { itens: { marca: string; titulo?: string; texto: ReactNode }[]; escuro?: boolean; className?: string }) {
  return (
    <dl
      className={cn(
        "grid gap-px overflow-hidden rounded-xl border",
        escuro ? "border-[#313131] bg-[#313131]" : "border-[#e5e5e5] bg-[#e5e5e5]",
        className,
      )}
    >
      {itens.map((f) => (
        <div key={f.marca} className={cn("p-4", escuro ? "bg-[#141414]" : "bg-white")}>
          <dt className={cn("font-mono-tabular text-sm font-medium", escuro ? "text-[#6798ff]" : "text-[#1a4be0]")}>{f.marca}</dt>
          {f.titulo && <p className={cn("mt-1 text-sm font-medium", escuro ? "text-white" : "text-[#111111]")}>{f.titulo}</p>}
          <dd className={cn("mt-1 text-xs leading-relaxed", escuro ? "text-[#a7a7a7]" : "text-[#4a4a4a]")}>{f.texto}</dd>
        </div>
      ))}
    </dl>
  );
}

export const OFERTA = [
  { marca: "10 etapas", texto: "Do cadastro ao registro em cartório, com histórico de cada mudança." },
  { marca: "12 documentos", texto: "Checklist por cliente em dois grupos: comprador, imóvel e vendedor." },
  { marca: "08:00", texto: "Aviso diário com quem cobrar e o que está parado há 7+ dias." },
  { marca: "wa.me", texto: "Mensagem pronta no WhatsApp e confirmação no \"Enviou?\"." },
  { marca: "Portal", texto: "O corretor entra por convite e vê só os próprios clientes." },
  { marca: "Taxa congelada", texto: "Percentual travado na assinatura. VGV e comissão só para o gestor." },
];

export const PASSOS_COBRANCA = [
  { marca: "1 · 08:00", titulo: "A lista do dia", texto: "Entra no aviso quem tem documento faltando e retorno vencendo hoje." },
  { marca: "2 · wa.me", titulo: "Mensagem pronta", texto: "O link abre a conversa do cliente com o texto. Sem telefone, a mensagem é copiada." },
  { marca: "3 · Enviou?", titulo: "Registro e próximo retorno", texto: "Confirmou, a cobrança vai para o histórico e o próximo contato sai do intervalo: 1, 2, 3, 5 ou 7 dias." },
];

const STATUS_COBRANCA = (c: Estado["cobrancas"][number]) =>
  c.status === "registrada" ? <Pilula tom="verde">+{c.intervalo}d</Pilula> : c.status === "enviou" ? <Pilula tom="azul">Enviou?</Pilula> : <Pilula tom="neutra">{hora(c.min)}</Pilula>;

const Check = () => (
  <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 6.5l2.25 2.25L9.5 3.5" />
  </svg>
);

/* ── Régua do expediente (lado direito) ─────────────────────────────── */

const ABRE_REGUA = 8 * 60;
const MARCAS_REGUA = Array.from({ length: (FECHA - ABRE_REGUA) / 15 + 1 }, (_, i) => ABRE_REGUA + i * 15);

/** Evento que a landing dispara a cada leitura da rolagem, com o horário exato (sem arredondar). */
export const EVENTO_MINUTO = "ex:minuto";

/**
 * Régua do expediente: uma linha a cada 15 minutos. Segue a rolagem contínua e desliza até ela (lerp),
 * com uma lupa em curva em volta da posição. Escreve direto nas linhas, sem re-renderizar a página.
 */
export function ReguaDoExpediente({ escuro }: { escuro: boolean }) {
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const linhas = Array.from(raiz.current?.children ?? []) as HTMLElement[];
    const reduzir = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let exibido = ABRE_REGUA;
    let alvo = ABRE_REGUA;
    let quadro = 0;

    const pintar = () => {
      linhas.forEach((el, i) => {
        const t = MARCAS_REGUA[i]!;
        const perto = Math.max(0, 1 - Math.abs(exibido - t) / 55);
        const curva = perto * perto * (3 - 2 * perto); // smoothstep: a lupa sobe e desce sem quina
        const base = t <= exibido ? 0.5 : 0.18; // o que já passou fica mais escuro
        el.style.transform = `scaleX(${0.3 + 0.7 * curva})`;
        el.style.opacity = String(base + (1 - base) * curva);
        el.style.backgroundColor = `color-mix(in srgb, var(--regua-acento) ${Math.round(curva * curva * 100)}%, var(--regua-tinta))`;
      });
    };
    const passo = () => {
      exibido += (alvo - exibido) * 0.1;
      if (Math.abs(alvo - exibido) < 0.05) exibido = alvo;
      pintar();
      quadro = exibido === alvo ? 0 : requestAnimationFrame(passo);
    };
    const ouvir = (ev: Event) => {
      alvo = (ev as CustomEvent<number>).detail;
      if (reduzir) {
        exibido = alvo;
        pintar();
      } else if (!quadro) {
        quadro = requestAnimationFrame(passo);
      }
    };

    pintar();
    addEventListener(EVENTO_MINUTO, ouvir);
    return () => {
      removeEventListener(EVENTO_MINUTO, ouvir);
      cancelAnimationFrame(quadro);
    };
  }, []);

  return (
    <div
      ref={raiz}
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed top-1/2 right-5 z-40 hidden -translate-y-1/2 flex-col items-end gap-[6px] lg:flex",
        escuro ? "[--regua-acento:#6798ff] [--regua-tinta:#ffffff]" : "[--regua-acento:#1a4be0] [--regua-tinta:#111111]",
      )}
    >
      {MARCAS_REGUA.map((t) => (
        <span key={t} className={cn("block w-11 origin-right", t % 60 === 0 ? "h-[2px]" : "h-px")} />
      ))}
    </div>
  );
}

/* ── 1 · Início ─────────────────────────────────────────────────────── */

export function VistaInicio({ e }: { e: Estado }) {
  const comFalta = e.fichas.filter((f) => f.docs < 12).length;
  const contadores = [
    { rotulo: "Ativos", valor: e.fichas.length },
    { rotulo: "Cobrar hoje", valor: e.pendentes },
    { rotulo: "Com documento faltando", valor: comFalta },
    { rotulo: "Parados há 7+ dias", valor: e.parados.length, alerta: e.parados.length > 0 },
  ];
  return (
    <div className="flex w-full flex-col gap-8">
    <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-12">
      <div className="flex flex-col gap-4">
        <p className="font-mono-tabular text-xs text-[#4a4a4a]">Demonstração com dados de exemplo</p>
        <h1 className="max-w-[30ch] text-[1.75rem] font-medium leading-[1.08] tracking-[-0.03em] text-balance text-[#111111] sm:text-[2rem]">
          Controle de financiamento habitacional, do cadastro ao cartório.
        </h1>
        <p className="max-w-[44ch] text-base leading-relaxed text-pretty text-[#4a4a4a]">
          Cobrança diária pelo WhatsApp com confirmação, 12 documentos por cliente, portal do corretor e VGV com a taxa congelada.
        </p>
        <div className="hidden flex-wrap items-center gap-x-4 gap-y-2 sm:flex">
          <a href="#assinar" className="inline-flex min-h-11 items-center rounded-lg bg-[#1a4be0] px-5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#143bb5]">
            Assinar plano
          </a>
          <p className="text-sm text-[#4a4a4a]">
            A partir de <span className="font-mono-tabular text-[#111111]">{formatarReais(PLANOS.simples.precoCentavos)}</span>/mês · sem fidelidade · sem cobrança por corretor
          </p>
        </div>
      </div>

      <div className="relative">
        <Janela titulo="Início · Escritório Demonstração" lado={<span className="font-mono-tabular">{e.relogio}</span>}>
          <dl className="grid grid-cols-2 border-b border-[#e5e5e5] sm:grid-cols-4">
            {contadores.map((c) => (
              <div key={c.rotulo} className="border-r border-b border-[#e5e5e5] px-4 py-3 last:border-r-0 sm:border-b-0">
                <dt className="text-[11px] leading-tight text-[#4a4a4a]">{c.rotulo}</dt>
                <dd className={cn("font-mono-tabular mt-1 text-xl font-medium", c.alerta ? "text-[#9a3412]" : "text-[#111111]")}>{c.valor}</dd>
              </div>
            ))}
          </dl>
          <div className="p-4">
            <div className="flex items-center justify-between text-xs text-[#4a4a4a]">
              <strong className="font-medium text-[#111111]">Parados há 7+ dias</strong>
              <span>sem cobrança, etapa ou anexo</span>
            </div>
            <ul className="mt-3 flex min-h-[7.5rem] flex-col gap-2">
              {e.parados.map((f) => (
                <li key={f.id} className="ex-entra flex h-14 items-center justify-between gap-3 rounded-lg border border-[#e5e5e5] px-3">
                  <div className="min-w-0 leading-tight">
                    <p className="truncate text-sm font-medium text-[#111111]">{f.nome}</p>
                    <p className="truncate text-xs text-[#4a4a4a]">{ETAPAS[f.etapa]} · {f.corretor}</p>
                  </div>
                  <Pilula tom="ambar">{f.dias}d parado</Pilula>
                </li>
              ))}
              {e.parados.length === 0 && <li className="grid h-14 place-items-center text-xs text-[#4a4a4a]">Nenhuma ficha parada</li>}
            </ul>
          </div>
          <div className="hidden border-t border-[#e5e5e5] px-4 pt-3 pb-2 lg:block">
            <div className="flex items-center justify-between text-xs text-[#4a4a4a]">
              <strong className="font-medium text-[#111111]">Cobrar hoje</strong>
              <span>documento faltando e retorno vencendo</span>
            </div>
            <ul className="mt-1 divide-y divide-[#e5e5e5]">
              {e.cobrancas.map((c) => (
                <li key={c.ficha} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-[#111111]">{c.nome}</span>
                  <span className="font-mono-tabular text-xs text-[#4a4a4a]">{c.docs}/12 docs</span>
                  {STATUS_COBRANCA(c)}
                </li>
              ))}
            </ul>
          </div>
        </Janela>

        {/* Plano da frente: o aviso das 08:00 chega por cima do painel */}
        <div
          className={cn(
            "absolute -top-5 right-3 w-[min(19rem,80%)] rounded-xl border border-[#e5e5e5] bg-white p-3.5 shadow-[0_12px_28px_-14px_rgba(17,17,17,0.35)] transition-[opacity,translate] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] sm:-right-5",
            e.avisou ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
          )}
          aria-hidden={!e.avisou}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-[#111111]">
              Aviso das <span className="font-mono-tabular">08:00</span>
            </p>
            <span className="font-mono-tabular text-xs text-[#4a4a4a]">08:00</span>
          </div>
          <p className="mt-0.5 text-xs text-[#4a4a4a]">4 cobranças para hoje · 2 fichas paradas</p>
        </div>
      </div>
    </div>
    <Fatos itens={OFERTA} className="hidden lg:grid lg:grid-cols-6" />
    </div>
  );
}

/* ── 2 · Cobranças ──────────────────────────────────────────────────── */

const MENSAGEM: Record<string, string> = {
  marcelo: "Olá, Marcelo! Faltam o comprovante de renda e a matrícula do imóvel para seguir com o financiamento.",
  diego: "Olá, Diego! Ainda faltam documentos do comprador para a análise. Pode enviar hoje?",
  patricia: "Olá, Patrícia! A análise de crédito precisa dos extratos atualizados. Consegue mandar?",
  camila: "Olá, Camila! Falta só um documento do vendedor para a conformidade.",
};

export function TrilhoCobrancas({ e }: { e: Estado }) {
  const zerou = e.cobrancas.every((c) => c.status === "registrada");
  const ultima = e.cobrancas.at(-1);
  return (
    <>
      {/* Só no desktop: no celular o título fica parado acima do trilho (Landing) e o texto vem depois do palco. */}
      <article className="ex-cartao hidden flex-col justify-center gap-3 pr-4 lg:flex">
        <h2 className="text-2xl font-medium tracking-[-0.03em] text-[#111111]">Cobranças de hoje</h2>
        <p className="text-sm leading-relaxed text-[#4a4a4a]">
          Abra o WhatsApp com a mensagem pronta e confirme ao voltar. O próximo retorno sai do intervalo de cada cliente: 1, 2, 3, 5 ou 7 dias.
        </p>
        <p className="font-mono-tabular text-xs text-[#4a4a4a]">
          {e.pendentes} de {e.cobrancas.length} pendentes
        </p>
      </article>

      {e.cobrancas.map((c) => (
        <article key={c.ficha} className="ex-cartao flex flex-col gap-3 rounded-xl border border-[#e5e5e5] bg-white p-4">
          <header className="flex items-start justify-between gap-3">
            <div className="min-w-0 leading-tight">
              <h3 className="truncate text-base font-medium text-[#111111]">{c.nome}</h3>
              <p className="font-mono-tabular mt-1 text-xs text-[#4a4a4a]">
                {formatarReais(c.imovelCentavos)} · {c.docs}/12 docs
              </p>
            </div>
            {c.status === "registrada" ? (
              <Pilula tom="verde">+{c.intervalo}d</Pilula>
            ) : (
              <Pilula tom={c.status === "enviou" ? "azul" : "neutra"}>{hora(c.min)}</Pilula>
            )}
          </header>

          <div className="flex items-center gap-2 text-xs text-[#4a4a4a]">
            <img src="/icons/whatsapp.svg" alt="" width={16} height={16} />
            {c.telefone ? (
              <span>
                Mensagem pronta via wa.me · <span className="font-mono-tabular">intervalo {c.intervalo} {c.intervalo === 1 ? "dia" : "dias"}</span>
              </span>
            ) : (
              <span>Sem telefone · mensagem copiada para enviar por outro meio</span>
            )}
          </div>
          <p className="rounded-md bg-[#f4f4f4] px-3 py-2 text-xs leading-relaxed text-[#111111]">{MENSAGEM[c.ficha]}</p>

          <div className="mt-auto min-h-[5.25rem]">
            {c.status === "fila" && <p className="pt-2 text-xs text-[#4a4a4a]">Na fila para {hora(c.min)}.</p>}
            {c.status === "enviou" && (
              <div className="ex-entra rounded-lg border border-[#e5e5e5] bg-[#f4f4f4] p-3">
                <p className="text-sm font-medium text-[#111111]">Enviou a cobrança para {c.nome.split(" ")[0]}?</p>
                <div className="mt-2 flex gap-2" aria-hidden="true">
                  <span className="rounded-md bg-[#1a4be0] px-3 py-1.5 text-xs font-medium text-white">Sim, registrar cobrança</span>
                  <span className="rounded-md border border-[#d4d4d4] bg-white px-3 py-1.5 text-xs font-medium text-[#111111]">Não enviei</span>
                </div>
              </div>
            )}
            {c.status === "registrada" && (
              <p className="ex-entra flex items-start gap-2 rounded-lg border border-[#e5e5e5] p-3 text-sm text-[#111111]">
                <span className="mt-0.5 text-[#15803d]">
                  <Check />
                </span>
                <span>
                  Registrada às <span className="font-mono-tabular">{hora(c.min)}</span>. Próximo retorno em {c.intervalo} {c.intervalo === 1 ? "dia" : "dias"}.
                </span>
              </p>
            )}
          </div>
        </article>
      ))}

      <article className="ex-cartao flex flex-col justify-center gap-2 pl-2">
        <p className="font-mono-tabular text-xs text-[#4a4a4a]">{zerou && ultima ? hora(ultima.min) : "Até 10:15"}</p>
        <p className="text-xl font-medium tracking-[-0.02em] text-[#111111]">{zerou ? "Fila zerada." : `${e.pendentes} na fila.`}</p>
        <p className="text-sm text-[#4a4a4a]">Cada registro entra no histórico da ficha e conta como atualização.</p>
      </article>
    </>
  );
}

/* ── 3 · Ficha e portal do corretor ─────────────────────────────────── */

export function VistaFicha({ e }: { e: Estado }) {
  const rafael = e.fichas.find((f) => f.id === "rafael")!;
  const doCorretor = e.fichas.filter((f) => f.corretor === "C. Lima");
  const historico = e.historico.filter((h) => h.texto.includes("Rafael Camargo"));
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <Janela id="painel-portal" titulo="Portal do corretor · C. Lima" lado={<span>vê só os próprios clientes</span>}>
        <div className="flex flex-col gap-4 p-4">
          <ul className="flex flex-col gap-1.5 text-sm">
            {doCorretor.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3">
                <span className="text-[#111111]">{f.nome}</span>
                <span className="text-xs text-[#4a4a4a]">{ETAPAS[f.etapa]}</span>
              </li>
            ))}
          </ul>
          <div>
            <p className="text-xs font-medium text-[#111111]">Anexos enviados para Rafael Camargo</p>
            <ul className="mt-2 flex flex-col gap-2">
              {e.anexos.map((a) => (
                <li key={a.arquivo} className="rounded-lg border border-[#e5e5e5] px-3 py-2.5 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex min-w-0 items-center gap-2 font-medium text-[#111111]">
                      <img src="/icons/pdf.svg" alt="" width={16} height={16} />
                      <span className="truncate">
                        {a.arquivo} <span className="font-normal text-[#4a4a4a]">· {a.rotulo}</span>
                      </span>
                    </span>
                    {a.progresso >= 1 ? (
                      <span className="font-mono-tabular inline-flex shrink-0 items-center gap-1 font-medium text-[#15803d]">
                        Recebido <Check />
                      </span>
                    ) : (
                      <span className="font-mono-tabular shrink-0 text-[#4a4a4a]">{a.progresso > 0 ? `${Math.round(a.progresso * 100)}%` : "Aguardando"}</span>
                    )}
                  </div>
                  <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-[#e5e5e5]">
                    <div className="ex-progresso h-full bg-[#1a4be0]" style={{ transform: `scaleX(${a.progresso})` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Janela>

      <Janela id="painel-ficha" titulo="Ficha · Rafael Camargo" lado={<span className="font-mono-tabular">{formatarReais(rafael.imovelCentavos)}</span>}>
        <div className="flex flex-col gap-4 p-4">
          <div>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="text-[#4a4a4a]">Etapa</span>
              <span className="text-sm font-medium text-[#111111]">{ETAPAS[rafael.etapa]}</span>
            </div>
            <ol className="mt-2 flex gap-1" aria-label={`Etapa ${rafael.etapa + 1} de ${ETAPAS.length}: ${ETAPAS[rafael.etapa]}`}>
              {ETAPAS.map((nome, i) => (
                <li
                  key={nome}
                  title={nome}
                  className={cn("h-1 flex-1 rounded-full transition-colors duration-300", i < rafael.etapa ? "bg-[#1a4be0]" : i === rafael.etapa ? "bg-[#111111]" : "bg-[#e5e5e5]")}
                />
              ))}
            </ol>
            <p className="mt-2 hidden text-[11px] leading-relaxed text-[#4a4a4a] sm:block" aria-hidden="true">
              {ETAPAS.map((nome, i) => (
                <span key={nome} className={cn(i === rafael.etapa && "font-medium text-[#111111]", i < rafael.etapa && "text-[#1a4be0]")}>
                  {nome}
                  {i < ETAPAS.length - 1 && <span className="text-[#a3a3a3]"> › </span>}
                </span>
              ))}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {[
              { grupo: "Comprador", feitos: rafael.comprador, total: 8 },
              { grupo: "Imóvel e vendedor", feitos: rafael.imovel, total: 4 },
            ].map((g) => (
              <div key={g.grupo} className="rounded-lg border border-[#e5e5e5] p-3">
                <p className="text-[#4a4a4a]">{g.grupo}</p>
                <p className={cn("font-mono-tabular mt-1 text-lg font-medium", g.feitos === g.total ? "text-[#15803d]" : "text-[#111111]")}>
                  {g.feitos}/{g.total}
                </p>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-medium text-[#111111]">Histórico da ficha</p>
            <ul className="mt-2 flex min-h-[4.5rem] flex-col gap-1.5 text-xs text-[#4a4a4a]">
              {historico.map((h) => (
                <li key={h.min} className="ex-entra flex gap-3">
                  <span className="font-mono-tabular shrink-0 text-[#111111]">{hora(h.min)}</span>
                  <span>{h.texto.replace(" · Rafael Camargo", "").replace("Rafael Camargo avançou", "Avançou")}</span>
                </li>
              ))}
              {historico.length === 0 && <li>Aguardando documentos do corretor.</li>}
            </ul>
          </div>
        </div>
      </Janela>

      <Fatos
        className="sm:grid-cols-3 lg:col-span-2"
        itens={[
          { marca: "Convite", titulo: "Link válido por 7 dias", texto: "O corretor cria o próprio acesso pelo link e passa a ver só os clientes dele." },
          { marca: "Anexo", titulo: "PDF marca o documento", texto: "Enviar o arquivo marca o item do checklist como recebido e entra no histórico da ficha." },
          { marca: "30 dias", titulo: "PDFs com prazo", texto: "Os anexos são apagados 30 dias depois da assinatura, com aviso antes. A ficha e o histórico ficam." },
        ]}
      />
    </div>
  );
}

/* ── 4 · Gestor (o pico) ────────────────────────────────────────────── */

type Perfil = "gestor" | "funcionaria" | "corretor";
const PERFIS: { id: Perfil; rotulo: string }[] = [
  { id: "gestor", rotulo: "Gestor" },
  { id: "funcionaria", rotulo: "Funcionária" },
  { id: "corretor", rotulo: "Corretor C. Lima" },
];

function Cadeado({ fechado }: { fechado: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <path className={cn("ex-arco", fechado && "ex-arco--fechado")} d="M4 5.5V4a2 2 0 0 1 4 0v1.5" />
      <rect x="2.5" y="5.5" width="7" height="5" rx="1" />
    </svg>
  );
}

export function VistaGestor({ e }: { e: Estado }) {
  const [perfil, setPerfil] = useState<Perfil>("gestor");
  const hojeCentavos = e.contratos.filter((c) => c.hoje).reduce((s, c) => s + c.imovelCentavos, 0);
  const valores = perfil === "gestor";
  const contratos = perfil === "corretor" ? e.contratos.filter((c) => c.corretor === "C. Lima") : e.contratos;
  return (
    <div className="flex w-full flex-col gap-3 text-white sm:gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono-tabular text-xs text-[#a7a7a7]">Visão do gestor · {e.relogio}</p>
          <h2 className="mt-1 text-2xl font-medium tracking-[-0.03em] sm:text-3xl">Contratos do mês</h2>
        </div>
        <div role="group" aria-label="Ver como" className="flex rounded-lg border border-[#313131] p-0.5 text-xs">
          {PERFIS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={perfil === p.id}
              onClick={() => setPerfil(p.id)}
              className={cn(
                "rounded-md px-3 py-1.5 font-medium transition-colors duration-150",
                perfil === p.id ? "bg-white text-[#0a0a0a]" : "text-[#a7a7a7] hover:text-white",
              )}
            >
              {p.rotulo}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-[#1e1e1e] p-3 sm:col-span-2 sm:p-4">
          <p className="font-mono-tabular text-[11px] tracking-wider text-[#a7a7a7] uppercase">VGV contratado no mês</p>
          {valores ? (
            <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono-tabular text-2xl font-medium sm:text-4xl">{formatarReais(e.vgvCentavos)}</span>
              {hojeCentavos > 0 && <span className="ex-entra font-mono-tabular text-xs text-[#6798ff]">+ {formatarReais(hojeCentavos)} hoje</span>}
            </p>
          ) : (
            <p className="mt-2 text-sm text-[#a7a7a7]">Sem acesso. O banco não envia VGV para este perfil.</p>
          )}
        </div>
        {/* No celular, rótulo e valor na mesma linha. */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 rounded-lg bg-[#1e1e1e] p-3 sm:block sm:p-4">
          <p className="font-mono-tabular text-[11px] tracking-wider text-[#a7a7a7] uppercase">Remuneração prevista</p>
          {valores ? (
            <p className="font-mono-tabular text-xl font-medium sm:mt-1 sm:text-2xl">{formatarReais(e.remuneracaoCentavos)}</p>
          ) : (
            <p className="text-sm text-[#a7a7a7] sm:mt-2">Sem acesso (RLS).</p>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#313131]">
        <div className="grid grid-cols-[minmax(0,1fr)_6rem_4.25rem] gap-3 border-b border-[#313131] px-4 py-2 text-[11px] text-[#a7a7a7] sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)]">
          <span>Cliente</span>
          <span>Imóvel</span>
          <span>
            Taxa<span className="max-sm:hidden"> congelada</span>
          </span>
          <span className="hidden sm:block">Remuneração</span>
        </div>
        <ul>
          {contratos.map((c) => (
            <li
              key={c.nome}
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_6rem_4.25rem] items-center gap-3 border-b border-[#1e1e1e] px-4 py-2.5 text-sm last:border-b-0 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)]",
                c.hoje && "ex-entra bg-[#141414]",
              )}
            >
              <span className="truncate">
                {c.nome}
                {c.hoje && <span className="font-mono-tabular ml-2 text-xs text-[#6798ff]">hoje</span>}
              </span>
              <span className="font-mono-tabular text-xs text-[#a7a7a7] sm:truncate sm:text-sm">{formatarReais(c.imovelCentavos)}</span>
              {valores ? (
                <span className="font-mono-tabular inline-flex items-center gap-1.5 text-xs text-[#6798ff]">
                  <Cadeado fechado />
                  {porcento(c.taxa)}
                </span>
              ) : (
                <span className="text-xs text-[#7c7c7c]">oculta</span>
              )}
              <span className="font-mono-tabular hidden text-[#a7a7a7] sm:block">{valores ? formatarReais(c.remuneracaoCentavos) : "oculta"}</span>
            </li>
          ))}
          {contratos.length === 0 && <li className="px-4 py-3 text-sm text-[#a7a7a7]">Nenhum contrato deste corretor no mês ainda.</li>}
        </ul>
      </div>

      <p className="text-xs leading-relaxed text-[#a7a7a7]">
        {valores
          ? `Taxa vigente ${porcento(TAXA_ATUAL)}. Na assinatura o percentual fica congelado no contrato: o de Carla Menezes segue em ${porcento(1.3)}.`
          : perfil === "funcionaria"
            ? "A funcionária cadastra clientes e registra cobranças, mas o banco nunca envia a ela percentual, remuneração ou VGV."
            : "O corretor vê só os próprios clientes e envia documentos. Percentual e remuneração não saem do banco para ele."}
      </p>

      <Fatos
        escuro
        className="hidden lg:grid lg:grid-cols-3"
        itens={[
          { marca: "RN-07", titulo: "Taxa travada por contrato", texto: "Mudar o percentual hoje não altera contratos já assinados." },
          { marca: "RLS", titulo: "Sigilo no banco", texto: "Funcionária e corretor não recebem percentual, remuneração nem VGV: a regra roda no Postgres, não só na tela." },
          {
            marca: "Exportar",
            titulo: "Relatório do gestor",
            texto: (
              <span className="inline-flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-white">
                  <img src="/icons/pdf.svg" alt="" width={14} height={14} /> Relatório PDF
                </span>
                <span className="inline-flex items-center gap-1.5 text-white">
                  <img src="/icons/google-sheets.svg" alt="" width={14} height={14} /> Planilha
                </span>
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}

/* ── 5 · Fechamento do expediente ───────────────────────────────────── */

const ESCOPO = [
  { titulo: "Lembrete às 08:00", desc: "Web Push no app instalado e e-mail de reserva.", incluido: true },
  { titulo: "Importador de JSON", desc: "Migração dos processos para quem vem do protótipo.", incluido: true },
  { titulo: "Download privado LGPD", desc: "Links temporários e auditados para anexos de clientes.", incluido: true },
  { titulo: "Sistemas do banco", desc: "Não integra com portais do banco nem simula crédito.", incluido: false },
  { titulo: "Envio automático no WhatsApp", desc: "Sem API oficial: você envia e confirma no \"Enviou?\".", incluido: false },
];

const DUVIDAS = [
  { q: "Existe teste grátis?", a: "Não há teste grátis automático. Fazemos demonstração antes da assinatura, e há 7 dias de tolerância em atraso." },
  { q: "A funcionária vê percentual e comissão?", a: "Não. Ela cadastra clientes e registra cobranças, mas VGV e remuneração ficam ocultos por regra no banco." },
  { q: "Posso mudar de plano depois?", a: "Sim, a qualquer momento. A troca vale na hora e o novo valor entra na próxima fatura do Asaas." },
];

const ABAS_FECHAMENTO = [
  { id: "historico", rotulo: "Histórico de hoje" },
  { id: "inclui", rotulo: "O que vem no sistema" },
  { id: "duvidas", rotulo: "Dúvidas" },
] as const;

/** Fechamento: o resumo do dia em cima e um painel com abas (histórico, escopo, dúvidas) para caber numa tela. */
export function ResumoExpediente({ e }: { e: Estado }) {
  const [aba, setAba] = useState<(typeof ABAS_FECHAMENTO)[number]["id"]>("historico");
  const encerrado = e.historico.some((h) => h.texto.startsWith("Expediente encerrado"));
  const conta = (prefixo: string) => e.historico.filter((h) => h.texto.includes(prefixo)).length;
  const numeros = [
    { rotulo: "cobranças registradas", valor: conta("Cobrança registrada") },
    { rotulo: "documentos recebidos", valor: conta("recebido ·") },
    { rotulo: "contrato assinado", valor: conta("Contrato assinado") },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-mono-tabular text-xs text-[#4a4a4a]">{e.relogio}</p>
        <h2 className="mt-1 text-2xl font-medium tracking-[-0.03em] text-[#111111] sm:text-3xl">
          {encerrado ? "Expediente encerrado." : "Fechando o expediente."}
        </h2>
      </div>
      <dl className="flex flex-wrap gap-x-6 gap-y-1">
        {numeros.map((n) => (
          <div key={n.rotulo} className="flex items-baseline gap-2">
            <dd className="font-mono-tabular text-xl font-medium text-[#111111]">{n.valor}</dd>
            <dt className="text-sm text-[#4a4a4a]">{n.rotulo}</dt>
          </div>
        ))}
      </dl>

      <div className="overflow-hidden rounded-xl border border-[#e5e5e5] bg-white">
        <div role="group" aria-label="Painel do fechamento" className="flex gap-1 overflow-x-auto border-b border-[#e5e5e5] bg-[#f8f8f7] p-1 text-xs">
          {ABAS_FECHAMENTO.map((a) => (
            <button
              key={a.id}
              type="button"
              aria-pressed={aba === a.id}
              aria-controls="painel-fechamento"
              onClick={() => setAba(a.id)}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 font-medium transition-colors duration-150",
                aba === a.id ? "bg-white text-[#111111] shadow-[inset_0_0_0_1px_#e5e5e5]" : "text-[#4a4a4a] hover:text-[#111111]",
              )}
            >
              {a.rotulo}
            </button>
          ))}
        </div>
        <div id="painel-fechamento" className="h-[19.75rem] overflow-y-auto px-4 py-2 text-xs">
          {aba === "historico" && (
            <ol className="divide-y divide-[#e5e5e5]">
              {e.historico.map((h) => (
                <li key={`${h.min}-${h.texto}`} className="flex gap-3 py-1.5">
                  <span className="font-mono-tabular shrink-0 text-[#111111]">{hora(h.min)}</span>
                  <span className="text-[#4a4a4a]">{h.texto}</span>
                </li>
              ))}
            </ol>
          )}
          {aba === "inclui" && (
            <ul className="divide-y divide-[#e5e5e5]">
              {ESCOPO.map((l) => (
                <li key={l.titulo} className="flex items-start justify-between gap-4 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-[#111111]">{l.titulo}</p>
                    <p className="text-[#4a4a4a]">{l.desc}</p>
                  </div>
                  <span className="font-mono-tabular shrink-0 rounded border border-[#e5e5e5] px-2 py-0.5 text-[11px] text-[#4a4a4a]">
                    {l.incluido ? "Incluído" : "Fora da v1"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {aba === "duvidas" && (
            <dl className="divide-y divide-[#e5e5e5]">
              {DUVIDAS.map((d) => (
                <div key={d.q} className="py-2.5">
                  <dt className="text-sm font-medium text-[#111111]">{d.q}</dt>
                  <dd className="mt-1 text-[#4a4a4a]">{d.a}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}
