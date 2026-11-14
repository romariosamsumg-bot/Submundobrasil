# Submundo Brasil — Game Design (v1.3)

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

> **Atualizado na v0.9:** o jogo passou a ser adulto (18+) por decisão do autor. Ver §16. O parágrafo abaixo é o texto original da 0.5.

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

---

## 14. Feira do Rolo, Galpão, vida noturna e Perfil (v0.7)

Mecânicas clássicas do gênero (arsenal, mercadoria, produção, remessa, noite e
ficha do personagem) com sistemas e nomes próprios. Tudo é comércio abstrato:
comprar, produzir, transportar e vender, sem receitas nem métodos reais.
Prostituição não entra como mecânica; a noite é feita de bares e casas noturnas.

### Navegação
Cinco abas: **Início, Serviços, Cidade, Gangue, Perfil**. A aba Cidade reúne os
lugares (Bairros, Galpão, Feira do Rolo, Vida noturna, Banco e negócios,
Temporada). Temporada também é acessível pelo Perfil.

### Feira do Rolo (equipamentos)
Um item por espaço; ao trocar, o antigo volta por 50%.

| Espaço | Itens (preço · respeito) | Efeito |
|---|---|---|
| Arma | Soco-inglês (300 · 0), Peixeira (750 · 15), Três-oitão (1.700 · 35), Pistola (3.300 · 70), Doze (5.600 · 110), Fuzil (9.200 · 160) | Poder 2/4/7/10/13/17: confrontos +poder, operações +60% do poder, serviços de Força +50% do poder. **Custo:** com arma de fogo (poder ≥ 7), +1 dia de detenção |
| Proteção | Jaqueta de couro (400 · 0), Colete usado (1.500 · 30), Colete tático (4.200 · 90) | Defesa 2/5/9: reduz a chance de detenção |
| Veículo | Bicicleta cargueira (250), Cinquentinha (950 · 10), Moto 150 (2.400 · 40), Opala preto (5.200 · 80), Carro blindado (12.000 · 150) | Carga +10/15/25/60/90; fuga 1/3/6/8/12 (detenção e blitz); da Moto em diante, viajar não gasta energia |

### Galpão (mercadorias)
| Mercadoria | Base | Risco | Respeito |
|---|---|---|---|
| Cigarro da fronteira | R$ 20 | 1 | 0 |
| Bebida batizada | R$ 45 | 1 | 10 |
| Erva | R$ 70 | 2 | 20 |
| Eletrônico sem nota | R$ 120 | 2 | 30 |
| Bala | R$ 160 | 3 | 60 |
| Pó | R$ 300 | 4 | 100 |

- **Preço** = base × fator do bairro (60–150%), que oscila todo dia e volta aos poucos a 100%. A venda paga 95% do preço (+5% em território aliado).
- **Impacto**: cada unidade negociada move o preço local (mais forte nas mercadorias caras), então comprar e revender no mesmo lugar dá prejuízo.
- **Custos e riscos**: 3 de energia por negócio; vigilância pessoal e local sobem com a quantidade e o risco; vender na área de outro grupo gera atrito.
- **Carga**: 30 + veículo + 40 por ponto de produção.
- **Blitz**: viajar carregado tem chance de `carga×risco/12 + vigilância×0,25 − fuga` (máx. 60%) de perder metade da carga.
- **Comprador de fora**: a cada 5 dias (5, 10, ... 30), no bairro de cargas, paga **1,9× a base** por uma mercadoria anunciada com antecedência, até 60 unidades, uma vez por dia. É a mecânica de planejamento: guardar estoque para a data certa.
- **Produção própria** (3 níveis: ×1, ×1,8, ×2,6; custo de R$ 30 por nível ao dia):

| Ponto | Produz | Custo · respeito |
|---|---|---|
| Alambique de fundo de quintal | 7 Bebida/dia | R$ 2.000 · 15 |
| Plantação na mata | 6 Erva/dia | R$ 3.600 · 35 |
| Laboratório de galpão | 4 Bala/dia | R$ 7.000 · 80 |

  **Batida policial**: com vigilância acima de 40, cada ponto tem `(vigilância − 40) × 0,5%` de chance por dia (máx. 25%) de ser fechado por 2 dias, perdendo o estoque daquela mercadoria.
- **Patrimônio** passa a contar estoque (70% da base), equipamentos e produção (50% do custo).
- **Sexta categoria de medalha, Comércio**: lucro com mercadorias (vendas e remessas menos compras). Bronze R$ 3.000, prata R$ 7.000, ouro R$ 12.000.

### Vida noturna
Dinheiro vira energia hoje; a ressaca reduz a energia recuperada amanhã. Até 2
saídas por dia; a segunda custa 50% a mais.

| Lugar | Custo | Energia | Ressaca | Extra |
|---|---|---|---|---|
| Boteco | R$ 60 | +12 | −3 | — |
| Baile (nome muda por cidade) | R$ 160 | +25 | −6 | equipe +3 de ânimo; +2 de vigilância |
| Inferninho | R$ 360 | +40 | −10 | 55% de fazer contatos (+influência); senão, 40% de confusão (+6 de vigilância) |

