# Prompts para as imagens pintadas — Submundo Brasil
> **Situação na v1.4:** as 24 imagens já estão em `art/`. Os originais são reduzidos para 880 px (cenas) e 288 px (retratos) antes de entrar.


O jogo já tem ilustrações em SVG para cada lugar, adversário e assalto. Este guia
serve para gerar **versões pintadas** numa IA de imagem (Midjourney, Gemini,
ChatGPT, Firefly etc.) e trocar as que você quiser, uma a uma.

## Como colocar no jogo

1. Gere a imagem com o prompt da tabela (sempre **com o bloco de estilo** abaixo colado no começo).
2. Salve com o **nome exato** da coluna "Arquivo", em **WebP ou JPG**, na pasta `art/` do projeto.
3. Tamanho: lugares e assaltos em **1200 × 600** (2:1); retratos em **512 × 512**.
4. Comprima para **até 150 KB** cada (o build recusa acima de 400 KB). Sites como Squoosh fazem isso de graça.
5. Rode `node build.js`. A imagem substitui o SVG daquela chave; as que faltarem continuam em SVG.

Pode trocar aos poucos, começando pelas telas que o jogador mais vê (Galpão, Feira, Noite, Duelos).
Com as 24 imagens o arquivo final fica com cerca de 2 a 3 MB e continua funcionando offline.

## Bloco de estilo (cole no início de todo prompt)

> Ilustração estilo graphic novel brasileira, pintura digital com traço grosso e sombras duras, noite urbana de cidade grande do Brasil, paleta escura com azul petróleo, âmbar de lâmpada de rua e toques de vermelho, textura de concreto e cartaz gasto, luz dramática de poste, enquadramento de cena de jogo de navegador. Sem texto, sem letreiros legíveis, sem logotipos ou marcas, sem pessoas reais ou famosas, sem sangue. Clima adulto e sujo, mas sem violência explícita.

Mantenha sempre o mesmo modelo e, se a ferramenta permitir, a mesma "seed" ou imagem de referência de estilo, para o conjunto parecer de um jogo só.

## Lugares da Cidade (1200 × 600)

| Arquivo | Prompt (depois do bloco de estilo) |
|---|---|
| `place-cidade.webp` | Vista de rua alta de um bairro brasileiro à noite, prédios e sobrados com janelas acesas, fios de poste cruzando o céu, uma placa de rua azul esmaltada em primeiro plano, lua no alto. |
| `place-galpao.webp` | Galpão de carga com porta de enrolar meio aberta, uma lâmpada pendurada iluminando caixas de papelão e engradados, empilhadeira velha amarela ao lado, chão molhado. |
| `place-feira.webp` | Barraca de camelô de feira noturna com toldo listrado vermelho e branco, lona e caixotes, varal de lâmpadas, ferramentas e peças variadas na bancada, vendedor de costas na penumbra. |
| `place-noite.webp` | Festa na laje de favela à noite, caixas de som grandes, varal de lâmpadas coloridas, silhuetas dançando, casas empilhadas ao fundo e lua. |
| `place-duelos.webp` | Beco estreito entre prédios, um único poste lançando cone de luz, duas silhuetas de homens se encarando, um de boné, poças no chão. |
| `place-hospital.webp` | Fachada de UPA brasileira à noite, luz fria fluorescente, ambulância branca estacionada, cruz vermelha acesa, fila de pessoas cansadas na porta. |
| `place-gestao.webp` | Fachada de banco antigo com colunas no centro da cidade, caixa eletrônico iluminado ao lado, calçada vazia de madrugada. |
| `place-temporada.webp` | Parede de bar com troféu dourado de campeonato de várzea na prateleira, medalhas de bronze e prata penduradas, fotos desbotadas e bandeirinhas. |
| `place-apostas.webp` | Fundo de bar com mesa de sinuca de pano verde sob lâmpada pendurada, quadro de anotações de jogo do bicho na parede, roleta pequena num canto, fumaça e copos. |
| `place-assaltos.webp` | Van escura parada numa rua lateral de madrugada, porta lateral aberta, sacola de lona no chão, reflexo distante de giroflex vermelho e azul. |

## Adversários de duelo (512 × 512, retrato de busto, fundo liso escuro)

