import { abrirCobranca, cobrancasAbertas, fecharCobranca, ultimaAberta } from "./cobranca-aberta";

// no ambiente de teste (node) não há sessionStorage: vale a memória, como numa aba sem armazenamento
test("abre, renova e fecha cobranças por escritório", () => {
  abrirCobranca("A", { clienteId: "1", nome: "Maria", meio: "whatsapp" }, 1);
  abrirCobranca("A", { clienteId: "2", nome: "João", meio: "copiada" }, 2);
  abrirCobranca("B", { clienteId: "9", nome: "Outra conta", meio: "whatsapp" }, 3);
  expect(ultimaAberta("A")?.nome).toBe("João");
  abrirCobranca("A", { clienteId: "1", nome: "Maria", meio: "whatsapp" }, 4); // reabrir passa a ser a última
  expect(cobrancasAbertas("A").map((c) => c.clienteId)).toEqual(["2", "1"]);
  fecharCobranca("A", "1");
  expect(ultimaAberta("A")?.clienteId).toBe("2");
  expect(cobrancasAbertas("B")).toHaveLength(1);
});
