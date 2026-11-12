# Validação — Submundo Brasil v1.4

Tudo abaixo foi **executado** neste ambiente (Node.js + Chromium/Playwright).
Para reproduzir: `npm test` (build + motor + fuzz + interface), `npm run simulate`
e `npm run careers`.

Os testes de motor, fuzz e simulação carregam o motor **de dentro do HTML
entregue** (`<script id="sb-engine">`), não de uma cópia.

## 1. Testes do motor — `tests/engine.test.js`

**136 de 136 passaram** (v1.3; 18 novos sobre classes, casas da noite, Termas própria, vício e overdose, desintoxicação, batida, apostas, colete na trocação, respeito perdido na prisão, despachante, calendário e semanas). Cenários cobertos:

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

**96 de 96 verificações passaram** (v1.3: inclui apostar no bicho, tomar soro, usar o despachante e a semana do mês na Rua), com **0 erros de console**:

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

## 3c. Imagens pintadas (v1.4)

- 20 imagens em `art/` (WebP, 880 px de largura nos lugares e assaltos, 288 px nos retratos; 10 a 91 KB cada, 1,05 MB no total). O HTML passou de ~0,7 MB para ~1,75 MB.
- `npm test` repetido com as imagens embutidas: 136/136 no motor, fuzz sem erros, 96/96 na interface, sem rolagem horizontal a 360 px.
- Capturas `tests/screens/v14-*.png` revisadas: Cidade, Duelos e Assaltos. Zé Marrento, Agência, Transportadora e Apostas seguem em SVG até as imagens chegarem.
- Nenhuma regra mudou: as tabelas de simulação abaixo são as da v1.3.

## 4. Simulação de balanceamento — `tests/simulate.js`

Bots com estratégias fixas jogam temporadas completas. Resultado da **v1.3** em
`node tests/simulate.js 300 2` (300 temporadas por estratégia, médias, em Recife):

| Estratégia | Patrimônio | Respeito | Pontos | Meta | Detenções |
|---|---|---|---|---|---|
| Assaltante farmando roubos | 15.286 | 133 | 194 | 50% | 2,8 |
| Bicheiro com negócios | 19.393 | 110 | 197 | 60% | 3,2 |
| Articulador territorial | 632 | 126 | 202 | 100% | 1,5 |
| Articulador diplomata | 1.710 | 100 | 214 | 90% | 2,5 |
| Bonde (gangue) | 1.311 | 103 | 179 | 30% | 1,2 |
| Comerciante sem a classe | 11.167 | 104 | 158 | 10% | 3,2 |
| Ciclo completo: roubo, noite e arsenal | 16.806 | 122 | 188 | 40% | 3,1 |
| Brigão (duelos) | 15.854 | 153 | 194 | 0% | 1,9 |
| Bando de assaltos | 2.270 | 85 | 170 | 30% | 1,2 |
| **Traficante (Galpão e remessas)** | 14.275 | 105 | **226** | 30% | 2,8 |
| **Barão da Noite (império e noitadas)** | 16.599 | 112 | 180 | 40% | 3,5 |
| **Apostador (metade do caixa na roleta, 3× ao dia)** | 5.258 | 84 | **77** | 20% | 3,6 |
| **Exploit: repetir a melhor e depositar tudo** | 2.402 | 39 | **25** | 0% | **10,6** |
| Aleatório | 404 | 43 | 48 | 0% | 0,7 |

Leitura e calibração da v1.3:
- **Traficante**: na primeira medição fez 316 pontos (o comerciante sem a classe fazia 172). Foram reduzidos os bônus (produção 10%, comprador +5%, carga +15, remessa 70), criada a desvantagem (mais atenção da polícia nos negócios) e subidas as faixas da medalha de Comércio (4.000 / 9.000 / 16.000). Medições intermediárias: 262, 251, 235, 226. **Continua o caminho mais forte**, 12 pontos acima do segundo.
- **Barão da Noite**: começou em 143. Bar e Casa de Shows passaram a contar como casas da noite, o bônus foi a +50%, a noitada a −40%, e cada saída dá +1 de respeito. Resultado: 180.
- **Apostas não são renda**: o apostador faz 77 pontos. Um teste separado mostra a banca com vantagem em 10 mil apostas de cada jogo.
- As estratégias que não usam as mecânicas novas mudaram pouco (até 16 pontos), puxadas pelos dias de pagamento, pela perda de respeito na prisão e pelo dano maior nos roubos armados.

### Classes — `tests/careers.js` (100 temporadas por célula, v1.3)

| Estratégia | Assaltante | Articulador | Bicheiro | Traficante | Barão |
|---|---|---|---|---|---|
| Roubos | 177 | **184** | 152 | 153 | 155 |
| Negócios | 189 | 173 | **208** | 149 | 202 |
| Território | 198 | **203** | 195 | 196 | 197 |
| Diplomacia | 185 | **211** | 160 | 158 | 170 |
| Gangue | **191** | 176 | 146 | 161 | 167 |

(O Traficante só brilha na estratégia de mercadoria, medida na tabela acima.)

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
