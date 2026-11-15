import { type FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { authCliente } from "@/auth-cliente";
import { Aviso, Botao, Campo, TelaSimples } from "@/componentes/ui";

export function NovaSenha() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const navegar = useNavigate();
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const senha = String(new FormData(ev.currentTarget).get("senha") ?? "");
    if (senha.length < 8) return setErro("A senha precisa de pelo menos 8 caracteres.");
    setEnviando(true);
    const { error } = await authCliente.resetPassword({ newPassword: senha, token: token! });
    setEnviando(false);
    if (error) return setErro("Este link não vale mais. Peça um novo.");
    navegar("/entrar?senha=nova");
  }

  if (!token || params.get("error"))
    return (
      <TelaSimples titulo="Nova senha">
        <Aviso tom="erro">Este link não vale mais. Peça um novo.</Aviso>
        <Link to="/esqueci-a-senha" className="text-sm text-marca underline">Pedir um link novo</Link>
      </TelaSimples>
    );

  return (
    <TelaSimples titulo="Nova senha">
      <form onSubmit={enviar} className="flex flex-col gap-4">
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        <Campo id="senha" name="senha" type="password" rotulo="Senha nova" autoComplete="new-password" dica="Pelo menos 8 caracteres." required />
        <Botao type="submit" carregando={enviando}>Salvar senha</Botao>
      </form>
    </TelaSimples>
  );
}
