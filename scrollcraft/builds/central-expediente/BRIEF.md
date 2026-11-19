# BRIEF · Central do Correspondente · "O expediente"

**Self-authored under explicit creative delegation.** O Jean respondeu "Decide você" (2026-11-17) às 8 perguntas da entrevista. As respostas abaixo são decisões do Claude, não citações dele. O que é evidência e o que é suposição está marcado.

Alvo: a landing React em `/` (`src/telas/Landing.tsx`), mantendo o cadastro real ligado a `POST /api/cadastro`.

## Evidência (o que já existia)

- Produto real: controle de financiamento habitacional para correspondentes bancários. 10 etapas, checklist de 12 documentos, aviso às 08:00, cobrança por link `wa.me` com a confirmação "Enviou?", parados há 7+ dias, portal do corretor (só os próprios clientes), taxa de comissão congelada na assinatura, sigilo por RLS (funcionária e corretor nunca veem percentual nem VGV). Fonte: `docs/SRS.md`, brief do Jean de 2026-11-17.
- Planos reais: Simples R$ 99 e Com corretores R$ 149 (`src/regras/planos.ts`).
- Marca: Mesa de Controle Editorial. Host Grotesk + JetBrains Mono, fundo branco, azul `#1a4be0`, painel escuro do gestor (`#0a0a0a`, azul `#6798ff`), logo vetorizada.
- Regras do Jean que continuam valendo: sem roxo, sem glow, sem 3D/tilt, movimento seco, `prefers-reduced-motion` legível, nunca citar "Caixa" no nome nem prometer integração com portais da Caixa ou envio automático no WhatsApp.
- Fotos em `public/images` são de banco de imagens (mesa, notebook, caneta). Não entram: esta gramática proíbe fotografia de fundo e o argumento é o produto.

## As 8 perguntas (decisões do Claude)

1. **Clima:** sala de controle às 08:00, calma e exata. Referências: o painel de partidas de uma estação de trem (estado muda sozinho, ninguém explica); o livro-caixa de um cartório (tudo carimbado com hora); o filme *Rotina* de um plantão, onde o relógio é o personagem.
2. **Percurso:** abre no Início às 08:00 com o aviso do dia; a fila de cobranças anda; o corretor manda os documentos e a ficha avança; às 16:00 um contrato é assinado e a tela vira a visão do gestor; às 18:00 o expediente fecha e a pessoa cria o próprio escritório.
3. **Energia:** calma no começo (a pilha do dia), ritmo na fila de cobranças, quieta no meio da tarde, o pico às 16:00, e assentada no fim.
4. **Sentimento por etapa e o momento:** ver abaixo. O momento: a virada para a visão do gestor com a taxa travando.
5. **O que nenhum site faz:** a rolagem é o relógio do expediente. Cada estado da tela é calculado pelo horário: rolar é trabalhar um dia de correspondente.
6. **Distância do premium-minimal:** *dense* (informação na frente, tipo pequeno, números tabulares), dentro da Mesa de Controle Editorial.
7. **Mundo contínuo ou cenas:** nem um, nem outro. Uma superfície só (o próprio produto), com vistas que mudam: Início, Cobranças, Ficha, Gestor, Assinatura.
8. **Materiais:** a interface real do produto, a logo vetorizada, os dados de exemplo. Nada gerado por IA (sem `KIE_AI_API_KEY`, e a gramática não pede fotografia).

## Jornada

```
1  Reconhecimento  08:00, o aviso do dia e a pilha de pendências
2  Movimento       a fila de cobranças anda, uma a uma, com o "Enviou?"
3  Confiança       o corretor anexa os PDFs e a ficha avança sozinha
4  Controle        16:00, a assinatura trava a taxa e o gestor vê o VGV somar
5  Compromisso     18:00, expediente encerrado; criar o próprio escritório
```

## Curva de sentimento (antes dos atos)

