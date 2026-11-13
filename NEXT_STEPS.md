# Próximos passos

## Implementado na 0.5

- [x] Correção de XSS via save; validação e higienização campo a campo
- [x] Backup de save ilegível e do save da 0.4; aviso e download
- [x] Migração completa 0.4 → 0.5 (testada com save real gerado pela 0.4)
- [x] Exportação com checksum; importação também pela tela inicial
- [x] Sincronização entre abas; tela de erro com exportação em caso de falha de renderização
- [x] Bloqueio de compras, melhorias e fundação de gangue durante a detenção; fiança
- [x] Missões por atributo (13, sendo 5 exclusivas de bairro), requisitos, consequências específicas, fadiga de repetição e respeito decrescente
- [x] Vigilância local e economia por bairro, dinâmicas
- [x] Especializações com XP e 3 habilidades cada
- [x] Banco com taxa; negócios por bairro, revenda, extorsão; tributo; sociedades
- [x] Equipe com nomes, funções, níveis e deserção
- [x] IA de facções com personalidade, força, rancor, guerra entre facções, propostas, traição
- [x] Alianças com benefícios e compromissos; trégua como compromisso; custo de romper acordos
- [x] 15 eventos (Carnaval e Clássico fixos) com efeitos concretos; 10 tipos de notícia
- [x] Pontuação em 5 categorias com medalhas, títulos, ranking de poder simulado, 18 conquistas, recordes, prestígio, rival histórico
- [x] Confirmação de dois toques em "Avançar dia", cartão de resultado com variações e resumo do dia
- [x] Simulação de balanceamento e testes automatizados
- [x] Direção de arte "rua brasileira": HUD fixo com retrato, cenas SVG por bairro que reagem a eventos, placa de rua, lambe-lambe, cupom com carimbo, fita zebrada, dossiês de facção, cartinhas de integrantes, capa e transição de amanhecer

- [x] **v0.6**: seis cidades reais com bairros, grupos, negócios, festas e vantagem próprios; introdução "Como jogar", trilha de primeiros passos e cartão "Seu rumo"; Operador com +8% em serviços grandes

- [x] **v0.7**: Feira do Rolo (armas, proteção, veículos), Galpão (mercadorias, produção, comprador de fora, blitz), vida noturna, Perfil, aba Cidade e categoria Comércio

- [x] **v0.8**: saúde (barra no topo), ferimentos, internação, Hospital (posto e clínica) e Duelos de rua contra 8 adversários

- [x] **v0.9**: linha adulta 18+ (aviso obrigatório), arsenal de 16 armas e 6 proteções, 5 serviços novos, noite com Pagode, Baile e Termas VIP, UPA, advogado de porta de cadeia e suborno do carcereiro

- [x] **v1.0**: assaltos do bando em 4 etapas e 6 degraus, com avulsos, reconhecimento, prazo e divisão

- [x] **v1.1**: ilustrações SVG para lugares, adversários e assaltos; encaixe para imagens pintadas em `art/` com guia de prompts

- [x] **v1.2**: telas reorganizadas em torno do ciclo (Rua, Roubar, Noite, Feira, Cidade), "E agora?", fases com lugares trancados, arma liberando roubo, 3 saídas na noite e primeiros passos na ordem do ciclo

- [x] **v1.3**: cinco classes, casas da noite e banca do bicho, Termas própria, vício e desintoxicação, batida policial, apostas, colete na trocação, despachante, calendário do mês com quatro semanas e patentes

- [x] **v1.4**: 24 imagens pintadas do autor embutidas (10 lugares, 8 adversários, 6 assaltos) e cena no topo de Galpão, Duelos, Hospital, Assaltos, Banco e Temporada. O SVG fica como reserva. Escolha de retrato no Perfil, com 10 perfis brasileiros.

O que falta para lançar está em **LANCAMENTO.md**.

## Pendências de balanceamento (prioridade alta)

