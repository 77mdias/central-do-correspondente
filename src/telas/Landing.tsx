import "@/lib/scrollcraft/scrollcraft.js";
import motorCss from "@/lib/scrollcraft/scrollcraft.css?inline";
import "./landing/expediente.css";
import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, memo, type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { api, ErroApi } from "@/api";
import { errosPorCampo, mensagemDeErro } from "@/componentes/formulario";
import { Aviso, Botao, Campo, Marca } from "@/componentes/ui";
import { chaves } from "@/consultas";
import { cn } from "@/lib/cn";
import { formatarReais } from "@/regras/dinheiro";
import { esquemaCadastro } from "@/regras/esquemas";
import { type Plano, PLANOS } from "@/regras/planos";
import { ABRE, estadoAs, FECHA } from "./landing/expediente";
import { EVENTO_MINUTO, Fatos, OFERTA, PASSOS_COBRANCA, ReguaDoExpediente, ResumoExpediente, TrilhoCobrancas, VistaFicha, VistaGestor, VistaInicio } from "./landing/Vistas";

// Landing como "superfície viva" (scroll-craft): a página é o produto num dia de trabalho,
// e a rolagem é o relógio do expediente. Brief e roteiro em scrollcraft/builds/central-expediente/BRIEF.md.

// Tokens do motor na marca. O <style> fica no começo do <head>: a limpeza do harness de verificação
// apaga o último <style> que contém "data-sc-cue", e ele não pode ser o nosso.
const TOKENS = `:root{--sc-canvas:#ffffff;--sc-surface:#f8f8f7;--sc-ink:#111111;--sc-ink-soft:#4a4a4a;--sc-accent:#1a4be0;--sc-accent-ink:#ffffff;--sc-font-display:"Host Grotesk",system-ui,sans-serif;--sc-font-text:"Host Grotesk",system-ui,sans-serif;--sc-font-mono:"JetBrains Mono",ui-monospace,monospace}`;

const VISTAS = [
  { id: "inicio", rotulo: "Início" },
  { id: "cobrancas", rotulo: "Cobranças" },
  { id: "ficha", rotulo: "Ficha" },
  { id: "gestor", rotulo: "Gestor" },
  { id: "assinar", rotulo: "Assinar plano" },
] as const;
type IdVista = (typeof VISTAS)[number]["id"];

const h = (hh: number, mm = 0) => hh * 60 + mm;

/** A ficha fica travada quando os dois painéis cabem lado a lado na altura da tela. */
const FICHA_FIXADA = "(min-width: 1024px) and (min-height: 760px)";

/** Dentro da trava da ficha: [fração do pino, horário]. Cada upload e a troca de etapa têm a sua faixa de rolagem. */
const RITMO_FICHA: [number, number][] = [
  [0, h(10, 30)],
  [0.08, h(10, 35)],
  [0.33, h(10, 50)], // Holerite sobe
  [0.42, h(11, 20)],
  [0.67, h(11, 35)], // Matrícula sobe, checklist completo
  [0.82, h(14, 30)], // a ficha avança para Conformidade
  [1, h(15, 30)],
];

/**
 * Âncoras [posição da rolagem, horário]: entre duas, o relógio anda em linha reta.
 * Atos fixados usam o começo e o fim do pino. Sem a trava (telas baixas ou estreitas), os uploads
 * terminam com o portal no centro da tela e a etapa muda quando a ficha passa por ele.
 */
function ancoras(vh: number): [number, number][] {
  const em = (id: string, ponto: (r: DOMRect) => number) => {
    const r = document.getElementById(id)?.getBoundingClientRect();
    return r ? ponto(r) + scrollY : null;
  };
  const topo = (r: DOMRect) => r.top;
  const fimDoPino = (r: DOMRect) => r.bottom - vh;
  const ficha = document.getElementById("ficha");
  const fichaFixada = ficha?.dataset.scAct === "pin";
  const inicioFicha = em("ficha", topo) ?? 0;
  const viagemFicha = (ficha?.getBoundingClientRect().height ?? vh) - vh;
  const brutas: [number | null, number][] = [
    [em("inicio", topo), ABRE],
    [em("inicio", fimDoPino), h(8, 30)],
    [em("cobrancas", topo), h(8, 30)],
    [em("cobrancas", fimDoPino), h(10, 30)],
    ...(fichaFixada
      ? RITMO_FICHA.map(([f, min]): [number, number] => [inicioFicha + f * viagemFicha, min])
      : ([
          [em("ficha", (r) => r.top - vh * 0.3), h(10, 30)],
          [em("painel-portal", (r) => r.top + r.height / 2 - vh / 2), h(11, 45)],
          [em("painel-ficha", (r) => r.bottom - vh / 2), h(14, 45)],
          [em("ficha", (r) => r.bottom - vh * 0.6), h(15, 30)],
        ] as [number | null, number][])),
    [em("gestor", topo), h(15, 30)],
    [em("gestor", fimDoPino), h(17)],
    [em("assinar", (r) => r.top - vh * 0.6), h(17)],
    [em("assinar", (r) => r.top - vh * 0.05), FECHA],
  ];
  // Nenhuma âncora depois do fim da página: senão o fechamento (curto) nunca chegaria às 18:00.
  const fimDaPagina = document.documentElement.scrollHeight - vh;
  const pontos: [number, number][] = [];
  for (const [y, min] of brutas) {
    if (y === null) continue;
    pontos.push([Math.min(fimDaPagina, Math.max(y, pontos.at(-1)?.[0] ?? y)), min]); // nunca volta: o relógio só anda para frente
  }
  return pontos;
}

