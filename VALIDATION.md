# Validação — Submundo Brasil v0.6

Tudo abaixo foi **executado** neste ambiente (Node.js + Chromium/Playwright).
Para reproduzir: `npm test` (build + motor + fuzz + interface), `npm run simulate`
e `npm run careers`.

Os testes de motor, fuzz e simulação carregam o motor **de dentro do HTML
entregue** (`<script id="sb-engine">`), não de uma cópia.

## 1. Testes do motor — `tests/engine.test.js`

**68 de 68 passaram** (v0.6; 12 novos sobre cidades e primeiros passos). Cenários cobertos:

| Cenário pedido | Testes |
|---|---|
| Personagem iniciante | estado inicial válido; chances iniciais coerentes (fácil ≥ 75%, cofre ≤ 15%); bloqueios por respeito e por bairro |
| Jogador experiente / valores extremos | 1.000 missões seguidas com energia infinita mantêm invariantes; caixa de R$ 10¹¹ não quebra fórmulas; respeito decrescente em missões fáceis |
| Pouco dinheiro | fiança recusada sem caixa; `maxDeposit` nunca deixa o caixa negativo (0, 1, 2, 33, 103...) |
| Excesso de dinheiro | treino superlinear; legado entre temporadas limitado a R$ 4.500 mesmo com R$ 10⁹ |
| Energia esgotada | ação recusada **sem alterar o estado** (comparação do JSON antes e depois) |
| Gangue pequena e grande | chance maior com 7 do que com 2 integrantes; limite de 8; deserção com ânimo baixo; integrantes sobem de nível |
| Rival dominante | presença 95 e força 90 reduzem a chance de confronto; facções hostis retaliam; a liderança de bairros muda ao longo das temporadas |
| Trégua ativa | exige +35; bloqueia confronto e disputa; impede retaliação; a renovação custa mais e respeita a carência; romper pune todas as facções |
| Aliança | requisitos, contribuição diária, hostilidade do inimigo do aliado |
| Mudança de temporada | não encerra antes do dia 30; exatamente 29 viradas; histórico, conquistas e recordes preservados; rival histórico herdado |
| Importação de save antigo | save 0.4 completo migra (dinheiro, 5 integrantes gerados, rival → presença, trégua, evento legado, histórico); save migrado joga uma temporada inteira; envelope de exportação da 0.4 aceito |
| Save inválido | JSON corrompido, schema desconhecido e dia 31 recusados com motivo; valores extremos limitados com notas; campos com HTML e chaves extras descartados; ida e volta estável; checksum detecta alteração |
| Repetição | repetir reduz chance e recompensa; vigilância local; cofre 1 vez por dia; 3 treinos por dia |

Um bug foi **encontrado por estes testes e corrigido**: `nextMemberId` era
incrementado a cada carregamento do save.

## 2. Fuzz — `tests/fuzz.js`

Ações aleatórias de todos os tipos com argumentos aleatórios (inclusive
inválidos). Após cada ação verifica: valores inteiros e não negativos, energia e
vigilância ≤ 100, influência e presença entre 0 e 100. Ao fim de cada temporada,
faz ida e volta pelo JSON.

Sementes 1, 2 e 3, com 30 ciclos cada (~17–23 temporadas completas por semente,
milhares de ações): **0 exceções, 0 violações**.

## 3. Interface — `tests/ui.test.js` (Chromium, 360×780)

**52 de 52 verificações passaram** (v0.6: capa com cidade, introdução, guia e destaque de aba), com **0 erros de console**:

