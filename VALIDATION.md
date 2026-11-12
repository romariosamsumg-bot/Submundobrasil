# Validação — Submundo Brasil v1.4

Tudo abaixo foi **executado** neste ambiente (Node.js + Chromium/Playwright).
Para reproduzir: `npm test` (build + motor + fuzz + interface), `npm run simulate`
e `npm run careers`.

Os testes de motor, fuzz e simulação carregam o motor **de dentro do HTML
entregue** (`<script id="sb-engine">`), não de uma cópia.

## 1. Testes do motor — `tests/engine.test.js`

**152 de 152 passaram** (v1.4: + retrato do jogador; + 4 sobre as quatro classes; + 2 sobre tolerância e teto do corpo; + 9 sobre doses, casas da noite, estoque, azia, sete esquemas, gatonet, propina, casa abastecida e pó no Navio) (v1.3; 18 novos sobre classes, casas da noite, Termas própria, vício e overdose, desintoxicação, batida, apostas, colete na trocação, respeito perdido na prisão, despachante, calendário e semanas). Cenários cobertos:

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

**102 de 102 verificações passaram** (v1.4: escolha de retrato no Perfil; topo com Procurado e Vício; Rua com a ficha da temporada) (v1.3: inclui apostar no bicho, tomar soro, usar o despachante e a semana do mês na Rua), com **0 erros de console**:

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

- 24 imagens de cena e adversário mais 10 retratos do jogador (256 px, 9 a 17 KB) em `art/` (WebP, 880 px de largura nos lugares e assaltos, 288 px nos retratos; 10 a 91 KB cada). O HTML passou de ~0,7 MB para ~2,3 MB.
- `npm test` repetido com as imagens embutidas: 136/136 no motor, fuzz sem erros, 96/96 na interface, sem rolagem horizontal a 360 px.
- Capturas `tests/screens/v14-*.png` revisadas: Cidade, Duelos e Assaltos. As 4 últimas (Zé Marrento, Agência, Transportadora, Apostas) entraram depois e foram conferidas nas capturas de Apostas e Duelos.
- Nenhuma regra mudou: as tabelas de simulação abaixo são as da v1.3.

## 4. Simulação de balanceamento — `tests/simulate.js`

Bots com estratégias fixas jogam temporadas completas. Resultado da **v1.4** (quatro classes, noite com cardápio, sete esquemas, tolerância e teto do corpo) em
`node tests/simulate.js 300 2` (300 temporadas por estratégia, médias, em Recife):

| Estratégia | Patrimônio | Respeito | Pontos | Meta | Detenções |
|---|---|---|---|---|---|
| Assaltante farmando roubos | 16.243 | 141 | 210 | 60% | 3,3 |
| Bicheiro com negócios | 20.325 | 118 | 213 | 60% | 3,4 |
| Território (Bicheiro) | 714 | 125 | 199 | 100% | 1,8 |
| Diplomacia (Bicheiro) | 1.350 | 96 | 173 | 90% | 2,6 |
| Bonde (gangue) | 1.299 | 100 | 167 | 20% | 1,7 |
| Comerciante sem a classe | 13.297 | 104 | 211 | 20% | 3,2 |
| Ciclo completo: roubo, noite e arsenal | 18.687 | 130 | 201 | 50% | 3,8 |
| Brigão (duelos) | 18.066 | 158 | 210 | 0% | 2,3 |
| Bando de assaltos | 2.785 | 93 | 192 | 40% | 1,5 |
| **Traficante (Galpão e remessas)** | 13.810 | 94 | **225** | 20% | 2,7 |
| Dono da Noite (casas e noitadas) | 16.986 | 114 | 184 | 40% | 3,4 |
| **Império da noite (Dono da Noite + produção e casas abastecidas)** | 16.971 | 104 | **226** | 40% | 3,4 |
| Apostador (metade do caixa na roleta, 3× ao dia) | 7.393 | 94 | 92 | 30% | 3,5 |
| Exploit: repetir a melhor e depositar tudo | 2.007 | 37 | 23 | 0% | 11,5 |
| Aleatório | 419 | 42 | 38 | 0% | 0,7 |

Leitura e calibração da v1.4:
- **Quatro classes**: com os números propostos, o Traficante foi a 243 e o império da noite a 247 (os demais perto de 210). O Navio do Traficante caiu de +15% para +10% e a casa abastecida de +100% para +70%: **225** e **226**, 12 pontos acima do grupo seguinte. Os robôs de território e diplomacia, que eram do Articulador, jogam de Bicheiro; a diplomacia perdeu força (173), e o bonde caiu para 167.
- **Noite com cardápio**: as estratégias que usam a noite ficaram onde estavam (ciclo completo 188, Barão 178). O vício continua sendo o freio: uma bala dá 75 de energia e 18 de vício, e acima de 70 as doses fortes podem dar overdose.
- **Casa abastecida**: na primeira medição, o império da noite fez **241 pontos**, porque a renda dobrada somava em cima do bônus do Barão. Passou a dobrar só a renda base da casa: **227**, empatado com o Traficante (223) no topo.
- **Comerciante sem a classe** subiu de 158 para 197 com os esquemas baratos (gelo e cigarro). Deixou de ser o caminho mais fraco.
- **Tolerância e teto do corpo** (`node tests/maratona.js`): um jogador com dinheiro infinito, que rouba, se droga e zera o vício na clínica sem parar, fazia **84,9 roubos e 1.313 de energia em drogas por dia**; agora faz **13,6 roubos e 150**. Sem a clínica, caiu de 11,4 para 9,3 roubos por dia. Nos robôs comuns a diferença ficou no ruído (até 6 pontos), porque quase ninguém passa de 150 por dia; o império da noite foi a 233, 13 acima do Traficante.
- A refinaria (R$ 25.000, 150 de respeito) quase não é alcançada numa temporada: é meta de fim de jogo.

### Classes — `tests/careers.js` (100 temporadas por célula, v1.4)

| Estratégia | Assaltante | Dono da Noite | Traficante | Bicheiro |
|---|---|---|---|---|
| Roubos | **215** | 169 | 165 | 171 |
| Negócios | 208 | **219** | 162 | 213 |
| Território | **200** | 197 | 196 | 198 |
| Diplomacia | **196** | 176 | 174 | 163 |
| Gangue | **183** | 148 | 157 | 167 |

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
