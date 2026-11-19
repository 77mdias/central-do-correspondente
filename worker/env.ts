export type Env = {
  DB_APP: Hyperdrive;
  DB_SYSTEM: Hyperdrive;
  ASSETS: Fetcher;
  APP_URL: string;
  BETTER_AUTH_SECRET: string;
  /** Chave da Resend: só em produção. Com ela, o envio vai pela Resend. */
  EMAIL_API_KEY?: string;
  /** API de envio do Mailpit: desenvolvimento, testes e e2e. */
  EMAIL_API_URL?: string;
  EMAIL_REMETENTE: string;
};
