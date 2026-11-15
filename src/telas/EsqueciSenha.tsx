import { type FormEvent, useState } from "react";
import { Link } from "react-router";
import { authCliente } from "@/auth-cliente";
import { Aviso, Botao, Campo, TelaSimples } from "@/componentes/ui";

export function EsqueciSenha() {
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setEnviando(true);
    await authCliente.requestPasswordReset({ email: String(new FormData(ev.currentTarget).get("email") ?? "").trim(), redirectTo: "/nova-senha" });
    setEnviando(false);
    setEnviado(true); // mesma resposta sempre: não revela quem tem conta
  }

  return (
    <TelaSimples titulo="Esqueci a senha">
      {enviado ? (
        <Aviso tom="ok">Se existir uma conta com esse e-mail, enviamos um link.</Aviso>
      ) : (
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <Campo id="email" name="email" type="email" rotulo="E-mail" autoComplete="email" required />
          <Botao type="submit" carregando={enviando}>Enviar link</Botao>
        </form>
      )}
      <Link to="/entrar" className="text-sm text-marca underline">Voltar para entrar</Link>
    </TelaSimples>
  );
}
