# Validação — Submundo Brasil v1.1

Tudo abaixo foi **executado** neste ambiente (Node.js + Chromium/Playwright).
Para reproduzir: `npm test` (build + motor + fuzz + interface), `npm run simulate`
e `npm run careers`.

Os testes de motor, fuzz e simulação carregam o motor **de dentro do HTML
entregue** (`<script id="sb-engine">`), não de uma cópia.

## 1. Testes do motor — `tests/engine.test.js`

**114 de 114 passaram** (v1.0; 9 novos sobre assaltos: requisitos, avulsos, noite de espera, reconhecimento, sucesso e fracasso, prazo, cancelamento e categoria Gangue). Cenários cobertos:

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

**84 de 84 verificações passaram** (v1.1: inclui as cenas dos 8 lugares, a troca de uma imagem pintada só na chave certa e as 23 chaves de arte), com **0 erros de console**:

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

## 3b. Arte (v1.1)

- Build com um arquivo de teste em `art/place-galpao.png`: o Galpão mostrou a imagem e os outros 7 lugares continuaram em SVG (verificado no navegador). O arquivo de teste foi removido depois.
- Capturas `tests/screens/v11-*.png` revisadas a 360 px: as cenas preenchem os cartões e a lista de assaltos não espreme o texto.
- A arte não muda regras: motor, fuzz e simulações são os mesmos da v1.0.

## 4. Simulação de balanceamento — `tests/simulate.js`

Bots com estratégias fixas jogam temporadas completas. Resultado da **v0.9** em
`node tests/simulate.js 300 2` (300 temporadas por estratégia, médias, em Recife):

| Estratégia | Patrimônio | Respeito | Pontos | Meta | Detenções |
|---|---|---|---|---|---|
| Operador farmando missões | 16.334 | 131 | 202 | 40% | 2,7 |
| Empreendedor com negócios | 19.612 | 121 | 214 | 60% | 2,6 |
| Articulador territorial | 563 | 132 | 206 | 100% | 1,6 |
| Articulador diplomata | 1.676 | 105 | 217 | 90% | 2,8 |
| Bonde (gangue) | 593 | 95 | 166 | 30% | 1,0 |
| Comerciante (Galpão, produção, remessas) | 12.210 | 119 | 208 | 20% | 2,9 |
| Operador com arsenal e noite | 16.563 | 128 | 194 | 40% | 3,0 |
| Brigão (arsenal, duelos, hospital) | 15.001 | 139 | 186 | 10% | 2,0 |
| **Bando de assaltos (v1.0)** | 2.321 | 92 | 191 | 40% | 1,2 |
| **Exploit: repetir a melhor e depositar tudo** | 2.236 | 47 | **29** | 0% | **11,0** |
| Aleatório | 620 | 49 | 55 | 0% | 1,0 |

Leitura:
- **Calibração da v0.9:** com os 5 serviços novos nas recompensas propostas, o farm de missões e os negócios subiram para 224 e 233 pontos (o espaço entre as estratégias foi de 56 para 65). Com mais opções, a penalidade por repetir quase sumia. Recompensas e dificuldade dos 5 serviços novos foram reduzidas; o resultado acima é depois do ajuste (166 a 217).
- **Assaltos (v1.0):** um robô que vive de assaltos faz 186 a 191 pontos (duas sementes), contra 166 a 179 da gangue sem assaltos. Faz cerca de 2 assaltos certos e 0,5 errado por temporada e não passa do 2º degrau (o respeito médio dele é 92). As tabelas das outras estratégias não mudaram, porque elas não fazem assaltos.
- O exploit da 0.4 continua a pior estratégia.

### Especializações — `tests/careers.js` (150 temporadas por célula, v0.9; idênticas na v1.0)

| Estratégia | Operador | Articulador | Empreendedor |
|---|---|---|---|
| Missões | **206** | 188 | 174 |
| Negócios | **209** | 174 | 200 |
| Território | 202 | **206** | 200 |
| Diplomacia | 197 | **227** | 166 |
| Gangue | 159 | **166** | 161 |

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
