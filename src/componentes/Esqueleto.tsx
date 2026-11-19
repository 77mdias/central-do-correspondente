import { useLayoutEffect } from "react";

/**
 * Espera de tela inteira: não desenha nada. Com a raiz vazia, o CSS do index.html mostra a casca
 * estática (#pre) já no formato da tela que vai abrir, a mesma que aparece antes do JS carregar.
 */
export function Carregando({ casca }: { casca: "app" | "simples" | "landing" }) {
  useLayoutEffect(() => {
    document.documentElement.dataset.casca = casca;
  }, [casca]);
  return null;
}

/** Campos de um formulário que ainda depende de dados, dentro de uma TelaSimples. */
export function OssosFormulario({ campos = 3 }: { campos?: number }) {
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">Carregando…</span>
      {Array.from({ length: campos }, (_, i) => (
        <div key={i} aria-hidden="true" className="flex flex-col gap-2">
          <i className="osso h-3 w-24" />
          <i className="block h-11 rounded-lg border border-borda" />
        </div>
      ))}
      <i aria-hidden="true" className="osso h-11 rounded-lg" />
    </div>
  );
}

/** Linhas de uma lista em cartão (ex.: pessoas da equipe) enquanto a consulta responde. */
export function OssosLista({ linhas = 3 }: { linhas?: number }) {
  return (
    <div role="status" className="flex flex-col gap-2">
      <span className="sr-only">Carregando…</span>
      <i aria-hidden="true" className="osso h-4 w-24" />
      <div aria-hidden="true" className="divide-y divide-borda rounded-xl border border-borda bg-superficie">
        {Array.from({ length: linhas }, (_, i) => (
          <div key={i} className="flex items-center gap-6 p-3.5">
            <i className="osso h-3.5 w-32" />
            <i className="osso hidden h-3.5 w-48 sm:block" />
            <i className="osso ml-auto h-3.5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
