# Submundo Brasil — Game Design (v0.6)

Documento de referência das mecânicas. Os números aqui são os do código em
`src/engine.js`. Se você mudar um valor no código, atualize este documento.

---

## 1. Auditoria da versão 0.4

Legenda: **[C]** comprovado (reproduzido por teste ou bot), **[I]** comprovado
por leitura do código, **[H]** hipótese ainda não medida.

### 1.1 Críticos (perda de dados e segurança)

| # | Problema | Evidência | Correção na 0.5 |
|---|---|---|---|
| C1 | **XSS por save importado ou editado**: `h.season` (histórico) e `item.day` (registro) eram inseridos no HTML sem escape. | [C] Um `<img onerror>` executou nos dois campos (Playwright, `audit04.js`). | Toda saída passa por `esc()`/`num()`, e `normalizeSave` reconstrói cada campo com o tipo correto e descarta chaves desconhecidas. Teste: `ui.test.js` §4. |
| C2 | **Perda silenciosa do save**: qualquer falha de validação (JSON truncado, um valor fracionado) levava à tela inicial, e o novo jogo sobrescrevia o save antigo. | [C] Um save com `cash: 100.5` foi descartado. | O conteúdo ilegível é copiado para `submundo_brasil_corrupt_backup`, a tela inicial avisa o motivo e oferece download. Números fora de faixa são **limitados** em vez de rejeitados. |
| C3 | Sem backup antes de migração. | [I] | O save original da 0.4 é guardado em `submundo_brasil_v04_backup`, com botão para baixar. |
| C4 | Duas abas abertas sobrescreviam o progresso uma da outra. | [I] | Escuta o evento `storage` e recarrega o estado da outra aba. [H] Edição simultânea nas duas abas ainda prevalece a última gravação. |

### 1.2 Bugs e inconsistências

| # | Problema | Evidência |
|---|---|---|
| B1 | Era possível comprar negócios, melhorar a sede e fundar gangue **detido**. | [C] Compra do bar com `jail: 2`. |
| B2 | Tensão das facções nunca diminuía naturalmente; a relação nunca voltava ao padrão. | [I] |
| B3 | O "rival" de cada bairro só crescia (+2 a 5 por dia, aleatório) e não havia disputa entre facções. | [I] |
| B4 | Meta **Patrimônio** contava negócios pelo preço de compra: comprar era "gratuito" para a meta. | [I] |
| B5 | "Avançar dia" sem confirmação: um toque acidental desperdiçava 100 de energia. | [I] |
| B6 | Energia e vigilância apareciam duplicadas no painel. | [I] |
| B7 | `confirm()` nativo era a única confirmação; não havia resumo do dia. | [I] |

### 1.3 Economia e exploração

| # | Problema | Evidência |
|---|---|---|
| E1 | **Banco sem custo** anulava o risco: depositar tudo após cada ação tornava as falhas inofensivas (perda de 12% do caixa **em mãos**). | [C] Bot "missões + banco": até R$ 29.251 em uma temporada, com caixa sempre 0. |
| E2 | **Astúcia dominava**: peso 1,7 na fórmula única de missões; Força, Lábia e Influência quase não importavam para ganhar dinheiro. | [I] |
| E3 | Operação coletiva sem limite diário e sem efeito no território: repetível até acabar a energia. | [I] |
| E4 | "Criar contatos" sem limite: R$ 180 por +12 de influência, e +2 de respeito por uso, permitia comprar o controle de um bairro em 2 dias. | [I] |
| E5 | Negócios com retorno em cerca de 15 dias e nenhum risco: comprar todos cedo era sempre a melhor escolha. | [I] |
| E6 | Repetir a missão mais lucrativa não tinha penalidade além da vigilância global. | [I] |
| E7 | Alta variância: o mesmo bot terminou entre R$ 7.392 e R$ 24.431. | [C] 2 temporadas por estratégia, número pequeno. |

### 1.4 Profundidade e integração

- **Facções** só diferiam por um número (`temperament`). Não tinham objetivo, força, memória nem decisões próprias.
- **Bairros** eram estáticos (bônus e risco fixos); liderar dava só +12% nas missões.
- **Eventos** eram 6 textos com ±% de um dia, sem relação com a ambientação brasileira.
- **Carreiras** eram passivas fixas, sem progressão dentro da temporada.
- **Temporada**: o "ranking" era só o histórico; a vitória era medida por dinheiro e respeito.
- Missões, facções, negócios e bairros **não se afetavam** entre si.