| Ato | Emoção | O que causa na tela |
|---|---|---|
| 1 · Início, 08:00 | Reconhecimento | O aviso das 08:00 chega, a varredura acha a Patrícia com 7 dias parada e ela sobe na lista |
| 2 · Cobranças | Alívio em movimento | Os cartões da fila passam de lado; cada um muda de "Cobrar" para "Enviou?" e para "Registrada", e o contador desce de 4 a 0 |
| 3 · Ficha e corretor | Confiança | Os PDFs do C. Lima enchem as barras, o checklist chega a 12 de 12 e a ficha muda de etapa sem ninguém pedir |
| (silêncio) | Expectativa | Às 15:30 a tela fica quieta: só a linha "16:00 · Assinatura do contrato · Bruno Costa" |
| 4 · Gestor, 16:00 | Controle (o pico) | O fundo vira escuro de baixo para cima, o cadeado fecha em 1,400%, o VGV soma R$ 290.000,00 na hora; trocar para "Funcionária" esconde os valores |
| 5 · Fim do expediente | Decisão | 18:00, 0 cobranças pendentes, o histórico do dia completo e o formulário de criar escritório com o cursor esperando |

Nenhum par vizinho com o mesmo sentimento.

**Silêncio autoral:** o fim do ato 3 (15:30 a 16:00) mostra pouca coisa de propósito. Não é scroll morto.

## O pico

> "a tela virou a visão do gestor, o cadeado fechou e o VGV somou o contrato na hora"

Vive no ato 4. Recebe o maior span da página e o silêncio antes dele.

## Frase para contar a alguém

> "É o site em que você rola um dia inteiro de correspondente: o relógio anda das 08:00 às 18:00 e a fila zera na sua mão."

## Gramática

**Superfície viva (live surface).** A página é o produto funcionando, com dados de exemplo identificados como tal. A navegação é o cromo do app (barra de status com o relógio, menu lateral real que pula para cada vista); o hero é a superfície já em estado; o fim é um campo de verdade (o cadastro).

Por que as outras sete perderam:
- **Filmic one-shot:** pede vídeo de câmera e um arco cinematográfico; o produto não tem filmagem e o argumento não é imagem.
- **Chaptered editorial:** combina com a estética, mas descreveria o produto em vez de mostrá-lo funcionando.
- **Continuous world:** não há geografia; exigiria worldflight com vídeo.
- **Typographic poster:** o ativo da marca não é uma frase; é a operação.
- **Gallery/catalog:** não há uma coleção de objetos; são dois planos.
- **Split stage:** "caderno vs. sistema" seria possível, mas viraria comparação e não demonstração.
- **Rhythmic cutlist:** energia de marca jovem; o público quer controle calmo.

Proibições que valem aqui: sem cromo de marketing (barra logo + CTA), sem scrim, sem fotografia de fundo, sem manchete cinética, sem título de 6rem, sem `scrub`, sem `spotlight`, no máximo dois chãos (claro e escuro do gestor).

**Honestidade:** todo painel calcula o estado a partir de arrays de dados na página (`src/telas/landing/expediente.ts`) e a página diz "Demonstração com dados de exemplo".

## Assinatura (signature move)

**O relógio do expediente.** O horário da barra de status é a posição da rolagem (08:00 no topo, 18:00 no fim). Fila, parados, ficha, VGV e histórico são funções desse horário, com a regra real do produto (uma cobrança registrada tira a ficha dos parados; a assinatura congela a taxa vigente). O histórico do dia acumula uma linha carimbada a cada evento e chega completo ao fechamento.

## Roteiro de dispositivos

| Ato | Dispositivo | Por quê | Span | Horário |
|---|---|---|---|---|
| 1 · Início | `pin` | A superfície segura enquanto a varredura das 08:00 roda | 1,6 | 08:00 a 08:30 |
| 2 · Cobranças | `pan` | A fila é largura (uma depois da outra), não argumento | 3,0 | 08:30 a 10:30 |
| 3 · Ficha e corretor | `flow` (progresso do ato dirige os anexos) | Ritmo de leitura normal entre dois atos fixados | natural | 10:30 a 15:30 |
| 4 · Gestor | `reveal` + `pin` | A virada de papel é mudança de estado; o pico segura | 3,4 (maior) | 15:30 a 17:00 |
| 5 · Fim do expediente | `flow` + `in`, fecha num campo | A página para de se mover e espera uma entrada | natural | 17:00 a 18:00 |

