import { createAuthClient } from "better-auth/react";

// Só sessão: entrar, sair, confirmar e-mail e recuperar senha. O resto é a nossa API (src/api.ts).
export const authCliente = createAuthClient();
