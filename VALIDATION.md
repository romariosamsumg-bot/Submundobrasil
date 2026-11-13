# Validação — Submundo Brasil v1.5

Tudo abaixo foi **executado** neste ambiente (Node.js + Chromium/Playwright).
Para reproduzir: `npm test` (build + motor + fuzz + interface), `npm run simulate`
e `npm run careers`.

Os testes de motor, fuzz e simulação carregam o motor **de dentro do HTML
entregue** (`<script id="sb-engine">`), não de uma cópia.

## 1. Testes do motor — `tests/engine.test.js`

**172 de 172 passaram** (v1.5: + 14 sobre o relógio do online; + 2 sobre o começo do zero e os preços da Feira; + 4 sobre a trilha de compra; v1.4: + retrato do jogador; + 4 sobre as quatro classes; + 2 sobre tolerância e teto do corpo; + 9 sobre doses, casas da noite, estoque, azia, sete esquemas, gatonet, propina, casa abastecida e pó no Navio) (v1.3; 18 novos sobre classes, casas da noite, Termas própria, vício e overdose, desintoxicação, batida, apostas, colete na trocação, respeito perdido na prisão, despachante, calendário e semanas). Cenários cobertos:

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

**118 de 118 verificações passaram** (v1.4: escolha de retrato no Perfil; topo com Procurado e Vício; Rua com a ficha da temporada) (v1.3: inclui apostar no bicho, tomar soro, usar o despachante e a semana do mês na Rua), com **0 erros de console**:

- **Nenhum texto cortado** (v1.5): 15 telas nas 6 cidades, com nome de 22 letras, R$ 123.456 e a patente mais longa, mais as páginas de "Como jogar". O detector foi conferido contra a versão anterior, onde acusou o corte do topo.
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

- 24 imagens de cena e adversário, 5 bairros (v1.5, 79 a 101 KB), 10 retratos do jogador e 27 itens da Feira (v1.5, cortados de 3 grades pelas bordas, 192 px, cerca de 100 KB no total) (256 px, 9 a 17 KB) em `art/` (WebP, 880 px de largura nos lugares e assaltos, 288 px nos retratos; 10 a 91 KB cada). O HTML passou de ~0,7 MB para ~3 MB.
- `npm test` repetido com as imagens embutidas: 136/136 no motor, fuzz sem erros, 96/96 na interface, sem rolagem horizontal a 360 px.
- Capturas `tests/screens/v14-*.png` revisadas: Cidade, Duelos e Assaltos. As 4 últimas (Zé Marrento, Agência, Transportadora, Apostas) entraram depois e foram conferidas nas capturas de Apostas e Duelos.
- Nenhuma regra mudou: as tabelas de simulação abaixo são as da v1.3.

## 3d. Online (v1.5)

- `tests/online.test.js` (6 testes): o servidor usa o mesmo motor; codinome e cidade validados; ação recusada não grava; ação ou argumento estranho (`__proto__`, objeto, infinito, texto longo) é barrado; save adulterado no banco é normalizado; fim de temporada troca o estado.
- Interface com servidor simulado (8 verificações): cadastro, criação do personagem com R$ 0, roubo calculado pelo servidor, nada salvo no aparelho, ranking no Perfil, sair e entrar de novo.
- No projeto real: a função recusa quem não entrou (401), o ranking responde e ninguém lê a tabela de saves sem login (regras de acesso do banco).
- **Relógio (fase 1b)**: 14 testes no motor (energia a cada 3 min, tempo que não anda para trás, Procurado e vício pelo tempo, cadeia em horas, virada à meia-noite de Brasília, ausência de dias e de meses, fim do mês, ir pra casa, argumentos forjados em Dormir e Encerrar temporada, relógio adulterado no save); `tests/online.test.js` com 8 testes (a hora é sempre a do servidor); interface com servidor simulado, incluindo ir pra casa e voltar 3 horas depois.
- **Teste real com o relógio** (função versão 2): personagem criado no dia 13 do mês 2026-11, três roubos pelo servidor em 1,0 a 1,4 s cada (medido de fora do Brasil), faixa do dia com "O dia vira em 16 h 7 min", ir pra casa e sair, ranking do mês. Conta de teste apagada. **Não testado de verdade**: a virada da meia-noite e a do mês no servidor (só nos testes, com a hora simulada).
- **Teste real de ponta a ponta** (confirmação de e-mail desligada pelo autor): conta criada, personagem com R$ 0, roubo calculado pelo servidor (1,2 s na primeira chamada), ranking com o jogador em 1º e continuação após recarregar a página. A conta de teste foi apagada em seguida.

## 4. Simulação de balanceamento — `tests/simulate.js`

Bots com estratégias fixas jogam temporadas completas. Resultado da **v1.5** (começo do zero, preços novos da Feira, trilha de compra, quatro classes, noite com cardápio, sete esquemas, tolerância e teto do corpo) em
`node tests/simulate.js 300 2` (300 temporadas por estratégia, médias, em Recife):