### 1.5 O que estava bom e foi preservado

Interface por cliques, as 6 telas e a navegação inferior no celular, a estética
(serifas, tons terrosos, sem neon), o ciclo de 30 dias, a meta de temporada, as
notícias com escolhas, tréguas, ânimo e manutenção da equipe, a exportação em
JSON e o caráter fictício e abstrato das ações.

---

## 2. Princípios de design da 0.5

1. **Toda vantagem tem custo**: proteger dinheiro custa taxa, liderar bairros atrai vigilância e facções, alianças têm contribuição diária, e romper acordos derruba a confiança de todos.
2. **Diversidade obrigatória por regra, não por limite artificial**: repetir a mesma missão e insistir no mesmo bairro piora chance e recompensa (fadiga e vigilância local). O jogador é recompensado por variar.
3. **Sistemas conectados**: uma missão no Cais aumenta a vigilância local, irrita a Frente dos Armazéns, pode gerar retaliação contra seu negócio no Cais e muda a economia do bairro.
4. **Várias formas de vencer**: a temporada é pontuada em 5 categorias.
5. **IA compreensível**: cada facção registra seu último movimento com o motivo ("aproveitando sua ausência", "ao perceber sua fragilidade").

---

## 3. Personagem e especializações

Atributos: **Astúcia, Força, Lábia, Influência**. Cada missão usa um atributo principal:

```
preparo = atributo_principal × 2 + soma_dos_atributos × 0,4 + nível_da_sede × 1,5
chance  = 72 + (preparo − dificuldade) × 2 − vigilância × 0,35 − vigilância_local × 0,3
          − risco_do_bairro − risco_dos_eventos − 6 × repetições_hoje + carreira + dica
          (limitada a 8–95%)
```

Treino: +2 pontos (+1 acima de 25), 22 de energia, custo `250 + 40·nível + 1,2·nível²`,
no máximo **3 por dia**. Missões bem-sucedidas têm 30% de chance de dar +1 no
atributo usado.

### Especializações (escolha por temporada)

| | Passiva | Desvantagem | Nível 1 (10 XP) | Nível 2 (25 XP) | Nível 3 (45 XP) |
|---|---|---|---|---|---|
| **Operador** | +6 de chance; +8% de recompensa em serviços grandes (dificuldade ≥ 33); falhas custam 30% menos caixa | vigilância gerada +10%; negócios −10% | Rota de fuga: −15 na detenção | Ritmo de rua: fadiga de repetição pela metade | Sangue frio: vigilância pesa metade; cofre com Astúcia 18 |
| **Articulador** | +30% de influência; +8 em diálogos; +5 em disputas e confrontos | recompensas de missões −10% | Rede de contatos: contatos −30% | Mediador: tréguas de 5 dias, alianças −40% | Voz do bairro: tributo +60%, 50% das retaliações evitadas |
| **Empreendedor** | negócios +25% de renda e −12% de custo | chance nas missões −3 | Contador: taxa bancária 1% | Fornecedores: crises e extorsões pela metade | Sócio oculto: banco rende 0,4%/dia (até R$ 120) |

XP: o Operador ganha com missões (2 nas difíceis); o Articulador com contatos,
diálogos, tréguas, alianças e notícias; o Empreendedor com dias de renda de
R$ 150 ou mais e compras de negócios.

---

## 4. Missões

13 missões: 8 gerais e 5 exclusivas de bairro. Cada uma tem atributo, dificuldade,
energia, faixa de recompensa, vigilância pessoal e local, respeito, chance de
detenção, perda de caixa na falha e atrito com a facção local.

