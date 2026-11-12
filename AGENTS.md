# AGENTS.md — Regras de continuidade

Para pessoas e agentes de IA que continuarem o Submundo Brasil.

## Regras obrigatórias

1. **Nunca edite `Submundo-Brasil-v1.3.html` à mão.** Edite `src/` e rode `node build.js`.
2. **Regras só em `src/engine.js`; nada de DOM lá.** A interface (`src/ui.js`) só chama `SB.perform(...)` e lê funções derivadas.
3. **Toda ação recusada não pode alterar o estado.** Valide tudo antes da primeira mutação. Existe teste para isso.
4. **Compatibilidade de saves é sagrada.**
   - Não troque a chave `submundo_brasil_v01`.
   - Campo novo → valor padrão em `defaultState` **e** leitura com limite em `normalizeSave`.
   - Mudança incompatível → novo `SCHEMA` e conversão explícita; mantenha a leitura dos schemas 1 e 2.
   - Nunca descarte um save ilegível sem guardar cópia.
5. **Escape todo texto vindo do estado** com `esc()` (ou `num()`/`fmt()` para números) ao montar HTML.
6. **Não invente resultados.** Rode `npm test` antes de commitar; para mudanças de números, rode `npm run simulate` e `npm run careers` e atualize as tabelas em `VALIDATION.md`.
7. **Atualize `GAME_DESIGN.md`** quando mudar uma regra ou um número exibido ao jogador.
8. **Conteúdo adulto (18+) e fictício**: o jogo é sujo de propósito (crime, armas, drogas, linguagem pesada), com aviso 18+ obrigatório na entrada. A única linha que não se cruza: **nenhum texto ensina a fazer** algo no mundo real (nomes, riscos e recompensas dão o clima; métodos, passos, materiais e técnicas, nunca). As **cidades são reais** (tabela `CITIES`), mas bairros, grupos e pessoas são **inventados**, inspirados na paisagem de cada cidade. Nunca use nomes de comunidades, facções ou pessoas reais. Cidade nova → entrada completa em `CITIES` (5 bairros, 3 grupos, 5 negócios, festas, vantagem) e silhueta em `LANDMARK` (`ui.js`); textos de eventos usam marcadores (`{centro}`, `{bar}`) em vez de nomes fixos.
9. **Sem pay-to-win, sem dependência externa para jogar, sem simular multiplayer.**
10. **Siga a direção de arte "rua brasileira"** (GAME_DESIGN.md §11): HUD fixo do personagem, cena SVG do bairro com placa esmaltada, lambe-lambe para notícias/eventos, cupom com carimbo para resultados, fita zebrada para detenção, dossiês para facções e títulos em caixa alta condensada. Só CSS e SVG inline (nada externo), fundo escuro com âmbar, sem neon e sem cara de dashboard. Não apague os ganchos usados pelos testes (`data-action`, `data-view`, ids e `.resultCard`). Animações precisam respeitar `prefers-reduced-motion`. Teste em 360×780 sem rolagem horizontal e olhe as capturas.

## Checklist ao adicionar uma mecânica

- [ ] Dados/tabela em `engine.js` (seção 2), com custo **e** consequência
- [ ] Estado padrão + `normalizeSave`
- [ ] Ação em `act` com validação completa e `log()`
- [ ] Integração com pelo menos um sistema existente (bairro, facção, economia ou temporada)
- [ ] Teste em `tests/engine.test.js`; bot em `tests/simulate.js` se afetar a estratégia
- [ ] Interface: botão desabilitado com o motivo visível, e resultado no cartão
- [ ] Documentação atualizada

## Convenções

- Textos ao jogador em português do Brasil, curtos, sempre com o custo à vista ("R$ 320 · 33 energia").
- Valores monetários inteiros (`Math.round`); faixas sempre com `clamp`.
- Funções derivadas puras (`missionChance(s, m)`); efeitos colaterais apenas em `do*`.
- Aleatoriedade somente por `rand`/`roll`/`pick`/`weighted` do motor (para testes determinísticos).

## Conteúdo adulto e temas sensíveis

- Mercadorias, produção, remessas e serviços: **nome e clima sim, método não**. Nada de receitas, ingredientes, ferramentas e passos, rotas reais ou como burlar segurança.
- Lugares adultos (Termas VIP, baile) são cenário e negócio; **pessoas não são mercadoria**: nada de comprar, vender ou explorar pessoas como mecânica, nada de conteúdo sexual explícito.
- Facções e pessoas continuam **inventadas**; não use nomes de facções criminosas reais nem de pessoas reais.
- Duelos e confrontos: chance, resultado e consequências em números; violência sugerida, sem descrição gráfica.
- Ação física nova → bloqueio por `blocked(s)` (detenção e internação) e, se arriscada, dano por `hurt(s, n)`.
- Item, mercadoria ou ponto de produção novo → entrada nas tabelas `ITEMS`/`GOODS`/`LABS`, com custo **e** risco, e leitura em `normalizeSave`.

## Ciclo e organização das telas

- **Sem PvP**: a disputa é contra a polícia, o vício, a falência e o calendário do mês (GAME_DESIGN.md §20). Risco novo deve vir do sistema, não de outro jogador.
- Toda fonte de energia ou dinheiro fácil precisa de um freio medido na simulação (vício na noite, vantagem da banca nas apostas).
- O jogo gira em torno de **Roubar → Noite → Feira → Dormir** (GAME_DESIGN.md §19). As abas seguem essa ordem; não acrescente aba sem tirar outra.
- Lugar novo entra na tela Cidade, com fase de abertura em `GATES` quando não for para iniciante.
- O cartão "E agora?" (`nextMove` em `ui.js`) precisa conhecer qualquer mecânica nova que mude o próximo passo do jogador.
- Enquanto os primeiros passos estão ativos, só o guia orienta: não mostre dois conselhos ao mesmo tempo.

## Arte

- Ilustrações em SVG ficam em `src/art.js` (lugares, adversários, assaltos), geradas em código e sem arquivos externos.
- Imagens pintadas opcionais: `art/<chave>.(webp|jpg|png)`, até 400 KB cada; o build embute e elas substituem o SVG da mesma chave. Prompts e nomes em `PROMPTS_ARTE.md`.
- Lugar, adversário ou assalto novo → desenho em `src/art.js` **e** linha de prompt em `PROMPTS_ARTE.md`.

## Primeiros passos e ajuda

- A trilha fica em `TUTORIAL` (`engine.js`). Passo novo → `check(s)` puro, recompensa pequena e a `view` onde acontece.
- Quem já jogou nunca é forçado ao guia: saves anteriores e novas temporadas entram com `tutorial.done = true`.
- Mecânica nova que o jogador precisa entender → uma frase em "Como jogar" (`helpPages` em `ui.js`).
