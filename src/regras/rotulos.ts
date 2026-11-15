import type { Perfil } from "../tipos-api";

export const ROTULO_PERFIL: Record<Perfil, string> = { gestor: "Gestor", funcionaria: "Funcionária", corretor: "Corretor parceiro" };

export const dataBr = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
