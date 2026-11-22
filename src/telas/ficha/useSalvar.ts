import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { api, ErroApi } from "@/api";
import { atualizarNaLista, chavesEscritorio } from "@/consultas-escritorio";
import { type EstadoSalvamento, FilaSalvamento } from "@/lib/salvamento";
import type { ClienteLista } from "@/tipos-api";

/**
 * Salvamento automático da ficha (RF-15): 700 ms depois de parar de digitar, só os campos alterados.
 * Erro de validação aponta o campo; ao fechar a ficha, o que estiver pendente é enviado na hora.
 */
export function useSalvarCliente(conta: string, id: string) {
  const qc = useQueryClient();
  const [estado, setEstado] = useState<EstadoSalvamento>("ocioso");
  const [erros, setErros] = useState<Record<string, string>>({});

  const fila = useMemo(
    () =>
      new FilaSalvamento(async (campos) => {
        try {
          const c = await api<ClienteLista>(`/api/contas/${conta}/clientes/${id}`, { method: "PATCH", body: campos });
          atualizarNaLista(qc, conta, c);
          void qc.invalidateQueries({ queryKey: chavesEscritorio.ficha(conta, id) });
          void qc.invalidateQueries({ queryKey: chavesEscritorio.historico(conta) });
          setErros((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !(k in campos))));
        } catch (e) {
          if (e instanceof ErroApi && e.codigo === "validacao")
            setErros((x) => ({ ...x, ...Object.fromEntries((e.campos.length ? e.campos : Object.keys(campos)).map((k) => [k, "Valor inválido"])) }));
          throw e;
        }
      }, setEstado),
    [conta, id, qc],
  );

  useEffect(() => () => void fila.descarregar().catch(() => undefined), [fila]);

  return { estado, erros, agendar: (campo: string, valor: unknown) => fila.agendar(campo, valor), agora: () => fila.descarregar() };
}

export const TEXTO_ESTADO: Record<EstadoSalvamento, string> = {
  ocioso: "Tudo é salvo automaticamente.",
  salvando: "Salvando…",
  salvo: "Salvo.",
  erro: "Não foi possível salvar. Confira o campo marcado.",
};