Famílias: `pin`, `pan`, `flow`, `reveal` (4). Nenhuma repetida em sequência. Um único `pin` de pico. Total perto de 11 alturas de tela em 5 atos, fora da faixa 6 a 7 atos / 13,6 a 13,8.

## Verificação (2026-11-17)

Harness `shoot.mjs` contra o app do Docker (`127.0.0.1:3002`), desktop 1440×900, celular 390×844 e movimento reduzido: sem scroll morto; único erro de console é o 401 esperado de `/api/eu` sem sessão. A seção Ficha (fluxo) foi fotografada à parte, e os controles exercitados num script: "Ver como" Funcionária esconde VGV, taxa e remuneração; Corretor mostra só o contrato dele; cadastro vazio mostra 6 erros e não chama `/api/cadastro`; o relógio chega a 18:00 no fim da página.

Defeitos achados e corrigidos no caminho:
- O `<style>` do motor no `body` era apagado pela limpeza do harness (ele remove o último `<style>` com `data-sc-cue`). Foi para o começo do `<head>`.
- `button { color: inherit }` do motor (sem camada) vencia as utilidades do Tailwind: o botão "Gestor" ficava branco no branco. O motor entrou na camada `@layer scrollcraft`, a de menor prioridade.
- Na Ficha os uploads terminavam antes de o painel aparecer (seção curta, relógio linear). O horário passou a seguir âncoras: 11:45 com o portal no centro da tela, 14:45 com a ficha passando por ele.
- Hero em 3 linhas; reduzido para caber em 2. Abas do celular cortadas; espaçamento menor.

## Checagem de sentimento (fria, pelas folhas)

| Ato | Pretendido | Sentido | Ação |
|---|---|---|---|
| Início | Reconhecimento | Reconhecimento (o painel do dia, o aviso chegando) | nenhuma |
| Cobranças | Alívio em movimento | Movimento; vazio demais acima do trilho depois que o cartão-título sai | linha de status fixa sobre o trilho |
| Ficha | Confiança | Primeira passada: "já estava pronto" (nada a sentir) | âncoras no relógio; agora os PDFs sobem à vista |
| (silêncio) | Expectativa | Expectativa | nenhuma |
| Gestor | Controle (pico) | Controle: maior mudança da página e maior span; depois das 16:24 a tela segura parada, que é onde o "Ver como" pede para ser usado | mantido |
| Fim | Decisão | Decisão; o fim para com conteúdo (histórico + formulário) | nenhuma |

Não verificado: aparelho real (iPhone/Android), Safari, leitor de tela.

## Revisão do Jean (2026-11-17): "muito espaço em branco"

O Jean achou as vistas vazias e pediu que a landing detalhe o que o produto oferece. Conteúdo real acrescentado, sem números inventados:
- Hero: botão "Assinar plano" com o preço a partir de R$ 99, lista "Cobrar hoje" no painel e a faixa com os 6 recursos (10 etapas, 12 documentos, 08:00, wa.me, portal, taxa congelada). Abaixo de 1024 px a faixa vai para logo depois do hero.
- Cobranças: os 3 passos da cobrança sob o trilho (no celular só número e título).
- Ficha: nomes das etapas (RN-01) e três regras: convite de 7 dias, anexo marca o documento, PDFs apagados 30 dias depois da assinatura.
- Antes do pico: a agenda da tarde e o que a assinatura faz (no lugar do silêncio quase vazio).
- Gestor: taxa travada por contrato, sigilo no banco (RLS) e exportação.
- Planos: o que cada um inclui, dentro da escolha do formulário.

Conferido em 1440×900, 1366×768 e 390×844: tudo cabe nos palcos fixados, sem corte.

## Revisão do Jean (2026-11-17): trava na Ficha e régua à direita