| Missão | Atributo | Desbloqueio | Energia | R$ base | Particularidade |
|---|---|---|---|---|---|
| Serviço suspeito | Astúcia | 0 | 16 | 150–290 | Entrada |
| Rolo na feira | Lábia | 6 resp. | 18 | 190–340 | Pouca vigilância |
| Mercadoria desaparecida | Força | 0 | 23 | 300–560 | |
| Cobrança atrasada | Força | 20 | 26 | 420–740 | |
| Operação no depósito | Astúcia | 32 | 32 | 580–980 | |
| Leilão clandestino | Lábia | 50 + 25 de influência local | 30 | 680–1120 | Exige base no bairro |
| Comboio misterioso | Força | 75 + gangue | 40 | 1050–1750 | |
| O grande cofre | Astúcia | 120 + Astúcia 22 | 52 | 1900–3100 | 1 vez por dia |
| Esquema do camelódromo | Lábia | Centro, 10 | 22 | 330–560 | |
| Carga sem dono | Força | Cais, 15 | 28 | 560–900 | Atrito alto com os Armazéns |
| Favor de vizinhança | Influência | Jardim, 0 | 18 | 90–170 | +4 de influência local |
| Galpão desativado | Astúcia | Industrial, 40 | 36 | 900–1500 | Vigilância local +16 |
| Bastidores do baile | Lábia | Vila, 12 | 22 | 300–520 | +25% em dias de festa |

**Recompensa** = sorteio × (1 + bônus do bairro + eventos + 12% se você lidera + 10% em território aliado) × economia local × (1 − 12% por repetição no dia, mínimo 50%).

**Falha**: perde uma % do caixa **em mãos**, ganha vigilância extra e pode ser detido.
A chance de detenção é `base + vigilância × 0,3 + vigilância_local × 0,15 − olheiros − perk`.
A detenção dura 1 a 3 dias (+1 com vigilância ≥ 70) e pode ser encerrada com
**fiança** (`250 + 250 × dias + 1,5 × respeito`).

**Respeito decrescente**: missões com desbloqueio 90 ou mais pontos abaixo do seu
respeito rendem 1/3 do respeito.

Alternativas seguras: **Bico** (28 de energia, R$ 110–170, −4 de vigilância) e
**Ficar na sua** (18 de energia, −20 de vigilância pessoal e −10 local).

---

## 5. Bairros e território

Cada bairro tem **economia** (60–140%, flutua diariamente e reage a eventos e
conflitos), **vigilância local** (sobe com missões, operações e confrontos; cai 10
por dia) e **presença de cada facção** (0–100).

**Liderar** = sua influência ≥ 60 e ≥ maior presença + 10.

| Bairro | Bônus / risco | Tributo/dia | Vantagem de liderar |
|---|---|---|---|
| Centro Antigo | 0 / 0 | 110 | Diálogos +8; contatos −20% |
| Cais do Norte | +15% / +5 | 140 | Operações coletivas +20% |
| Jardim União | −10% / −4 | 70 | Recrutar −25%; ânimo +2/dia |
| Distrito Industrial | +28% / +10 | 160 | Todos os negócios +12% |
| Vila das Palmeiras | +4% / −2 | 90 | Vigilância −5 extras por dia |

**Custos de liderar**: cada bairro liderado soma +2 de vigilância por dia, as
facções o consideram alvo valioso, e sua influência cai 1 por dia nos bairros
onde você não está.

**Ações de influência**: *Criar contatos* (R$ 180, 22 de energia, até 2 por bairro
ao dia, o segundo rende metade) e *Disputar área* (R$ 320, 33 de energia, exige 20
de influência, bloqueada por acordo, chance baseada em Influência, sede,
negociadores, vigilância e força da facção).

---

## 6. Economia

| Item | 0.4 | 0.5 | Motivo |
|---|---|---|---|
| Depósito | grátis | taxa de 3% (1% com perk) | Proteger dinheiro passa a ser uma decisão (E1) |
| Negócios | retorno em ~15 dias, sem risco | retorno em ~18–19 dias; renda × economia × eventos × facções; revenda a 60% | E5 e B4 |
| Contatos | ilimitados, +2 de respeito | 2 por bairro ao dia, +1 de respeito | E4 |
| Operação coletiva | ilimitada | 1 por dia, mínimo de 2 integrantes | E3 |
| Treino | linear | superlinear, 3 por dia | Evita disparo dos atributos com caixa alto |
| Manutenção da equipe | R$ 25/integrante | R$ 20 + R$ 8 × nível | Integrantes melhores custam mais |
| Tributo | — | por bairro liderado | Recompensa territorial em dinheiro |
| Sociedades (notícia) | — | R$ 800 → R$ 95/dia por 10 dias | Investimento de prazo médio |

Negócios ficam num bairro: Bar (Vila), Oficina (Jardim), Mercadinho (Centro),
Depósito de Logística (Industrial, **novo**) e Casa de Shows (Cais). Renda reduzida
em 15% se a facção dominante do bairro for hostil e muito mais forte que você, e
cortada pela metade no dia de uma extorsão.