### Perfil
Ficha do personagem: retrato, título, atributos em barras, os três espaços de
equipamento, números da temporada (serviços, detenções, mercadoria vendida,
remessas, blitze) e acesso a Temporada e Como jogar.

---

## 15. Saúde, hospital e duelos de rua (v0.8)

### Saúde (0–100, barra azul no topo)
- **Cai** em: derrota em confronto (12–22), derrota em duelo (14–26 + poder do adversário ÷ 10), vitória em duelo (3–9), falha em serviço de Força (6–12) e falha em operação coletiva (4–9). A **proteção reduz o dano** em 60% da sua defesa.
- **Efeito**: abaixo de 60, todas as chances (serviços, operações, confrontos, duelos) caem `(60 − saúde) × 0,4` pontos. Abaixo de 25 você fica **ferido**: não confronta, não lidera operação e não duela.
- **Internação**: ao chegar a 0, você fica 2 dias internado, a saúde volta a 35, paga até R$ 300 de conta e a vigilância cai 10. Internado, não faz nada físico (serviços, treinos, viagens, duelos, noite, Galpão, contatos, disputas); banco, notícias e decisões continuam. Recupera +15 por dia internado.
- **Recuperação**: +10 por dia (+6 se detido).

### Hospital
| Atendimento | Custo | Efeito |
|---|---|---|
| Posto de saúde | 20 de energia, 1 vez por dia | +25 de saúde |
| Clínica particular | R$ 12 por ponto que falta | saúde cheia na hora |

### Duelos de rua
Até 3 por dia, 15 de energia cada. Adversários são personagens inventados:

| Adversário | Poder | Respeito exigido | Prêmio | Respeito |
|---|---|---|---|---|
| Zé Marrento | 12 | 0 | R$ 80–160 | 1 |
| Tonhão da Feira | 22 | 10 | R$ 150–280 | 2 |
| Cabeça de Bagre | 30 | 20 | R$ 220–400 | 2 |
| Mãozinha | 40 | 35 | R$ 320–560 | 3 |
| Galego do Fliperama | 52 | 55 | R$ 450–800 | 4 |
| Sargento Bigode | 64 | 80 | R$ 650–1.100 | 5 |
| Carcará | 78 | 110 | R$ 900–1.500 | 6 |
| Rei do Pedaço | 95 | 150 | R$ 1.400–2.300 | 9 |

- **Seu poder de luta** = Força × 1,6 + Astúcia × 0,6 + poder da arma × 1,8 + defesa + sede × 1,5. Iniciante sem equipamento: 10.
- **Chance** = 50 + (seu poder − poder do adversário) × 2,2 − penalidade de saúde − 4 por duelo já feito no dia (8–92%).
- **Vitória**: prêmio, respeito (dobrado na primeira vitória contra cada adversário), 25% de chance de +1 de Força e um pouco de dano. **Derrota**: 5% do caixa em mãos e dano maior.
- **Custo**: +1 de vigilância por duelo (+4 com arma de fogo) e +3 de vigilância local.
- É o uso direto das armas e proteções da Feira do Rolo.
- Conquistas novas: **Nome na roda** (10 vitórias) e **Destronou o rei** (vencer o Rei do Pedaço).

---

## 16. Linha adulta: arsenal, serviços, noite e cadeia (v0.9)

O jogo é **18+**: crime, armas, drogas e linguagem pesada, com aviso obrigatório
na capa (caixa de confirmação) e, para quem já jogava, um aviso único na primeira
abertura. A linha que permanece: **nenhum texto ensina a fazer** algo no mundo real.

### Arsenal (Feira do Rolo)
Itens antigos mantêm o código interno (saves continuam válidos); alguns só mudaram de nome.

| Arma | Preço · respeito | Poder | Observação |
|---|---|---|---|
| Pedaço de pau com prego | 120 · 0 | 1 | |
| Chave de fenda amolada | 300 · 0 | 2 | antes "Soco-inglês" |
| Vergalhão de obra | 500 · 8 | 3 | |
| Facão | 750 · 15 | 4 | antes "Peixeira" |
| Maquita | 1.200 · 25 | 5 | libera "Caixa eletrônico na maquita" |
| Três-oitão raspado | 1.700 · 35 | 7 | primeira arma de fogo: libera a lotérica |
| Pistola .40 | 3.300 · 60 | 9 | |
| Doze de cano serrado | 4.800 · 80 | 11 | |
| Uzi de pente estendido | 6.500 · 100 | 13 | |
| Submetralhadora | 8.000 · 115 | 14 | |
| FAL 7.62, o Vovô | 9.200 · 130 | 16 | |
| Fuzil AR-15 | 12.000 · 150 | 18 | pesada |
| Ponto Cinquenta | 18.000 · 175 | 21 | pesada |
| Metralhadora MAG | 24.000 · 200 | 24 | pesada |
| Lança-rojão | 30.000 · 220 | 26 | pesada |
| Fuzil dourado de tambor duplo | 30.000 · 150 | 26 | pesada; **troféu**: só depois de vencer o Rei do Pedaço (não se compra vantagem) |

- Arma de fogo (poder ≥ 7): +1 dia se for preso; +4 de vigilância por duelo.
- **Arma pesada**: +3 de vigilância todo dia enquanto estiver equipada.

