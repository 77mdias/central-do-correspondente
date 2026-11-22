// Campos da ficha com salvamento automático: o valor local acompanha o do servidor enquanto o campo
// não está em uso, para uma leitura nova (a cada 30 s) não apagar o que a pessoa está digitando.
import { type ReactNode, useEffect, useRef, useState } from "react";
import { formatarReais, lerReais } from "@/regras/dinheiro";
import { cn } from "@/lib/cn";

const CLASSE_ENTRADA =
  "min-h-11 w-full rounded-[6px] border border-borda-campo bg-superficie px-3 text-base text-texto placeholder:text-texto-2/70 disabled:opacity-70 aria-invalid:border-perigo";

function useLocal<T>(servidor: T) {
  const [valor, setValor] = useState(servidor);
  const emUso = useRef(false);
  useEffect(() => {
    if (!emUso.current) setValor(servidor);
  }, [servidor]);
  const focar = () => {
    emUso.current = true;
  };
  const soltar = () => {
    emUso.current = false;
  };
  return { valor, setValor, focar, soltar };
}

type Base = { id: string; rotulo: string; erro?: string; desativado?: boolean; className?: string; dica?: ReactNode };

function Rotulo({ id, rotulo, erro, dica, className, children }: Base & { children: ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-texto">
        {rotulo}
      </label>
      {children}
      {dica && <p className="text-xs text-texto-2">{dica}</p>}
      {erro && (
        <p id={`${id}-erro`} className="text-sm text-perigo">
          {erro}
        </p>
      )}
    </div>
  );
}

export function CampoTexto({
  valor,
  aoMudar,
  tipo = "text",
  modo,
  multilinha,
  ...b
}: Base & { valor: string | null; aoMudar: (v: string) => void; tipo?: string; modo?: "numeric" | "tel" | "email"; multilinha?: boolean }) {
  const l = useLocal(valor ?? "");
  const comum = {
    id: b.id,
    value: l.valor,
    disabled: b.desativado,
    "aria-invalid": b.erro ? true : undefined,
    "aria-describedby": b.erro ? `${b.id}-erro` : undefined,
    onFocus: l.focar,
    onBlur: l.soltar,
  };
  return (
    <Rotulo {...b}>
      {multilinha ? (
        <textarea
          {...comum}
          rows={4}
          className={cn(CLASSE_ENTRADA, "py-2")}
          onChange={(e) => {
            l.setValor(e.target.value);
            aoMudar(e.target.value);
          }}
        />
      ) : (
        <input
          {...comum}
          type={tipo}
          inputMode={modo}
          className={CLASSE_ENTRADA}
          onChange={(e) => {
            l.setValor(e.target.value);
            aoMudar(e.target.value);
          }}
        />
      )}
    </Rotulo>
  );
}

/** Dinheiro em centavos; a pessoa digita em reais ("350.000" ou "350.000,00"). */
export function CampoDinheiro({ valor, aoMudar, ...b }: Base & { valor: number | null; aoMudar: (centavos: number | null) => void }) {
  const formatado = valor == null ? "" : formatarReais(valor);
  const l = useLocal(formatado);
  return (
    <Rotulo {...b}>
      <input
        id={b.id}
        inputMode="decimal"
        placeholder="R$ 0,00"
        value={l.valor}
        disabled={b.desativado}
        aria-invalid={b.erro ? true : undefined}
        className={cn(CLASSE_ENTRADA, "font-mono-tabular")}
        onFocus={l.focar}
        onBlur={() => {
          l.soltar();
          const c = lerReais(l.valor);
          l.setValor(c == null ? "" : formatarReais(c));
        }}
        onChange={(e) => {
          l.setValor(e.target.value);
          aoMudar(lerReais(e.target.value));
        }}
      />
    </Rotulo>
  );
}

export function CampoEscolha<T extends string>({
  valor,
  aoMudar,
  opcoes,
  vazio,
  ...b
}: Base & { valor: T | null; aoMudar: (v: T | null) => void; opcoes: readonly { valor: T; rotulo: string }[]; vazio?: string }) {
  return (
    <Rotulo {...b}>
      <select
        id={b.id}
        value={valor ?? ""}
        disabled={b.desativado}
        className={CLASSE_ENTRADA}
        onChange={(e) => aoMudar((e.target.value || null) as T | null)}
      >
        {vazio !== undefined && <option value="">{vazio}</option>}
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </Rotulo>
  );
}

export const classeEntrada = CLASSE_ENTRADA;