| Arquivo | Prompt (depois do bloco de estilo) |
|---|---|
| `rival-marrento.webp` | Retrato de busto de rapaz marrento de boné azul aba reta, camiseta vermelha, sorriso debochado. |
| `rival-tonhao.webp` | Retrato de busto de carregador de feira grandão, ombros largos, camiseta verde suada, cara fechada. |
| `rival-bagre.webp` | Retrato de busto de homem de cabeça grande e cabelo raspado nas laterais, expressão teimosa, camisa xadrez. |
| `rival-maozinha.webp` | Retrato de busto de rapaz franzino de moletom com capuz azul-escuro, olhar rápido e desconfiado. |
| `rival-galego.webp` | Retrato de busto de homem loiro de óculos escuros espelhados, corrente dourada fina, camisa preta, ar de apostador. |
| `rival-sargento.webp` | Retrato de busto de ex-segurança de bigode grosso, boina verde-oliva, camiseta militar, postura calma. |
| `rival-carcara.webp` | Retrato de busto de homem de capuz preto com lenço vermelho cobrindo o rosto até o nariz, olhos âmbar intensos. |
| `rival-rei.webp` | Retrato de busto de chefão de rua com coroa dourada de brincadeira, cordão de ouro grosso, camisa preta de seda, olhar de dono do pedaço. |

## Assaltos do bando (1200 × 600)

| Arquivo | Prompt (depois do bloco de estilo) |
|---|---|
| `heist-arrastao.webp` | Corredor de shopping à noite com vitrines de celulares e relógios, vidro estilhaçado, silhuetas correndo, motos esperando no estacionamento. |
| `heist-rodovia.webp` | Rodovia brasileira de madrugada, caminhão baú parado, cones e um carro atravessado na pista, morros escuros ao fundo. |
| `heist-agencia.webp` | Pequena agência bancária numa praça de cidade do interior, igreja ao fundo, rua vazia, uma viatura solitária estacionada. |
| `heist-carroforte.webp` | Carro-forte numa curva de serra com neblina, guard-rail, mata escura, faróis acesos. |
| `heist-transportadora.webp` | Muro alto com arame farpado de uma base de transportadora de valores, guarita com holofote, caminhões blindados no pátio. |
| `heist-cofrecentral.webp` | Porta de cofre redondo gigante de aço com volante, iluminada de cima, maços de dinheiro em pilhas, atmosfera de grande golpe. |

## Bairros (1200 × 600, sem monumentos: servem para as 6 cidades)

Já no jogo (v1.5), reduzidas para 880 px. Aparecem atrás da placa do bairro na Rua e em Bairros. Os efeitos de evento (chuva, sirene, confete) continuam desenhados por cima. Sem a imagem, fica a cena desenhada atual.

| Arquivo | Prompt (depois do bloco de estilo) |
|---|---|
| `bairro-centro.webp` | Centro antigo de cidade grande brasileira à noite: sobrados coloniais coloridos e descascados, camelôs com lonas, fios emaranhados nos postes, calçada de pedra portuguesa, gente apressada. Sem monumentos reconhecíveis. |
| `bairro-cais.webp` | Região portuária à noite: galpões e armazéns antigos, guindastes, contêineres empilhados, trilhos no chão, poças refletindo a luz dos postes, um navio cargueiro ao longe. Sem monumentos reconhecíveis. |
| `bairro-jardim.webp` | Bairro residencial de trabalhadores à noite: casas simples de tijolo sem reboco subindo o morro, lajes com caixas d'água, varais, escadaria estreita, uma birosca iluminada. Sem monumentos reconhecíveis. |
| `bairro-industrial.webp` | Distrito industrial à noite: fábricas com chaminés soltando fumaça, muros altos com arame farpado, portões de galpão, caminhões parados, luz de giroflex ao fundo. Sem monumentos reconhecíveis. |
| `bairro-vila.webp` | Rua boêmia de bairro à noite: bares com mesas de plástico na calçada, palmeiras, bandeirinhas, letreiros sem texto legível, gente conversando, motos estacionadas. Sem monumentos reconhecíveis. |

## Itens da Feira (grades, já no jogo na v1.5)

Feitas em três grades (armas 4 × 4, proteções 3 × 2, veículos 3 × 2), fundo cinza liso, sem texto. O corte é automático pelas bordas pretas de cada quadro e cada item vira `art/item-<id>.webp` (192 px). Ordem das armas: porrete, soco, vergalhao, peixeira, maquita, trezoitao, pistola, doze, uzi, submetra, fuzil, ar15, ponto50, mag, rojao, dourado. Proteções: lista, jaqueta, colete, kevlar, tatico, traje. Veículos: bike, cinquentinha, moto, opala, blindado.

## Roubos (duas grades 3 × 3, a pedido)

