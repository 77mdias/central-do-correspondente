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
  /** Anexos (fase 2): API S3 do Supabase Storage em produção, s3mock no desenvolvimento. */
  S3_ENDPOINT: string;
  S3_REGIAO: string;
  S3_BUCKET: string;
  S3_ACCESS_KEY_ID: string;
  S3_SECRET_ACCESS_KEY: string;
};