| Estratégia | Patrimônio | Respeito | Pontos | Meta | Detenções |
|---|---|---|---|---|---|
| Assaltante farmando roubos | 9.959 | 124 | 195 | 40% | 3,6 |
| Bicheiro com negócios | 13.010 | 119 | 226 | 70% | 3,2 |
| Território (Bicheiro) | 598 | 122 | 203 | 100% | 1,9 |
| Diplomacia (Bicheiro) | 923 | 93 | 160 | 80% | 2,4 |
| Bonde (gangue) | 1.245 | 93 | 171 | 20% | 1,7 |
| Comerciante sem a classe | 10.310 | 105 | 238 | 50% | 3,1 |
| Ciclo completo: roubo, noite e arsenal | 12.825 | 120 | 202 | 40% | 3,9 |
| Brigão (duelos) | 9.589 | 129 | 189 | 20% | 2,8 |
| **Bando de assaltos** | 2.189 | 73 | **130** | 10% | 1,6 |
| **Traficante (Galpão e remessas)** | 9.950 | 87 | **239** | 50% | 2,7 |
| Dono da Noite (casas e noitadas) | 9.297 | 103 | 173 | 50% | 3,6 |
| Império da noite (Dono da Noite + produção e casas abastecidas) | 9.844 | 102 | 215 | 50% | 3,4 |
| Apostador (metade do caixa na roleta, 3× ao dia) | 5.631 | 96 | 106 | 30% | 3,4 |
| Exploit: repetir a melhor e depositar tudo | 1.919 | 36 | 30 | 0% | 11,3 |
| Aleatório | 235 | 33 | 23 | 0% | 0,7 |

Leitura e calibração da v1.5 (economia do começo):
- **Ritmo da Feira** (`npm run ritmo`, jogador que só rouba e compra a próxima arma assim que pode, começando com R$ 0): antes, a 2ª e a 3ª arma saíam no 1º e no 2º roubo, e a 4ª no 5º (presa só pelo respeito). Agora: 1ª no roubo 1, 2ª no 3, 3ª no 8, 4ª no 14 (dia 11), Maquita no dia 18, Três-oitão no 23. Esse jogador não treina e é o caso lento; os robôs completos chegam antes.
- Começo do zero e preços novos, cada um sozinho, tiraram de 20 a 50 pontos; juntos, o patrimônio final caiu cerca de 40% (Assaltante de R$ 16,3 mil para R$ 10 mil). As medalhas de Fortuna e Fama e a meta Patrimônio foram reduzidas na mesma proporção; o Comércio quase não caiu, por isso sua medalha mudou pouco (reduzi-la a 60% deu 266 ao Traficante).
- O roubo armado passou a pagar +25% (antes +15%): Assaltante de 183 para 195 e ciclo completo de 184 para 202.
- **Pendências**: Bando de assaltos caiu de 191 para 130 (fundar, recrutar e armar o líder disputam o pouco dinheiro do começo); Traficante (239) e Comerciante (238) lideram; o Assaltante lidera até na estratégia de negócios (235).

Leitura e calibração da v1.5 (trilha de compra):
- Primeiro a trilha valeu para todas as listas; o autor a reduziu à Feira e aos negócios. Na versão completa, o Assaltante caiu para 181 e precisou do "dobro de respeito na primeira vez" para voltar a 200; sem trilha nos roubos, essa compensação saiu e ele fez **215**.
- Os robôs compram o que falta na prateleira antes do que querem. Traficante (241) e império da noite (236) subiram cerca de 15 pontos e abriram 20 sobre o terceiro (Comerciante 219). Causa provável: os negócios baratos comprados pelo caminho também dão renda e respeito. **Calibração pendente.**

Leitura e calibração da v1.4:
- **Quatro classes**: com os números propostos, o Traficante foi a 243 e o império da noite a 247 (os demais perto de 210). O Navio do Traficante caiu de +15% para +10% e a casa abastecida de +100% para +70%: **225** e **226**, 12 pontos acima do grupo seguinte. Os robôs de território e diplomacia, que eram do Articulador, jogam de Bicheiro; a diplomacia perdeu força (173), e o bonde caiu para 167.
- **Noite com cardápio**: as estratégias que usam a noite ficaram onde estavam (ciclo completo 188, Barão 178). O vício continua sendo o freio: uma bala dá 75 de energia e 18 de vício, e acima de 70 as doses fortes podem dar overdose.
- **Casa abastecida**: na primeira medição, o império da noite fez **241 pontos**, porque a renda dobrada somava em cima do bônus do Barão. Passou a dobrar só a renda base da casa: **227**, empatado com o Traficante (223) no topo.
- **Comerciante sem a classe** subiu de 158 para 197 com os esquemas baratos (gelo e cigarro). Deixou de ser o caminho mais fraco.
- **Tolerância e teto do corpo** (`node tests/maratona.js`; na v1.5, 15,5 roubos por dia com 150 de energia em doses): um jogador com dinheiro infinito, que rouba, se droga e zera o vício na clínica sem parar, fazia **84,9 roubos e 1.313 de energia em drogas por dia**; agora faz **13,6 roubos e 150**. Sem a clínica, caiu de 11,4 para 9,3 roubos por dia. Nos robôs comuns a diferença ficou no ruído (até 6 pontos), porque quase ninguém passa de 150 por dia; o império da noite foi a 233, 13 acima do Traficante.
- A refinaria (R$ 25.000, 150 de respeito) quase não é alcançada numa temporada: é meta de fim de jogo.

### Classes — `tests/careers.js` (100 temporadas por célula, v1.5)

| Estratégia | Assaltante | Dono da Noite | Traficante | Bicheiro |
|---|---|---|---|---|
| Roubos | **186** | 132 | 143 | 154 |
| Negócios | **235** | 221 | 183 | 212 |
| Território | **206** | 200 | 194 | 203 |
| Diplomacia | **192** | 165 | 163 | 167 |
| Gangue | **172** | 157 | 171 | 149 |

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