Cortar com `python3 tools/cortar-grade.py <imagem> 3 3 roubo <ids>`. Grade 1: correria, rolo, fiacao, pastel, mercadoria, cobranca, deposito, cartao, leilao. Grade 2: caixa, loterica, comboio, cofre, favor, baile, camelodromo, carga, galpao. As cenas mostram o lugar e o clima, nunca o método.

## Casas da noite, esquemas, cadeia e capa (já no jogo na v1.5)

| Grupo | Arquivos | Como pedir |
|---|---|---|
| Casas da noite (5) | `casa-boteco`, `casa-pagode`, `casa-baile`, `casa-inferninho`, `casa-termas` | uma grade 3 × 2 (a última vazia) |
| Esquemas do Galpão (7) | `esquema-gelo`, `esquema-paraguai`, `esquema-alambique`, `esquema-gatonet`, `esquema-plantacao`, `esquema-laboratorio`, `esquema-refinaria` | uma grade 3 × 3 (as duas últimas vazias) |
| Cadeia | `place-cadeia` (1200 × 600, sai no topo da tela quando preso) | imagem única |
| Capa | `capa-entrada` (1200 × 600, tela de entrada) | imagem única |

Cortar grades com `python3 tools/cortar-grade.py <imagem> <colunas> <linhas> <prefixo> <ids>`. Esquemas: só o lugar, nunca o processo.

## Grupos rivais (já no jogo na v1.5)

Uma grade 6 × 3 por cidade, ou seis grades 3 × 1. Arquivos `grupo-<cidade>-<esquina|docas|aurora>`; cidades: rio, sp, bh, salvador, recife, poa. Cortar com `tools/cortar-grade.py <imagem> 3 1 grupo-<cidade> esquina,docas,aurora`. Pessoas e grupos **inventados**, sem símbolos de facções reais.

## Fotos de perfil do jogador (512 × 512, retrato de busto, fundo liso escuro)

Já no jogo (v1.4): escolha de retrato no Perfil, reduzidas para 256 px. Novo retrato → entrada em `AVATARS` (`engine.js`) e arquivo `art/avatar-<id>`.

| Arquivo | Prompt (depois do bloco de estilo) |
|---|---|
| `avatar-malandro.webp` | Retrato de busto de malandro carioca de meia-idade, chapéu panamá, camisa listrada aberta no peito, cordão fino de ouro, palito no canto da boca, sorriso de canto. |
| `avatar-funkeira.webp` | Retrato de busto de mulher jovem negra de tranças longas, argolas douradas grandes, jaqueta corta-vento colorida, olhar desafiador. |
| `avatar-motoboy.webp` | Retrato de busto de motoboy magro com capacete aberto e viseira levantada, colete refletivo gasto, barba por fazer, cara de cansado e esperto. |
| `avatar-sertanejo.webp` | Retrato de busto de nordestino do sertão, chapéu de couro, rosto curtido de sol, bigode grosso, lenço amarrado no pescoço, olhar sério. |
| `avatar-gaucho.webp` | Retrato de busto de gaúcho de barba cheia, boina escura, lenço vermelho no pescoço, poncho de lã, cuia de chimarrão na mão. |
| `avatar-coroa.webp` | Retrato de busto de senhora de uns 60 anos, cabelo grisalho preso em coque, óculos na ponta do nariz, batom vermelho, colar de contas, ar de quem manda na banca. |
| `avatar-skatista.webp` | Retrato de busto de jovem de periferia paulista, boné de aba reta para trás, moletom com capuz, tatuagem pequena no pescoço, sobrancelha com risco. |
| `avatar-capoeirista.webp` | Retrato de busto de homem negro atlético de cabeça raspada, regata branca, cordão de capoeira no ombro, expressão calma e firme. |
| `avatar-golpista.webp` | Retrato de busto de mulher de cabelo liso escovado, óculos escuros na cabeça, brinco de pérola, blazer claro, sorriso de quem está aplicando um golpe. |
| `avatar-marombeiro.webp` | Retrato de busto de marombeiro de cabelo descolorido platinado, regata cavada, corrente grossa prateada, braços enormes, cara fechada. |

## Cuidados

- Peça sempre **sem texto**: IA de imagem escreve letreiros errados e isso quebra a ilusão.
- Evite pedir rostos parecidos com pessoas reais, marcas, uniformes reais de polícia ou facções reais.
- Se a imagem vier com sangue ou violência explícita, gere de novo: o jogo é 18+, mas a violência é sugerida.
- Verifique os termos de uso da ferramenta sobre uso comercial antes de lançar.
