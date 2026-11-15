import { betterAuth } from "better-auth";
import type { Pool } from "pg";
import type { Email } from "./email";
import { emailContaExistente, emailRecuperarSenha, emailVerificacao } from "./emails";
import type { Env } from "./env";

/**
 * Better Auth por pedido (no Worker, conexões não podem ser reaproveitadas entre pedidos).
 * Só login: escritórios, membros e convites são tabelas nossas. Configuração de e-mail e senha igual à do AtelieSys.
 */
export function criarAuth(env: Pick<Env, "APP_URL" | "BETTER_AUTH_SECRET">, system: Pool, enviar: (e: Email) => void) {
  const app = env.APP_URL.replace(/\/$/, "");
  return betterAuth({
    baseURL: app,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [app],
    database: system,
    advanced: {
      database: { generateId: "uuid" },
      // no Worker, o IP do cliente vem da Cloudflare neste cabeçalho; sem IP, o limite viraria um balde só para todos
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
    user: {
      additionalFields: {
        termosVersao: { type: "string", required: false, input: false },
        termosAceitosEm: { type: "date", required: false, input: false },
        adminSistema: { type: "boolean", required: false, defaultValue: false, input: false },
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => enviar({ para: user.email, ...emailRecuperarSenha(url, user.name) }),
      // com requireEmailVerification o Better Auth responde igual para e-mail novo e existente; aqui a pessoa é avisada
      onExistingUserSignUp: async ({ user }) => enviar({ para: user.email, ...emailContaExistente(`${app}/entrar`, user.name) }),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      // sem login automático: quem pré-cadastrou o e-mail de outra pessoa não ganha a conta quando ela confirma
      autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, url }) => {
        // quem entra pelo convite tem o e-mail confirmado pelo próprio link do convite
        if (await temConviteAberto(system, user.email, user.createdAt)) return;
        const link = new URL(url);
        link.searchParams.set("callbackURL", "/entrar?confirmado=1");
        enviar({ para: user.email, ...emailVerificacao(link.toString(), user.name) });
      },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-up/email": { window: 3600, max: 5 },
        "/sign-in/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 3600, max: 3 },
        "/send-verification-email": { window: 3600, max: 3 },
      },
    },
  });
}

export type Auth = ReturnType<typeof criarAuth>;

/** Conta criada há menos de 15 min com convite aberto para o e-mail: entra pelo convite, sem e-mail de confirmação. */
async function temConviteAberto(system: Pool, email: string, criadoEm: Date): Promise<boolean> {
  if (Date.now() - new Date(criadoEm).getTime() > 15 * 60_000) return false;
  const r = await system.query(
    `select 1 from convites where email = lower($1) and aceito_em is null and revogado_em is null and expira_em > now() limit 1`,
    [email],
  );
  return (r.rowCount ?? 0) > 0;
}
