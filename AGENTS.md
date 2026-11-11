# AGENTS.md — Regras de continuidade

Para pessoas e agentes de IA que continuarem o Submundo Brasil.

## Regras obrigatórias

1. **Nunca edite `Submundo-Brasil-v0.5.html` à mão.** Edite `src/` e rode `node build.js`.
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
8. **Conteúdo fictício e abstrato**: nenhuma instrução aplicável a crimes reais; nada de bairros, facções ou pessoas reais.
9. **Sem pay-to-win, sem dependência externa para jogar, sem simular multiplayer.**
10. **Não refaça o visual por inteiro**: preserve a paleta, as serifas nos títulos e a navegação inferior no celular. Teste em 360×780 sem rolagem horizontal.

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
