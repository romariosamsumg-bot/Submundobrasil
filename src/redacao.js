/* Redação do Jornal do Submundo: a equipe (inventada) e o banco de textos.
 * Só texto: as regras e os números vêm do motor (SB.jornal). A interface escolhe uma variação por dia
 * (semente do dia), então o jornal muda de manhã para manhã sem sortear nada do motor.
 * Cada modelo recebe `v` com valores JÁ ESCAPADOS (v.nome, v.regiao, v.valor...).
 * Regras de conteúdo (AGENTS.md): linguagem de rua sim; nomes de pessoas, facções ou comunidades reais não;
 * nada que ensine a fazer algo no mundo real; violência só sugerida; pessoas não são mercadoria. */
(function () {
  'use strict';

  /* ---------------- Expediente ---------------- */
  const EQUIPE = {
    kelly: { nome: 'Kelly Manchete', cargo: 'editora-chefe' },
    tuca: { nome: 'Tuca do Plantão', cargo: 'plantão da madrugada' },
    ze: { nome: 'Zé da Pauta', cargo: 'repórter de polícia' },
    lourival: { nome: 'Lourival Pé-de-Ouvido', cargo: 'setorista das gangues' },
    tiao: { nome: 'Tião Cotação', cargo: 'mercado e Galpão' },
    bene: { nome: 'Seu Bené da Banca', cargo: 'coluna do bicho' },
    neide: { nome: 'Dona Neide', cargo: 'fofoca e bastidores' },
    cida: { nome: 'Cida Previsão', cargo: 'agenda da cidade' },
    marquinhos: { nome: 'Marquinhos Classificado', cargo: 'negócios' },
    juca: { nome: 'Juca Crônica', cargo: 'cronista' },
    bia: { nome: 'Bia Lente', cargo: 'fotografia' },
    doutora: { nome: 'Doutora Rosinha', cargo: 'saúde e plantão do pronto-socorro' }
  };

  /* ---------------- Pautas: notícias que dependem do que aconteceu ----------------
   * t = títulos, x = textos. Uma de cada é escolhida pela semente do dia. */
  const P = {
    /* Carreira */
    patenteAgora: { by: 'tuca', t: [
      v => `${v.nome} vira ${v.patente}`, v => `Plantão: a rua já chama ${v.nome} de ${v.patente}`, v => `Subiu de posto agora há pouco: ${v.nome}, ${v.patente}`,
      v => `${v.patente}: é assim que chamam ${v.nome} desde agora`
    ], x: [
      v => `A notícia correu mais rápido que moto de entrega. ${v.prox}`, v => `Ninguém anunciou, mas todo mundo ficou sabendo. ${v.prox}`,
      v => `No balcão do bar já mudaram o tom quando falam o seu nome. ${v.prox}`, v => `Tem gente que levou anos para isso. ${v.prox}`
    ] },
    patenteOntem: { by: 'kelly', t: [
      v => `${v.nome} agora é ${v.patente}`, v => `Promoção na quebrada: ${v.nome} vira ${v.patente}`, v => `A rua mudou o jeito de chamar ${v.nome}`,
      v => `De nome sussurrado a ${v.patente}`, v => `${v.patente}: o novo posto de ${v.nome}`
    ], x: [
      v => `Ontem a cidade passou a te tratar diferente. ${v.prox}`, v => `Respeito não se compra na Feira: se conquista roubo a roubo. ${v.prox}`,
      v => `Os mais velhos acenam, os mais novos copiam o seu jeito de andar. ${v.prox}`, v => `Na esquina, ninguém mais te chama pelo apelido antigo. ${v.prox}`,
      v => `Esta redação apurou: a fama chegou antes de você nas outras regiões. ${v.prox}`
    ] },
    extra: { by: 'tuca', t: [
      () => 'Saiu agora na rua', () => 'Acabou de chegar', () => 'Plantão: novidade liberada', () => 'Fresquinho do forno', () => 'Corre que abriu'
    ], x: [
      v => `Seu respeito de hoje abriu: ${v.lista}.`, v => `Com o nome crescendo, a rua liberou: ${v.lista}.`, v => `Quem tem moral é atendido: ${v.lista}.`,
      v => `Foi só o respeito subir e apareceu: ${v.lista}.`
    ] },
    novidades: { by: 'kelly', t: [
      v => v.um ? `${v.item} liberado` : 'Chegou coisa nova pra você', v => v.um ? `Liberado: ${v.item}` : 'A rua abriu as portas',
      () => 'Novidade na praça', () => 'Novas portas na cidade'
    ], x: [
      v => `Com o respeito de ontem, a rua abriu: ${v.lista}.`, v => `Quem chega no seu patamar ganha acesso a ${v.lista}.`,
      v => `Os contatos certos já sabem do seu nome. Liberado: ${v.lista}.`, v => `Nossa reportagem confirmou: ${v.lista} já estão ao seu alcance.`
    ] },
    fofocaProximo: { by: 'neide', t: [
      v => `Dizem que com ${v.n} de respeito…`, v => `Um passarinho me contou: ${v.n} de respeito`, v => `Fofoca da Neide: falta pouco`, () => 'Escutei atrás da porta'
    ], x: [
      v => `…aparece ${v.item} (${v.tipo}). Faltam ${v.falta}.`, v => `Na fila do pão, garantiram que ${v.item} (${v.tipo}) sai para quem chegar a ${v.n}. Faltam ${v.falta}.`,
      v => `Não espalha, mas ${v.item} (${v.tipo}) está guardado para quem bater ${v.n} de respeito. Faltam ${v.falta}.`,
      v => `Minha comadre jura que ${v.item} (${v.tipo}) já tem dono. Só falta você chegar a ${v.n}. Faltam ${v.falta}.`
    ] },
    degrau: { by: 'ze', t: [
      v => `${v.nome} sobe de patamar: ${v.roubo}`, v => `Primeira vez no degrau ${v.n}`, v => `Ousadia: ${v.nome} encara ${v.roubo}`, v => `Escada acima: degrau ${v.n}`
    ], x: [
      () => 'Ontem foi o maior serviço da sua carreira até aqui. Os roubos pequenos já não pagam respeito como antes.', () => 'A pista notou: quem fazia o miúdo agora faz o graúdo. O respeito vem do degrau novo.',
      () => 'Fontes da polícia confirmam que o seu nome entrou numa pasta mais grossa. O respeito acompanha.', () => 'Subir dá respeito. Ficar parado no fácil, só dinheiro.'
    ] },

    /* O dia de ontem */
    ontemBom: { by: 'kelly', t: [
      v => `${v.n} roubos na conta de ${v.nome}`, v => `${v.nome} fez a limpa: ${v.n} serviços`, v => `Dia cheio: ${v.n} roubos certos`, v => `A pista não parou: ${v.n} acertos`
    ], x: [
      v => `${v.falhas}Respeito ${v.resp}, patrimônio ${v.patr}.`, v => `${v.falhas}No balanço do dia: respeito ${v.resp} e patrimônio ${v.patr}.`,
      v => `${v.falhas}A contabilidade da rua fechou em respeito ${v.resp} e patrimônio ${v.patr}.`
    ] },
    ontemRuim: { by: 'ze', t: [
      () => 'Dia de vacilo nos roubos', () => 'Nada deu certo ontem', () => 'Deu ruim na pista', () => 'Dia pra esquecer'
    ], x: [
      v => `${v.f} roubo(s) deram errado e nenhum saiu. Patrimônio ${v.patr}.`, v => `Foram ${v.f} tentativa(s) e zero acerto. Patrimônio ${v.patr}. Treinar ajuda.`,
      v => `${v.f} vez(es) a fita não fechou. Patrimônio ${v.patr}. Olhe a chance antes de ir.`
    ] },
    preso: { by: 'ze', t: [
      v => `${v.nome} rodou ontem`, v => `Enquadro: ${v.nome} na viatura`, v => `B.O. com o nome de ${v.nome}`, v => `Algema e foto de perfil: ${v.nome} foi detido`
    ], x: [
      v => `Foram ${v.n} detenção(ões) no dia. A polícia comemorou na rede social da corporação.`, v => `${v.n} detenção(ões) ontem. Na delegacia, o café estava frio e a pressa era nenhuma.`,
      v => `${v.n} detenção(ões). A vizinhança assistiu pela janela e comentou até a novela começar.`
    ] },

    /* Bicho (quando você tinha jogo) */
    bichoGanhou: { by: 'bene', t: [
      v => `Deu ${v.bicho}! ${v.nome} acertou`, v => `${v.nome} cravou no ${v.bicho}`, v => `Sorte grande: ${v.bicho} na cabeça`, v => `A banca chorou: deu ${v.bicho}`
    ], x: [
      v => `A banca pagou ${v.valor} de lucro. Seu Bené diz que é sonho bom: "Sonhou com o bicho, joga no bicho".`, v => `Lucro de ${v.valor}. O apontador contou o dinheiro duas vezes e entregou sem sorrir.`,
      v => `${v.valor} de lucro. Já tem gente perguntando o que você jantou antes de dormir.`
    ] },
    bichoPerdeu: { by: 'bene', t: [
      v => `Deu ${v.bicho}: não foi dessa vez`, v => `O ${v.bicho} passou longe do seu jogo`, () => 'Bilhete amassado no bolso', v => `Deu ${v.bicho}, e a banca agradece`
    ], x: [
      v => `Você tinha ${v.jogo}. Perdeu ${v.valor}. Seu Bené avisa: "Banca sempre leva um pouco".`, v => `Seu jogo: ${v.jogo}. Foram ${v.valor} para a banca.`,
      v => `Jogou em ${v.jogo} e saiu ${v.bicho}. ${v.valor} a menos, sonho para hoje à noite.`
    ] },

    /* Cidade */
    eventoNovo: { by: 'cida', t: [v => v.evento, v => `Começa hoje: ${v.evento}`, v => `Na cidade: ${v.evento}`], x: [v => `${v.desc} ${v.ate}`] },
    eventoSegue: { by: 'cida', t: [v => v.evento, v => `Continua: ${v.evento}`, v => `Segue: ${v.evento}`], x: [v => `${v.desc} ${v.ate}`] },
    previsao: { by: 'cida', t: [v => `Amanhã: ${v.evento}`, v => `Agenda: amanhã tem ${v.evento}`, v => `Previsão da Cida: ${v.evento}`], x: [
      () => 'Se prepare hoje.', () => 'Quem se organiza na véspera sai na frente.', () => 'Anote na agenda e chegue cedo.', () => 'Deixe energia e dinheiro guardados.'
    ] },

    /* Gangues */
    voceTomou: { by: 'lourival', t: [
      v => `${v.nome} assume a ${v.regiao}`, v => `Bandeira nova na ${v.regiao}`, v => `A ${v.regiao} tem dono: ${v.nome}`, v => `Troca de comando na ${v.regiao}`
    ], x: [
      () => 'Agora quem manda ali é você. O comércio já sabe a quem procurar.', () => 'O recado chegou em todas as esquinas: tem gente nova no comando.',
      () => 'Quem mandava antes saiu calado. Por enquanto.'
    ] },
    vocePerdeu: { by: 'lourival', t: [v => `${v.nome} perde a ${v.regiao}`, v => `A ${v.regiao} escapou da sua mão`, v => `${v.grupo} passa na frente na ${v.regiao}`], x: [
      v => `${v.grupo} ocupou o espaço. Volte a fazer contatos e roubos por lá.`, v => `Vacilou, perdeu: ${v.grupo} agora dita as regras na região.`,
      v => `Na madrugada, ${v.grupo} pintou o muro com as cores deles.`
    ] },
    gangueToma: { by: 'lourival', t: [v => `${v.grupo} toma a ${v.regiao}`, v => `Virada na ${v.regiao}: ${v.grupo} no comando`, v => `${v.grupo2} perde a ${v.regiao}`], x: [
      v => `${v.grupo2} perdeu o comando da região durante a noite.`, v => `Foi rápido e sem barulho: ${v.grupo2} recuou e ${v.grupo} avançou.`,
      v => `Moradores dizem que a mudança foi sentida no preço do pastel.`
    ] },
    movimento: { by: 'lourival', t: [() => 'O movimento da noite', () => 'Enquanto você dormia', () => 'Bastidores das gangues', () => 'Quem mexeu as peças'], x: [v => v.lista] },

    /* Polícia */
    cacado: { by: 'ze', t: [() => 'Caçado: seu retrato está na delegacia', v => `Procura-se: ${v.nome}`, () => 'Cartaz com a sua cara no posto', () => 'A polícia quer você'], x: [
      v => `Procurado ${v.heat} (${v.tier}). Até roubo que dá certo pode virar enquadro. Esfrie antes de sair.`, v => `Procurado ${v.heat}. O delegado pediu reforço só para te achar.`
    ] },
    naMira: { by: 'ze', t: [() => 'A polícia está na sua cola', () => 'Viatura rondando o seu quarteirão', () => 'Os home estão de olho'], x: [
      v => `Procurado ${v.heat} (${v.tier}). Esfrie antes do próximo roubo.`, v => `Procurado ${v.heat}. Falhar agora dá cadeia com mais facilidade.`, v => `Com ${v.heat} de Procurado, a propina ou o sossego viram amigos.`
    ] },
    esfriou: { by: 'ze', t: [() => 'A poeira baixou', () => 'Sumiu da boca da polícia', () => 'Delegacia achou outro assunto'], x: [
      v => `Seu Procurado caiu para ${v.heat} (${v.tier}). Dá para voltar à pista com calma.`, v => `Procurado ${v.heat}. O cartaz com a sua cara já desbotou.`
    ] },
    policiaRegiao: { by: 'ze', t: [v => `Viatura de sobra na ${v.regiao}`, v => `Cerco na ${v.regiao}`, v => `${v.regiao}: polícia em peso`], x: [
      v => `Polícia ${v.n} por lá. Mais tranquila: ${v.regiao2}.`, v => `Na ${v.regiao}, até o vendedor de água está sendo revistado. A ${v.regiao2} está mais calma.`
    ] },

    /* Galpão e porto */
    portoHoje: { by: 'tiao', t: [() => 'O comprador de fora atracou', () => 'Navio no cais', () => 'Barco estrangeiro na Portuária'], x: [
      v => `Hoje, na ${v.regiao}. Ele só fala de negócio pessoalmente.`, v => `Na ${v.regiao}. Ninguém sabe o que ele quer: só quem for lá descobre.`
    ] },
    portoPrevisto: { by: 'tiao', t: [v => `Barco previsto para o dia ${v.dia}`, v => `Dia ${v.dia}: tem navio chegando`], x: [
      v => `Na ${v.regiao}. Ninguém sabe o que ele vem buscar. Estoque variado sai na frente.`, v => `Na ${v.regiao}. Quem tiver de tudo um pouco no galpão chega preparado.`
    ] },
    alta: { by: 'tiao', t: [v => `${v.mercadoria} dispara ${v.pct}% na ${v.regiao}`, v => `Preço do ${v.mercadoria} sobe na ${v.regiao}`, v => `${v.mercadoria} em alta na ${v.regiao}: +${v.pct}%`], x: [
      v => `De ${v.de} para ${v.para} por ${v.unid}. Quem tem estoque sorri.`, v => `Foi de ${v.de} para ${v.para} por ${v.unid}. Hora de vender, dizem os espertos.`
    ] },
    queda: { by: 'tiao', t: [v => `${v.mercadoria} despenca ${v.pct}% na ${v.regiao}`, v => `Liquidação de ${v.mercadoria} na ${v.regiao}`, v => `${v.mercadoria} em baixa na ${v.regiao}`], x: [
      v => `De ${v.de} para ${v.para} por ${v.unid}. Bom para comprar e esperar.`, v => `Caiu de ${v.de} para ${v.para} por ${v.unid}. Tião recomenda: compra na baixa, vende na alta.`
    ] },
    rota: { by: 'tiao', t: [v => `Rota do dia: ${v.mercadoria}`, v => `Dica do Tião: ${v.mercadoria}`], x: [
      v => `Compre na ${v.compra} por ${v.de} e venda na ${v.venda} por ${v.para}.`, v => `Na ${v.compra} sai a ${v.de}; na ${v.venda}, pagam ${v.para}. A diferença é sua.`
    ] },
    vendeu: { by: 'tiao', t: [v => `${v.nome} movimentou o Galpão`, () => 'Mercadoria girando'], x: [
      v => `Ontem você vendeu ${v.n} unidade(s). O mercado sentiu.`, v => `${v.n} unidade(s) vendidas no dia. Tião anotou no caderninho.`
    ] },
    remessa: { by: 'tiao', t: [() => 'Remessa embarcou', v => `${v.nome} fechou com o comprador de fora`], x: [
      v => `${v.n} unidade(s) seguiram de navio. Ninguém viu, ninguém sabe.`, v => `${v.n} unidade(s) embarcadas. O porto amanheceu como se nada fosse.`
    ] },
    blitz: { by: 'ze', t: [() => 'Blitz pegou carga no caminho', () => 'Carga apreendida em blitz'], x: [
      v => `${v.n} blitz no dia. Veículo melhor e viagens menos carregadas diminuem o risco.`, v => `A polícia parou ${v.n} vez(es) a sua carga ontem.`
    ] },

    /* Negócios e compras */
    boom: { by: 'marquinhos', t: [v => `${v.negocio} fatura alto hoje`, v => `Movimento forte no ${v.negocio}`, v => `${v.negocio} lotado`], x: [
      v => `O movimento da cidade puxa a casa: +${v.pct}% na renda de hoje.`, v => `Fila na porta e caixa cheio: +${v.pct}% hoje.`
    ] },
    negocioDaVez: { by: 'marquinhos', t: [v => `Negócio da vez: ${v.negocio}`, v => `Oportunidade: ${v.negocio}`, v => `Classificado: ${v.negocio}`], x: [
      v => `${v.custo}, rende cerca de ${v.renda} por dia e se paga em ${v.prazo} dias.`, v => `Por ${v.custo}, entra cerca de ${v.renda} por dia. Em ${v.prazo} dias o dinheiro volta.`
    ] },
    comprouNegocio: { by: 'marquinhos', t: [v => `${v.nome} é o novo dono do ${v.negocio}`, v => `Inauguração: ${v.negocio}`, v => `${v.negocio} troca de dono`], x: [
      () => 'A chave mudou de mão ontem. A clientela ainda não sabe quem é o patrão.', () => 'Fita vermelha cortada e porta aberta. Agora é esperar o caixa encher.',
      () => 'Os vizinhos estranharam o carro novo na porta. Negócio é negócio.'
    ] },
    armaNova: { by: 'ze', t: [v => `${v.nome} anda com ${v.item}`, v => `Volume novo na cintura de ${v.nome}`, () => 'Arsenal renovado'], x: [
      () => 'A Feira do Rolo confirmou a venda. Os roubos maiores ficam mais perto.', () => 'Quem viu disse que o olhar mudou junto com o ferro.'
    ] },
    protecaoNova: { by: 'ze', t: [v => `${v.nome} está mais protegido`, v => `Proteção nova: ${v.item}`], x: [() => 'Quando a fita der errado, o estrago é menor.', () => 'A Feira do Rolo vendeu e a rua comentou.'] },
    veiculoNovo: { by: 'kelly', t: [v => `${v.nome} de ${v.item}`, v => `Garagem nova: ${v.item}`, () => 'Motor roncando na esquina'], x: [
      () => 'Fuga mais rápida, carga maior e outros roubos ao alcance.', () => 'A vizinhança reconheceu o barulho do motor antes de ver quem dirigia.'
    ] },

    /* Duelos, bando, saúde */
    dueloVenceu: { by: 'ze', t: [v => `${v.nome} vence na rua`, () => 'Trocação na esquina: deu você', v => `${v.n} duelo(s), ${v.n} vitória(s)`], x: [
      v => `Foram ${v.n} vitória(s) ontem. O respeito vem no grito da galera.`, () => 'A roda se abriu, a poeira subiu e quem saiu de pé foi você.'
    ] },
    dueloPerdeu: { by: 'ze', t: [() => 'Levou a pior na trocação', () => 'Derrota na roda de rua'], x: [
      v => `${v.n} derrota(s) ontem. Treinar Força e um colete melhor ajudam.`, () => 'Sai com o orgulho arranhado e a carteira mais leve.'
    ] },
    bandoNovo: { by: 'lourival', t: [v => `Nasce o bando de ${v.nome}`, () => 'Bando novo na cidade'], x: [() => 'Mais gente, mais força, mais boca para alimentar.', () => 'As outras gangues já anotaram o nome.'] },
    bandoCresceu: { by: 'lourival', t: [() => 'O bando cresceu', v => `${v.n} novo(s) no bando`], x: [() => 'Gente nova chegou para somar. Agora é manter o ânimo.', () => 'Mais braço para os assaltos grandes.'] },
    overdose: { by: 'doutora', t: [() => 'Passou mal na noite', () => 'Overdose: susto no pronto-socorro', () => 'A noite cobrou a conta'], x: [
      () => 'A Doutora Rosinha avisa: vício alto é bilhete para o hospital. O soro da UPA ajuda.', () => 'Uma noite de exagero e a energia virou internação. Vá com calma no balcão.'
    ] },
    vicioAlto: { by: 'doutora', t: [() => 'O vício passou do ponto', () => 'Alerta da Doutora Rosinha'], x: [
      v => `Vício ${v.n}/100. A noite rende menos e o risco de passar mal sobe. O Hospital desintoxica.`, v => `Com ${v.n} de vício, cada dose é uma roleta. Procure o Hospital.`
    ] },
    saudeBaixa: { by: 'doutora', t: [() => 'Ferido, mas de pé', () => 'Saúde no vermelho'], x: [
      v => `Saúde ${v.n}. Assim as chances caem em tudo. A UPA é de graça.`, v => `Com ${v.n} de saúde, até a escada do ônibus cansa. Passe no Hospital.`
    ] },
    conquista: { by: 'kelly', t: [() => 'Feito registrado', v => `${v.nome} entra para a história`], x: [() => 'O nome foi para o mural de feitos da cidade.', () => 'A rua vai lembrar disso por um bom tempo.'] },
    banco: { by: 'marquinhos', t: [() => 'Dinheiro guardado', v => `${v.nome} fez depósito`], x: [v => `${v.valor} foram para o banco ontem. Dinheiro no banco não some num enquadro.`, v => `O gerente atendeu de terno: ${v.valor} na conta.`] },
    historia: { by: 'juca', t: [() => 'Uma decisão que vai pesar', () => 'Escolhas da noite'], x: [() => 'Ontem você escolheu um caminho. A cidade ainda está digerindo.', () => 'Toda escolha tem preço. A sua já foi paga.'] }
  };

  /* ---------------- Crônicas da cidade: a vida acontece sem você ----------------
   * v.regiao (uma região), v.grupo (um grupo), v.bar (o boteco da cidade), v.cidade. */
  const CRONICAS = [
    { t: () => 'Pastel subiu cinquenta centavos', x: v => `Na ${v.regiao}, a barraca mais famosa reajustou o pastel de queijo. A fila diminuiu por uma hora e voltou ao normal antes do almoço.` },
    { t: () => 'Briga de vizinho por causa do pagode', x: v => `Um morador da ${v.regiao} reclamou do som. O outro aumentou o volume. A rua inteira escolheu um lado.` },
    { t: () => 'Cachorro caramelo adota a praça', x: v => `Ele não tem dono, mas tem horário: às sete toma café no ${v.bar}, às dez cochila no banco da praça.` },
    { t: () => 'Falta luz e sobra conversa', x: v => `A ${v.regiao} ficou duas horas no escuro. Teve vela, violão e gente que não se falava há anos dividindo cadeira na calçada.` },
    { t: () => 'O ônibus atrasou de novo', x: v => `Passageiros da ${v.regiao} esperaram quarenta minutos. Um senhor contou a vida inteira para quem quis ouvir.` },
    { t: () => 'Torneio de dominó termina em discussão', x: v => `No ${v.bar}, a final foi decidida numa pedra contestada. O juiz era cunhado de um dos jogadores.` },
    { t: () => 'Mural novo na parede da escola', x: v => `Artistas da ${v.regiao} pintaram um sol enorme. Ninguém sabe quem pagou a tinta, e ninguém perguntou.` },
    { t: v => `${v.grupo} patrocina time de várzea`, x: v => `O uniforme veio novinho, com o nome de uma loja que ninguém nunca viu aberta. O time perdeu de 4 a 1.` },
    { t: () => 'Chuva alaga a esquina de sempre', x: v => `A mesma poça de todo ano voltou na ${v.regiao}. Um morador batizou de "lago municipal" e a piada pegou.` },
    { t: () => 'Camelô inventa capa de celular de pão de forma', x: v => `A novidade da ${v.regiao} vendeu tudo em uma tarde. Ninguém entendeu, todo mundo comprou.` },
    { t: () => 'Aniversário de cem anos na ladeira', x: v => `Dona Filó completou um século na ${v.regiao}. Disse que o segredo é café forte e nunca dar o endereço certo para estranho.` },
    { t: () => 'Rádio pirata volta ao ar', x: v => `Depois de uma semana calada, a rádio da ${v.regiao} voltou tocando brega das seis às seis.` },
    { t: () => 'Gato fica preso em poste por seis horas', x: v => `Os bombeiros não vieram. Quem salvou foi um moleque de bicicleta e uma escada emprestada do ${v.bar}.` },
    { t: () => 'Feira livre bate recorde de gritaria', x: v => `Na ${v.regiao}, o vendedor de laranja e o de abacaxi disputaram quem grita mais. O de abacaxi ficou rouco.` },
    { t: () => 'Calor faz sorvete virar moeda', x: v => `Fez tanto calor na ${v.regiao} que um picolé de limão valia mais que uma conversa.` },
    { t: () => 'Casamento termina às seis da manhã', x: v => `A festa começou no salão e terminou na calçada da ${v.regiao}. O noivo dormiu no carro, de terno e feliz.` },
    { t: () => 'Padaria lança pão de queijo gigante', x: v => `Na ${v.regiao}, o pão do tamanho de um prato virou atração. Tem gente vindo de outra região só para tirar foto.` },
    { t: v => `${v.grupo} pinta faixa de pedestre`, x: v => `A prefeitura não veio, eles vieram. A faixa ficou torta, mas os carros passaram a parar na ${v.regiao}.` },
    { t: () => 'Orelhão volta a funcionar', x: v => `Ninguém sabe como, mas o orelhão da ${v.regiao} deu sinal. Uma fila se formou só para ouvir o tom de discar.` },
    { t: () => 'Clássico na TV para a cidade', x: v => `Em ${v.cidade}, até o trânsito respeitou o segundo tempo. No ${v.bar}, a TV pequena juntou trinta pessoas.` },
    { t: () => 'Professor de capoeira abre roda grátis', x: v => `Na praça da ${v.regiao}, a criançada aprendeu ginga e respeito. A roda vai voltar todo sábado.` },
    { t: () => 'Moto sem placa assusta a vizinhança', x: v => `Passou três vezes na ${v.regiao} e sumiu. Ninguém anotou nada. Todo mundo comentou tudo.` },
    { t: () => 'Brechó vende jaqueta "da época boa"', x: v => `Na ${v.regiao}, a jaqueta de couro custou caro e veio com uma história de amor que ninguém pediu para ouvir.` },
    { t: () => 'Cozinheira do bar ganha fã-clube', x: v => `O feijão do ${v.bar} ganhou fama. Já tem gente de terno comendo em pé no balcão.` },
    { t: () => 'Galo canta às três da manhã', x: v => `Ninguém na ${v.regiao} sabe de onde veio o galo. Ele canta de madrugada e some de dia.` },
    { t: () => 'Batalha de rima lota a praça', x: v => `Na ${v.regiao}, a final teve rima sobre aluguel, ônibus lotado e o preço do gás. A plateia escolheu o mais novo.` },
    { t: () => 'Obra que nunca termina faz aniversário', x: v => `A obra da avenida na ${v.regiao} completou mais um ano. Os moradores levaram bolo e cantaram parabéns para o tapume.` },
    { t: () => 'Bicicleta perdida volta para o dono', x: v => `Sumiu na sexta, apareceu na segunda, lavada e com o pneu cheio, na porta de casa. Na ${v.regiao}, ninguém pergunta.` },
    { t: () => 'Vendedor de churrasquinho muda de esquina', x: v => `A mudança na ${v.regiao} causou comoção. Os clientes fizeram abaixo-assinado e ele voltou em dois dias.` },
    { t: () => 'Sereno da madrugada traz neblina', x: v => `Em ${v.cidade}, a neblina cobriu tudo. Até os mais espertos andaram devagar.` },
    { t: () => 'Bloco ensaia fora de época', x: v => `O bloco da ${v.regiao} ensaiou num dia qualquer. Disseram que é para não perder o ritmo. Ninguém reclamou.` },
    { t: () => 'Senhora do terceiro andar vê tudo', x: v => `Ela não sai da janela da ${v.regiao}. Sabe quem entrou, quem saiu e quem devia ter ficado em casa.` },
    { t: () => 'Promoção de gás causa fila', x: v => `O caminhão do gás anunciou desconto na ${v.regiao}. Em dez minutos, a rua parecia dia de pagamento.` },
    { t: () => 'Escola de samba escolhe o enredo', x: v => `A quadra da ${v.regiao} ferveu. O enredo fala de quem acorda cedo e dorme tarde. Todo mundo se viu ali.` },
    { t: () => 'Taxista conta a mesma história pela milésima vez', x: v => `Quem pegou corrida na ${v.regiao} ouviu de novo sobre o dia em que ele quase foi jogador de futebol.` },
    { t: v => `${v.grupo} organiza festa de criança`, x: v => `Pula-pula, algodão-doce e palhaço na ${v.regiao}. Muita gente foi sem perguntar quem pagou.` },
    { t: () => 'Lan house resiste ao tempo', x: v => `A última da ${v.regiao} ainda abre todo dia. O dono diz que é ponto de encontro, não de internet.` },
    { t: () => 'Vira-lata ganha nome de jogador', x: v => `Na ${v.regiao}, o cachorro que dribla os carros foi batizado de Craque. Ainda não tem time.` },
    { t: () => 'Feirão de móveis usados', x: v => `Sofá, geladeira e um piano sem três teclas. Na ${v.regiao}, tudo vendeu antes do meio-dia.` },
    { t: () => 'Quermesse da paróquia', x: v => `Pescaria, correio elegante e quentão na ${v.regiao}. O correio elegante causou duas brigas e um namoro.` }
  ];

  /* ---------------- Ouvido na rua: frase do dia ---------------- */
  const FRASES = [
    'Na rua, quem fala muito escuta pouco.', 'Malandro que é malandro não corre: anda rápido.', 'Dinheiro na mão é vendaval.', 'Quem não é visto não é lembrado, mas também não é preso.',
    'Respeito é que nem fiado: demora para pegar e some num vacilo.', 'A esquina tem ouvido e o muro tem olho.', 'Todo mundo é santo até o caixa abrir.', 'Quem planta tâmara não come tâmara, mas quem rouba o caixa come hoje.',
    'Vacilou, a fila anda.', 'O silêncio é o melhor sócio.', 'Promessa de bêbado e de político, eu anoto a lápis.', 'Fé em Deus e pé no acelerador.',
    'A noite é uma criança, mas a ressaca é adulta.', 'Quem tem padrinho não morre pagão, mas paga a festa.', 'Cachorro mordido de cobra tem medo de linguiça.', 'O que é do homem o bicho não come.',
    'Hoje é dia de quê? Dia de corre.', 'De grão em grão a galinha enche o papo, e de roubo em roubo o nome cresce.', 'Na pressa, até o esperto tropeça.', 'Amigo de verdade aparece na hora da fiança.',
    'Rua sem movimento não paga ninguém.', 'O preço do sossego sobe todo mês.', 'Quem nunca comeu melado, quando come se lambuza.', 'Cada um sabe onde o calo aperta.',
    'Papo reto: quem guarda tem.', 'Não confunda simpatia com sociedade.', 'O olho do dono engorda o boi e afasta o enquadro.', 'Aqui ninguém viu nada, como sempre.',
    'Cautela e caldo de galinha não fazem mal a ninguém.', 'Quem avisa amigo é.', 'Tá ruim? Pode piorar. Tá bom? Não conta pra ninguém.', 'A rua ensina, mas cobra a matrícula.',
    'Uma andorinha só não faz verão, mas faz barulho.', 'Mais vale um na mão do que dois no galpão.', 'Quem dorme no ponto perde o ônibus e a vez.', 'Devagar com o andor que o santo é de barro.',
    'Água mole em pedra dura, tanto bate até que a polícia vem.', 'Quem tem boca vai a Roma, quem tem moto vai mais rápido.', 'O fácil sai caro.', 'Na dúvida, fica quieto e pede outra.'
  ];
  const FRASE_QUEM = ['disse um senhor no ponto de ônibus', 'ouvido na fila do pão', 'falou a dona do bar, enxugando um copo', 'garantiu um taxista', 'gritou o vendedor da feira',
    'resmungou um vigia de obra', 'ensinou uma avó para o neto', 'comentou alguém na barbearia', 'escrito à caneta na porta do banheiro do bar', 'cantou o pagodeiro no intervalo'];

  /* ---------------- Classificados (de brincadeira, nada de pessoas como mercadoria) ---------------- */
  const CLASSIFICADOS = [
    'Vendo fusca 78 sem motor, com muito potencial e um rádio que pega duas estações.', 'Procura-se gato laranja atende por Biscoito. Não é bravo, só é cínico.',
    'Conserto de geladeira, TV e coração partido. Orçamento grátis.', 'Aulas de violão para quem já desistiu três vezes.', 'Troco bicicleta por videogame que ainda liga.',
    'Faço bolo de aniversário com o nome certo na primeira tentativa.', 'Alugo vaga de garagem que cabe um carro pequeno e um sonho grande.', 'Vende-se sofá de três lugares que na prática é de dois.',
    'Benzedeira atende de segunda a sábado. Olho gordo, espinhela caída e azar no bicho.', 'Compro ferro-velho, panela furada e rádio de pilha.', 'Professor particular de matemática para quem só sabe fazer conta de troco.',
    'Fotógrafo para casamento, batizado e formatura. Não faço foto de perfil para a polícia.', 'Doa-se cachorro grande, carinhoso e que come como gente.', 'Costureira faz bainha em calça de time e de terno, sem preconceito.',
    'Manicure a domicílio, com fofoca inclusa no preço.', 'Vendo coleção de figurinhas da Copa, faltam só as difíceis.', 'Chaveiro 24 horas. Só abro a porta de quem mostra a conta de luz.',
    'Mudança e frete: levo tudo, menos problema dos outros.', 'Precisa-se de cozinheira que saiba fazer feijão como a mãe da gente.', 'Vendo terreno na beira do rio, documentação "quase" pronta.',
    'Bolo de pote, salgado e marmita fitness que ninguém pede.', 'Pastor de bairro oferece conselho grátis e sermão por fora.', 'Dou aula de dança para quem tem dois pés esquerdos.', 'Vendo celular com a tela trincada só num cantinho.'
  ];

  window.SBRedacao = { EQUIPE, P, CRONICAS, FRASES, FRASE_QUEM, CLASSIFICADOS };
})();
