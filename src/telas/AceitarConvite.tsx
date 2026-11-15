import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { api, ErroApi } from "@/api";
import { authCliente } from "@/auth-cliente";
import { mensagemDeErro } from "@/componentes/formulario";
import { Aviso, Botao, Campo, TelaSimples } from "@/componentes/ui";
import { chaves, useEu } from "@/consultas";
import { ROTULO_PERFIL } from "@/regras/rotulos";
import type { ConvitePublico } from "@/tipos-api";

const INVALIDO = "Convite inválido ou expirado. Peça um novo convite ao escritório.";

export function AceitarConvite() {
  const { token = "" } = useParams();
  const convite = useQuery({ queryKey: ["convite", token], queryFn: () => api<ConvitePublico>(`/api/convites/${token}`) });
  const eu = useEu();
  const navegar = useNavigate();
  const consultas = useQueryClient();
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const voltaAqui = `/entrar?volta=${encodeURIComponent(`/convite/${token}`)}`;

  async function aceitar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    if (f.get("aceitouTermos") !== "on") return setErro("É preciso aceitar os termos.");
    const corpo = eu.data ? { aceitouTermos: true } : { nome: f.get("nome"), senha: f.get("senha"), aceitouTermos: true };
    setErro("");
    setEnviando(true);
    try {
      const { contaId } = await api<{ contaId: string }>(`/api/convites/${token}/aceitar`, { body: corpo });
      await consultas.invalidateQueries({ queryKey: chaves.eu });
      navegar(`/e/${contaId}`);
    } catch (e) {
      const c = e instanceof ErroApi ? e.codigo : "";
      setErro(
        c === "convite_invalido" ? INVALIDO
        : c === "convite_email_diferente" ? "Este convite é para outro e-mail."
        : c === "ja_membro" ? "Você já faz parte deste escritório."
        : c === "entre_primeiro" ? "Este e-mail já tem conta: entre para aceitar."
        : c === "validacao" ? "Confira o nome e a senha (pelo menos 8 caracteres)."
        : mensagemDeErro(e),
      );
    } finally {
      setEnviando(false);
    }
  }

  if (convite.isPending || eu.isPending) return <TelaSimples titulo="Convite"><p role="status">Carregando…</p></TelaSimples>;
  const v = convite.data;
  if (!v || v.estado === "invalido")
    return <TelaSimples titulo="Convite"><Aviso tom="erro">{INVALIDO}</Aviso></TelaSimples>;

  const termos = (
    <label className="flex items-start gap-3 text-sm">
      <input type="checkbox" name="aceitouTermos" className="mt-0.5 size-4 accent-marca" />
      <span>Li e aceito os termos de uso e a política de privacidade (versão provisória).</span>
    </label>
  );

  return (
    <TelaSimples titulo={`Convite de ${v.nomeEscritorio}`}>
      <p className="text-texto-2">Para <strong className="text-texto">{v.email}</strong>, como {ROTULO_PERFIL[v.perfil].toLowerCase()}.</p>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {eu.data && eu.data.usuario.email.toLowerCase() !== v.email ? (
        <>
          <Aviso tom="atencao">Você está com outra conta ({eu.data.usuario.email}). Saia para aceitar com {v.email}.</Aviso>
          <Botao variante="secundario" onClick={async () => { await authCliente.signOut(); consultas.clear(); navegar(voltaAqui); }}>Sair</Botao>
        </>
      ) : eu.data ? (
        <form onSubmit={aceitar} className="flex flex-col gap-4">
          {termos}
          <Botao type="submit" carregando={enviando}>Aceitar convite</Botao>
        </form>
      ) : v.temConta ? (
        <p>Este e-mail já tem conta. <Link to={voltaAqui} className="text-marca underline">Entre para aceitar</Link>.</p>
      ) : (
        <form onSubmit={aceitar} className="flex flex-col gap-4">
          <Campo id="nome" name="nome" rotulo="Seu nome" autoComplete="name" required />
          <Campo id="senha" name="senha" type="password" rotulo="Crie uma senha" autoComplete="new-password" dica="Pelo menos 8 caracteres." required />
          {termos}
          <Botao type="submit" carregando={enviando}>Aceitar convite</Botao>
        </form>
      )}
    </TelaSimples>
  );
}
