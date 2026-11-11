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

## Pendências de balanceamento (prioridade alta)

1. **Operador sem estratégia dominante própria**: dar a ele uma vantagem exclusiva em missões de alto nível. Por exemplo, nível 2 liberando uma missão "Golpe de mestre", ou recompensas +8% em missões com dificuldade ≥ 33. Validar com `npm run careers` (meta: Operador ≥ +10 pontos no farm de missões).
2. **Articulador levemente forte**: reduzir o bônus de influência das notícias para +15% (hoje +30% em tudo) ou cobrar mais caro o primeiro contato do dia.
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