**Fluxo entre temporadas**: o novo personagem começa com R$ 1.900 + 5% do
patrimônio (máximo R$ 1.200) + R$ 600 se cumpriu a meta + bônus de medalhas
(30/80/200 por bronze/prata/ouro, máximo R$ 800). O teto total é R$ 4.500, o que
evita bola de neve entre temporadas.

---

## 7. Gangue e facções

### Equipe
Integrantes nomeados com função: **Músculo** (+confrontos e operações), **Olheiro**
(−detenção, −vigilância das operações) e **Negociador** (+diálogos e contatos).
Sobem do nível 1 ao 5 com XP de operações e confrontos. Ânimo abaixo de 25 traz
35% de chance diária de **deserção**: o integrante vai para a facção mais hostil
(que ganha força) e vazam informações (+5 de vigilância).

### Facções (IA)
Cada facção tem relação, tensão, **força**, **rancor**, acordos e personalidade:

| Facção | Perfil | Comportamento |
|---|---|---|
| Círculo da Esquina | Tradicional | Honra acordos; retalia com **extorsão** de negócios no seu território |
| Frente dos Armazéns | Expansionista | Expande e ataca sua influência; testa quem parece fraco |
| Coletivo Aurora | Oportunista | Avança onde você **não está**; retalia com **denúncia** (vigilância); pode **trair** acordos se você parecer fraco |

Todo dia cada facção (em ordem aleatória) escolhe por sorteio ponderado entre:
**expandir** (o alvo é escolhido pela utilidade: tributo, economia, sua ausência e o
próprio território), **consolidar** (ganha força), **retaliar** (só se hostil:
relação ≤ −30 e tensão ≥ 35; no máximo uma por dia), **guerrear** contra a facção
inimiga (abre o evento "Guerra entre facções", com brecha de +12 para disputas) e
**propor acordo** (relação ≥ 30; vira uma notícia de decisão).

A **traição** é verificada antes: facções oportunistas com acordo podem rompê-lo
se você estiver fraco (equipe < 3, ânimo < 35, vigilância ≥ 70 ou poder < metade
do delas). A chance é de 4% por sinal de fraqueza × oportunismo.

Dinâmica natural: a tensão cai 1 ou 2 por dia; a relação volta ao padrão do grupo
sem acordo; a força tende a `30 + presença_total/4`.

### Acordos
- **Trégua**: relação +35, R$ 400 + R$ 200 por trégua anterior com o mesmo grupo, 24 de energia; dura 3 dias (5 com perk); exige carência de 2 dias para renovar. Agir no território do grupo durante a trégua desgasta a relação, e abaixo de 15 ele encerra o acordo.
- **Aliança** (uma por vez): relação +60, sede nível 2, R$ 900, 20 de energia. Dá +10% nas missões e nenhum atrito no território dele, e +8 contra o inimigo dele. Custa contribuição diária (`50 + 15 × sede`) e o inimigo do aliado fica mais hostil. Pedidos de apoio chegam como notícia; recusar custa −20 de relação.
- **Romper acordo**: −40 de relação, +3 de rancor e −8 com **todas** as facções; cada traição reduz 5 pontos dos diálogos futuros (até −20).

**Rival histórico**: a facção com rancor ≥ 3 ao fim da temporada começa a próxima
com −25 de relação e +15 de tensão.

---

## 8. Eventos dinâmicos

| Evento | Quando | Efeito concreto |
|---|---|---|
| **Carnaval** | dias 9–11 (fixo) | Centro e Vila +25% nas missões; Bar +60%; Casa de Shows +80%; vigilância gerada −10%; ânimo +3/dia |
| **Clássico no estádio** | dia 20 (fixo) | Bar +100%, Casa de Shows +40%, risco +8 no Centro, ânimo +5 |
| Arraial no Jardim União | aleatório, 2 dias | Missões no Jardim +20%, economia local em alta |
| Crise no comércio | aleatório, 4 dias | Negócios −25%, missões −8%, bicos −20%, recrutar −30% |
| Operação policial em {bairro} | aleatório, 2 dias | +35 de vigilância local, risco +15 |
| Greve no porto | aleatório, 3 dias | Economia do Cais −30%; a Frente dos Armazéns perde força |
| Guerra entre facções | disparado pela IA | Disputas e confrontos +12 no bairro |
| Feriadão, Eleição, Temporal, Semana de comércio, Fiscalização, Festival, Patrulhas | aleatórios | Energia, influência, risco ou renda |

