import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/cn";
import { LOGO } from "./logo";

// Componentes base no padrão Mesa de Controle Editorial (Host Grotesk + JetBrains Mono, border-first).

type Variante = "primario" | "secundario" | "perigo" | "fantasma";
const VARIANTES: Record<Variante, string> = {
  primario: "bg-marca text-marca-texto hover:bg-marca-forte active:translate-y-px",
  secundario: "border border-borda bg-superficie text-texto hover:border-borda-campo hover:bg-superficie-sutil",
  perigo: "border border-perigo text-perigo hover:bg-superficie-sutil",
  fantasma: "text-texto hover:bg-superficie-sutil",
};

/** Logo. Preto e cinza seguem a cor do texto (somem no escuro sem variante); o azul vem de --logo-azul. */
export function Marca({ className }: { className?: string }) {
  return (
    <svg viewBox={LOGO.viewBox} aria-hidden="true" className={cn("size-6 shrink-0 text-texto", className)}>
      <g transform={LOGO.transform}>
        <path fill="currentColor" d={LOGO.preto} />
        {/* 0,77 de #111 sobre branco dá o cinza #47484a da logo; sobre o escuro vira cinza-claro. */}
        <path fill="currentColor" fillOpacity={0.77} d={LOGO.cinza} />
        <path style={{ fill: "var(--logo-azul, #213fa0)" }} d={LOGO.azul} />
      </g>
    </svg>
  );
}

export function Botao({
  variante = "primario",
  carregando = false,
  className,
  children,
  disabled,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; carregando?: boolean }) {
  return (
    <button
      {...p}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors disabled:opacity-60",
        VARIANTES[variante],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Campo({
  id,
  rotulo,
  erro,
  dica,
  className,
  ...p
}: InputHTMLAttributes<HTMLInputElement> & { id: string; rotulo: string; erro?: string; dica?: string }) {
  const descr = [erro && `${id}-erro`, dica && `${id}-dica`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-texto">{rotulo}</label>
      <input
        id={id}
        {...p}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descr}
        className="min-h-11 rounded-[6px] border border-borda-campo bg-superficie px-3 text-base text-texto transition-colors placeholder:text-texto-2/70 aria-invalid:border-perigo"
      />
      {dica && <p id={`${id}-dica`} className="text-sm text-texto-2">{dica}</p>}
      {erro && <p id={`${id}-erro`} className="text-sm text-perigo">{erro}</p>}
    </div>
  );
}

export function Cartao({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-xl border border-borda bg-superficie p-6", className)}>{children}</div>;
}

const TONS = {
  info: "border-borda bg-superficie text-texto",
  atencao: "border-transparent bg-aviso-fundo text-aviso-texto",
  ok: "border-transparent bg-ok-fundo text-ok-texto",
  erro: "border-perigo text-perigo bg-superficie",
};

export function Aviso({ tom = "info", children, className }: { tom?: keyof typeof TONS; children: ReactNode; className?: string }) {
  return (
    <div role={tom === "erro" ? "alert" : "status"} className={cn("rounded-lg border px-4 py-3 text-sm", TONS[tom], className)}>
      {children}
    </div>
  );
}

/** Tela de formulário centralizada (cadastro, login, convite) alinhada à estética editorial. */
export function TelaSimples({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="flex items-center justify-between gap-3">
        <Link to="/" className="inline-flex items-center gap-2.5 text-sm font-medium tracking-tight text-texto">
          <Marca />
          <span>Central do Correspondente</span>
        </Link>
        <Link to="/" className="text-xs font-medium text-texto-2 hover:text-texto">
          Página inicial
        </Link>
      </div>
      <div className="rounded-xl border border-borda bg-superficie p-6 sm:p-7 flex flex-col gap-5">
        <h1 className="text-2xl font-medium tracking-[-0.03em] text-texto">{titulo}</h1>
        {children}
      </div>
    </main>
  );
}
