# Validação — Submundo Brasil v1.5

Tudo abaixo foi **executado** neste ambiente (Node.js + Chromium/Playwright).
Para reproduzir: `npm test` (build + motor + fuzz + interface), `npm run simulate`
e `npm run careers`.

Os testes de motor, fuzz e simulação carregam o motor **de dentro do HTML
entregue** (`<script id="sb-engine">`), não de uma cópia.

## 1. Testes do motor — `tests/engine.test.js`

**178 de 178 passaram** (v1.5: + 2 sobre equipamento nos roubos e veículo de fuga; + 1 sobre a conta da luta; + 3 sobre itens que são seus e a ficha da temporada; + 14 sobre o relógio do online; + 2 sobre o começo do zero e os preços da Feira; + 4 sobre a trilha de compra; v1.4: + retrato do jogador; + 4 sobre as quatro classes; + 2 sobre tolerância e teto do corpo; + 9 sobre doses, casas da noite, estoque, azia, sete esquemas, gatonet, propina, casa abastecida e pó no Navio) (v1.3; 18 novos sobre classes, casas da noite, Termas própria, vício e overdose, desintoxicação, batida, apostas, colete na trocação, respeito perdido na prisão, despachante, calendário e semanas). Cenários cobertos:

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

**128 de 128 verificações passaram** (v1.4: escolha de retrato no Perfil; topo com Procurado e Vício; Rua com a ficha da temporada) (v1.3: inclui apostar no bicho, tomar soro, usar o despachante e a semana do mês na Rua), com **0 erros de console**:

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

- 24 imagens de cena e adversário, 5 bairros (v1.5, 79 a 101 KB), 10 retratos do jogador, 27 itens da Feira, 18 roubos, 5 casas da noite e 7 esquemas (v1.5, cortados de grades por `tools/cortar-grade.py`, pelas bordas ou pelas faixas de fundo, com quadro vazio deduzido pelo passo da grade, 192 px), mais a cadeia e a capa (880 px) e os 18 grupos rivais (3 por cidade). São 116 imagens e o HTML está com cerca de 3,9 MB. (256 px, 9 a 17 KB) em `art/` (WebP, 880 px de largura nos lugares e assaltos, 288 px nos retratos; 10 a 91 KB cada). O HTML passou de ~0,7 MB para ~3 MB.
- `npm test` repetido com as imagens embutidas: 136/136 no motor, fuzz sem erros, 96/96 na interface, sem rolagem horizontal a 360 px.
- Capturas `tests/screens/v14-*.png` revisadas: Cidade, Duelos e Assaltos. As 4 últimas (Zé Marrento, Agência, Transportadora, Apostas) entraram depois e foram conferidas nas capturas de Apostas e Duelos.
- Nenhuma regra mudou: as tabelas de simulação abaixo são as da v1.3.

## 3d. Online (v1.5)

- `tests/online.test.js` (10 testes; v1.5: criação com a ficha completa e troca de vulgo): o servidor usa o mesmo motor; codinome e cidade validados; ação recusada não grava; ação ou argumento estranho (`__proto__`, objeto, infinito, texto longo) é barrado; save adulterado no banco é normalizado; fim de temporada troca o estado.
- Interface com servidor simulado (8 verificações): cadastro, criação do personagem com R$ 0, roubo calculado pelo servidor, nada salvo no aparelho, ranking no Perfil, sair e entrar de novo.
- No projeto real: a função recusa quem não entrou (401), o ranking responde e ninguém lê a tabela de saves sem login (regras de acesso do banco).
- **Relógio (fase 1b)**: 14 testes no motor (energia a cada 3 min, tempo que não anda para trás, Procurado e vício pelo tempo, cadeia em horas, virada à meia-noite de Brasília, ausência de dias e de meses, fim do mês, ir pra casa, argumentos forjados em Dormir e Encerrar temporada, relógio adulterado no save); `tests/online.test.js` com 8 testes (a hora é sempre a do servidor); interface com servidor simulado, incluindo ir pra casa e voltar 3 horas depois.
- **Teste real com o relógio** (função versão 2): personagem criado no dia 13 do mês 2026-11, três roubos pelo servidor em 1,0 a 1,4 s cada (medido de fora do Brasil), faixa do dia com "O dia vira em 16 h 7 min", ir pra casa e sair, ranking do mês. Conta de teste apagada. **Não testado de verdade**: a virada da meia-noite e a do mês no servidor (só nos testes, com a hora simulada).
- **Teste real de ponta a ponta** (confirmação de e-mail desligada pelo autor): conta criada, personagem com R$ 0, roubo calculado pelo servidor (1,2 s na primeira chamada), ranking com o jogador em 1º e continuação após recarregar a página. A conta de teste foi apagada em seguida.