1. **Articulador forte na estratégia de gangue** (191 contra 172 do Operador): rever o bônus de +5 em confrontos.
2. **Articulador levemente forte como generalista**: reduzir o bônus de influência das notícias para +15% (hoje +30% em tudo).
3. **Empreendedor fraco fora dos negócios** (151–171): considerar +1 de XP por compra de treino ou uma habilidade híbrida.
4. **Estratégia de gangue com caixa baixo**: avaliar com pessoas se é frustrante; uma opção é a operação coletiva render mais com integrantes de nível alto.
5. Repetir a calibração das medalhas após cada mudança (`npm run simulate`).

## Conteúdo e profundidade (prioridade média)

- Reforma de negócios (nível 2, +60% de renda, mais visado por extorsão).
- Missões em cadeia (3 etapas com escolhas) por bairro.
- Eventos de carreira (por exemplo, "Oferta de sociedade grande" exclusiva para o Empreendedor nível 2).
- Relações entre facções dinâmicas (hoje as inimizades são fixas): permitir que duas facções se aliem contra você se você liderar 3 bairros.
- Integrantes com traço pessoal (leal, ambicioso, nervoso) e possibilidade de promoção a "braço direito".
- Mais cidades com bairros próprios (a cidade de origem hoje é só texto).

## Interface (prioridade média)

- Testar em Safari/iOS e Firefox Android.
- Fonte de títulos: sem arquivo de fonte embutido, o visual condensado depende do aparelho (Impact/Roboto Condensed); avaliar embutir uma fonte livre em base64 (~20 KB).
- Cenas: variação dia/noite conforme o dia da temporada e pequenos personagens; retratos para integrantes e líderes de facção.
- Sons curtos opcionais (carimbo, moedas) com botão de mudo.
- Telas Banco e Temporada ainda são as mais "cartão"; dar a elas metáforas próprias (caderneta, quadro de troféus).
- Gráfico simples da evolução da influência por bairro na tela Bairros.
- Leitor de tela: revisar a ordem de foco e os anúncios do cartão de resultado.

## Arquitetura (prioridade baixa até haver backend)

- Versionar a migração com uma função por versão (`migrate1to2`, `migrate2to3`) quando surgir o schema 3.
- Mover as tabelas de dados para um bloco JSON separado para facilitar o balanceamento.
- Ver "Backend e multiplayer" em PROJECT_CONTEXT.md antes de qualquer recurso online.

## Depois da v0.7 (ideias do gênero ainda não feitas)

- **Arte dos lugares**: os lugares da aba Cidade usam ícones; merecem ilustrações próprias como as cenas dos bairros.
- **Operações grandes de gangue** em etapas (planejar, reunir, executar), com requisito de poder da equipe.
- **Negócios da noite**: comprar o boteco ou a casa noturna que você frequenta.
- **Jogo do bicho, caça-níquel e agiotagem** como negócios de contravenção brasileiros.
- **Estoque separado**: o que está no galpão não viaja com você (hoje toda a carga anda junto).
- **Tarefas encadeadas** de um padrinho, com recompensas, como continuação dos primeiros passos.
- Recalibrar as cidades com as mecânicas novas (a tabela de cidades é da v0.6).

## Pendências da v0.8

- O Empreendedor continua fraco fora dos negócios e na gangue (142–175).
- Adversários de duelo não reagem (não lembram derrotas, não cobram revanche); dá para ligar ao rancor das facções.
- Carga do Galpão pode ficar acima da capacidade se o jogador vender um veículo maior? Hoje a troca é bloqueada nesse caso; vender sem trocar ainda não existe.

## Próximo: assaltos de gangue em etapas (proposta do autor, v0.9)

Escada de assaltos que exige tamanho de bando, poder médio de arma e proteção:
Arrastão em shopping (3) → Caminhão de carga (5) → Agência no interior (6) → Carro-forte na serra (8) → Transportadora de valores (10) → Cofre central (12).
Cada um: planejar (custo e dias), reunir (energia de todos), executar (chance por poder do bando), dividir (manutenção e ânimo). Itens pesados (Ponto Cinquenta, MAG, Lança-rojão) ganham uso real aqui.
Também sugerido: rebelião na cadeia com a gangue.

## Pendências da v1.0

