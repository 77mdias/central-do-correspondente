# Protótipo

`prototipo.html` é uma cópia de referência do protótipo da Central, feito como Artifact do Claude: https://claude.ai/artifact/VyQhFpjAr6aetT4nVkf6c6 (copiado em 22/11/2026). É a referência de telas e regras da fase 2; o código **não** é reaproveitado.

- Abre direto no navegador, mas **sem dados**: o protótipo lê e grava no banco compartilhado do Artifact (`window.claude.use("db")`) e guarda os anexos no armazenamento de arquivos dele (`window.claude.use("assets")`). Fora do Claude aparece o aviso "O armazenamento não está disponível".
- Na cópia ficou de fora só o runtime que o Claude injeta em todo Artifact; no lugar dele entrou a regra base `[hidden]{display:none}`, sem a qual a gaveta e as telas escondidas aparecem.
- Os outros protótipos citados no Briefing não funcionam e não servem de referência.

## Onde está cada coisa no código

| O quê | Onde (`prototipo.html`) |
|---|---|
| Etapas, modalidades, os 12 documentos, intervalos de cobrança, "parado" (7 dias) | constantes `ETAPAS`, `MODALIDADES`, `DOCS`, `CHECK`, `INTERVALOS`, `STALE` |
| Percentual e remuneração (RN-08, RN-09), contratado | `pctCliente`, `remun`, `contratado` |
| Situação da cobrança | `cobranca` |
| Mensagens de WhatsApp | `msgCliente`, `msgCorretor`, `waLink` |
| Salvamento automático (700 ms) e histórico (últimas 80 entradas) | `salvar`, `salvarDepois` |
| Redução de fotos (2.200 px, JPG 0,85) | função de upload, perto de `OK_TIPOS` |
| Dados | coleções `clientes` e `corretores` e o documento `config/geral` (mapeamento para o banco novo em [MODELO-DE-DADOS.md](../MODELO-DE-DADOS.md) §8) |