| Proteção | Preço · respeito | Defesa |
|---|---|---|
| Lista telefônica com silver tape | 150 · 0 | 1 |
| Camisa de time na cara e jaqueta de couro | 400 · 0 | 2 |
| Colete de vigilante vencido | 1.500 · 30 | 5 |
| Colete de kevlar da polícia | 2.800 · 60 | 7 |
| Colete tático com placa de cerâmica | 4.200 · 90 | 9 |
| Traje tático com escudo balístico | 8.000 · 140 | 12 |

### Serviços renomeados e novos
- Renomeados (mesmas regras): Bater carteira, Celular no ponto de ônibus, Mercadinho Dois Irmãos, Caminhão de carga na rodovia, Carro-forte na serra.
- Novos: **Fiação de cobre** (Astúcia, fácil), **Barraquinha de pastel** (Força, fácil), **Clonar cartão de velho rico** (Lábia, 40 de respeito), **Caixa eletrônico na maquita** (Astúcia, 45, exige arma de poder 5) e **Casa lotérica** (Força, 60, exige arma de fogo). As recompensas foram calibradas para não inflar o farm (ver VALIDATION).

### Noite
| Lugar | Custo | Energia | Ressaca | Extra |
|---|---|---|---|---|
| Boteco do Zé | R$ 40 | +12 | −3 | — |
| Pagode na laje | R$ 120 | +22 | −5 | equipe +4; 60% de firmar contatos (+influência) |
| Baile de favela | R$ 160 | +38 | −8 | equipe +3; +2 de vigilância; **22% de briga com gangue rival (fere)** |
| Termas VIP | R$ 900 | energia cheia | −4 | exige 60 de respeito; sem risco; negócio fechado com quem manda no bairro (relação +5) |

### Hospital e cadeia
- **UPA** (antes posto de saúde) e **Propina pro plantonista** (antes clínica): mesmas regras.
- **Advogado de porta de cadeia** (antes fiança): sai na hora, garantido.
- **Molhar a mão do carcereiro**: 45% do preço do advogado, uma tentativa por dia; chance `55 + Lábia − vigilância × 0,3` (15–85%). Se der errado, +1 dia e +8 de vigilância.

---

## 17. Assaltos do bando em etapas (v1.0)

Na aba Gangue, **Assaltos do bando**. Um plano por vez, em quatro etapas:

1. **Planejar** (15 de energia): paga o plano. Se faltar gente, contrata até 4 **avulsos** (mais fracos, pagos na hora). O plano vale do dia seguinte até 5 dias depois; se o prazo passar, esfria (−5 de ânimo).
2. **Reconhecer o terreno** (15 de energia, 1 vez por dia): +12 de informação (+2 por nível de Olheiro, até +10), teto 40. Cada ponto vale +0,5% de chance. Sobe 4 de vigilância local.
3. **Executar** (40 de energia, a partir do dia seguinte ao plano): exige o bando completo, ânimo ≥ 30, não estar ferido e a arma do líder com o poder mínimo.
4. **Dividir**: o bando fica com 25%; o resto é seu.

- **Poder do bando** = seu poder de luta + 3 × níveis dos integrantes + 2 × integrantes + 2 × níveis de Músculo + 4 × avulsos.
- **Chance** = 40 + (poder − dificuldade) × 1,2 + informação × 0,5 + (ânimo − 50) × 0,15 − vigilância × 0,3 − penalidade de saúde − risco do evento ÷ 2 (5–90%).
- **Sucesso**: dinheiro × economia do bairro, respeito, vigilância, ânimo +6, XP para todos.
- **Fracasso**: −10% do caixa em mãos, vigilância alta, ânimo −15, ferimento, 35% de um integrante "rodar" (sai do bando) e chance de prisão de 2 a 3 dias (+1 com arma de fogo).
- Depois de executar, o bando **esfria 3 dias** antes de novo plano. Cada assalto vira atrito com o grupo que manda no bairro e +25 de vigilância local.
- Cada assalto certo vale **+15 na categoria Gangue**. Conquistas: **Primeiro assalto** e **Golpe do ano** (Cofre central).

| Assalto | Bando | Sede | Arma | Respeito | Dificuldade | Plano · avulso | Rende | Prisão |
|---|---|---|---|---|---|---|---|---|
| Arrastão no shopping | 3 | 1 | 3 | 30 | 50 | R$ 400 · 300 | R$ 2.200–3.600 | 30% |
| Bloqueio na rodovia | 5 | 2 | 9 | 55 | 80 | R$ 900 · 450 | R$ 5.000–8.000 | 36% |
| Agência no interior | 6 | 3 | 13 | 80 | 110 | R$ 1.600 · 600 | R$ 9.000–14.000 | 42% |
| Carro-forte na serra | 8 | 4 | 16 | 105 | 140 | R$ 2.600 · 800 | R$ 15.000–22.000 | 46% |
| Base da transportadora de valores | 10 | 5 | 18 | 130 | 170 | R$ 4.000 · 1.000 | R$ 24.000–34.000 | 50% |
| Cofre central | 12 | 6 | 21 | 155 | 200 | R$ 6.000 · 1.300 | R$ 38.000–52.000 | 55% |

O serviço solo que se chamava "Carro-forte na serra" passou a se chamar **Cofre da joalheria** (mesmas regras), para não confundir com o assalto do bando.

