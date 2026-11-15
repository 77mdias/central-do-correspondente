import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { authCliente } from "@/auth-cliente";
import { Aviso, Botao, Campo, TelaSimples } from "@/componentes/ui";

export function Entrar() {
  const [params] = useSearchParams();
  const navegar = useNavigate();
  const consultas = useQueryClient();
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const volta = params.get("volta")?.startsWith("/") ? params.get("volta")! : "/"; // só caminho interno

  async function enviar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    const email = String(f.get("email") ?? "").trim();
    setErro("");
    setEnviando(true);
    const { error } = await authCliente.signIn.email({ email, password: String(f.get("senha") ?? "") });
    setEnviando(false);
    if (!error) {
      await consultas.invalidateQueries();
      return navegar(volta);
    }
    if (error.code === "EMAIL_NOT_VERIFIED") return navegar(`/confirme-o-email?email=${encodeURIComponent(email)}`);
    setErro(error.status === 429 ? "Muitas tentativas. Espere um minuto e tente de novo." : "E-mail ou senha incorretos.");
  }

  return (
    <TelaSimples titulo="Entrar">
      {params.get("confirmado") && <Aviso tom="ok">E-mail confirmado. Agora é só entrar.</Aviso>}
      {params.get("senha") === "nova" && <Aviso tom="ok">Senha alterada. Entre com a senha nova.</Aviso>}
      <form onSubmit={enviar} className="flex flex-col gap-4">
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        <Campo id="email" name="email" type="email" rotulo="E-mail" autoComplete="email" required />
        <Campo id="senha" name="senha" type="password" rotulo="Senha" autoComplete="current-password" required />
        <Botao type="submit" carregando={enviando}>Entrar</Botao>
      </form>
      <div className="flex flex-col gap-2 text-sm text-texto-2">
        <Link to="/esqueci-a-senha" className="text-marca underline">Esqueci a senha</Link>
        <p>Ainda não tem escritório? <Link to="/criar-escritorio" className="text-marca underline">Criar escritório</Link></p>
      </div>
    </TelaSimples>
  );
}