/** Lê a rolagem e devolve o horário do expediente (exato, sem arredondar) e a vista em foco. */
function medir(): { minuto: number; vista: IdVista } {
  const vh = innerHeight;
  const pontos = ancoras(vh);
  let minuto = pontos[0]?.[1] ?? ABRE;
  for (let i = 1; i < pontos.length; i++) {
    const [y0, m0] = pontos[i - 1]!;
    const [y1, m1] = pontos[i]!;
    if (scrollY <= y0) break;
    minuto = scrollY >= y1 ? m1 : m0 + ((scrollY - y0) / Math.max(1, y1 - y0)) * (m1 - m0);
  }
  let vista: IdVista = "inicio";
  for (const v of VISTAS) {
    const r = document.getElementById(v.id)?.getBoundingClientRect();
    if (r && r.top <= vh * 0.5) vista = v.id;
  }
  return { minuto, vista };
}

/** Palco do motor quando o ato é fixado; conteúdo direto quando a seção só rola. */
function Palco({ fixado, children }: { fixado: boolean; children: ReactNode }) {
  return fixado ? (
    <div data-sc-stage className="sc-stage ex-palco">
      {children}
    </div>
  ) : (
    children
  );
}

export function Landing() {
  const raiz = useRef<HTMLDivElement>(null);
  const [{ minuto, vista }, setPosicao] = useState<{ minuto: number; vista: IdVista }>({ minuto: ABRE, vista: "inicio" });
  // Decidido na montagem: o motor lê data-sc-act uma vez. Quem redimensiona depois mantém o modo inicial.
  const [fichaFixada] = useState(() => matchMedia(FICHA_FIXADA).matches);
  const e = useMemo(() => estadoAs(minuto), [minuto]);

  // O CSS do motor mexe em html/body: entra no <head> antes da primeira pintura e sai junto com a landing.
  // Fica na camada "scrollcraft", a primeira do documento, para as utilidades do Tailwind vencerem as regras
  // globais dele (ex.: `button { color: inherit }`); os tokens ficam fora da camada para vencer o :root dele.
  useLayoutEffect(() => {
    const estilo = document.createElement("style");
    estilo.textContent = `@layer scrollcraft{${motorCss}}${TOKENS}`;
    document.head.insertBefore(estilo, document.head.firstChild);
    return () => {
      estilo.parentNode?.removeChild(estilo);
    };
  }, []);

  useEffect(() => {
    const motor = window.ScrollCraft.mount(raiz.current);
    let quadro = 0;
    const atualizar = () => {
      quadro = 0;
      const { minuto: exato, vista: v } = medir();
      dispatchEvent(new CustomEvent(EVENTO_MINUTO, { detail: exato })); // a régua anda com o valor contínuo
      const m = Math.round(exato);
      setPosicao((atual) => (atual.minuto === m && atual.vista === v ? atual : { minuto: m, vista: v }));
    };
    const agendar = () => {
      if (!quadro) quadro = requestAnimationFrame(atualizar);
    };
    agendar();
    addEventListener("scroll", agendar, { passive: true });
    addEventListener("resize", agendar);
    return () => {
      removeEventListener("scroll", agendar);
      removeEventListener("resize", agendar);
      cancelAnimationFrame(quadro);
      motor.destroy();
    };
  }, []);

  const abas = VISTAS.map((v) => (
    <a
      key={v.id}
      href={`#${v.id}`}
      aria-current={vista === v.id ? "location" : undefined}
      className={cn(
        "shrink-0 rounded-md px-2 py-1.5 text-[13px] transition-colors duration-150 md:px-3 md:text-sm",
        v.id === "assinar"
          ? "bg-[#1a4be0] font-medium text-white hover:bg-[#143bb5]"
          : vista === v.id
            ? "bg-[#f4f4f4] font-medium text-[#111111]"
            : "text-[#4a4a4a] hover:text-[#111111]",
      )}
    >
      {v.rotulo}
    </a>
  ));

  return (
    <div ref={raiz} className="tema-claro ex min-h-dvh bg-white text-[#111111]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#e5e5e5] bg-white">
        <div className="mx-auto flex h-14 max-w-[90rem] items-center gap-4 px-4 sm:px-6">
          <a href="#inicio" className="inline-flex shrink-0 items-center gap-2.5 text-sm font-medium tracking-tight text-[#111111]">
            <Marca />
            <span className="hidden lg:inline">Central do Correspondente</span>
          </a>
          <nav aria-label="Vistas da demonstração" className="hidden items-center gap-1 md:flex">
            {abas}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <time className="font-mono-tabular text-sm font-medium text-[#111111]" aria-label={`Horário da demonstração: ${e.relogio}`}>
              {e.relogio}
            </time>
            <span className="font-mono-tabular hidden rounded-full bg-[#f4f4f4] px-2.5 py-0.5 text-xs text-[#4a4a4a] sm:inline">
              {e.pendentes > 0 ? `${e.pendentes} cobranças pendentes` : "0 pendências"}
            </span>
            <Link to="/entrar" className="px-1 py-2 text-sm font-medium text-[#4a4a4a] hover:text-[#111111]">
              Entrar
            </Link>
          </div>
        </div>
        <nav aria-label="Vistas da demonstração" className="flex gap-1 overflow-x-auto border-t border-[#e5e5e5] px-3 py-2 md:hidden">
          {abas}
        </nav>
      </header>

      {/* Escuro só depois que a visão do gestor cobriu a tela (reveal entre 15:37 e 15:53). */}
      <ReguaDoExpediente escuro={vista === "gestor" && minuto >= h(15, 45)} />

      <main>
        <section id="inicio" data-sc-act="pin" data-sc-span="1.6" aria-label="Início">
          <div data-sc-stage className="sc-stage ex-palco">
            <div className="ex-conteudo">
              <VistaInicio e={e} />
            </div>
          </div>
        </section>

        {/* Abaixo de 1024 px o hero não tem altura para a faixa do que vem no sistema: ela entra aqui. */}
        <section id="o-que-vem" className="ex-conteudo py-10 lg:hidden" aria-label="O que vem no sistema">
          <Fatos itens={OFERTA} className="grid-cols-2 md:grid-cols-3" />
        </section>

        <section id="cobrancas" data-sc-act="pan" data-sc-span="3" aria-label="Cobranças de hoje">
          <div data-sc-stage className="sc-stage ex-palco ex-palco--coluna">
            <div className="ex-conteudo flex items-center gap-3 text-xs text-[#4a4a4a]">
              <span className="font-medium text-[#111111]">Fila de hoje</span>
              <span className="flex gap-1" aria-hidden="true">
                {e.cobrancas.map((c) => (
                  <i key={c.ficha} className={cn("block h-1 w-6 rounded-full transition-colors duration-300", c.status === "registrada" ? "bg-[#1a4be0]" : "bg-[#e5e5e5]")} />
                ))}
              </span>
              <span className="font-mono-tabular">
                {e.cobrancas.length - e.pendentes} de {e.cobrancas.length} registradas
              </span>
            </div>
            <div className="ex-trilho" data-sc-pan="0.04">
              <TrilhoCobrancas e={e} />
            </div>
            {/* Some só onde a tela é baixa demais para o palco fixado (celular pequeno). */}
            <div className="ex-conteudo hidden lg:block [@media(min-height:760px)]:block">
              <Fatos itens={PASSOS_COBRANCA} className="grid-cols-1 sm:grid-cols-3 max-sm:[&_dd]:hidden" />
            </div>
          </div>
        </section>

        <section
          id="ficha"
          aria-labelledby="titulo-ficha"
          {...(fichaFixada ? { "data-sc-act": "pin", "data-sc-span": "2.6" } : { className: "ex-secao" })}
        >
          <Palco fixado={fichaFixada}>
            <div className="ex-conteudo flex flex-col gap-6">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 id="titulo-ficha" className="text-2xl font-medium tracking-[-0.03em] text-[#111111]">
                  Ficha e portal do corretor
                </h2>
                <p className="max-w-[46ch] text-sm text-[#4a4a4a]">
                  O corretor entra por convite, vê só os próprios clientes e anexa os PDFs direto na ficha. Anexar marca o documento como recebido.
                </p>
              </div>
              <VistaFicha e={e} />
            </div>
          </Palco>
        </section>

        <section id="gestor" data-sc-act="pin" data-sc-span="3.4" aria-label="Visão do gestor">
          <div data-sc-stage className="sc-stage ex-palco">
            {/* Antes do pico: a agenda da tarde, mais calma que a virada que vem. */}
            <div className="ex-conteudo grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-12">
              <div>
                <p className="font-mono-tabular text-sm text-[#4a4a4a]">Próximo · 16:00</p>
                <p className="mt-1 max-w-[30ch] text-2xl font-medium tracking-[-0.03em] text-[#111111] sm:text-3xl">Assinatura do contrato · Bruno Costa</p>
                <ul className="mt-4 flex flex-col gap-2 text-sm text-[#4a4a4a]">
                  {["A data da assinatura fica gravada no contrato.", "A taxa vigente, 1,400%, fica congelada nele.", "O valor do imóvel entra no VGV do mês do gestor."].map((t) => (
                    <li key={t} className="flex gap-2">
                      <span className="text-[#1a4be0]" aria-hidden="true">·</span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <ol className="divide-y divide-[#e5e5e5] rounded-xl border border-[#e5e5e5] bg-white text-sm" aria-label="Agenda da tarde">
                {[
                  { h: "11:35", t: "Checklist do Rafael Camargo completo: 12 de 12", feito: true },
                  { h: "14:30", t: "Rafael Camargo avançou para Conformidade", feito: true },
                  { h: "16:00", t: "Assinatura do contrato · Bruno Costa", feito: false, agora: true },
                  { h: "18:00", t: "Fechamento do expediente", feito: false },
                ].map((a) => (
                  <li key={a.h} className={cn("flex items-center gap-4 px-4 py-3", a.agora && "bg-[#eff6ff]")}>
                    <span className="font-mono-tabular w-12 shrink-0 text-[#111111]">{a.h}</span>
                    <span className={cn("flex-1", a.feito ? "text-[#4a4a4a]" : "text-[#111111]", a.agora && "font-medium")}>{a.t}</span>
                    <span className={cn("font-mono-tabular shrink-0 text-xs", a.feito ? "text-[#15803d]" : a.agora ? "text-[#1a4be0]" : "text-[#4a4a4a]")}>
                      {a.feito ? "feito" : a.agora ? "a seguir" : "hoje"}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="ex-escuro" data-sc-reveal="up" data-sc-reveal-at="0.08 0.26">
              <div className="ex-conteudo">
                <VistaGestor e={e} />
              </div>
            </div>
          </div>
        </section>

        {/* Uma tela exata abaixo da barra do app: preenche telas grandes e não passa de uma tela no desktop
            (o conteúdo cabe a partir de 1280×720). No celular, empilhado, cresce e rola. */}
        <section
          id="assinar"
          className="flex min-h-[calc(100svh-var(--ex-barra))] scroll-mt-14 items-center border-t border-[#e5e5e5] bg-[#f8f8f7] py-8 lg:py-5"
          aria-label="Assinar plano"
        >
          <div className="ex-conteudo grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start lg:gap-10">
            <div className="flex flex-col gap-5">
              <ResumoExpediente e={e} />
              <p className="text-[11px] text-[#4a4a4a]">© 2026 Central do Correspondente · Marcas e ícones pertencem aos respectivos titulares.</p>
            </div>
            <FormularioCadastro />
          </div>
        </section>
      </main>
    </div>
  );
}

const ROTULOS_ERRO: Record<string, string> = {
  documento: "Confira o CPF ou CNPJ",
  senha: "Confira a senha",
  email: "Confira o e-mail",
};

const RECURSOS: Record<Plano, { inclui: string[] }> = {
  simples: {
    inclui: ["1 acesso, o do gestor", "Corretores cadastrados como origem", "Cobrança no WhatsApp com confirmação", "Checklist de 12 documentos com anexos", "Painel de VGV e taxa congelada"],
  },
  com_corretores: {
    inclui: ["Gestor e 1 funcionária, que não vê receita", "Corretores ilimitados com login próprio", "Corretor vê só os próprios clientes", "Envio de documentos pelo portal", "Tudo do plano Simples"],
  },
};

/** O fim da página é um campo: o cadastro real (POST /api/cadastro). Memo para o relógio não re-renderizar o formulário. */
const FormularioCadastro = memo(function FormularioCadastro() {
  const navegar = useNavigate();
  const consultas = useQueryClient();
  const [plano, setPlano] = useState<Plano>("com_corretores");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviarCadastro(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    const dados = {
      ...Object.fromEntries(f),
      plano,
      aceitouTermos: f.get("aceitouTermos") === "on",
    };
    const v = esquemaCadastro.safeParse(dados);
    setErroGeral("");
    if (!v.success) return setErros(errosPorCampo(v.error));
    setErros({});
    setEnviando(true);
    try {
      const r = await api<{ ok?: true; contaId?: string }>("/api/cadastro", { body: dados });
      if (r.contaId) {
        await consultas.invalidateQueries({ queryKey: chaves.eu });
        navegar(`/e/${r.contaId}`);
      } else {
        navegar(`/confirme-o-email?email=${encodeURIComponent(String(f.get("email") ?? ""))}`);
      }
    } catch (e) {
      if (e instanceof ErroApi && e.campos.length) {
        setErros(Object.fromEntries(e.campos.map((c) => [c, ROTULOS_ERRO[c] ?? "Confira este campo"])));
      }
      setErroGeral(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white p-5 sm:p-6" data-sc-in>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-medium tracking-[-0.03em] text-[#111111] sm:text-2xl">Criar o seu escritório</h2>
        <Link to={`/criar-escritorio?plano=${plano}`} className="text-xs font-medium text-[#1a4be0] hover:underline">
          Abrir tela completa
        </Link>
      </div>
      <p className="mt-1 text-sm text-[#4a4a4a]">Amanhã às 08:00 o aviso é do seu escritório. Sem fidelidade, sem cobrança por corretor.</p>

      <form onSubmit={enviarCadastro} noValidate className="mt-4 flex flex-col gap-3">
        {erroGeral && <Aviso tom="erro">{erroGeral}</Aviso>}
        <fieldset className="grid gap-2.5 sm:grid-cols-2">
          <legend className="mb-1.5 text-sm font-medium text-[#111111]">Plano</legend>
          {(Object.keys(PLANOS) as Plano[]).map((p) => (
            <label
              key={p}
              className={cn(
                "flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 transition-colors duration-150",
                plano === p ? "border-[#1a4be0] bg-[#eff6ff]" : "border-[#e5e5e5] hover:border-[#171717]",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-medium text-[#111111]">
                  <input type="radio" name="plano" value={p} checked={plano === p} onChange={() => setPlano(p)} className="size-4 accent-[#1a4be0]" />
                  {PLANOS[p].nome}
                </span>
                <span className="font-mono-tabular text-sm text-[#111111]">{formatarReais(PLANOS[p].precoCentavos)}/mês</span>
              </span>
              <ul className="mt-1 flex flex-col gap-0.5 pl-6 text-[11px] leading-snug text-[#111111]">
                {RECURSOS[p].inclui.map((item) => (
                  <li key={item} className="flex gap-1.5">
                    <span className="text-[#15803d]" aria-hidden="true">
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </label>
          ))}
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo id="f-nome" name="nome" rotulo="Seu nome" autoComplete="name" erro={erros.nome} />
          <Campo id="f-escritorio" name="nomeEscritorio" rotulo="Nome do escritório" autoComplete="organization" erro={erros.nomeEscritorio} />
          <Campo id="f-email" name="email" type="email" rotulo="E-mail de acesso" autoComplete="email" erro={erros.email} />
          <Campo id="f-senha" name="senha" type="password" rotulo="Senha" autoComplete="new-password" dica="Mínimo 8 caracteres." erro={erros.senha} />
          <Campo id="f-doc" name="documento" rotulo="CPF ou CNPJ" inputMode="numeric" erro={erros.documento} />
          <div className="flex flex-col justify-end gap-1 sm:pb-1">
            <label className="flex items-start gap-2.5 text-sm text-[#4a4a4a]">
              <input type="checkbox" name="aceitouTermos" className="mt-0.5 size-4 shrink-0 accent-[#1a4be0]" />
              <span>
                Li e aceito os{" "}
                <Link to="/termos" className="text-[#111111] underline">
                  Termos de Uso
                </Link>{" "}
                e a{" "}
                <Link to="/privacidade" className="text-[#111111] underline">
                  Política de Privacidade
                </Link>
                .
              </span>
            </label>
            {erros.aceitouTermos && <p className="text-sm text-[#b91c1c]">{erros.aceitouTermos}</p>}
          </div>
        </div>
        <Botao type="submit" carregando={enviando} className="mt-1">
          Assinar plano
        </Botao>
      </form>
    </div>
  );
});