---

## 18. Arte ilustrada (v1.1)

- **SVG em código** (`src/art.js`): cena para cada lugar da Cidade (Bairros, Galpão, Feira do Rolo, Vida noturna, Duelos, Hospital, Banco, Temporada) e para Assaltos do bando; retrato de busto para os 8 adversários de duelo; cena para os 6 assaltos, também no cartaz do plano em andamento. Itens bloqueados aparecem dessaturados.
- **Imagens pintadas opcionais**: arquivos em `art/` com as chaves `place-<id>`, `rival-<id>` e `heist-<id>` substituem o SVG correspondente no build. As que faltarem continuam em SVG. Guia de estilo e prompts em `PROMPTS_ARTE.md`.
- **v1.4**: as 24 imagens pintadas estão no jogo, e Galpão, Duelos, Hospital, Assaltos, Banco e Temporada ganharam cena no topo.
- **Retrato do jogador (v1.4)**: no Perfil, o jogador escolhe 1 de 10 retratos (Malandro, Funkeira, Motoboy, Sertanejo, Gaúcho, Coroa, Skatista, Capoeirista, Golpista, Marombeiro) ou volta à silhueta da classe. É só aparência: grátis, sem efeito nas regras, guardado no save (`avatar`) e mantido na temporada seguinte. Imagens `art/avatar-<id>`.

---

## 19. O ciclo do jogo e a organização das telas (v1.2)

Baseado no fluxo descrito pelo autor: **um ciclo rápido de ambição**.

```
Roubar (gasta energia) → dinheiro, atributos e respeito
   ↓ acabou a energia
Noite (dinheiro vira energia; ressaca amanhã)
   ↓ bolso cheio
Feira do Rolo (arma melhor) → roubo maior
   ↓ sem energia e sem saída
Dormir (vira o dia: +70 de energia, renda, grupos se movem)
```

### Fases (por respeito)
| Fase | Respeito | O que entra |
|---|---|---|
| Pé de chinelo | 0 | Roubar, Noite, Feira, Treino, Banco e negócios, Hospital |
| Subindo no movimento | 30 | Bando e assaltos (30); antes disso: Duelos (10), Galpão (15), Bairros (20) |
| Linha de frente | 90 | Assaltos grandes e arma pesada |
| Dono do crime | 150 | Os maiores golpes |

A fase aparece na barra do personagem. Lugares ainda fechados aparecem **trancados, com o respeito que falta**. Quem já fechou uma temporada vê tudo aberto.

### Navegação
- Abas na ordem do ciclo: **Rua, Roubar, Noite, Feira, Cidade**.
- **Rua**: cena do bairro, dia e fase, botão Dormir, o cartão **"E agora?"**, os quatro passos do ciclo, notícia, rumo e diário.
- **"E agora?"** escolhe o próximo passo pelo estado, nesta ordem: saúde baixa → Hospital; vigilância alta → ficar na sua; dinheiro para arma que destrava roubo → Feira; sem energia → Noite (se houver saída e dinheiro) ou Dormir; senão, o melhor roubo. Enquanto os primeiros passos estiverem ativos, só o guia fala.
- **Cidade**: Bando e assaltos, Banco e negócios, Galpão, Bairros, Duelos, Hospital, Perfil e temporada.
- **Perfil** abre tocando no retrato da barra do personagem.

### Regras que mudaram para sustentar o ciclo
- **Arma libera roubo**: Cobrança (poder 2), Mercadinho e Carga sem dono (4), Galpão desativado e Caixa eletrônico (5), Lotérica e Caminhão na rodovia (7), Cofre da joalheria (9).
- **Arma melhor vale a pena**: roubo armado paga +15%, e cada ponto de poder acima do mínimo dá +1,5 de chance (até +10).
- **Noite**: 3 saídas por dia (antes 2); cada saída a mais custa +50%. Dono do **Bar** bebe de graça no Boteco; dono da **Casa de Shows** não corre risco de briga no Baile.
- **Primeiros passos** na ordem do ciclo (9 passos): especialização, primeiro roubo, primeira arma, noitada, treino, dormir, meta, banco, bando.

### O que do fluxo do autor depende de servidor (não existe nesta versão)
- Outros jogadores no bando, caçada a jogadores na noite e ranking nacional. Hoje: integrantes e grupos rivais simulados; a "emboscada" na noite é a briga do Baile.
- Renda por hora de relógio. Hoje: renda ao dormir.

---

### Rua e topo (v1.4)

- **Nomes**: a vigilância pessoal (`heat`) aparece ao jogador como **Procurado**; a do bairro (`vigil`) como **Polícia no bairro** ("Polícia" na placa); a economia do bairro como **Grana**. As regras e os números não mudaram, só o nome.
- **Topo (v1.5)**: dinheiro grande e, logo abaixo, o **respeito com estrela** (é o que conta no ranking) e o dia. Barras com ícone; Energia e Saúde grossas, Procurado e Vício finas e apagadas, que acendem com borda âmbar (Procurado ≥ 30, Vício ≥ 40) e vermelha piscando (Procurado ≥ 60, Vício ≥ 70).
- **Topo com 4 barras**, em duas linhas no celular: Energia e Saúde (o que você tem) em cima, Procurado e Vício (o que te ameaça) embaixo. O Vício pisca a partir de 70, quando começa o risco de overdose.
- **Tela Rua (v1.5)**, de cima para baixo: placa do bairro (Dono, Grana e Polícia do bairro; tocar na faixa explica os três) → resultado → primeiros passos ou "E agora?" (a ação vem primeiro) → faixa do dia com **Dormir discreto**, que só fica em destaque com menos de 16 de energia → lambe-lambe "Hoje na cidade" → notícia com decisão → **Sua temporada** em 4 blocos (patente, classe, meta, título) com atalhos para Medalhas e Habilidades (no Perfil) → diário com 2 registros.

