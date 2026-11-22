import { type ReactNode, useEffect, useRef } from "react";
import { Botao } from "./ui";

/**
 * Painel lateral da ficha (como o do protótipo): à direita no computador, tela cheia no celular.
 * Aberto pelo endereço (?cliente=…), para o voltar do celular fechar o painel.
 */
export function PainelLateral({ aberto, aoFechar, titulo, children }: { aberto: boolean; aoFechar: () => void; titulo: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);

  return (
    <dialog
      ref={ref}
      aria-label={titulo}
      onClose={aoFechar}
      onClick={(e) => e.target === ref.current && aoFechar()}
      className="m-0 ml-auto h-dvh max-h-none w-full max-w-none border-l border-borda bg-fundo p-0 text-texto backdrop:bg-black/40 sm:w-[40rem]"
    >
      {aberto && (
        <div className="flex min-h-full flex-col">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-borda bg-superficie px-5 py-3">
            <h2 className="truncate text-base font-medium">{titulo}</h2>
            <Botao variante="secundario" className="min-h-9 px-3 text-xs" onClick={aoFechar}>
              Fechar
            </Botao>
          </div>
          <div className="flex flex-col gap-5 p-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}
