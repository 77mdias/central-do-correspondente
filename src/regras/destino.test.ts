import type { EscritorioResumo } from "../tipos-api";
import { destinoAposEntrar } from "./destino";

const e = (contaId: string): EscritorioResumo => ({
  contaId, nomeEscritorio: contaId, perfil: "gestor", plano: "simples", statusAssinatura: "ativa", ativa: true,
});

test("sem escritório vai criar", () => expect(destinoAposEntrar([], null)).toBe("/criar-escritorio"));
test("um escritório entra direto", () => expect(destinoAposEntrar([e("a")], "z")).toBe("/e/a"));
test("vários: último usado, se ainda existir", () => {
  expect(destinoAposEntrar([e("a"), e("b")], "b")).toBe("/e/b");
  expect(destinoAposEntrar([e("a"), e("b")], "z")).toBe("/escritorios");
  expect(destinoAposEntrar([e("a"), e("b")], null)).toBe("/escritorios");
});