- **Ficha travada** (pedido do Jean: "as mudanças estão muito rápidas"). Vira `pin` com span 2,6 quando os dois painéis cabem lado a lado (≥1024 px de largura e ≥760 px de altura); abaixo disso continua em fluxo com as âncoras. Dentro da trava o relógio segue `RITMO_FICHA`: cada upload e a troca de etapa têm a sua faixa de rolagem. Isso põe dois `pin` seguidos (ficha e gestor), contra a regra de variedade da skill; vale o pedido do Jean. O gestor continua com o maior span (3,4) e a virada escura o separa da ficha.
- **Régua do expediente** à direita (≥1024 px): só linhas (44 px, sem fundo nem borda, transparente ao mouse), uma a cada 15 minutos de 08:00 a 18:00. Segue a rolagem contínua (não o minuto arredondado) e desliza até ela com lerp de 0,1 por quadro; a lupa em volta da posição cresce em curva (smoothstep) e a cor passa do cinza ao azul aos poucos (`color-mix`). Versão escura na visão do gestor. Só visual (`aria-hidden`); o horário acessível está na barra do app. Pontos de evento e horário ao lado foram tirados a pedido do Jean.

Conferido: 1440×900 e 1366×768 com a Ficha travada (4 atos fixados) e sem corte; 390×844 em fluxo; harness sem scroll morto.

## Revisão do Jean (2026-11-17): o fechamento não cabia na tela

O fechamento tinha ~1.100 px (histórico, escopo e dúvidas empilhados à esquerda; formulário longo à direita). O conteúdo agora tem 657 px e cabe a partir de 1280×720; a seção ocupa exatamente uma tela abaixo da barra do app (`min-h: 100svh - barra`, conteúdo centralizado), conferida em 1366×768, 1920×1080 e 2560×1440:
- À esquerda, o resumo do dia e um painel com abas no idioma do app: "Histórico de hoje" (as 10 linhas), "O que vem no sistema" e "Dúvidas".
- À direita, o cadastro em pares (nome e escritório, e-mail e senha, CPF/CNPJ ao lado do aceite) e os planos só com a lista do que incluem.
- As âncoras do relógio são limitadas ao fim real da página, para o fechamento curto ainda chegar às 18:00 ("Expediente encerrado").
- Validação conferida de novo: 6 erros com o formulário vazio e nenhuma chamada a `/api/cadastro`. No celular a seção continua empilhada e rola.

## Revisão do Jean (2026-11-19): quebras no celular

O Jean abriu a landing no celular (Chrome no iPhone, 393×852) e viu faixas brancas embaixo dos palcos, títulos cortados e blocos que apareciam e sumiam ao rolar. Causas e correções:

- **Vão embaixo dos palcos.** O palco tinha a altura da tela com a barra do navegador aberta (`100svh`, 661 px). Ao rolar, a barra recolhe e a tela passa a 761 px: sobravam 100 px sem fundo (branco embaixo da visão do gestor). Agora o palco tem `100lvh` (fundo sempre até o fim) e `padding-bottom: 100lvh − 100svh`, então o conteúdo é composto na tela pequena e não se mexe quando a barra vai e volta.
- **Nada no palco depende de `@media (min-height)`.** No celular essa medida muda com a barra do navegador: os 3 passos da cobrança apareciam dentro do palco no meio da rolagem e empurravam o resto. Abaixo de 1024 px os passos (com o texto) e o parágrafo de abertura ficam numa seção em fluxo depois do palco, como a faixa do início.
- **Cobranças.** Abaixo de 1024 px o título "Cobranças de hoje" fica parado acima do trilho; dentro do trilho ele passava cortado pela borda da tela.
- **Gestor.** Mais compacto abaixo de 640 px (remuneração numa linha, respiros menores) e colunas fixas na tabela: o valor do imóvel não trunca mais.
- **Fechamento.** Empilhado, o rodapé de direitos vai para depois do formulário (ficava no meio da página).
- **Barra do app.** Entre 768 e 1023 px a pílula de pendências some: quebrava em duas linhas ao lado das abas.

Conferido no navegador: 393×661 e 393×761 (barra do navegador aberta e recolhida, com a sobra simulada em 100 px), 360×560, 768×1024 e 1280×800. Em 360×560 a visão do gestor passa 74 px da tela pequena (última linha e nota): aparece inteira quando a barra recolhe, que é o estado normal ao rolar para baixo. Não conferido num iPhone de verdade.