### Equipamento nos roubos (v1.5)

Antes, cada ponto do atributo valia +4% e a arma só +0,5% por ponto, e só nos roubos de Força. Agora o equipamento soma chance em **todo** roubo:

| Peça | Soma na chance |
|---|---|
| Arma | poder × 2 (Força), × 1,2 (Astúcia), × 0,8 (Influência), × 0,5 (Lábia) |
| Proteção | defesa × 1 nos roubos de Força e nos armados; × 0,5 nos outros |
| Veículo | fuga × 0,8 |

Assaltante: arma e proteção +15%; Dono da Noite: arma −20% nos roubos. Os roubos grandes pedem **veículo de fuga**: Caixa eletrônico (Bicicleta), Lotérica e Galpão desativado (Cinquentinha), Caminhão de carga e Cofre (Moto 150). As dificuldades subiram pela metade do equipamento esperado em cada degrau (Bater carteira 14 → 15, Mercadinho 33 → 37, Lotérica 42 → 48, Caminhão 46 → 52, Cofre 58 → 64), então o equipamento dá vantagem líquida. Para compensar o dinheiro que vira equipamento, a medalha de Fortuna foi a 6.000 / 9.000 / 13.000 e a meta Patrimônio a R$ 9.000. Cada roubo mostra "Seu equipamento: +X% de chance".

### Luta, força do bando e poder da arma (v1.5)

Três nomes, três medidas: **poder** é só da arma (abre roubos e soma nas chances); **Luta** é a sua, mostrada no Perfil com a conta aberta: Força × 1,6 + Astúcia × 0,6 + poder da arma × 1,8 + defesa da proteção + nível da sede × 1,5 (Assaltante: arma e proteção +15%); vale nos duelos (+2,2% de chance por ponto acima do adversário) e é a base da **Força do bando** nos assaltos (mais nível e número de integrantes, Músculos e avulsos). Também pesam: saúde abaixo de 60, cansaço do dia, Procurado, ânimo e informação. O antigo "Poder na cidade" virou **Domínio da cidade** (influência nos bairros, não luta).

### Entrada e ficha da temporada (v1.5)

Sequência: **tela inicial** (aviso 18+, entrar ou criar conta, ou jogar sem conta) → **ficha 1**: retrato (10), vulgo e cidade, botão **Próximo** → **ficha 2**: classe (4), e só depois de escolher aparecem o aviso "retrato, vulgo e classe só poderão ser alterados na próxima temporada" e o botão **Salvar** → o **guia de primeiros passos** começa direto no passo 2 (primeiro roubo). A ação é `setup(retrato, vulgo, classe)`, que só vale sem classe; ao virar a temporada a ficha reabre com o vulgo preenchido (a cidade não muda). O Perfil não troca mais o retrato. No online, o vulgo novo precisa ser único (o banco recusa repetido).

### Itens são seus (v1.5)

Na Feira, comprar paga o **preço cheio** e o item fica **seu** na temporada; os que você já tem mostram **Usar** (troca de graça, recusada preso ou com veículo menor que a carga). Não há mais devolução de metade na troca, então os preços caíram pela regra *novo = antigo − metade do anterior da mesma prateleira*: o custo para subir a trilha ficou igual (o ritmo medido em `npm run ritmo` não mudou). Patrimônio conta só o que está em uso (itens guardados não viram dinheiro).

| Arma | Preço | | Proteção | Preço | | Veículo | Preço |
|---|---|---|---|---|---|---|---|
| Pedaço de pau | 150 | | Lista telefônica | 200 | | Bicicleta | 300 |
| Chave de fenda | 820 | | Jaqueta | 900 | | Cinquentinha | 1.650 |
| Vergalhão | 1.050 | | Colete vencido | 2.300 | | Moto | 3.100 |
| Facão | 1.450 | | Kevlar | 3.100 | | Opala | 5.500 |
| Maquita | 1.900 | | Tático | 4.750 | | Blindado | 11.250 |
| Três-oitão | 2.000 | | Traje | 8.500 | | | |
| Pistola .40 | 2.750 | | | | | | |
| Doze | 3.750 | | | | | | |
| Uzi | 4.500 | | | | | | |
| Submetralhadora | 5.250 | | | | | | |
| FAL | 6.000 | | | | | | |
| AR-15 | 7.750 | | | | | | |
| Ponto Cinquenta | 11.500 | | | | | | |
| MAG | 15.000 | | | | | | |
| Lança-rojão | 18.000 | | | | | | |

### Relógio do modo online (v1.5, fase 1b)

Só no online. O jogo local continua com o botão Dormir e 30 dias por temporada.

