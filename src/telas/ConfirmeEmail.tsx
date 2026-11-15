import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { authCliente } from "@/auth-cliente";
import { Aviso, Botao, TelaSimples } from "@/componentes/ui";

export function ConfirmeEmail() {
  const email = useSearchParams()[0].get("email") ?? "";
  const [estado, setEstado] = useState<"" | "enviando" | "enviado" | "erro">("");

  async function reenviar() {
    setEstado("enviando");
    const { error } = await authCliente.sendVerificationEmail({ email, callbackURL: "/entrar?confirmado=1" });
    setEstado(error ? "erro" : "enviado");
  }

  return (
    <TelaSimples titulo="Confirme seu e-mail">
      <p>Enviamos um e-mail para <strong>{email || "o seu endereço"}</strong>. Abra o link para confirmar o cadastro.</p>
      {estado === "enviado" && <Aviso tom="ok">Enviamos de novo. Confira também a caixa de spam.</Aviso>}
      {estado === "erro" && <Aviso tom="erro">Não deu para reenviar agora. Espere um pouco e tente de novo.</Aviso>}
      {email && <Botao variante="secundario" onClick={reenviar} carregando={estado === "enviando"}>Reenviar e-mail</Botao>}
      <Link to="/entrar" className="text-sm text-marca underline">Voltar para entrar</Link>
    </TelaSimples>
  );
}
