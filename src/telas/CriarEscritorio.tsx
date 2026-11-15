import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
import { api, ErroApi } from "@/api";
import { errosPorCampo, mensagemDeErro } from "@/componentes/formulario";
import { Aviso, Botao, Campo, TelaSimples } from "@/componentes/ui";
import { chaves, useEu } from "@/consultas";
import { formatarReais } from "@/regras/dinheiro";
import { esquemaCadastro, esquemaEscritorio } from "@/regras/esquemas";
import { type Plano, PLANOS } from "@/regras/planos";

const ROTULOS: Record<string, string> = { documento: "Confira o CPF ou CNPJ", senha: "Confira a senha", email: "Confira o e-mail" };

export function CriarEscritorio() {
  const eu = useEu();
  const logado = !!eu.data;
  const navegar = useNavigate();
  const consultas = useQueryClient();
  const [plano, setPlano] = useState<Plano>("simples");
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

  if (eu.isPending) return <TelaSimples titulo="Criar escritório"><p role="status">Carregando…</p></TelaSimples>;

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
          <legend className="mb-1 text-sm font-medium">Plano</legend>
          {(Object.keys(PLANOS) as Plano[]).map((p) => (
            <label key={p} className="flex items-start gap-3 rounded-md border border-borda bg-superficie p-3 has-checked:border-marca">
              <input type="radio" name="plano" value={p} checked={plano === p} onChange={() => setPlano(p)} className="mt-1 accent-marca" />
              <span>
                <span className="font-medium">{PLANOS[p].nome} — {formatarReais(PLANOS[p].precoCentavos)}/mês</span>
                <span className="block text-sm text-texto-2">
                  {p === "simples" ? "Só você. Corretores entram como cadastro, sem acesso." : "Você, uma funcionária e corretores parceiros com acesso ao portal."}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="flex flex-col gap-1">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="aceitouTermos" className="mt-0.5 size-4 accent-marca" aria-describedby={erros.aceitouTermos ? "termos-erro" : undefined} />
            <span>Li e aceito os termos de uso e a política de privacidade (versão provisória).</span>
          </label>
          {erros.aceitouTermos && <p id="termos-erro" className="text-sm text-perigo">{erros.aceitouTermos}</p>}
        </div>
        <Botao type="submit" carregando={enviando}>Criar escritório</Botao>
      </form>
      {!logado && (
        <p className="text-sm text-texto-2">Já tem conta? <Link to="/entrar" className="text-marca underline">Entrar</Link></p>
      )}
    </TelaSimples>
  );
}
