# Fingerprints

Every site you build with **scroll-craft** gets one row here, appended after it
ships. The registry exists so your next build can prove it is a different page
rather than a re-skin of one you already made.

This file is **yours**. It starts empty on purpose: the gate is about not
repeating *yourself*, so it has nothing to say until you have built something.

The rules and the gate live in the skill's
`references/uniqueness.md`. Short version:

**A new build must differ from EVERY row below on at least 4 of the 6
dimensions.** Four against each row individually, not four on average across the
table. If a planned build fails, change the plan. Never edit a row to make room
for it.

The six dimensions are: **grammar**, **nav treatment**, **hero device**,
**act-sequence shape**, **close pattern**, **signature move**.

Dimension 6 is free, because a signature move is unique by definition. So the
gate really asks for three more out of the remaining five, and a build that
changes only grammar and world will fail it.

---

## The registry

| Build | Grammar | Nav treatment | Hero device | Act-sequence shape | Close pattern | Signature move | World | Port |
|---|---|---|---|---|---|---|---|---|

*(empty: your first build has nothing to clear, so build whatever the interview
points at. From the second onwards, this table is the constraint.)*

---

## What is taken

Add a bullet here whenever a build claims something a later build should avoid
reusing: a grammar, a nav treatment, a close pattern, a signature move, an
act-count-and-length band. The shared columns are what the next build inherits
as a constraint, so writing them down is the whole point.

Nothing is taken yet.

---

## Appending a row

After shipping, add one line to the table and one bullet to **What is taken** if
the build claimed something new. Fill every column. Say what the build shares
with existing rows.

Rows are append-only. A build that has been superseded stays in the table,
because the space it occupies is still occupied.

---

## Worked example

The skill's author kept a registry of twelve builds across eight page grammars.
If you want to see what a filled-in table looks like, and which shapes tend to
collide, read `EXAMPLES.md` in the scroll-craft repository. Treat it as
illustration only: those rows are somebody else's builds and they do **not**
constrain yours.
| central-expediente | Live surface | Barra de app: marca, abas das vistas (scroll-spy, clicáveis), relógio do expediente, contador de cobranças, Entrar; régua vertical do expediente à direita (só linhas, uma a cada 15 min, lupa suave que desliza com a rolagem) | Superfície já em estado às 07:55; o aviso das 08:00 chega como notificação por cima do painel (pin 1,6) | pin 1,6 > pan 3,0 > pin 2,6 (ficha; fluxo em telas baixas) > reveal + pin 3,4 (pico) > flow; 5 atos, 11,8 vh no desktop e 12,6 no celular | Fecha num campo: o cadastro real ao lado do histórico completo do dia, às 18:00 | A rolagem é o relógio do expediente (07:55 a 18:00); todo estado da tela é função do horário | Interface real do produto, chão claro com virada escura do gestor | React SPA, `src/telas/Landing.tsx` |