- Os 4 degraus de cima (Agência em diante) quase não são alcançados numa temporada de 30 dias: pedem 80 a 155 de respeito, e o robô de assaltos termina com ~92. Decidir se ficam como meta de longo prazo ou se o respeito exigido cai.
- O bando ainda termina a temporada com pouco dinheiro (~R$ 2.300); a parte de 25% e o custo dos avulsos pesam.
- Rebelião na cadeia com a gangue (sugerida pelo autor) ainda não existe.

## Pendências da v1.2 (do fluxo descrito pelo autor)

- **Negócios da noite**: comprar pensão, inferninho ou termas próprias para recarregar sem risco. Hoje só Bar e Casa de Shows dão vantagem na noite.
- **Rival que te caça**: um adversário nomeado que aparece na noite e cresce com a temporada (substituto solo da "caçada" entre jogadores).
- **Fim de jogo**: os assaltos grandes ainda pedem respeito que pouca gente alcança em 30 dias.
- Empreendedor e Comerciante são os caminhos mais fracos depois da v1.2 (172 e 175 pontos).
- No farm de roubos, o Articulador empata com o Operador (183 contra 180).
- Atributos continuam Astúcia, Força, Lábia e Influência (o autor citou Força, Inteligência, Carisma e Resistência); decidir se renomeia.

## Pendências da v1.3

- **Traficante é o caminho mais forte** (226 pontos, 12 acima do segundo). Próximo ajuste: reduzir o bônus de blitz ou a remessa.
- No farm de roubos, o Articulador (184) passa o Assaltante (177).
- **Estouro de esquema**: polícia fechar casa ou banca de quem não paga propina (pedido pelo autor) ainda não existe.
- **Rebelião na cadeia** e **guerra de território entre bandos** como eventos jogáveis.
- **Caça-níquel** e outras casas de jogo como negócio.
- [x] Rótulo decidido pelo autor (v1.4): a vigilância pessoal virou **Procurado** em todo o jogo; a do bairro aparece como **Vigia local**.
- Atributos continuam Astúcia, Força, Lábia e Influência.

## Pendências da v1.4 (noite e esquemas)

- [x] Quatro classes por pilar (Assaltante, Dono da Noite, Traficante, Bicheiro). Traficante 225 e império 226 no topo após calibrar o Navio (+10%) e a casa abastecida (+70%).
- Diplomacia e bonde ficaram mais fracos sem o Articulador (173 e 167); o Assaltante é a melhor classe no bonde (183). Dar ao bonde um bônus de classe misturada quando houver gangues online.
- [x] Freio do ciclo eterno: tolerância por tipo (−15% por dose repetida) e teto de 150 de energia em doses por dia. Online: "Ir pra casa" por tempo real.
- Refinaria do pó é meta de fim de jogo: quase ninguém chega a 150 de respeito com R$ 25.000 numa temporada.
- No farm de roubos, o Assaltante voltou a liderar (182 contra 169 do Articulador).
- Online: produção e mensalidades por hora em vez de ao dormir.

## Pendências da v1.5 (trilha)

- [x] Trilha de progresso em roubos, Feira, noite, duelos, esquemas, negócios (duas prateleiras) e assaltos, com o dobro de respeito no primeiro roubo de cada tipo.
- Dono da Noite (174) e diplomacia (155) ficaram abaixo do grupo; o Assaltante faz só 176 em negócios. Reavaliar com pessoas.
- Detenções subiram (cerca de +0,5 por temporada): avaliar se a trilha deve aceitar o roubo que falhou sem prisão.
- Online: decidir se a trilha recomeça todo mês (hoje sim) ou se parte dela vira progresso permanente da conta.

## Depende de servidor (visão do autor para o jogo online)

- Rodada no calendário real (dia 1º ao último dia do mês) e eventos em datas reais (quinto dia útil, sextas e sábados).
- Ranking de Respeito entre jogadores, com a fórmula única (patrimônio lavado, atributos, golpes) e as abas Reis da Noite, Maiores Assaltantes e Ranking de Bondes.
- Galeria da fama, molduras e títulos históricos ("Rei de Novembro").
- Renda por hora, mesmo offline. Bondes com jogadores de verdade.