- 6 telas sem rolagem horizontal a 360 px (jogo novo e save migrado) e a 1280 px.
- A missão consome energia e mostra o cartão de resultado com as variações.
- "Avançar dia" pede um segundo toque com energia ≥ 40 e mostra o resumo do dia.
- O depósito de R$ 1.000 cobra R$ 30; valor negativo é recusado.
- Save corrompido: tela inicial com aviso, cópia preservada.
- **XSS**: 5 cargas `<img onerror>` (histórico, registro, nome da gangue) não executaram.
- **Compatibilidade real**: a v0.4 original foi aberta no navegador e jogada por 6 dias; o save foi enriquecido com gangue, trégua e negócio e carregado na 0.5. Nome, dia, dinheiro, carreira, negócios, trégua, integrantes e presença foram preservados, e o backup da 0.4 foi criado.
- Temporada levada ao dia 30 e encerrada pela interface; histórico com pontuação.
- Exportação com versão e checksum; importação pela tela inicial restaura a carreira.

Capturas em `tests/screens/` (revisadas manualmente: legibilidade, hierarquia,
ausência de cortes).

## 4. Simulação de balanceamento — `tests/simulate.js`

Bots com estratégias fixas jogam temporadas completas. Resultado da **v0.6** em
`node tests/simulate.js 300 2` (300 temporadas por estratégia, médias, em Recife):

| Estratégia | Patrimônio | Respeito | Pontos | Meta | Detenções |
|---|---|---|---|---|---|
| Operador farmando missões | 16.092 | 131 | 199 | 40% | 2,8 |
| Empreendedor com negócios | 18.872 | 120 | 207 | 60% | 2,8 |
| Articulador territorial | 602 | 132 | 206 | 100% | 1,7 |
| Articulador diplomata | 1.534 | 105 | 219 | 100% | 2,8 |
| Bonde (gangue) | 638 | 96 | 166 | 40% | 1,0 |
| **Exploit: repetir a melhor e depositar tudo** | 2.089 | 46 | **28** | 0% | **11,1** |
| Aleatório | 571 | 50 | 56 | 0% | 1,0 |

Leitura:
- As cinco estratégias focadas ficam entre 166 e 219 pontos: há **vários caminhos de vitória**.
- O exploit da 0.4 (repetir a melhor missão e depositar tudo) continua a pior estratégia.
- Na calibração da 0.5, a diplomacia chegou a 287 pontos (ouro sempre); foi corrigida com regras (custo crescente das tréguas, carência, desgaste da relação).

### Especializações — `tests/careers.js` (200 temporadas por célula, v0.6)

| Estratégia | Operador | Articulador | Empreendedor |
|---|---|---|---|
| Missões | **203** | 192 | 169 |
| Negócios | **201** | 184 | **201** |
| Território | 203 | **206** | 199 |
| Diplomacia | 195 | **219** | 174 |
| Gangue | 172 | **191** | 164 |

### Cidades (v0.6)

Média das cinco estratégias focadas, 120 temporadas cada (600 por cidade):
Rio de Janeiro 200 · São Paulo 203 · Belo Horizonte 209 · Salvador 206 · Recife 202 · Porto Alegre 202.
Nenhuma cidade é obrigatória nem ruim; a diferença máxima é de 4,5%.

## 5. Limitações conhecidas (honestas)

1. **O Articulador é forte na estratégia de gangue** (191 contra 172 do Operador) e bom generalista. O Operador passou a vencer no farm de missões (203 contra 192) depois do bônus de +8% em serviços grandes.
2. O Empreendedor é fraco fora da estratégia de negócios (164–174).
3. Os bots são heurísticos. Um humano otimizando pode encontrar linhas melhores, especialmente combinando território com negócios no mesmo bairro. [H]
4. A estratégia de gangue termina com pouco dinheiro (cerca de R$ 540): a manutenção consome a renda. É intencional como custo, mas pode desanimar. [H] Precisa de teste com pessoas.
5. Não houve teste com jogadores reais, nem em Safari/iOS ou Firefox; só Chromium.
6. A acessibilidade (leitor de tela) foi tratada só no básico: `aria-live`, `aria-current` e rótulos.
7. A sincronização entre abas recarrega o estado, mas não resolve edições simultâneas.
8. O caso extremo em que o `localStorage` fica cheio foi tratado com aviso, mas não foi simulado.