| Regra | Online |
|---|---|
| Dia | Vira sozinho à **meia-noite de Brasília**; o dia do jogo é o dia do mês (o dia 31 conta como 30). Na virada entram renda, produção, eventos e facções, e os limites do dia zeram. Quem ficou fora recebe as viradas atrasadas (até 33). |
| Energia | **+1 a cada 3 minutos** (cheia em 5 horas), até 100. A virada não dá mais +70. |
| Ir pra casa | 3 horas sem roubar, noite ou viagem (banco, compras e decisões do bando continuam). No fim: energia cheia, tolerância e teto do corpo zerados. **Até 2 vezes por dia.** Sair antes não dá o descanso. |
| Procurado | Cai aos poucos, no ritmo de 15 por dia (com os mesmos bônus de antes). |
| Vício | −1 a cada 8 horas. |
| Cadeia e hospital | 1 dia do jogo = **2 horas** reais. Fiança, suborno e clínica continuam valendo na hora. |
| Temporada | É o **mês do calendário**: fecha sozinha na virada do mês, com legado, e o ranking recomeça. |

O tempo é contado pelo servidor; o aparelho só prevê energia, Procurado e os contadores entre um pedido e outro. "Dormir" e "Encerrar temporada" são recusados no online.

### Economia do começo (v1.5)

- **Começa sem dinheiro** (R$ 0). A partir da 2ª temporada, entra só o legado (até R$ 2.600 + medalhas). O **Bico** (28 de energia, R$ 110–170, sem risco) é a rede de segurança.
- **Primeiros passos**: enquanto o guia está ativo, roubo que falha antes do primeiro sucesso não dá cadeia.
- **Preços da Feira** recalibrados (antes, 3 roubos compravam a 4ª arma). Regra: a primeira arma sai com 1 roubo; cada arma seguinte custa vários roubos do nível em que você está.

| Arma | Antes | Agora | Poder |
|---|---|---|---|
| Pedaço de pau | 120 | 150 | 1 |
| Chave de fenda | 300 | 900 | 2 |
| Vergalhão | 500 | 1.500 | 3 |
| Facão | 750 | 2.200 | 4 |
| Maquita | 1.200 | 3.000 | 5 |
| Três-oitão | 1.700 | 3.500 | 7 |
| Pistola .40 | 3.300 | 4.500 | 9 |
| Doze | 4.800 | 6.000 | 11 |
| Uzi | 6.500 | 7.500 | 13 |
| Submetralhadora | 8.000 | 9.000 | 14 |
| FAL | 9.200 | 10.500 | 16 |
| AR-15 | 12.000 | 13.000 | 18 |
| Ponto Cinquenta, MAG, Lança-rojão | 18.000 / 24.000 / 30.000 | iguais | 21–26 |

Proteções: Lista 200, Jaqueta 1.000, Colete vencido 2.800, Kevlar 4.500, Tático 7.000, Traje 12.000. Veículos: Bicicleta 300, Cinquentinha 1.800, Moto 4.000, Opala 7.500, Blindado 15.000.

- **Roubo armado paga +25%** (antes +15%), para a arma se pagar.
- **Medalhas e meta acompanham a economia**: Fortuna 6.500 / 10.000 / 14.500 (antes 11 / 17 / 24 mil), Fama 95 / 135 / 185 de respeito (antes 110 / 160 / 220), Comércio 3.500 / 8.000 / 14.000 (antes 4 / 9 / 16 mil); meta Patrimônio R$ 10.000 (antes 18.000).

### Trilha de compra (v1.5)

Na **Feira do Rolo** e nos **negócios**, o próximo item só abre depois que o anterior foi comprado **nesta temporada** (a trilha recomeça a cada mês). Os requisitos antigos (respeito, troféu) continuam valendo; a trilha vem antes deles no motivo do bloqueio. Roubos, noite, duelos, esquemas e assaltos do bando **não têm trilha** (o autor decidiu tirar).

| Trilha | Ordem |
|---|---|
| Armas | Pedaço de pau → Chave de fenda → Vergalhão → … → Lança-rojão (o Fuzil dourado é troféu, fora da trilha) |
| Proteções | Lista telefônica → Jaqueta → Colete vencido → … → Traje tático |
| Veículos | Bicicleta → Cinquentinha → Moto → Opala → Blindado |
| Casas da noite | Pensão → Bar → Inferninho → Casa de Shows → Termas |
| Negócios de rua | Oficina → Banca do bicho → Mercadinho → Depósito |

Save anterior à v1.5 entra com a trilha toda liberada até a próxima temporada.

### Quatro classes (v1.4)

Uma classe por pilar. As tabelas de classe mais antigas deste documento ficam como histórico; esta é a regra atual. A classe Articulador saiu: save que estava nela volta a escolher a classe (o histórico guarda o nome antigo).

