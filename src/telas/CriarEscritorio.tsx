import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { api, ErroApi } from "@/api";
import { errosPorCampo, mensagemDeErro } from "@/componentes/formulario";
import { Aviso, Botao, Campo, TelaSimples } from "@/componentes/ui";
import { chaves, useEu } from "@/consultas";
import { formatarReais } from "@/regras/dinheiro";
import { esquemaCadastro, esquemaEscritorio } from "@/regras/esquemas";
import { type Plano, PLANOS } from "@/regras/planos";

const ROTULOS: Record<string, string> = { documento: "Confira o CPF ou CNPJ", senha: "Confira a senha", email: "Confira o e-mail" };

export function CriarEscritorio() {
  const [params] = useSearchParams();
  const planoInicial: Plano = params.get("plano") === "com_corretores" ? "com_corretores" : "simples";
  const eu = useEu();
  const logado = !!eu.data;
  const navegar = useNavigate();
  const consultas = useQueryClient();
  const [plano, setPlano] = useState<Plano>(planoInicial);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    const dados = { ...Object.fromEntries(f), plano, aceitouTermos: f.get("aceitouTermos") === "on" };
    const v = (logado ? esquemaEscritorio : esquemaCadastro).safeParse(dados);
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
      if (e instanceof ErroApi && e.campos.length) setErros(Object.fromEntries(e.campos.map((c) => [c, ROTULOS[c] ?? "Confira este campo"])));
      setErroGeral(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  }

  if (eu.isPending) return <TelaSimples titulo="Criar escritório"><p role="status" className="text-texto-2">Carregando…</p></TelaSimples>;

  return (
    <TelaSimples titulo="Criar escritório">
      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
        {erroGeral && <Aviso tom="erro">{erroGeral}</Aviso>}
        {!logado && (
          <>
            <Campo id="nome" name="nome" rotulo="Seu nome" autoComplete="name" erro={erros.nome} />
            <Campo id="email" name="email" type="email" rotulo="E-mail" autoComplete="email" erro={erros.email} />
            <Campo id="senha" name="senha" type="password" rotulo="Senha" autoComplete="new-password" dica="Pelo menos 8 caracteres." erro={erros.senha} />
          </>
        )}
        <Campo id="nomeEscritorio" name="nomeEscritorio" rotulo="Nome do escritório" autoComplete="organization" erro={erros.nomeEscritorio} />
        <Campo id="documento" name="documento" rotulo="CPF ou CNPJ do titular" inputMode="numeric" erro={erros.documento} />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-texto">Plano</legend>
          {(Object.keys(PLANOS) as Plano[]).map((p) => (
            <label
              key={p}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-borda bg-superficie p-3.5 transition-colors hover:border-borda-campo has-checked:border-acento has-checked:bg-acento-suave/40"
            >
              <input type="radio" name="plano" value={p} checked={plano === p} onChange={() => setPlano(p)} className="mt-1 accent-acento" />
              <span className="flex-1">
                <span className="flex flex-wrap items-center justify-between gap-2 font-medium text-texto">
                  <span>{PLANOS[p].nome} — <span className="font-mono-tabular">{formatarReais(PLANOS[p].precoCentavos)}/mês</span></span>
                  {p === "com_corretores" && (
                    <span className="font-mono-tabular rounded border border-borda bg-superficie px-1.5 py-0.5 text-[11px] font-medium text-texto">
                      Portal
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-sm text-texto-2">
                  {p === "simples" ? "Só você. Corretores entram como cadastro, sem acesso." : "Você, uma funcionária e corretores parceiros com acesso ao portal."}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="flex flex-col gap-1">
          <label className="flex items-start gap-3 text-sm text-texto-2">
            <input type="checkbox" name="aceitouTermos" className="mt-0.5 size-4 accent-acento" aria-describedby={erros.aceitouTermos ? "termos-erro" : undefined} />
            <span>
              Li e aceito os{" "}
              <Link to="/termos" className="text-texto underline underline-offset-2">termos de uso</Link>{" "}
              e a{" "}
              <Link to="/privacidade" className="text-texto underline underline-offset-2">política de privacidade</Link>{" "}
              (versão provisória).
            </span>
          </label>
          {erros.aceitouTermos && <p id="termos-erro" className="text-sm text-perigo">{erros.aceitouTermos}</p>}
        </div>
        <Botao type="submit" carregando={enviando}>Criar escritório</Botao>
      </form>
      {!logado && (
        <p className="text-sm text-texto-2">
          Já tem conta? <Link to="/entrar" className="font-medium text-acento underline underline-offset-2">Entrar</Link>
        </p>
      )}
    </TelaSimples>
  );
}
