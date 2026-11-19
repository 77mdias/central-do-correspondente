import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Navigate, useOutletContext } from "react-router";
import { api, ErroApi } from "@/api";
import { mensagemDeErro } from "@/componentes/formulario";
import { Aviso, Botao, Campo, Cartao } from "@/componentes/ui";
import { chaves, useEquipe } from "@/consultas";
import { esquemaConvite } from "@/regras/esquemas";
import { dataBr, ROTULO_PERFIL } from "@/regras/rotulos";
import type { EscritorioResumo } from "@/tipos-api";

const ERROS: Record<string, string> = {
  limite_funcionaria: "O plano já tem uma funcionária ou um convite pendente para ela.",
  limite_plano: "O plano Simples não inclui funcionária nem corretores.",
  sem_permissao: "Esta conta ainda não pode fazer alterações.",
  ja_membro: "Esse e-mail já faz parte da equipe.",
};
const mensagem = (e: unknown) => (e instanceof ErroApi && ERROS[e.codigo]) || mensagemDeErro(e);

export function Equipe() {
  const escritorio = useOutletContext<EscritorioResumo>();
  const base = `/api/contas/${escritorio.contaId}`;
  const equipe = useEquipe(escritorio.contaId);
  const consultas = useQueryClient();
  const [erroConvite, setErroConvite] = useState("");
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState("");
  const recarregar = () => consultas.invalidateQueries({ queryKey: chaves.equipe(escritorio.contaId) });

  const acao = useMutation({
    mutationFn: ({ caminho, method }: { caminho: string; method: string }) => api(`${base}${caminho}`, { method }),
    onSuccess: () => { setErroAcao(""); setConfirmando(null); return recarregar(); },
    onError: (e) => setErroAcao(mensagem(e)),
  });
  const convidar = useMutation({
    mutationFn: (email: string) => api(`${base}/convites`, { body: { email, perfil: "funcionaria" } }),
    onSuccess: recarregar,
    onError: (e) => setErroConvite(mensagem(e)),
  });

  if (escritorio.perfil !== "gestor") return <Navigate to={`/e/${escritorio.contaId}`} replace />;

  function enviarConvite(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const v = esquemaConvite.safeParse({ email: new FormData(form).get("email"), perfil: "funcionaria" });
    if (!v.success) return setErroConvite("E-mail inválido.");
    setErroConvite("");
    convidar.mutate(v.data.email, { onSuccess: () => form.reset() });
  }

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-1 border-b border-borda pb-5">
        <p className="font-mono-tabular text-xs uppercase tracking-wider text-texto-2">Administração do escritório</p>
        <h1 className="text-2xl font-medium tracking-[-0.03em] text-texto">Equipe e acessos</h1>
      </div>

      {erroAcao && <Aviso tom="erro">{erroAcao}</Aviso>}
      {equipe.isPending && <p role="status" className="text-texto-2">Carregando…</p>}
      {equipe.error && <Aviso tom="erro">Não foi possível carregar a equipe.</Aviso>}
      {equipe.data && (
        <>
          <div className="flex flex-col gap-2">
            <h2 className="text-base font-medium text-texto">Pessoas</h2>
            <div className="overflow-x-auto rounded-xl border border-borda bg-superficie">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-borda text-xs uppercase tracking-wide text-texto-2">
                  <tr>
                    <th className="p-3.5 font-medium">Nome</th>
                    <th className="p-3.5 font-medium">E-mail</th>
                    <th className="p-3.5 font-medium">Perfil</th>
                    <th className="p-3.5 font-medium">Situação</th>
                    <th className="p-3.5"><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody>
                  {equipe.data.membros.map((m) => (
                    <tr key={m.id} className="border-b border-borda last:border-0">
                      <td className="p-3.5 font-medium text-texto">{m.nome}</td>
                      <td className="p-3.5 text-texto-2">{m.email}</td>
                      <td className="p-3.5">
                        <span className="font-mono-tabular rounded border border-borda bg-fundo px-2 py-0.5 text-xs text-texto">
                          {ROTULO_PERFIL[m.perfil]}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className={`font-mono-tabular inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${m.status === "ativo" ? "bg-ok-fundo text-ok-texto" : "bg-superficie-sutil text-texto-2"}`}>
                          {m.status === "ativo" ? "Ativo" : "Desativado"}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        {m.perfil !== "gestor" && m.status === "ativo" && (
                          confirmando === m.id ? (
                            <Botao variante="perigo" className="min-h-9 px-3 text-xs" carregando={acao.isPending} onClick={() => acao.mutate({ caminho: `/membros/${m.id}/desativar`, method: "POST" })}>
                              Confirmar desativação
                            </Botao>
                          ) : (
                            <Botao variante="secundario" className="min-h-9 px-3 text-xs" onClick={() => setConfirmando(m.id)}>Desativar</Botao>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="text-base font-medium text-texto">Convites pendentes</h2>
            {equipe.data.convites.length === 0 ? (
              <p className="text-sm text-texto-2">Nenhum convite pendente.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-borda rounded-xl border border-borda bg-superficie">
                {equipe.data.convites.map((cv) => (
                  <li key={cv.id} className="flex flex-wrap items-center justify-between gap-3 p-3.5 text-sm">
                    <span>
                      <strong className="font-medium text-texto">{cv.email}</strong> · {ROTULO_PERFIL[cv.perfil]} · vale até{" "}
                      <span className="font-mono-tabular text-texto-2">{dataBr(cv.expiraEm)}</span>
                    </span>
                    <span className="flex gap-2">
                      <Botao variante="secundario" className="min-h-9 px-3 text-xs" onClick={() => acao.mutate({ caminho: `/convites/${cv.id}/reenviar`, method: "POST" })}>Reenviar</Botao>
                      <Botao variante="fantasma" className="min-h-9 px-3 text-xs" onClick={() => acao.mutate({ caminho: `/convites/${cv.id}`, method: "DELETE" })}>Cancelar</Botao>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {escritorio.plano === "com_corretores" ? (
        <Cartao className="max-w-md p-5">
          <form onSubmit={enviarConvite} noValidate className="flex flex-col gap-3">
            <h2 className="text-base font-medium text-texto">Convidar funcionária</h2>
            <p className="text-xs text-texto-2">
              A funcionária registra clientes e cobranças, sem acesso a percentuais ou valores de comissão.
            </p>
            {erroConvite && <Aviso tom="erro">{erroConvite}</Aviso>}
            {convidar.isSuccess && !erroConvite && <Aviso tom="ok">Convite enviado.</Aviso>}
            <Campo id="email-convite" name="email" type="email" rotulo="E-mail da funcionária" autoComplete="off" />
            <Botao type="submit" carregando={convidar.isPending}>Enviar convite</Botao>
          </form>
        </Cartao>
      ) : (
        <Aviso>O plano Simples não inclui funcionária nem corretores.</Aviso>
      )}
    </section>
  );
}