| Classe | Vantagens | Desvantagem |
|---|---|---|
| **Assaltante** · Linha de Frente | +20% de dinheiro em todo roubo e assalto do bando; roubos gastam 10% menos energia; arma e colete contam 15% a mais (poder, defesa e dano) | Negócios e esquemas rendem 10% menos |
| **Dono da Noite** · Rei do Inferninho | Casas da noite +30% (+50% com Casa cheia) e 20% mais baratas; entrada e doses 40% mais baratas; whisky, loló, bala e pó sobem metade do vício; +1 de respeito por saída | Nos roubos, a arma conta 20% menos na chance |
| **Traficante** · Dono da Produção | Esquemas produzem +25% e custam 10% menos; Navio paga +10% | Comércio de mercadoria gera 60% mais Procurado; cada esquema de mercadoria ativo soma +1 de Procurado por dia |
| **Bicheiro** · Dono da Área | Gatonet e negócios de rua +35% (casas da noite não); taxa do banco 1,5% (0,75% com Contador); advogado e suborno 30% mais baratos; +1 de respeito por dia a cada R$ 10.000 no banco (até +3); bicho paga 20× | Roubos de Força com −5 de chance; treino de Força 25% mais caro |

As três habilidades por classe (níveis com 10, 25 e 45 de XP) continuam as mesmas de antes. Os números de 20%, 25% e 35% são os propostos pelo autor; o Navio do Traficante (proposto +15%) ficou em +10%, e a casa abastecida (proposta em dobro) ficou em +70%, porque a produção passava dos outros caminhos na simulação.

### Noite com cardápio (v1.4)

A casa cobra a **entrada** (conta como uma das 3 saídas do dia e traz os riscos da casa: batida, briga, contatos, ânimo); a energia vem das **doses** pedidas no balcão. Limite de 15 doses por dia. A energia de cada dose cai com o vício: `energia × máx(0,4; 1 − vício/160)`.

| Dose | Energia | Vício | Ressaca | Preço | Observação |
|---|---|---|---|---|---|
| Cigarro | +2 | 0 | 0 | R$ 8 | até 5 por dia |
| Cerveja | +5 | +1 | 0 | R$ 15 | |
| Pinga | +10 | +2 | −1 | R$ 30 | |
| Whisky falsificado | +20 | +4 | −1 | R$ 70 | 12% de azia (−5 de saúde) |
| Erva | +30 | +4 | 0 | R$ 100 | melhor energia por vício |
| Loló | +50 | +10 | −2 | R$ 180 | overdose com vício ≥ 70 |
| Bala | +75 | +18 | −3 | R$ 300 | overdose com vício ≥ 70 |
| Pó | +100 | +30 | −3 | R$ 600 | overdose com vício ≥ 70; só nas Termas |

| Casa | Entrada | Abre com | Cardápio |
|---|---|---|---|
| Boteco do Zé | R$ 10 | — | cigarro, cerveja, pinga |
| Pagode na laje | R$ 40 | — | + erva |
| Baile de favela | R$ 60 | — | cigarro, cerveja, whisky, erva, loló |
| Inferninho da Luz Vermelha | R$ 150 | 40 de respeito | cigarro, whisky, loló, bala |
| Termas VIP | R$ 400 | 60 de respeito | whisky, bala, pó |

**O corpo se acostuma**: cada dose do mesmo tipo no dia rende 15% menos (×0,85 por dose repetida; outro tipo rende cheio) e, somando tudo, as doses devolvem no máximo **150 de energia por dia**. Dormir zera os dois. Isso impede o ciclo eterno rouba → droga → clínica → droga: com dinheiro infinito, o máximo cai de cerca de 85 roubos por dia para cerca de 14. No online, o descanso por tempo real ("Ir pra casa") fará o papel do Dormir.

Cada saída a mais no dia encarece a entrada em 50%. Barão: entrada e doses 40% mais baratas, metade do vício. Dono do Bar entra de graça e paga metade no Boteco; dono do Inferninho entra de graça no Inferninho; dono da Termas tem uma recarga cheia, grátis e sem vício por dia. Mercadoria do Galpão serve como dose (cigarro, whisky, erva, loló, bala e pó do estoque).

### Esquemas de produção (v1.4)

| # | Esquema | Custo | Abre com | Rende por dia (nível 1) | Custo/dia por nível |
|---|---|---|---|---|---|
| 1 | Fábrica de gelo saborizado | R$ 500 | 0 | 10 × gelo | R$ 30, sem batida |
| 2 | Galpão de cigarro do Paraguai | R$ 1.200 | 8 | 9 × cigarro | R$ 30 |
| 3 | Depósito de bebida falsa | R$ 2.000 | 15 | 7 × whisky falsificado | R$ 30 |
| 4 | Central de internet (gatonet) | R$ 3.200 | 25 | R$ 200 direto no banco | R$ 30, sem batida |
| 5 | Plantação de maconha | R$ 3.600 | 35 | 6 × erva | R$ 30 |
| 6 | Laboratório químico | R$ 7.000 | 80 | 4 × bala e 3 × loló | R$ 90 (com propina: batida pela metade) |
| 7 | Refinaria do pó | R$ 25.000 | 150 | 3 × pó | R$ 180 (com propina: batida pela metade) |

Níveis 2 e 3 rendem ×1,8 e ×2,6. **Sinergia**: dono do Inferninho com Depósito de bebida falsa ou Laboratório e 5 unidades (whisky, loló ou bala) em estoque abastece a casa e ganha +70% da renda base dela no dia (sem somar bônus de classe); dono da Termas com Refinaria faz o mesmo com 2 de pó. **Pó no Navio** dá o triplo de respeito por remessa. No jogo offline a produção roda ao dormir; no online, rodará por hora.