No máximo um evento aleatório por vez, sem repetir o anterior. Crises não começam
depois do dia 25.

Notícias de decisão (a cada 3 dias, ou quando uma facção propõe acordo): 10 tipos,
com condições (por exemplo, "Integrantes reclamam" só com ânimo < 50, "Seu
aliado pede apoio" só com aliança).

---

## 9. Temporada e competição

- 30 dias jogáveis = **29 viradas**. A renda entra ao virar o dia; o dia 30 é o último para agir e permite encerrar. Verificado no teste "29 viradas levam ao dia 30".
- **Meta** (escolha até o dia 5; fica travada como cumprida no momento em que é atingida): Patrimônio R$ 18.000, Renome (130 de respeito e 25 missões), Territórios (12 dias liderando), Diplomacia (3 acordos e 2 relações +50) e Bonde forte (5 integrantes e 8 operações).
- **Pontuação** em 5 categorias com medalhas (bronze / prata / ouro):

| Categoria | Medida | Bronze | Prata | Ouro |
|---|---|---|---|---|
| Fortuna | patrimônio | 11.000 | 17.000 | 24.000 |
| Fama | respeito ganho | 110 | 160 | 220 |
| Território | dias liderando (soma) | 10 | 25 | 45 |
| Diplomacia | acordos, aliança, dias de aliança, relações +50, menos traições | 35 | 70 | 110 |
| Gangue | operações, confrontos vencidos, níveis da equipe, sede | 40 | 90 | 140 |

  Pontos = Σ progresso por categoria (0–100) + 15 por medalha + 40 pela meta. Títulos: Aprendiz da rua, Figura conhecida, Nome respeitado, Chefão da cidade e Lenda do Submundo.
- **Ranking de poder** (simulado e identificado como tal): você contra as 3 facções.
- **18 conquistas permanentes**, **recordes** por categoria, **prestígio** (soma das medalhas) e histórico com título e medalhas.

---

## 10. Limites éticos e de conteúdo

Todas as ações são abstratas ("Operação no depósito", "Rolo na feira"), sem
métodos, ferramentas ou instruções aplicáveis à realidade. Bairros, facções e
pessoas são fictícios. Não há monetização.

---

## 11. Direção de arte e interface ("rua brasileira")

Objetivo: parecer um jogo de navegador clássico, não um site. Referência de
experiência: HUD permanente do personagem, lugares com cara de lugar e lista de
serviços. Nenhum layout, nome, texto ou arte de outros jogos foi copiado.

| Elemento | Metáfora brasileira | Onde |
|---|---|---|
| HUD fixo | Retrato 3×4 do personagem (boné, chapéu ou gravata conforme a carreira), barras inclinadas de Energia e Vigilância, dinheiro em destaque | Todas as telas |
| Local | Cena SVG do bairro (sobrados e camelôs, guindastes e contêineres, casas com fios e pipa, galpões e chaminés, bar com palmeiras) + **placa de rua azul esmaltada** | Início, Serviços, Bairros |
| Eventos na cena | Confete e bandeirinhas (Carnaval, festas), chuva (Temporal), giroflex (operação/fiscalização), fumaça (guerra), faixas (greve) | Cenas |
| Notícias e eventos | **Lambe-lambe**: papel rasgado colado, tipografia de cartaz | Início |
| Resultado de ação | **Cupom** serrilhado com carimbo "DEU BOM" / "DEU RUIM" e variações | Todas |
| Detenção | **Fita zebrada** | Aviso de detido |
| Missões | **Quadro de serviços**: ícone do atributo, chance em destaque, botão grande à direita (polegar) | Serviços |
| Facções | **Dossiê** em pasta parda com emblema próprio | Gangue |
| Integrantes | Cartinhas com nível, função por cor e XP | Gangue |
| Registro | **Diário** de caderno pautado | Início |
| Virada do dia | Amanhecer de 1 segundo com "Dia N" | Global |
| Capa | Logo pintado + faixa verde-amarelo-azul sobre a cena do Centro | Tela inicial |

Regras: fundo de asfalto/concreto com âmbar; papel creme para o que é "do
mundo" (cartaz, cupom, dossiê, diário); botões com relevo e sombra dura; títulos
em caixa alta condensada (`Impact` → `Roboto Condensed` → sans); tudo em CSS e SVG
inline, sem arquivos externos. Animações curtas e desligadas com
`prefers-reduced-motion`. O aviso flutuante só aparece quando o cupom de
resultado está fora da tela.

---

## 12. Cidades (v0.6)

O jogador escolhe uma de seis **cidades reais**. A cidade troca nomes de bairros,
grupos, negócios e festas, e dá uma vantagem própria. Bairros e grupos são
**inventados**, inspirados na paisagem de cada cidade, para não associar
comunidades reais ao crime. As regras dos bairros (seção 5) valem por papel:
centro comercial, zona de cargas, bairro residencial, polo industrial e zona boêmia.

| Cidade | Vantagem | Centro · Cargas · Residencial · Industrial · Boemia | Grupos (tradicional · expansionista · oportunista) |
|---|---|---|---|
| Rio de Janeiro | Carnaval de 4 dias; serviços na orla +10% | Largo dos Arcos · Cais da Guanabara · Parada do Subúrbio · Galpões da Avenida · Praia do Posto 13 | Velha Guarda do Largo · Turma do Cais · Rede do Calçadão |
| São Paulo | Negócios +8% | Ladeira dos Camelôs · Terminal de Cargas · Vila dos Sobradinhos · Galpões da Marginal · Quadra da Garoa | Irmandade da Ladeira · Consórcio dos Galpões · Rede Garoa |
| Belo Horizonte | Boteco +40%; diálogos +4 | Mercado Velho · Pátio Ferroviário · Alto da Serra · Polo do Minério · Rua dos Botecos | Confraria do Mercado · Turma do Trilho · Rede das Gerais |
| Salvador | Carnaval de 5 dias; equipe +1 de ânimo/dia | Largo das Ladeiras · Cais da Baía · Alto das Mangueiras · Polo do Recôncavo · Orla do Dendê | Irmandade das Ladeiras · Estiva da Baía · Rede do Dendê |
| Recife | Viagem pela metade do preço e sem energia | Pátio dos Sobrados · Cais das Pontes · Beira do Mangue · Galpões da BR · Ladeira dos Bonecos | Clube do Pátio · Frente das Pontes · Maré Mansa |
| Porto Alegre | Treinos −10% | Largo do Mercado · Cais do Guaíba · Vila dos Plátanos · Distrito das Chaminés · Rua da Boemia | Velhos do Mercado · Turma do Guaíba · Rede Minuano |

Cada cidade também nomeia o Carnaval ("Carnaval dos trios", "Carnaval do frevo"),
o clássico de futebol ("Clássico mineiro") e a festa do serviço da zona boêmia
(baile, pagodão, brega, forró). Nas cenas, uma silhueta distante identifica a
cidade (morros, torres, serra, elevador, pontes, chaminé).

Saves antigos mantêm a cidade que já tinham; uma cidade desconhecida vira Rio de Janeiro.

## 13. Primeiros passos e orientação (v0.6)

Três camadas respondem "qual é o objetivo, aonde chegar e como":

1. **Como jogar**: introdução de 4 páginas aberta no primeiro jogo (O objetivo, Seu dia, Os riscos, Sua cidade), sempre acessível depois.
2. **Primeiros passos**: trilha de 8 passos com recompensas pequenas (R$ 520 no total). O passo atual aparece em todas as telas, com um botão que leva à tela certa, e a aba correspondente pisca. Pode ser dispensada.

| # | Passo | Recompensa |
|---|---|---|
| 1 | Escolher a especialização | — |
| 2 | Fazer o primeiro serviço | R$ 80 |
| 3 | Treinar um atributo | R$ 60 |
| 4 | Escolher a meta da temporada | — |
| 5 | Virar o dia | R$ 60 |
| 6 | Criar contatos no bairro | R$ 80 |
| 7 | Guardar dinheiro no banco | R$ 40 |
| 8 | Chegar a 30 de respeito e fundar a gangue | R$ 200 |

3. **Seu rumo**: cartão permanente no Início com a pontuação, o título atual, o próximo título e a **medalha mais próxima**, com a dica de como chegar nela. Avisa na reta final (dia 25 em diante).

Para não sobrecarregar, a meta e a primeira notícia só aparecem depois da escolha da especialização.
