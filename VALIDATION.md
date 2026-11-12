# Validação — Submundo Brasil v1.2

Tudo abaixo foi **executado** neste ambiente (Node.js + Chromium/Playwright).
Para reproduzir: `npm test` (build + motor + fuzz + interface), `npm run simulate`
e `npm run careers`.

Os testes de motor, fuzz e simulação carregam o motor **de dentro do HTML
entregue** (`<script id="sb-engine">`), não de uma cópia.

## 1. Testes do motor — `tests/engine.test.js`

**118 de 118 passaram** (v1.2; 4 novos sobre fases, lugares trancados, arma liberando roubo e vantagens de ser dono do Bar e da Casa de Shows; 3 antigos atualizados para as regras novas). Cenários cobertos:

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

**90 de 90 verificações passaram** (v1.2: abas na ordem do ciclo, fase na barra, lugares trancados para o iniciante, Perfil pelo retrato), com **0 erros de console**:

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

Bots com estratégias fixas jogam temporadas completas. Resultado da **v1.2** em
`node tests/simulate.js 300 2` (300 temporadas por estratégia, médias, em Recife):

| Estratégia | Patrimônio | Respeito | Pontos | Meta | Detenções |
|---|---|---|---|---|---|
| Operador farmando roubos | 14.744 | 138 | 196 | 50% | 2,8 |
| Empreendedor com negócios | 15.718 | 114 | 172 | 30% | 3,1 |
| Articulador territorial | 711 | 129 | 205 | 100% | 1,6 |
| Articulador diplomata | 1.768 | 105 | 211 | 90% | 2,6 |
| Bonde (gangue) | 1.351 | 104 | 178 | 30% | 1,3 |
| Comerciante (Galpão, produção, remessas) | 11.274 | 110 | 175 | 10% | 3,1 |
| **Ciclo completo: roubo, noite e arsenal** | 16.781 | 132 | 197 | 50% | 3,1 |
| Brigão (arsenal, duelos, hospital) | 15.583 | 155 | 194 | 0% | 1,8 |
| Bando de assaltos | 2.375 | 88 | 178 | 40% | 1,4 |
| **Exploit: repetir a melhor e depositar tudo** | 2.479 | 51 | **31** | 0% | **10,4** |
| Aleatório | 438 | 44 | 49 | 0% | 0,7 |

Leitura e calibração da v1.2:
- Com "arma libera roubo" sozinha, os caminhos de roubo caíram de ~205 para ~160: a arma custava e não rendia. Duas medições intermediárias mostraram que comprar a arma mais cara possível piorava (156) e comprar só a necessária ajudava pouco (175).
- Correção de regra: roubo armado paga +15% e arma acima do mínimo dá até +10 de chance; os dois roubos do topo passaram a pedir poder 7 e 9.
- Resultado: nove estratégias entre **172 e 211** (antes 166 a 217). O robô que segue o ciclo completo (roubar, noite, arsenal) faz 197, empatado com o farm puro (196); antes ficava atrás (194 contra 202).
- Os robôs foram atualizados para comprar a arma mais barata que destrava o próximo roubo, sacando do banco se preciso.
- Empreendedor e Comerciante são agora os caminhos mais fracos (172 e 175).

### Especializações — `tests/careers.js` (150 temporadas por célula, v1.2)

| Estratégia | Operador | Articulador | Empreendedor |
|---|---|---|---|
| Roubos | 180 | **183** | 164 |
| Negócios | 175 | 157 | **181** |
| Território | 202 | **205** | 203 |
| Diplomacia | 189 | **215** | 160 |
| Gangue | **177** | 173 | 168 |

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
