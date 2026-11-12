# Validação — Submundo Brasil v0.7

Tudo abaixo foi **executado** neste ambiente (Node.js + Chromium/Playwright).
Para reproduzir: `npm test` (build + motor + fuzz + interface), `npm run simulate`
e `npm run careers`.

Os testes de motor, fuzz e simulação carregam o motor **de dentro do HTML
entregue** (`<script id="sb-engine">`), não de uma cópia.

## 1. Testes do motor — `tests/engine.test.js`

**85 de 85 passaram** (v0.7; 17 novos sobre equipamentos, mercadorias, produção, remessas, blitz e noite). Cenários cobertos:

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

**67 de 67 verificações passaram** (v0.7: inclui Cidade, Feira do Rolo, Galpão, noite e Perfil), com **0 erros de console**:

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

Bots com estratégias fixas jogam temporadas completas. Resultado da **v0.7** em
`node tests/simulate.js 300 2` (300 temporadas por estratégia, médias, em Recife):

| Estratégia | Patrimônio | Respeito | Pontos | Meta | Detenções |
|---|---|---|---|---|---|
| Operador farmando missões | 16.722 | 135 | 210 | 50% | 2,7 |
| Empreendedor com negócios | 18.881 | 119 | 205 | 60% | 2,7 |
| Articulador territorial | 628 | 132 | 206 | 100% | 1,6 |
| Articulador diplomata | 1.544 | 104 | 214 | 90% | 2,9 |
| Bonde (gangue) | 592 | 95 | 162 | 30% | 1,1 |
| **Comerciante (Galpão, produção, remessas)** | 12.426 | 121 | 209 | 20% | 2,8 |
| Operador com arsenal e noite | 15.552 | 123 | 185 | 30% | 3,0 |
| **Exploit: repetir a melhor e depositar tudo** | 2.056 | 46 | **27** | 0% | **11,0** |
| Aleatório | 572 | 50 | 56 | 0% | 0,9 |

Leitura:
- Seis estratégias focadas ficam entre 162 e 214 pontos: há **vários caminhos de vitória**, agora incluindo o comércio.
- **Calibração do comércio (v0.7):** na primeira medição o comerciante fazia 74 pontos. A margem de venda era de 10% e os preços variavam pouco. Foram ajustados margem (5%), oscilação (60–150%), preço do comprador de fora (1,9×), produção, e criada a categoria Comércio; o patrimônio passou a contar equipamentos e produção.
- **A noite e o arsenal não dominam:** o robô que usa os dois faz 185 pontos, menos que o farm simples (210), porque gasta dinheiro. São escolhas, não obrigação. [H] Um humano pode usá-los melhor que o robô.
- O exploit da 0.4 continua a pior estratégia.

### Especializações — `tests/careers.js` (150 temporadas por célula, v0.7)

| Estratégia | Operador | Articulador | Empreendedor |
|---|---|---|---|
| Missões | **202** | 191 | 172 |
| Negócios | **213** | 186 | 211 |
| Território | 204 | **205** | 201 |
| Diplomacia | 199 | **217** | 175 |
| Gangue | 171 | **189** | 154 |

### Cidades (medido na v0.6; não refeito na v0.7)

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
