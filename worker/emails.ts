// Textos dos e-mails da fase 1. Só texto puro: chega bem em qualquer leitor.
const assinatura = "\n\n— Central do Correspondente";

export function emailVerificacao(url: string, nome: string) {
  return {
    assunto: "Confirme seu e-mail — Central do Correspondente",
    texto: `Olá, ${nome}!\n\nPara confirmar seu cadastro, abra o link:\n${url}\n\nSe não foi você, é só ignorar este e-mail.${assinatura}`,
  };
}

export function emailRecuperarSenha(url: string, nome: string) {
  return {
    assunto: "Nova senha — Central do Correspondente",
    texto: `Olá, ${nome}!\n\nPara criar uma senha nova, abra o link:\n${url}\n\nSe não foi você que pediu, ignore este e-mail: sua senha continua a mesma.${assinatura}`,
  };
}

export function emailContaExistente(urlEntrar: string, nome: string) {
  return {
    assunto: "Você já tem conta — Central do Correspondente",
    texto: `Olá, ${nome}!\n\nAlguém tentou criar uma conta com este e-mail, mas ela já existe. Para entrar ou criar um escritório, use:\n${urlEntrar}\n\nSe esqueceu a senha, peça uma nova na tela de entrada.${assinatura}`,
  };
}

const NOME_PERFIL = { funcionaria: "funcionária", corretor: "corretor parceiro" } as const;

export function emailConvite(url: string, nomeEscritorio: string, perfil: keyof typeof NOME_PERFIL) {
  return {
    assunto: `Convite para ${nomeEscritorio} — Central do Correspondente`,
    texto: `Olá!\n\n${nomeEscritorio} convidou você para acessar o Central do Correspondente como ${NOME_PERFIL[perfil]}.\n\nPara aceitar, abra o link (vale 7 dias):\n${url}${assinatura}`,
  };
}