## 3e. Site no ar (GitHub Pages)

- `https://romariosamsumg-bot.github.io/Submundobrasil/` responde 200 e entrega exatamente o último build.
- Teste real pelo site: conta criada, ficha (retrato, vulgo, classe), roubo calculado pelo servidor em 1,5 s (medido de fora do Brasil), ranking com o jogador. Conta de teste apagada; o banco ficou com 0 jogadores.

## 4. Simulação de balanceamento — `tests/simulate.js`

Bots com estratégias fixas jogam temporadas completas. Resultado da **v1.5** (começo do zero, preços novos da Feira, trilha de compra, quatro classes, noite com cardápio, sete esquemas, tolerância e teto do corpo) em
`node tests/simulate.js 300 2` (300 temporadas por estratégia, médias, em Recife):

| Estratégia | Patrimônio | Respeito | Pontos | Meta | Detenções |
|---|---|---|---|---|---|
| Assaltante farmando roubos | 7.199 | — | 178 | 40% | 3,4 |
| Bicheiro com negócios | 10.446 | — | 220 | 70% | 2,9 |
| Território (Bicheiro) | 719 | — | 202 | 100% | 1,9 |
| Diplomacia (Bicheiro) | 1.098 | — | 168 | 80% | 2,4 |
| Bonde (gangue) | 1.260 | — | 172 | 20% | 1,6 |
| Comerciante sem a classe | 8.746 | — | 243 | 60% | 2,9 |
| Ciclo completo: roubo, noite e arsenal | 8.908 | — | 188 | 40% | 3,7 |
| **Brigão (duelos)** | 7.939 | — | **207** | 40% | 2,2 |
| **Bando de assaltos** | 2.129 | — | **123** | 0% | 1,7 |
| Traficante (Galpão e remessas) | 8.726 | — | 242 | 60% | 2,7 |
| Dono da Noite (casas e noitadas) | 8.294 | — | 184 | 50% | 3,2 |
| Império da noite (Dono da Noite + produção e casas abastecidas) | 8.264 | — | 214 | 50% | 3,3 |
| Apostador (metade do caixa na roleta, 3× ao dia) | 3.967 | — | 113 | 30% | 2,9 |
| Exploit: repetir a melhor e depositar tudo | 1.785 | — | 30 | 0% | 11,4 |
| Aleatório | 240 | — | 25 | 0% | 0,7 |

Leitura da v1.5 (equipamento nos roubos):
- Só com o peso do equipamento, os caminhos de roubo subiram cerca de 30 pontos e o comerciante quase 40. As dificuldades subiram pela metade do equipamento esperado em cada degrau, e os robôs passaram a comprar proteção e veículo (antes só armas). O dinheiro que vira equipamento baixou o patrimônio; Fortuna e a meta Patrimônio caíram cerca de 10%.
- Resultado: quase todos a até 11 pontos de antes; Brigão subiu de 183 para 207 (duelo é onde arma e proteção mais pesam). O ritmo da Feira (`npm run ritmo`) não mudou. Os patrimônios desta tabela já são com Fortuna nova.

Leitura da v1.5 (itens são seus, sem devolução na troca):
- Preços recalculados para o custo de subir a trilha ficar igual; o ritmo da Feira (`npm run ritmo`) ficou o mesmo, arma a arma.
- O robô de compra passou a somar o caminho inteiro da prateleira (antes olhava só o preço da arma desejada e, sem devolução, gastava o caixa). Comparando com o motor anterior e o robô anterior: a maioria ficou igual (±5); quem rouba perdeu cerca de 12 (Assaltante 195 → 183, ciclo completo 202 → 189), porque o patrimônio conta só o que está em uso e a arma em uso agora custa menos. Contar todos os itens guardados foi testado e exagerou (+16 a +46, cruzando a meta de R$ 10.000), por isso ficou de fora.
- Dono da Noite subiu (173 → 186); Bando de assaltos continua o mais fraco (122).

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
| Roubos | **189** | 126 | 129 | 135 |
| Negócios | **252** | 215 | 189 | 220 |
| Território | **205** | 202 | 198 | 201 |
| Diplomacia | **199** | 162 | 166 | 174 |
| Gangue | 163 | 149 | 151 | **164** |

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
