# O que falta para lançar o Submundo Brasil

Análise crítica da proposta na v0.6. "Lançar" pode significar duas coisas muito
diferentes, e a resposta muda conforme a escolha:

- **Lançamento A — jogo solo gratuito na web** (o que existe hoje, publicado numa página). Falta pouco: semanas de trabalho, quase tudo fora do código.
- **Lançamento B — jogo competitivo online**, com ranking e gangues de jogadores, como os clássicos do gênero. Falta um produto inteiro: servidor, contas, operação. Meses.

Recomendação: fazer o **A primeiro**, de propósito, para aprender com jogadores
reais antes de investir no B.

## 1. A proposta se sustenta?

**O que já funciona**
- Ciclo claro: energia → serviços → dinheiro e respeito → investir → virar o dia.
- Decisões com custo real (banco com taxa, liderar bairro atrai ataque, acordo tem compromisso).
- Cinco formas de vencer medidas em simulação (166 a 219 pontos entre estratégias focadas).
- Identidade: seis cidades reais, festas do calendário brasileiro, direção de arte de rua.
- Orientação: introdução, primeiros passos e "Seu rumo".

**Fraquezas da proposta (não são bugs)**
1. **Sem motivo forte para voltar amanhã.** Uma temporada cabe em uma ou duas horas seguidas, porque "Avançar dia" é um clique. Os clássicos do gênero prendem pelo relógio real e pela rivalidade com pessoas. Sozinho e sem relógio, o jogo depende só de conquistas e recordes.
2. **Rejogabilidade limitada.** A segunda temporada é parecida com a primeira: mesmas 13 missões, mesmos 15 eventos, mesmas 3 facções. Cidade e carreira mudam números, não a história.
3. **Pouca narrativa.** Não há personagens com nome e voz (um rival, um padrinho, um delegado), nem missões em cadeia. Falta "história para contar".
4. **Sem som.** Jogo mudo parece protótipo.
5. **Tema sensível.** Crime no Brasil é assunto real e doloroso. O jogo é abstrato e usa bairros inventados, mas a divulgação e as lojas vão exigir cuidado com tom, faixa etária e texto.

## 2. Bloqueadores do lançamento A (jogo solo na web)

| # | Item | Por quê | Esforço |
|---|---|---|---|
| A1 | **Teste com 10 a 20 pessoas reais** | Todo o balanceamento veio de bots. Ninguém de fora jogou. É o maior risco. | 1–2 semanas |
| A2 | **Testar em iPhone (Safari) e Firefox** | Só foi testado em Chromium. Um efeito do cupom depende de navegador recente. | 2–3 dias |
| A3 | **Hospedagem e endereço** | Hoje é um arquivo para baixar. Precisa de uma página (qualquer hospedagem estática serve) e domínio. | 1 dia |
| A4 | **Instalável no celular (PWA)** | Ícone na tela inicial e uso offline exigem manifesto e service worker, que não cabem num arquivo único aberto do disco. Hospedado, é simples. | 2–3 dias |
| A5 | **Textos legais** | Aviso de ficção, classificação indicativa sugerida (provável 14 ou 16 anos), política de privacidade (hoje nada é coletado; dizer isso), contato. | 2–3 dias, com revisão de quem entende |
| A6 | **Nome e marca** | Verificar se "Submundo Brasil" está livre (INPI, domínios, redes) antes de divulgar. | 1 dia de pesquisa |
| A7 | **Canal de retorno** | Um formulário ou e-mail para bugs e sugestões; sem isso o teste A1 não rende. | 1 dia |
| A8 | **Fonte dos títulos embutida** | O visual de cartaz varia por aparelho. | 1 dia |
| A9 | **Som básico com botão de mudo** | Carimbo, moedas, virada do dia. | 3–5 dias |
| A10 | **Telas Banco e Temporada** | Ainda as mais "cartão"; a de fim de temporada merece uma cerimônia (medalhas aparecendo, título, comparação com o recorde). | 3–5 dias |

## 3. Para o jogo solo ser bom de verdade (retenção)

| # | Item | Efeito |
|---|---|---|
| R1 | **Missões em cadeia com personagens** (3 a 5 etapas com escolhas, por cidade) | Dá história e diferencia as cidades além dos nomes |
| R2 | **Modificadores de temporada** ("Ano de eleição", "Verão de greves", "Cidade em obras") sorteados no início | Cada temporada pede uma estratégia diferente |
| R3 | **Desbloqueios permanentes sem poder** (retratos, emblemas da gangue, cidades extras, modo difícil) | Motivo para jogar a próxima temporada sem bola de neve |
| R4 | **Desafio semanal com semente fixa** (todos jogam a mesma temporada) e código de resultado para compartilhar | Competição entre amigos sem servidor |
| R5 | **Rival nomeado por temporada**, com falas e reviravoltas | Rivalidade com rosto, hoje abstrata |
| R6 | **Mais conteúdo**: 25+ missões, 25+ eventos, festas regionais (São João, Círio, Festa do Peão, Réveillon) | Menos repetição |
| R7 | **Níveis de dificuldade** | Iniciantes e veteranos no mesmo jogo |
| R8 | **Estatísticas de carreira** (totais de todas as temporadas) | Sensação de trajetória |
| R9 | Acessibilidade: leitor de tela, tamanho de fonte, alto contraste | Alcance e respeito |
| R10 | Ajustes de balanceamento pendentes (Articulador forte com gangue; Empreendedor fraco fora de negócios) | Ver NEXT_STEPS.md |

## 4. Lançamento B (competitivo online)

Só vale depois de o A mostrar que as pessoas gostam do ciclo. Exige:

1. **Servidor que manda nas regras.** Hoje o save é um arquivo editável; ranking real com isso é ranking de trapaceiros. O motor foi escrito sem depender da tela justamente para poder rodar no servidor.
2. **Contas, banco de dados e temporadas globais** com data de início e fim.
3. **Relógio real**: energia que volta com o tempo, virada diária para todos. Muda o ritmo inteiro e precisa de novo balanceamento.
4. **Gangues de jogadores** disputando os mesmos bairros; as facções atuais viram personagens do cenário.
5. **Operação**: moderação de nomes, combate a contas múltiplas e robôs, suporte, monitoramento, cópias de segurança.
6. **LGPD**: consentimento, termos, exclusão de conta, responsável pelos dados.
7. **Modelo de receita sem pagar para vencer**: cosméticos, apoio voluntário ou passe de temporada só visual. Vender energia ou dinheiro do jogo destrói a competição.
8. **Custos**: servidor, domínio, e-mail transacional, possivelmente jurídico e contábil.

## 5. Ordem sugerida

1. A1 (teste com pessoas) usando o HTML atual, com um formulário simples (A7). Corrigir o que aparecer.
2. A2, A8, A10 e A9, nessa ordem.
3. A3 + A4 + A5 + A6: publicar.
4. R1, R2 e R4: os três que mais mudam a vontade de voltar.
5. Decidir sobre o B com dados de uso do A.

## 6. O que ainda não se sabe

- Se a primeira sessão prende: o guia foi testado por robô, não por gente.
- Se 30 dias é o tamanho certo de temporada no jogo solo (pode ser longo para celular).
- Se a estratégia de gangue, que termina com pouco dinheiro, diverte ou frustra.
- Se o tom do tema agrada ao público brasileiro ou incomoda; só o teste A1 responde.
