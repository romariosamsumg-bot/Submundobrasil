# Validação — Submundo Brasil v0.5

Tudo abaixo foi **executado** neste ambiente (Node.js + Chromium/Playwright).
Para reproduzir: `npm test` (build + motor + fuzz + interface), `npm run simulate`
e `npm run careers`.

Os testes de motor, fuzz e simulação carregam o motor **de dentro do HTML
entregue** (`<script id="sb-engine">`), não de uma cópia.

## 1. Testes do motor — `tests/engine.test.js`

**56 de 56 passaram.** Cenários cobertos:

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

**42 de 42 verificações passaram**, com **0 erros de console**:

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

Bots com estratégias fixas jogam temporadas completas. Resultado de
`node tests/simulate.js 300 2` (300 temporadas por estratégia, médias):

| Estratégia | Patrimônio | Respeito | Pontos | Meta | Detenções | Destaque |
|---|---|---|---|---|---|---|
| Operador farmando missões | 15.652 | 130 | 196 | 40% | 2,7 | Fortuna e fama |
| Empreendedor com negócios | 18.588 | 119 | 201 | 50% | 2,7 | Fortuna (1,7 medalha) |
| Articulador territorial | 603 | 132 | 206 | 100% | 1,6 | Território (prata, 28 dias) |
| Articulador diplomata | 1.647 | 107 | 224 | 90% | 2,7 | Diplomacia |
| Bonde (gangue) | 543 | 95 | 174 | 40% | 1,0 | Gangue (1,6 medalha) |
| **Exploit: repetir a melhor e depositar tudo** | 1.949 | 46 | **27** | 0% | **11,1** | — |
| Aleatório | 541 | 46 | 49 | 0% | 1,0 | — |

Leitura:
- As cinco estratégias focadas ficam entre 174 e 224 pontos: há **vários caminhos de vitória**.
- O exploit E1 + E6 da 0.4 agora é a pior estratégia: a fadiga, a vigilância local e a taxa bancária fecham a brecha.
- Durante a calibração, a diplomacia chegou a 287 pontos (ouro em todas as temporadas). Isso foi corrigido com custo crescente das tréguas, carência, desgaste da relação e trégua como compromisso.

### Especializações — `tests/careers.js` (200 temporadas por célula)

| Estratégia | Operador | Articulador | Empreendedor |
|---|---|---|---|
| Missões | 188 | **194** | 171 |
| Negócios | 199 | 174 | **206** |
| Território | 202 | **206** | 198 |
| Diplomacia | 194 | **225** | 170 |
| Gangue | **178** | **178** | 151 |

## 5. Limitações conhecidas (honestas)

1. **O Articulador é um generalista um pouco forte**: vence por pouco no farm de missões (194 contra 188 do Operador), porque ganha dias de território "de graça" com notícias. O Operador não tem uma estratégia em que vença com folga. Ajuste sugerido em NEXT_STEPS.
2. O Empreendedor é fraco fora da estratégia de negócios (151–171).
3. Os bots são heurísticos. Um humano otimizando pode encontrar linhas melhores, especialmente combinando território com negócios no mesmo bairro. [H]
4. A estratégia de gangue termina com pouco dinheiro (cerca de R$ 540): a manutenção consome a renda. É intencional como custo, mas pode desanimar. [H] Precisa de teste com pessoas.
5. Não houve teste com jogadores reais, nem em Safari/iOS ou Firefox; só Chromium.
6. A acessibilidade (leitor de tela) foi tratada só no básico: `aria-live`, `aria-current` e rótulos.
7. A sincronização entre abas recarrega o estado, mas não resolve edições simultâneas.
8. O caso extremo em que o `localStorage` fica cheio foi tratado com aviso, mas não foi simulado.