## 20. Sistemas paralelos (v1.3)

O ciclo de roubos é a espinha dorsal; estes sistemas rodam em volta dele. Não há PvP: a disputa é contra a polícia, o vício, a falência e o relógio do mês.

### Classes (cinco)
| Classe | Vantagem | Desvantagem | Habilidades (10 / 25 / 45 XP) |
|---|---|---|---|
| **Assaltante** | +6 de chance, +8% nos roubos grandes, falhas custam 30% menos | vigilância +10%, negócios −10% | Rota de fuga · Ritmo de rua · Sangue frio |
| **Traficante** | produção −10% de custo e +10% de volume; comprador de fora paga +5% | chance nos roubos −3; negócio de mercadoria chama 60% mais atenção | blitz −12 · carga +15 · batidas pela metade e remessas de 70 |
| **Barão da Noite** | casas da noite +50% e −12% de custo; noitada −40%; +1 de respeito por saída; vício pela metade | recompensa dos roubos −5% | ressaca pela metade · sem batida nem briga na noite · casas +20% |
| **Bicheiro** | negócios +25% e −12% de custo; o bicho paga 20× | chance nos roubos −3 | taxa do banco 1% · crises pela metade · banco rende |
| **Articulador** | influência +30%, diálogos +8, disputas +5 | recompensa dos roubos −10% | contatos −30% · tréguas longas · tributo +60% |

O "Cafetão" do gênero virou **Barão da Noite**: ele lucra com as casas, sem mecânica de contratar ou explorar pessoas. Assaltante e Bicheiro são os antigos Operador e Empreendedor (mesmo código interno; saves continuam válidos). O Articulador foi mantido porque bairros e acordos existem neste jogo.

### Império da noite e do jogo (negócios novos)
| Negócio | Custo | Renda base/dia | Observação |
|---|---|---|---|
| Pensão de beira de estrada | R$ 900 | 48 | casa da noite; o primeiro tijolo |
| Banca do bicho | R$ 3.000 | 165 | |
| Inferninho da Luz Vermelha | R$ 4.200 | 230 | casa da noite |
| Termas VIP | R$ 15.000 | 620 | casa da noite; dá **uma recarga cheia por dia, grátis, sem vício e sem batida** |

Bar e Casa de Shows também contam como casas da noite (bônus do Barão e da Noite de fluxo).

### Vício, overdose e desintoxicação
- Cada saída sobe o vício (Boteco +4, Pagode +5, Baile +9, Termas +3). Cai 3 por dia.
- Recarga da noite × `max(40%, 1 − vício/160)`.
- Com vício ≥ 70, cada saída tem `vício − 60`% de chance (até 40%) de **overdose**: um dia na UPA, −25 de saúde e −3% de respeito.
- Hospital: **Soro na veia** (25 de energia, −20, uma vez por dia) ou **Clínica de desintoxicação** (R$ 18 por ponto, zera).
- **Batida policial** nos lugares baratos (Boteco 8%, Pagode 4%, Baile 10%; ×1,6 na Noite de fluxo): 5% do caixa em mãos (até R$ 500) e +8 de vigilância.

### Apostas (Cidade → Apostas, abre com 8 de respeito)
| Jogo | Chance | Paga | Teto |
|---|---|---|---|
| Jogo do bicho | 1 em 25 | 18× (Bicheiro: 20×) | R$ 20.000 |
| Sinuca valendo dinheiro | 34–49% (Astúcia e Lábia) | 2× | R$ 2.000 |
| Roleta clandestina | 47% | 2× | R$ 20.000 |

Até 6 apostas por dia. A banca tem vantagem em todos os jogos (testado com 10 mil apostas de cada).

### O jogador contra o sistema
- **Colete**: roubo armado que falha vira trocação com a segurança: dano de `8–14 + poder exigido`, reduzido em 80% da defesa. Sem colete, é UPA.
- **Prisão custa respeito**: −4% ao ser preso.
- **Despachante** (tela Roubar): `R$ 150 + 14 × vigilância`, −35 de vigilância, uma vez por dia.

### O mês
| Semana | Dias | Tema |
|---|---|---|
| 1 | 1–7 | A corrida da sarjeta |
| 2 | 8–15 | A construção do império |
| 3 | 16–23 | O bonde pesado |
| 4 | 24–30 | Tudo ou nada |

- **Dia de pagamento** (5 e 20): Mercadinho, Caixa eletrônico, Lotérica, Cofre da joalheria e assaltos do bando +30%.
- **Noite de fluxo** (6, 7, 13, 14, 21, 27): casas da noite rendem o dobro; batida ×1,6.
- **Operação Fecha-Mês** (28 a 30): risco +8 e vigilância gerada +15%.
- **Último Navio** (dia 30): o comprador de fora paga +25%.

### Patentes (por respeito)
Pé de chinelo (0) · Rato de pista (30) · Linha de frente (90) · Gerente do movimento (150) · Dono do morro (230).

### Depende de servidor (não existe nesta versão)
Rodada no calendário real, ranking entre jogadores e de bondes, galeria da fama, renda enquanto offline e a fórmula única de Respeito como pontuação pública. A pontuação da temporada continua nas seis categorias (§9 e §14).
