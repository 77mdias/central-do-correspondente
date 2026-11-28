import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { api } from "@/api";
import { authCliente } from "@/auth-cliente";
import { Aviso, Botao, TelaSimples } from "@/componentes/ui";
import { chaves, sessaoProvavel } from "@/consultas";

/**
 * RF-67: quem aceitou uma versão anterior dos termos aceita a atual antes de continuar.
 * O texto do que mudou acompanha a versão (troca junto com TERMOS_VERSAO).
 */
export function TermosAtualizados() {
  const qc = useQueryClient();
  const navegar = useNavigate();
  const [marcou, setMarcou] = useState(false);
  const aceitar = useMutation({
    mutationFn: () => api("/api/termos/aceitar", { body: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.eu }),
  });
  const sair = async () => {
    await authCliente.signOut();
    sessaoProvavel.marcar(false);
    qc.clear();
    navegar("/entrar");
  };

  return (
    <TelaSimples titulo="Termos atualizados">
      <p className="text-sm text-texto-2">
        Os Termos de Uso e a Política de Privacidade da Central do Correspondente mudaram. Para continuar usando o app, leia a versão atual e
        confirme o aceite.
      </p>
      <ul className="flex flex-col gap-1 text-sm">
        <li>
          <a href="/termos" target="_blank" rel="noreferrer" className="font-medium text-acento hover:underline">
            Termos de Uso
          </a>
        </li>
        <li>
          <a href="/privacidade" target="_blank" rel="noreferrer" className="font-medium text-acento hover:underline">
            Política de Privacidade
          </a>
        </li>
      </ul>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-0.5 size-4 accent-marca" checked={marcou} onChange={(e) => setMarcou(e.target.checked)} />
        <span>Li e aceito os Termos de Uso e a Política de Privacidade</span>
      </label>
      {aceitar.isError && <Aviso tom="erro">Não foi possível registrar o aceite. Tente de novo.</Aviso>}
      <div className="flex flex-wrap items-center gap-3">
        <Botao disabled={!marcou} carregando={aceitar.isPending} onClick={() => aceitar.mutate()}>
          Continuar
        </Botao>
        <Botao variante="fantasma" onClick={() => void sair()}>
          Sair
        </Botao>
      </div>
    </TelaSimples>
  );
}
