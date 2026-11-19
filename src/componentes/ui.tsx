import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

// Componentes base da fase 1, no estilo shadcn (Tailwind + tokens), sem dependências.

type Variante = "primario" | "secundario" | "perigo" | "fantasma";
const VARIANTES: Record<Variante, string> = {
  primario: "bg-marca text-marca-texto hover:bg-marca-forte",
  secundario: "border border-borda bg-superficie hover:bg-fundo",
  perigo: "border border-perigo text-perigo hover:bg-fundo",
  fantasma: "hover:bg-fundo",
};

export function Botao({
  variante = "primario", carregando = false, className, children, disabled, ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; carregando?: boolean }) {
  return (
    <button
      {...p}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      className={cn("inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors disabled:opacity-60", VARIANTES[variante], className)}
    >
      {children}
    </button>
  );
}

export function Campo({
  id, rotulo, erro, dica, className, ...p
}: InputHTMLAttributes<HTMLInputElement> & { id: string; rotulo: string; erro?: string; dica?: string }) {
  const descr = [erro && `${id}-erro`, dica && `${id}-dica`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-sm font-medium">{rotulo}</label>
      <input
        id={id}
        {...p}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descr}
        className="min-h-10 rounded-md border border-borda bg-superficie px-3 text-base aria-invalid:border-perigo"
      />
      {dica && <p id={`${id}-dica`} className="text-sm text-texto-2">{dica}</p>}
      {erro && <p id={`${id}-erro`} className="text-sm text-perigo">{erro}</p>}
    </div>
  );
}

export function Cartao({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-md border border-borda bg-superficie p-6", className)}>{children}</div>;
}

const TONS = { info: "border-borda bg-superficie", atencao: "border-transparent bg-aviso-fundo text-aviso-texto", ok: "border-transparent bg-ok-fundo text-ok-texto", erro: "border-perigo text-perigo" };

export function Aviso({ tom = "info", children, className }: { tom?: keyof typeof TONS; children: ReactNode; className?: string }) {
  return (
    <div role={tom === "erro" ? "alert" : "status"} className={cn("rounded-md border px-4 py-3 text-sm", TONS[tom], className)}>
      {children}
    </div>
  );
}

/** Tela de formulário centralizada (cadastro, login, convite). */
export function TelaSimples({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <p className="text-sm font-semibold text-marca">Central do Correspondente</p>
      <h1 className="text-2xl font-semibold">{titulo}</h1>
      {children}
    </main>
  );
}
