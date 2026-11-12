# AGENTS.md — Regras de continuidade

Para pessoas e agentes de IA que continuarem o Submundo Brasil.

## Regras obrigatórias

1. **Nunca edite `Submundo-Brasil-v0.7.html` à mão.** Edite `src/` e rode `node build.js`.
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
8. **Conteúdo fictício e abstrato**: nenhuma instrução aplicável a crimes reais. As **cidades são reais** (tabela `CITIES`), mas bairros, grupos e pessoas são **inventados**, inspirados na paisagem de cada cidade. Nunca use nomes de comunidades, facções ou pessoas reais. Cidade nova → entrada completa em `CITIES` (5 bairros, 3 grupos, 5 negócios, festas, vantagem) e silhueta em `LANDMARK` (`ui.js`); textos de eventos usam marcadores (`{centro}`, `{bar}`) em vez de nomes fixos.
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

## Mercadorias e temas sensíveis

- Mercadorias, produção e remessas são **comércio abstrato**: nomes de rua e números, nunca receitas, ingredientes reais, métodos ou rotas reais.
- Pessoas não são mercadoria: nada de mecânica de exploração sexual ou tráfico de pessoas.
- Item, mercadoria ou ponto de produção novo → entrada nas tabelas `ITEMS`/`GOODS`/`LABS`, com custo **e** risco, e leitura em `normalizeSave`.

## Primeiros passos e ajuda

- A trilha fica em `TUTORIAL` (`engine.js`). Passo novo → `check(s)` puro, recompensa pequena e a `view` onde acontece.
- Quem já jogou nunca é forçado ao guia: saves anteriores e novas temporadas entram com `tutorial.done = true`.
- Mecânica nova que o jogador precisa entender → uma frase em "Como jogar" (`helpPages` em `ui.js`).
