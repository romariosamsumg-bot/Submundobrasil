/* =====================================================================
 * SUBMUNDO BRASIL — MOTOR DE REGRAS v1.0
 * ---------------------------------------------------------------------
 * Este módulo NÃO acessa o DOM. Ele contém:
 *   1. Utilitários e gerador aleatório (substituível nos testes).
 *   2. Tabelas de dados do jogo (missões, bairros, facções, eventos...).
 *   3. Criação, validação e migração do estado salvo.
 *   4. Fórmulas derivadas (chances, rendas, controle de bairros).
 *   5. Ações do jogador (cada uma valida antes de alterar o estado).
 *   6. Virada do dia (economia, eventos, IA das facções).
 *   7. Fim de temporada, pontuação, medalhas e conquistas.
 *
 * Convenção das ações: recebem o estado `s`, alteram-no somente se a
 * ação for permitida e devolvem { ok, good, msg, lines? }.
 *   ok=false  → ação recusada, estado intacto.
 *   ok=true   → ação executada; good indica sucesso (true) ou fracasso.
 * Conteúdo adulto (18+) e ficcional: nomes, riscos e recompensas dão o clima,
 * mas nenhum texto descreve como fazer algo no mundo real.
 * ===================================================================== */
(function (root) {
  'use strict';

  const VERSION = '1.5';
  const SCHEMA = 2;
  const MAXDAY = 30;
  const MAX_LOG = 60;
  const STORAGE_KEY = 'submundo_brasil_v01'; // mantida desde a 0.1 para ler saves antigos

  /* ------------------------------------------------------------------ */
  /* 1. Utilitários                                                       */
  /* ------------------------------------------------------------------ */
  function cryptoRandom() {
    if (globalThis.crypto && globalThis.crypto.getRandomValues) {
      const a = new Uint32Array(1);
      globalThis.crypto.getRandomValues(a);
      return a[0] / 4294967296;
    }
    return Math.random();
  }
  /** Gerador determinístico (mulberry32) usado em testes e simulações. */
  function seeded(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  let rng = cryptoRandom;
  function setRandom(fn) { rng = typeof fn === 'function' ? fn : cryptoRandom; }
  const rand = (min, max) => min + Math.floor(rng() * (max - min + 1));
  const roll = pct => rand(1, 100) <= pct;
  const pick = arr => arr[rand(0, arr.length - 1)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const isNum = v => typeof v === 'number' && Number.isFinite(v);
  /** Converte em inteiro limitado; usa `def` se o valor não for número. */
  const toInt = (v, def, min, max) => isNum(v) ? clamp(Math.round(v), min, max) : def;
  const toNum = (v, def, min, max) => isNum(v) ? clamp(v, min, max) : def;
  const sum = arr => arr.reduce((a, b) => a + b, 0);
  function weighted(options) {
    const total = sum(options.map(o => Math.max(0, o.w)));
    if (total <= 0) return options[0];
    let r = rng() * total;
    for (const o of options) { r -= Math.max(0, o.w); if (r <= 0) return o; }
    return options[options.length - 1];
  }
  const money = n => 'R$ ' + Math.round(n || 0).toLocaleString('pt-BR');

  /* ------------------------------------------------------------------ */
  /* 2. Dados do jogo                                                     */
  /* ------------------------------------------------------------------ */
  const STATS = [
    { id: 'astucia', name: 'Astúcia', desc: 'Planejamento e leitura de situação. Base das operações discretas.' },
    { id: 'forca', name: 'Força', desc: 'Preparo físico e presença. Base das ações de cobrança e escolta.' },
    { id: 'labia', name: 'Lábia', desc: 'Negociação e convencimento. Base dos acordos e da diplomacia.' },
    { id: 'influencia', name: 'Influência', desc: 'Rede de contatos. Base da disputa por bairros e da gangue.' }
  ];

  /* Missões: `stat` define o atributo principal; `district` limita a um bairro.
     difficulty está na escala do "preparo" (ver missionScore). */
  const MISSIONS = [
    { id: 'correria', name: 'Bater carteira', desc: 'Horário de pico, ônibus lotado e mão leve. O primeiro trocado de todo mundo.', stat: 'astucia', difficulty: 14, cost: 16, low: 150, high: 290, heat: 6, vigil: 5, respect: 2, unlock: 0, arrest: 28, loss: .10, tension: 1 },
    { id: 'rolo', name: 'Rolo na feira', desc: 'Convencer um atravessador fictício a fechar negócio fora da tabela.', stat: 'labia', difficulty: 16, cost: 18, low: 190, high: 340, heat: 3, vigil: 3, respect: 2, unlock: 6, arrest: 18, loss: .06, tension: 1 },
    { id: 'mercadoria', name: 'Celular no ponto de ônibus', desc: 'Lucro rápido na revenda de peças. Às vezes a vítima reage.', stat: 'forca', difficulty: 19, cost: 23, low: 300, high: 560, heat: 10, vigil: 7, respect: 3, unlock: 0, arrest: 38, loss: .12, tension: 2 },
    { id: 'cobranca', name: 'Cobrança atrasada', desc: 'Um comerciante quer receber uma dívida antiga. Exige presença.', stat: 'forca', difficulty: 27, cost: 26, low: 420, high: 740, heat: 12, vigil: 6, respect: 4, unlock: 20, req: { power: 2 }, arrest: 38, loss: .10, tension: 3 },
    { id: 'deposito', name: 'Mercadinho Dois Irmãos', desc: 'Limpar o caixa antes que o dono puxe o que guarda debaixo do balcão.', stat: 'astucia', difficulty: 33, cost: 32, low: 580, high: 980, heat: 15, vigil: 10, respect: 5, unlock: 32, req: { power: 4 }, arrest: 44, loss: .12, tension: 3 },
    { id: 'leilao', name: 'Leilão clandestino', desc: 'Intermediar um leilão fechado entre figuras da cidade.', stat: 'labia', difficulty: 37, cost: 30, low: 680, high: 1120, heat: 8, vigil: 6, respect: 6, unlock: 50, req: { influence: 25 }, arrest: 28, loss: .08, tension: 2 },
    { id: 'comboio', name: 'Caminhão de carga na rodovia', desc: 'Fechar a pista e levar a carga fechada. Só com o bonde junto.', stat: 'forca', difficulty: 46, cost: 40, low: 1050, high: 1750, heat: 19, vigil: 12, respect: 8, unlock: 75, req: { power: 7, gang: true }, arrest: 50, loss: .14, tension: 5 },
    { id: 'cofre', name: 'Cofre da joalheria', desc: 'O serviço solo mais pesado da temporada. Uma vez por dia.', stat: 'astucia', difficulty: 58, cost: 52, low: 1900, high: 3100, heat: 26, vigil: 18, respect: 13, unlock: 120, req: { power: 9, stat: ['astucia', 22], oncePerDay: true }, arrest: 55, loss: .15, tension: 6 },
    { id: 'fiacao', name: 'Fiação de cobre', desc: 'Pouco confronto, mas a guarda municipal ronda e o cobre vale pouco.', stat: 'astucia', difficulty: 17, cost: 18, low: 110, high: 190, heat: 4, vigil: 4, respect: 1, unlock: 3, arrest: 24, loss: .06, tension: 1 },
    { id: 'pastel', name: 'Barraquinha de pastel', desc: 'O dinheiro do caldo de cana e o primeiro respeito de verdade na rua.', stat: 'forca', difficulty: 17, cost: 19, low: 130, high: 230, heat: 7, vigil: 6, respect: 3, unlock: 2, arrest: 30, loss: .08, tension: 2 },
    { id: 'caixa', name: 'Caixa eletrônico na maquita', desc: 'Posto de gasolina afastado, barulho alto e notas que podem queimar.', stat: 'astucia', difficulty: 38, cost: 36, low: 560, high: 940, heat: 17, vigil: 14, respect: 5, unlock: 45, req: { power: 5 }, arrest: 46, loss: .12, tension: 3 },
    { id: 'loterica', name: 'Casa lotérica', desc: 'Fila cheia, malote de dinheiro vivo e risco de policial à paisana.', stat: 'forca', difficulty: 42, cost: 36, low: 660, high: 1080, heat: 18, vigil: 12, respect: 6, unlock: 60, req: { power: 7 }, arrest: 48, loss: .12, tension: 4 },
    { id: 'cartao', name: 'Clonar cartão de velho rico', desc: 'Lábia e paciência. Golpe limpo, mas a vítima um dia percebe.', stat: 'labia', difficulty: 35, cost: 30, low: 500, high: 820, heat: 6, vigil: 4, respect: 4, unlock: 40, arrest: 26, loss: .06, tension: 1 },
    // Oportunidades exclusivas de bairro
    { id: 'camelodromo', district: 'centro', name: 'Esquema do camelódromo', desc: 'Organizar a revenda de um lote sem nota no comércio popular.', stat: 'labia', difficulty: 23, cost: 22, low: 330, high: 560, heat: 7, vigil: 8, respect: 3, unlock: 10, arrest: 30, loss: .08, tension: 2 },
    { id: 'carga', district: 'cais', name: 'Carga sem dono', desc: 'Uma carga esquecida nos galpões. O grupo que manda ali não vai gostar.', stat: 'forca', difficulty: 29, cost: 28, low: 560, high: 900, heat: 12, vigil: 10, respect: 4, unlock: 15, req: { power: 4 }, arrest: 40, loss: .12, tension: 5 },
    { id: 'favor', district: 'jardim', name: 'Favor de vizinhança', desc: 'Resolver um problema de moradores e ganhar contatos. Pouco dinheiro.', stat: 'influencia', difficulty: 12, cost: 18, low: 90, high: 170, heat: 1, vigil: 2, respect: 3, unlock: 0, arrest: 10, loss: .04, tension: 0, influence: 4 },
    { id: 'galpao', district: 'industrial', name: 'Galpão desativado', desc: 'Material valioso parado num galpão sob patrulha reforçada.', stat: 'astucia', difficulty: 41, cost: 36, low: 900, high: 1500, heat: 18, vigil: 16, respect: 6, unlock: 40, req: { power: 5 }, arrest: 50, loss: .14, tension: 3 },
    { id: 'baile', district: 'vila', name: 'Bastidores do baile', desc: 'Cuidar da “organização paralela” de um baile de rua.', stat: 'labia', difficulty: 22, cost: 22, low: 300, high: 520, heat: 6, vigil: 6, respect: 4, unlock: 12, arrest: 26, loss: .08, tension: 2, festive: true }
  ];

  const DISTRICTS = [
    { id: 'centro', name: 'Centro Antigo', desc: 'Comércio intenso e circulação constante de gente.', risk: 0, bonus: 0, tribute: 110, advantage: 'Diálogos com facções +8 e criar contatos 20% mais barato.' },
    { id: 'cais', name: 'Cais do Norte', desc: 'Galpões, armazéns e uma região portuária em transformação.', risk: 5, bonus: 15, tribute: 140, advantage: 'Operações coletivas rendem +20%.' },
    { id: 'jardim', name: 'Jardim União', desc: 'Bairro residencial de trabalhadores e pequenos negócios.', risk: -4, bonus: -10, tribute: 70, advantage: 'Recrutar custa 25% menos e a equipe ganha +2 de ânimo por dia.' },
    { id: 'industrial', name: 'Distrito Industrial', desc: 'Grandes empresas e patrulhamento reforçado.', risk: 10, bonus: 28, tribute: 160, advantage: 'Todos os seus negócios rendem +12%.' },
    { id: 'vila', name: 'Vila das Palmeiras', desc: 'Ruas movimentadas e comércio de bairro.', risk: -2, bonus: 4, tribute: 90, advantage: 'Seu Procurado cai 5 pontos extras por dia.' }
  ];

  /* Negócios: cada um fica em um bairro e sofre a economia e as facções locais. */
  const BUSINESSES = [
    { id: 'bar', name: 'Bar da Esquina', district: 'vila', desc: 'Ponto de encontro. Lucra muito em festas e jogos.', cost: 1250, net: 70, respect: 3, tags: ['festa', 'jogo', 'noite'] },
    { id: 'oficina', name: 'Oficina de Motos', district: 'jardim', desc: 'Clientela recorrente e estável.', cost: 2850, net: 150, respect: 6, tags: [] },
    { id: 'mercado', name: 'Mercadinho 24h', district: 'centro', desc: 'Renda regular, sensível a crises.', cost: 5200, net: 270, respect: 10, tags: ['varejo'] },
    { id: 'logistica', name: 'Depósito de Logística', district: 'industrial', desc: 'Armazenagem para o comércio. Retorno alto, patrulha forte.', cost: 7400, net: 380, respect: 12, tags: [] },
    { id: 'show', name: 'Casa de Shows', district: 'cais', desc: 'Maior investimento. Explode no Carnaval.', cost: 9700, net: 500, respect: 17, tags: ['festa', 'noite'] }
    ,{ id: 'pensao', name: 'Pensão de beira de estrada', district: 'industrial', desc: 'Quartos por hora e nenhuma pergunta. O primeiro tijolo do império.', cost: 900, net: 48, respect: 2, tags: ['noite'] },
    { id: 'bicho', name: 'Banca do bicho', district: 'centro', desc: 'O dinheiro miúdo do bairro inteiro, todo dia.', cost: 3000, net: 165, respect: 6, tags: ['jogo'] },
    { id: 'inferninho', name: 'Inferninho da Luz Vermelha', district: 'centro', desc: 'Casa fechada que fatura até o sol nascer. Dobra na Noite de fluxo.', cost: 4200, net: 230, respect: 8, tags: ['noite'] },
    { id: 'termas', name: 'Termas VIP', district: 'cais', desc: 'Sua própria casa executiva: uma recarga cheia e limpa por dia, sem vício, sem batida, e ainda dá lucro.', cost: 15000, net: 620, respect: 22, tags: ['noite'] }
  ];
  const RESALE = 0.6;

  /* v1.4: quatro classes, uma por pilar (assaltos, noite, produção, esquemas de rua). Os ids antigos
   * continuam para não quebrar saves; a classe Articulador saiu (quem estava nela escolhe de novo). */
  const CAREERS = [
    { id: 'operador', name: 'Assaltante', tag: 'Linha de Frente', desc: '+20% de dinheiro em qualquer roubo (sozinho ou com o bando), roubos gastam 10% menos energia e armas e coletes rendem 15% mais (menos dano quando dá errado). Negócios e esquemas rendem 10% menos.',
      xpDesc: 'Ganha experiência concluindo roubos (mais nos grandes).',
      perks: ['Rota de fuga: −15 pontos na chance de detenção.', 'Ritmo de rua: penalidade por repetir roubos cai pela metade.', 'Sangue frio: o Procurado pesa metade nas chances; o cofre exige Astúcia 18.'] },
    { id: 'barao', name: 'Dono da Noite', tag: 'Rei do Inferninho', desc: 'Casas da noite rendem +30% e custam 20% menos; entrada e doses 40% mais baratas; whisky, loló, bala e pó sobem metade do vício. Nos roubos, a arma dele conta 20% menos.',
      xpDesc: 'Ganha experiência a cada saída na noite, a cada dia de lucro das casas e a cada casa comprada.',
      perks: ['Fígado de aço: ressaca pela metade.', 'Porta fechada: sem batida policial nem briga para você na noite.', 'Casa cheia: casas da noite rendem mais 20%.'] },
    { id: 'traficante', name: 'Traficante', tag: 'Dono da Produção', desc: 'Esquemas produzem +25% e custam 10% menos; no Navio, vende 10% mais caro que todo mundo. Chama a atenção da Polícia Federal: comércio de mercadoria gera 60% mais Procurado e cada esquema de mercadoria ativo soma +1 de Procurado por dia.',
      xpDesc: 'Ganha experiência vendendo mercadoria, fechando remessas e montando esquemas.',
      perks: ['Rota limpa: chance de blitz −12.', 'Fundo falso: +15 de espaço de carga.', 'Olheiro na esquina: batidas nos esquemas pela metade e remessas de até 70 unidades.'] },
    { id: 'empreendedor', name: 'Bicheiro', tag: 'Dono da Área', desc: 'Gatonet e negócios de rua rendem +35%; paga metade da taxa do banco, advogado e suborno 30% mais baratos e ganha +1 de respeito por dia a cada R$ 10.000 no banco (até +3); o bicho paga 20×. Nos roubos de Força tem −5 de chance, e o treino de Força custa 25% mais.',
      xpDesc: 'Ganha experiência a cada dia lucrativo e a cada negócio comprado.',
      perks: ['Contador: a taxa do banco cai para 0,75%.', 'Fornecedores: crises e extorsões afetam metade dos seus negócios.', 'Sócio oculto: o banco rende 0,4% ao dia (até R$ 120).'] }
  ];
  /** Classes que existiram e ficam só no histórico. */
  const OLD_CAREERS = { articulador: 'Articulador' };
  const CAREER_XP = [10, 25, 45];

  const GOALS = [
    { id: 'capital', name: 'Patrimônio', desc: 'Alcançar R$ 10.000 de patrimônio (caixa, banco e valor de revenda dos negócios).' },
    { id: 'renome', name: 'Renome', desc: 'Alcançar 130 de respeito e 25 missões concluídas.' },
    { id: 'dominio', name: 'Territórios', desc: 'Somar 12 dias liderando bairros (um bairro por 12 dias ou vários ao mesmo tempo).' },
    { id: 'diplomacia', name: 'Diplomacia', desc: 'Firmar 3 acordos (tréguas ou aliança) e terminar com relação +50 com 2 grupos.' },
    { id: 'bonde', name: 'Bonde forte', desc: 'Ter 5 integrantes e concluir 8 operações coletivas.' }
  ];

  const ROLES = [
    { id: 'musculo', name: 'Músculo', desc: '+confrontos e operações coletivas.' },
    { id: 'olheiro', name: 'Olheiro', desc: '-detenção e -Procurado nas operações.' },
    { id: 'negociador', name: 'Negociador', desc: '+diálogos e +influência ao criar contatos.' }
  ];
  const NICKNAMES = ['Baixinho', 'Magrão', 'Tico', 'Careca', 'Ligeirinho', 'Bigode', 'Dentinho', 'Tatu', 'Pardal', 'Juju', 'Nena', 'Lia', 'Biscoito', 'Coruja', 'Mocotó', 'Faísca', 'Chiclete', 'Tampinha', 'Sabiá', 'Paçoca', 'Quindim', 'Cabeção', 'Maré', 'Brisa', 'Tainha', 'Zóio', 'Gringo', 'Cuíca'];

  /* Facções: personalidade define pesos da IA (0 a 1). */
  const FACTIONS = [
    { id: 'esquina', name: 'Círculo da Esquina', short: 'Esquina', districts: ['centro', 'vila'], initialRelation: -10, temperament: 0,
      desc: 'Grupo antigo que preza reputação e acordos de palavra. Honra tréguas, mas não esquece traições.',
      persona: { label: 'Tradicional', aggr: .45, expand: .5, diplo: .8, honor: .95, opportunism: .15, pressure: 'extorsao' } },
    { id: 'docas', name: 'Frente dos Armazéns', short: 'Armazéns', districts: ['cais', 'industrial'], initialRelation: -20, temperament: 10,
      desc: 'Organização pragmática e expansionista dos galpões. Reage com força e testa quem parece fraco.',
      persona: { label: 'Expansionista', aggr: .9, expand: .85, diplo: .3, honor: .45, opportunism: .5, pressure: 'ataque' } },
    { id: 'aurora', name: 'Coletivo Aurora', short: 'Aurora', districts: ['jardim'], initialRelation: 0, temperament: -10,
      desc: 'Rede de intermediários que prefere influência silenciosa. Avança onde você não está e muda de lado quando convém.',
      persona: { label: 'Oportunista', aggr: .3, expand: .75, diplo: .6, honor: .25, opportunism: .9, pressure: 'denuncia' } }
  ];
  /* Inimizades entre facções (usadas na IA e no apoio de aliados). */
  const FACTION_ENEMY = { esquina: 'docas', docas: 'esquina', aurora: 'docas' };

  /* ------------------------------------------------------------------
   * Cidades. A cidade de origem define nomes de bairros, grupos, negócios
   * e festas, além de uma vantagem própria. As cidades são reais; bairros
   * e grupos são INVENTADOS (inspirados na paisagem de cada cidade) para
   * não associar comunidades reais ao crime. Os ids dos bairros são fixos
   * (centro, cais, jardim, industrial, vila) e valem para todas as cidades.
   * ------------------------------------------------------------------ */
  const CITIES = [
    { id: 'rio', name: 'Rio de Janeiro', trait: 'Cidade Maravilhosa', traitDesc: 'Carnaval dura 4 dias e serviços na orla rendem +10%.',
      districts: { centro: ['Largo dos Arcos', 'Sobrados, camelôs e samba na calçada debaixo dos arcos brancos.'], cais: ['Cais da Guanabara', 'Armazéns e guindastes de frente para a baía.'], jardim: ['Parada do Subúrbio', 'Casas simples, trem lotado e churrasquinho na esquina.'], industrial: ['Galpões da Avenida', 'Fábricas e depósitos à beira da via expressa, com patrulha pesada.'], vila: ['Praia do Posto 13', 'Quiosques, calçadão e movimento até de madrugada.'] },
      factions: { esquina: ['Velha Guarda do Largo', 'Velha Guarda'], docas: ['Turma do Cais', 'Turma do Cais'], aurora: ['Rede do Calçadão', 'Calçadão'] },
      biz: { bar: 'Boteco Pé-Sujo', oficina: 'Oficina de Motos', mercado: 'Banca do Camelódromo', logistica: 'Depósito da Avenida', show: 'Casa de Samba' },
      carnaval: 'Carnaval dos blocos', classico: 'Clássico carioca', baile: 'Bastidores do baile' },
    { id: 'sp', name: 'São Paulo', trait: 'Terra do trabalho', traitDesc: 'Todos os negócios rendem +8%.',
      districts: { centro: ['Ladeira dos Camelôs', 'Lojas de galeria, vendedores e multidão o dia inteiro.'], cais: ['Terminal de Cargas', 'Pátio de contêineres e trilhos no meio da cidade.'], jardim: ['Vila dos Sobradinhos', 'Ruas estreitas, sobrados geminados e feira de domingo.'], industrial: ['Galpões da Marginal', 'Fábricas e transportadoras à beira do rio, sob vigilância.'], vila: ['Quadra da Garoa', 'Bares, lanchonetes e casas de show sob a garoa fina.'] },
      factions: { esquina: ['Irmandade da Ladeira', 'Irmandade'], docas: ['Consórcio dos Galpões', 'Consórcio'], aurora: ['Rede Garoa', 'Garoa'] },
      biz: { bar: 'Boteco do Chope', oficina: 'Oficina de Motos', mercado: 'Loja de Galeria', logistica: 'Transportadora', show: 'Casa de Shows' },
      carnaval: 'Carnaval de rua', classico: 'Clássico paulista', baile: 'Bastidores da balada' },
    { id: 'bh', name: 'Belo Horizonte', trait: 'Capital dos botecos', traitDesc: 'O boteco rende +40% e diálogos têm +4 de chance.',
      districts: { centro: ['Mercado Velho', 'Bancas de queijo, cachaça e conversa fiada entre corredores apertados.'], cais: ['Pátio Ferroviário', 'Vagões, minério e galpões ao longo da linha do trem.'], jardim: ['Alto da Serra', 'Ladeiras, casas com varanda e vista para a serra.'], industrial: ['Polo do Minério', 'Siderúrgicas e pátios de carga com patrulha reforçada.'], vila: ['Rua dos Botecos', 'Mesa na calçada, tira-gosto e música ao vivo.'] },
      factions: { esquina: ['Confraria do Mercado', 'Confraria'], docas: ['Turma do Trilho', 'Trilho'], aurora: ['Rede das Gerais', 'Gerais'] },
      biz: { bar: 'Buteco de Esquina', oficina: 'Oficina de Motos', mercado: 'Banca do Mercado', logistica: 'Pátio de Cargas', show: 'Casa de Shows' },
      carnaval: 'Carnaval de rua', classico: 'Clássico mineiro', baile: 'Bastidores do forró' },
    { id: 'salvador', name: 'Salvador', trait: 'Terra da festa', traitDesc: 'Carnaval dura 5 dias e a equipe ganha +1 de ânimo por dia.',
      districts: { centro: ['Largo das Ladeiras', 'Casarões coloridos, tambores e turistas subindo e descendo.'], cais: ['Cais da Baía', 'Saveiros, armazéns e o movimento do porto na baía.'], jardim: ['Alto das Mangueiras', 'Bairro de moradores antigos, quintais e terreiros de festa.'], industrial: ['Polo do Recôncavo', 'Indústrias e tanques com segurança reforçada.'], vila: ['Orla do Dendê', 'Barracas de praia, tabuleiros e som alto na areia.'] },
      factions: { esquina: ['Irmandade das Ladeiras', 'Irmandade'], docas: ['Estiva da Baía', 'Estiva'], aurora: ['Rede do Dendê', 'Dendê'] },
      biz: { bar: 'Barraca da Orla', oficina: 'Oficina de Motos', mercado: 'Mercadinho do Largo', logistica: 'Armazém do Polo', show: 'Casa de Axé' },
      carnaval: 'Carnaval dos trios', classico: 'Clássico baiano', baile: 'Bastidores do pagodão' },
    { id: 'recife', name: 'Recife', trait: 'Cidade das pontes', traitDesc: 'Viajar entre bairros custa metade do dinheiro e nenhuma energia.',
      districts: { centro: ['Pátio dos Sobrados', 'Sobrados antigos, mascates e orquestra de frevo ensaiando.'], cais: ['Cais das Pontes', 'Armazéns entre rios e pontes, com barcos atracados.'], jardim: ['Beira do Mangue', 'Palafitas, pescadores e ruas que alagam na maré cheia.'], industrial: ['Galpões da BR', 'Depósitos e fábricas à beira da rodovia, bem vigiados.'], vila: ['Ladeira dos Bonecos', 'Ateliês, bonecos gigantes e bares na ladeira.'] },
      factions: { esquina: ['Clube do Pátio', 'Clube'], docas: ['Frente das Pontes', 'Pontes'], aurora: ['Maré Mansa', 'Maré'] },
      biz: { bar: 'Bar do Caldinho', oficina: 'Oficina de Motos', mercado: 'Mercadinho do Pátio', logistica: 'Galpão da BR', show: 'Casa de Frevo' },
      carnaval: 'Carnaval do frevo', classico: 'Clássico pernambucano', baile: 'Bastidores do brega' },
    { id: 'poa', name: 'Porto Alegre', trait: 'Disciplina gaúcha', traitDesc: 'Treinos custam 10% menos.',
      districts: { centro: ['Largo do Mercado', 'Bancas, erva-mate e gente apressada em volta do mercado.'], cais: ['Cais do Guaíba', 'Armazéns antigos e o pôr do sol sobre a água.'], jardim: ['Vila dos Plátanos', 'Ruas arborizadas, casas baixas e armazém de esquina.'], industrial: ['Distrito das Chaminés', 'Fábricas antigas e galpões com vigilância constante.'], vila: ['Rua da Boemia', 'Bares, churrasquinho e música até tarde.'] },
      factions: { esquina: ['Velhos do Mercado', 'Mercado'], docas: ['Turma do Guaíba', 'Guaíba'], aurora: ['Rede Minuano', 'Minuano'] },
      biz: { bar: 'Boteco da Boemia', oficina: 'Oficina de Motos', mercado: 'Banca do Mercado', logistica: 'Galpão das Chaminés', show: 'Casa de Shows' },
      carnaval: 'Carnaval de rua', classico: 'Clássico gaúcho', baile: 'Bastidores do baile' }
  ];

  /* ------------------------------------------------------------------
   * v0.7 — Feira do Rolo, Galpão e Vida noturna.
   * Tudo é comércio abstrato: comprar, produzir, transportar e vender.
   * Não há receitas, métodos nem qualquer detalhe aplicável ao mundo real.
   * ------------------------------------------------------------------ */
  /* Equipamentos: um por espaço (arma, proteção, veículo). `unlock` é o respeito exigido. */
  const ITEMS = [
    // Armas: do improviso ao arsenal pesado. `loud` = arma de fogo; `heavy` = chama atenção todo dia.
    { id: 'porrete', slot: 'arma', name: 'Pedaço de pau com prego', cost: 150, unlock: 0, power: 1 },
    { id: 'soco', slot: 'arma', name: 'Chave de fenda amolada', cost: 900, unlock: 0, power: 2 },
    { id: 'vergalhao', slot: 'arma', name: 'Vergalhão de obra', cost: 1500, unlock: 8, power: 3 },
    { id: 'peixeira', slot: 'arma', name: 'Facão', cost: 2200, unlock: 15, power: 4 },
    { id: 'maquita', slot: 'arma', name: 'Maquita', cost: 3000, unlock: 25, power: 5 },
    { id: 'trezoitao', slot: 'arma', name: 'Três-oitão raspado', cost: 3500, unlock: 35, power: 7 },
    { id: 'pistola', slot: 'arma', name: 'Pistola .40', cost: 4500, unlock: 60, power: 9 },
    { id: 'doze', slot: 'arma', name: 'Doze de cano serrado', cost: 6000, unlock: 80, power: 11 },
    { id: 'uzi', slot: 'arma', name: 'Uzi de pente estendido', cost: 7500, unlock: 100, power: 13 },
    { id: 'submetra', slot: 'arma', name: 'Submetralhadora', cost: 9000, unlock: 115, power: 14 },
    { id: 'fuzil', slot: 'arma', name: 'FAL 7.62, o Vovô', cost: 10500, unlock: 130, power: 16 },
    { id: 'ar15', slot: 'arma', name: 'Fuzil AR-15', cost: 13000, unlock: 150, power: 18, heavy: true },
    { id: 'ponto50', slot: 'arma', name: 'Ponto Cinquenta', cost: 18000, unlock: 175, power: 21, heavy: true },
    { id: 'mag', slot: 'arma', name: 'Metralhadora MAG', cost: 24000, unlock: 200, power: 24, heavy: true },
    { id: 'rojao', slot: 'arma', name: 'Lança-rojão', cost: 30000, unlock: 220, power: 26, heavy: true },
    { id: 'dourado', slot: 'arma', name: 'Fuzil dourado de tambor duplo', cost: 30000, unlock: 150, power: 26, heavy: true, trophy: 'reidopedaco' },
    // Proteção
    { id: 'lista', slot: 'protecao', name: 'Lista telefônica com silver tape', cost: 200, unlock: 0, def: 1 },
    { id: 'jaqueta', slot: 'protecao', name: 'Camisa de time na cara e jaqueta de couro', cost: 1000, unlock: 0, def: 2 },
    { id: 'colete', slot: 'protecao', name: 'Colete de vigilante vencido', cost: 2800, unlock: 30, def: 5 },
    { id: 'kevlar', slot: 'protecao', name: 'Colete de kevlar da polícia', cost: 4500, unlock: 60, def: 7 },
    { id: 'tatico', slot: 'protecao', name: 'Colete tático com placa de cerâmica', cost: 7000, unlock: 90, def: 9 },
    { id: 'traje', slot: 'protecao', name: 'Traje tático com escudo balístico', cost: 12000, unlock: 140, def: 12 },
    // Veículos
    { id: 'bike', slot: 'veiculo', name: 'Bicicleta cargueira', cost: 300, unlock: 0, cargo: 10, escape: 1 },
    { id: 'cinquentinha', slot: 'veiculo', name: 'Cinquentinha', cost: 1800, unlock: 10, cargo: 15, escape: 3 },
    { id: 'moto', slot: 'veiculo', name: 'Moto 150', cost: 4000, unlock: 40, cargo: 25, escape: 6, freeRide: true },
    { id: 'opala', slot: 'veiculo', name: 'Opala preto', cost: 7500, unlock: 80, cargo: 60, escape: 8, freeRide: true },
    { id: 'blindado', slot: 'veiculo', name: 'Carro blindado', cost: 15000, unlock: 150, cargo: 90, escape: 12, freeRide: true }
  ];
  const SLOTS = [{ id: 'arma', name: 'Arma' }, { id: 'protecao', name: 'Proteção' }, { id: 'veiculo', name: 'Veículo' }];
  /** v1.5: começa sem dinheiro nenhum (só o legado, a partir da 2ª temporada). */
  const START_CASH = 0;
  const ITEM_RESALE = 0.5;
  /* Mercadorias: preço = base × fator do bairro (60–150%). `risk` pesa na vigilância e nas blitze. */
  const GOODS = [
    { id: 'cigarro', name: 'Cigarro da fronteira', unit: 'pacote', base: 20, risk: 1, unlock: 0 },
    { id: 'bebida', name: 'Whisky falsificado', unit: 'caixa', base: 45, risk: 1, unlock: 10 },
    { id: 'erva', name: 'Erva', unit: 'tijolo', base: 70, risk: 2, unlock: 20 },
    { id: 'eletro', name: 'Eletrônico sem nota', unit: 'caixa', base: 120, risk: 2, unlock: 30 },
    { id: 'bala', name: 'Bala', unit: 'cartela', base: 160, risk: 3, unlock: 60 },
    { id: 'po', name: 'Pó', unit: 'pacote', base: 300, risk: 4, unlock: 100 },
    { id: 'gelo', name: 'Gelo saborizado', unit: 'caixa', base: 10, risk: 0, unlock: 0 },
    { id: 'lolo', name: 'Loló', unit: 'frasco', base: 110, risk: 3, unlock: 45 }
  ];
  const SELL_SPREAD = 0.95;
  /* Produção própria: gera mercadoria todo dia; batidas policiais dependem da sua vigilância. */
  /* v1.4: sete esquemas, do gelo à refinaria. Só nome, custo e risco: nada de método.
   * `cash` rende dinheiro no banco em vez de mercadoria; `bribe` é propina fixa por nível,
   * que corta pela metade a chance de batida; `good2/out2` é a segunda mercadoria do ponto. */
  const LABS = [
    { id: 'gelo', name: 'Fábrica de gelo saborizado', good: 'gelo', cost: 500, unlock: 0, out: 10, desc: 'Gelo de coco e de melancia para os bailes de rua. O primeiro esquema de quem saiu da sarjeta.' },
    { id: 'paraguai', name: 'Galpão de cigarro do Paraguai', good: 'cigarro', cost: 1200, unlock: 8, out: 9, desc: 'Contrabando clássico de caixa fechada: giro rápido e retorno garantido.' },
    { id: 'alambique', name: 'Depósito de bebida falsa', good: 'bebida', cost: 2000, unlock: 15, out: 7, desc: 'Rótulo importado, procedência nenhuma. Vende no mercado ou abastece o seu Inferninho.' },
    { id: 'gatonet', name: 'Central de internet (gatonet)', cash: 200, cost: 3200, unlock: 25, desc: 'Clientes pendurados nos postes pagam a mensalidade em dia. Dinheiro limpo direto no banco, sem estoque e sem batida.' },
    { id: 'plantacao', name: 'Plantação de maconha', good: 'erva', cost: 3600, unlock: 35, out: 6, desc: 'Terreno escondido e vigia contra batida. Fardos de valor alto para o mercado.' },
    { id: 'laboratorio', name: 'Laboratório químico', good: 'bala', out: 4, good2: 'lolo', out2: 3, cost: 7000, unlock: 80, bribe: 60, desc: 'Loló e bala em escala. Paga propina fixa para a fiscalização olhar para o outro lado.' },
    { id: 'refinaria', name: 'Refinaria do pó', good: 'po', cost: 25000, unlock: 150, out: 3, bribe: 150, desc: 'O topo do império. Cada lote vendido no Navio vale uma fortuna e dispara o respeito.' }
  ];
  const LAB_MULT = [0, 1, 1.8, 2.6];
  /* Vida noturna: troca dinheiro por energia, com ressaca no dia seguinte. */
  /* v1.4: a casa cobra a entrada (e traz os riscos dela); a energia vem das doses do cardápio. */
  const NIGHT = [
    { id: 'boteco', name: 'Boteco do Zé', desc: 'Cerveja quente, pinga com mel e café no copo americano. Pra quem ainda não é ninguém.', cost: 10, raid: 8, menu: ['cigarro', 'cerveja', 'pinga'] },
    { id: 'pagode', name: 'Pagode na laje', desc: 'Churrasquinho de gato e balde de latão. Bom lugar para firmar contato e animar o bonde.', cost: 40, morale: 4, contact: 60, raid: 4, menu: ['cigarro', 'cerveja', 'pinga', 'erva'] },
    { id: 'baile', name: 'Baile de favela', desc: 'Copão até de manhã. Recarrega muito, mas é onde se cruza com gente de outra gangue.', cost: 60, morale: 3, heat: 2, brawl: 22, raid: 10, menu: ['cigarro', 'cerveja', 'whisky', 'erva', 'lolo'] },
    { id: 'inferninho', name: 'Inferninho da Luz Vermelha', desc: 'Luz vermelha, som alto e porta fechada. Pra quem não quer perder tempo.', cost: 150, heat: 3, raid: 12, unlock: 40, menu: ['cigarro', 'whisky', 'lolo', 'bala'] },
    { id: 'termas', name: 'Termas VIP', desc: 'Fachada com manobrista e segurança armada na porta. Os chefões fecham negócio na suíte presidencial.', cost: 400, unlock: 60, boss: true, menu: ['whisky', 'bala', 'po'] }
  ];
  /* Cardápio: quanto mais forte, mais energia por dose e mais vício. `good` = pode vir do seu estoque. */
  const DOSES = [
    { id: 'cigarro', name: 'Cigarro', energy: 2, vicio: 0, ressaca: 0, price: 8, max: 5, good: 'cigarro', desc: 'Inteira os pontinhos que faltam para o próximo roubo. Até 5 por dia.' },
    { id: 'cerveja', name: 'Cerveja', energy: 5, vicio: 1, ressaca: 0, price: 15, desc: 'O combustível do começo da noite.' },
    { id: 'pinga', name: 'Pinga', energy: 10, vicio: 2, ressaca: 1, price: 30, desc: 'Barata e direta, para quem ainda rouba de peixeira.' },
    { id: 'whisky', name: 'Whisky falsificado', energy: 20, vicio: 4, ressaca: 1, price: 70, azia: 12, good: 'bebida', desc: 'Copão batizado: às vezes dá azia braba (−5 de saúde).' },
    { id: 'erva', name: 'Erva', energy: 30, vicio: 4, ressaca: 0, price: 100, good: 'erva', desc: 'O melhor custo-benefício: muita energia, pouco vício.' },
    { id: 'lolo', name: 'Loló', energy: 50, vicio: 10, ressaca: 2, price: 180, strong: true, good: 'lolo', desc: 'Dois e a barra enche. Com vício alto, risco de teto preto.' },
    { id: 'bala', name: 'Bala', energy: 75, vicio: 18, ressaca: 3, price: 300, strong: true, good: 'bala', desc: 'Para quem não quer perder tempo. Vício muito alto.' },
    { id: 'po', name: 'Pó', energy: 100, vicio: 30, ressaca: 3, price: 600, strong: true, good: 'po', desc: 'Um só e o cansaço some. Vício extremo: a clínica cobra caro depois.' }
  ];
  const DOSE_LIMIT = 15;
  /* v1.4: o corpo se acostuma. Cada dose do mesmo tipo no dia rende 15% menos (zera ao dormir)
   * e, somando tudo, as doses devolvem no máximo CHEM_CAP de energia por dia. */
  const TOLERANCE = .85;
  const CHEM_CAP = 150;
  /* Casa da noite abastecida com a sua produção: +70% da renda base no dia. */
  const SUPPLY_BONUS = .7;
  const SUPPLY = [
    { biz: 'inferninho', labs: ['alambique', 'laboratorio'], goods: ['bebida', 'lolo', 'bala'], qty: 5 },
    { biz: 'termas', labs: ['refinaria'], goods: ['po'], qty: 2 }
  ];

  /* ------------------------------------------------------------------
   * v0.8 — Saúde, hospital e duelos de rua.
   * Adversários são personagens inventados. O duelo é uma disputa abstrata
   * (sem descrição de violência); o resultado mexe em saúde, dinheiro e fama.
   * ------------------------------------------------------------------ */
  const RIVALS = [
    { id: 'marrento', name: 'Zé Marrento', desc: 'Fala alto na porta do bar. Bom para começar.', rating: 12, unlock: 0, low: 80, high: 160, respect: 1 },
    { id: 'tonhao', name: 'Tonhão da Feira', desc: 'Carrega caixa o dia inteiro e não leva desaforo.', rating: 22, unlock: 10, low: 150, high: 280, respect: 2 },
    { id: 'bagre', name: 'Cabeça de Bagre', desc: 'Teimoso. Perde e volta no dia seguinte.', rating: 30, unlock: 20, low: 220, high: 400, respect: 2 },
    { id: 'maozinha', name: 'Mãozinha', desc: 'Rápido demais para o tamanho que tem.', rating: 40, unlock: 35, low: 320, high: 560, respect: 3 },
    { id: 'galego', name: 'Galego do Fliperama', desc: 'Nunca perdeu uma aposta na vida. Diz ele.', rating: 52, unlock: 55, low: 450, high: 800, respect: 4 },
    { id: 'sargento', name: 'Sargento Bigode', desc: 'Ex-segurança de casa noturna. Calmo e perigoso.', rating: 64, unlock: 80, low: 650, high: 1100, respect: 5 },
    { id: 'carcara', name: 'Carcará', desc: 'Chega quieto e sai com o dinheiro dos outros.', rating: 78, unlock: 110, low: 900, high: 1500, respect: 6 },
    { id: 'rei', name: 'Rei do Pedaço', desc: 'Ninguém lembra a última vez que ele perdeu.', rating: 95, unlock: 150, low: 1400, high: 2300, respect: 9 }
  ];
  const DUEL_LIMIT = 3;
  const DUEL_ENERGY = 15;
  const CLINIC_PRICE = 12; // por ponto de saúde

  /* ------------------------------------------------------------------
   * v1.0 — Assaltos do bando em etapas: planejar → reconhecer → executar → dividir.
   * `need` = gente no bando (integrantes + avulsos contratados no plano);
   * `minPower` = poder mínimo da arma do líder; `rating` = dificuldade.
   * ------------------------------------------------------------------ */
  const HEISTS = [
    { id: 'arrastao', name: 'Arrastão no shopping', desc: 'Vitrine de celular e relógio, fuga de moto pelo estacionamento.', need: 3, unlock: 30, sede: 1, minPower: 3, rating: 50, plan: 400, hire: 300, low: 2200, high: 3600, heat: 18, arrest: 30, respect: 8 },
    { id: 'rodovia', name: 'Bloqueio na rodovia', desc: 'Fechar a pista de madrugada e levar a carreta inteira.', need: 5, unlock: 55, sede: 2, minPower: 9, rating: 80, plan: 900, hire: 450, low: 5000, high: 8000, heat: 24, arrest: 36, respect: 12 },
    { id: 'agencia', name: 'Agência no interior', desc: 'Cidade pequena, uma viatura só e o cofre cheio no dia do pagamento.', need: 6, unlock: 80, sede: 3, minPower: 13, rating: 110, plan: 1600, hire: 600, low: 9000, high: 14000, heat: 30, arrest: 42, respect: 18 },
    { id: 'carroforte', name: 'Carro-forte na serra', desc: 'Curva fechada, neblina e blindagem que não cede fácil.', need: 8, unlock: 105, sede: 4, minPower: 16, rating: 140, plan: 2600, hire: 800, low: 15000, high: 22000, heat: 34, arrest: 46, respect: 24 },
    { id: 'transportadora', name: 'Base da transportadora de valores', desc: 'Muro alto, segurança armada e o cofre central da região.', need: 10, unlock: 130, sede: 5, minPower: 18, rating: 170, plan: 4000, hire: 1000, low: 24000, high: 34000, heat: 38, arrest: 50, respect: 32 },
    { id: 'cofrecentral', name: 'Cofre central', desc: 'O golpe da temporada. Quem fizer vira lenda; quem errar, vira notícia.', need: 12, unlock: 155, sede: 6, minPower: 21, rating: 200, plan: 6000, hire: 1300, low: 38000, high: 52000, heat: 45, arrest: 55, respect: 45 }
  ];
  const HEIST_MAX_HIRES = 4;
  const HEIST_WINDOW = 5;     // dias para executar depois de planejar
  const HEIST_COOLDOWN = 3;   // dias de espera depois de executar
  const HEIST_CUT = 0.25;     // parte do bando
  const cityOf = name => CITIES.find(c => c.name === name) || CITIES[0];
  const cityIs = (s, id) => cityOf(s.city).id === id;
  let appliedCity = null;
  /** Aplica os nomes da cidade às tabelas (apenas textos; nenhuma regra muda aqui). */
  function applyCity(name) {
    const c = cityOf(name);
    if (appliedCity === c.id) return c;
    appliedCity = c.id;
    for (const d of DISTRICTS) { d.name = c.districts[d.id][0]; d.desc = c.districts[d.id][1]; }
    for (const f of FACTIONS) { f.name = c.factions[f.id][0]; f.short = c.factions[f.id][1]; }
    for (const b of BUSINESSES) if (c.biz[b.id]) b.name = c.biz[b.id];
    EVENTS.carnaval.title = c.carnaval; EVENTS.classico.title = c.classico;
    MISSIONS.find(m => m.id === 'baile').name = c.baile;
    return c;
  }

  /* Fases da carreira (por respeito) e quando cada lugar da cidade se abre.
     Quem já fechou uma temporada vê tudo aberto desde o começo. */
  const PAYDAY_MISSIONS = ['deposito', 'caixa', 'loterica', 'cofre'];
  const ANIMALS = ['Avestruz', 'Águia', 'Burro', 'Borboleta', 'Cachorro', 'Cabra', 'Carneiro', 'Camelo', 'Cobra', 'Coelho', 'Cavalo', 'Elefante', 'Galo', 'Gato', 'Jacaré', 'Leão', 'Macaco', 'Porco', 'Pavão', 'Peru', 'Touro', 'Tigre', 'Urso', 'Veado', 'Vaca'];
  const BET_LIMIT = 6;
  const BET_MAX = 20000;
  /* As quatro semanas do mês: dão o ritmo da temporada. */
  const WEEKS = [
    { until: 7, name: 'Semana 1 · A corrida da sarjeta', desc: 'Saia do pedaço de pau: junte o primeiro capital.' },
    { until: 15, name: 'Semana 2 · A construção do império', desc: 'Invista: casas da noite, banca, galpão e produção.' },
    { until: 23, name: 'Semana 3 · O bonde pesado', desc: 'Fuzil, colete e os grandes golpes com o bando.' },
    { until: 30, name: 'Semana 4 · Tudo ou nada', desc: 'Reta final: defenda a posição ou arrisque tudo.' }
  ];
  const week = s => WEEKS.find(w => s.day <= w.until) || WEEKS[3];
  const PHASES = [
    { at: 0, name: 'Pé de chinelo', desc: 'Sobrevivência e improviso: roube, recarregue na noite, compre a primeira arma.' },
    { at: 30, name: 'Rato de pista', desc: 'Bando, negócios, mercadoria e bairros: o dinheiro de verdade.' },
    { at: 90, name: 'Linha de frente', desc: 'Assaltos grandes, arma pesada e guerra pelos bairros.' },
    { at: 150, name: 'Gerente do movimento', desc: 'Império montado: os maiores golpes da temporada.' },
    { at: 230, name: 'Dono do morro', desc: 'O topo da cidade.' }
  ];
  const GATES = { apostas: 8, duelos: 10, galpao: 15, cidade: 20, gangue: 30 };
  const phaseIndex = s => PHASES.filter(p => s.respect >= p.at).length - 1;
  const phase = s => PHASES[phaseIndex(s)];
  const placeOpen = (s, view) => !GATES[view] || s.respect >= GATES[view] || s.seasonHistory.length > 0 || (view === 'gangue' && !!s.gangName);

  /* Primeiros passos: trilha guiada com pequenas recompensas. `view` é a tela onde o passo acontece. */
  const TUTORIAL = [
    { id: 'career', title: 'Escolha sua especialização', text: 'Ela define seu estilo na temporada: Assaltante vive de roubo, Dono da Noite das casas, Traficante da produção e Bicheiro dos esquemas de rua e do banco.', view: 'painel', cta: 'Ver especializações', reward: 0, check: s => !!s.career },
    { id: 'mission', title: 'Faça seu primeiro roubo', text: 'Roubar gasta energia e rende dinheiro e respeito. Olhe a chance antes: falhar custa caixa e pode dar cadeia.', view: 'acoes', cta: 'Ir roubar', reward: 80, check: s => s.successful + s.failed >= 1 },
    { id: 'gear', title: 'Compre sua primeira arma', text: 'Arma é o que abre os roubos maiores. Comece com o que o bolso permite: um pedaço de pau já serve.', view: 'feira', cta: 'Ir à Feira do Rolo', reward: 60, check: s => !!s.gear.arma },
    { id: 'night', title: 'Recarregue na noitada', text: 'Acabou a energia? Entre no Boteco e peça uma dose: dinheiro vira energia para continuar hoje. Amanhã vem a ressaca, e cada dose sobe o vício.', view: 'noite', cta: 'Ir para a noite', reward: 40, check: s => s.tutorial.nighted },
    { id: 'train', title: 'Treine um atributo', text: 'Cada roubo usa um atributo. Treinar aumenta a chance e o seu poder de luta.', view: 'acoes', cta: 'Ir treinar', reward: 60, check: s => s.tutorial.trained },
    { id: 'day', title: 'Durma: vire o dia', text: 'Sem energia e sem saída na noite, durma: +70 de energia, o Procurado cai, a renda entra e os grupos se movem. A temporada tem 30 dias.', view: 'painel', cta: 'Voltar para a rua', reward: 60, check: s => s.day >= 2 },
    { id: 'goal', title: 'Escolha a meta da temporada', text: 'A meta é o seu norte: cumprir rende bônus e pontos. Escolha até o dia 5.', view: 'temporada', cta: 'Escolher meta', reward: 0, check: s => !!s.goal || s.day > 5 },
    { id: 'bank', title: 'Guarde dinheiro no banco', text: 'Falhas tiram parte do dinheiro em mãos. O banco protege, cobrando uma taxa pequena.', view: 'gestao', cta: 'Abrir banco', reward: 40, check: s => s.tutorial.banked },
    { id: 'gang', title: 'Chegue a 30 de respeito e funde seu bando', text: 'Sozinho você não chega ao dinheiro de verdade. Com o bando vêm os assaltos planejados, os confrontos e os acordos.', view: 'gangue', cta: 'Abrir bando', reward: 200, check: s => !!s.gangName }
  ];

  /* Eventos: mods são números ou funções (ctx, evento) → número.
     Chaves terminadas em Mult multiplicam; demais somam. */
  const inD = (e, c, v) => (c && c.district === e.district) ? v : 0;
  const EVENTS = {
    rotina: { title: 'Rotina normal', desc: 'Sem acontecimentos importantes. A cidade segue seu ritmo.', dur: [1, 1], weight: 4, mods: {} },
    movimentado: { title: 'Dia movimentado', desc: 'Comércio aquecido: missões rendem +12% em toda a cidade.', dur: [1, 1], weight: 3, mods: { reward: 12 } },
    fiscalizacao: { title: 'Fiscalização reforçada', desc: 'Missões com -8 de chance e Procurado gerado +20%.', dur: [2, 2], weight: 3, mods: { risk: 8, heatMult: 1.2 } },
    festival: { title: 'Festival de rua', desc: 'Missões +9%, risco +4. {bar} e {show} lucram +30%.', dur: [1, 1], weight: 2, mods: { reward: 9, risk: 4, bizMult: c => c.biz && c.biz.tags.includes('festa') ? 1.3 : 1 } },
    patrulhas: { title: 'Patrulhas reduzidas', desc: 'Risco -7 nas missões e Procurado cai 5 extras.', dur: [1, 1], weight: 2, mods: { risk: -7, heatDecay: 5 } },
    comercio: { title: 'Semana de comércio', desc: 'Missões +6% e todos os negócios +12% por 3 dias.', dur: [3, 3], weight: 2, mods: { reward: 6, bizMult: 1.12 } },
    carnaval: { title: 'Carnaval', desc: 'Blocos nas ruas: missões em {centro} e {vila} +25% (demais +8%), risco +4, multidões escondem (Procurado gerado -10%). {bar} +60% e {show} +80%. Equipe +3 de ânimo por dia.', dur: [3, 3], fixed: 9, weight: 0,
      mods: { reward: c => (c.district === 'centro' || c.district === 'vila') ? 25 : 8, risk: 4, heatMult: .9, morale: 3, bizMult: c => c.biz ? (c.biz.id === 'show' ? 1.8 : c.biz.id === 'bar' ? 1.6 : 1) : 1, festive: 1 } },
    classico: { title: 'Clássico no estádio', desc: 'A cidade para pelo futebol: {bar} +100%, {show} +40%, risco +8 em {centro} e equipe +5 de ânimo.', dur: [1, 1], fixed: 20, weight: 0,
      mods: { risk: c => c.district === 'centro' ? 8 : 0, morale: 5, bizMult: c => c.biz ? (c.biz.id === 'bar' ? 2 : c.biz.id === 'show' ? 1.4 : 1) : 1 } },
    saojoao: { title: 'Arraial em {d}', desc: 'Festa junina: missões em {jardim} +20%, economia local em alta, {oficina} +20% e equipe +2 de ânimo.', dur: [2, 2], weight: 1, district: 'jardim',
      mods: { reward: (c, e) => inD(e, c, 20), econ: (c, e) => inD(e, c, .15), morale: 2, bizMult: c => c.biz && c.biz.id === 'oficina' ? 1.2 : 1, festive: 1 } },
    crise: { title: 'Crise no comércio', desc: 'Economia em queda por 4 dias: negócios -25%, missões -8%, bicos -20%. Em compensação, recrutar custa 30% menos.', dur: [4, 4], weight: 1,
      mods: { econ: -.2, bizMult: .75, reward: -8, recruitMult: .7, gigMult: .8, crisis: 1 } },
    operacao: { title: 'Operação policial em {d}', desc: 'Polícia no bairro +35 ao começar e risco +15 no bairro por 2 dias.', dur: [2, 2], weight: 2, randomDistrict: true,
      onStart: (s, e) => { s.dstate[e.district].vigil = clamp(s.dstate[e.district].vigil + 35, 0, 100); },
      mods: { risk: (c, e) => inD(e, c, 15), heatMult: 1 } },
    greve: { title: 'Greve em {d}', desc: '{cais} com economia -30% e missões -20% por 3 dias. {docas} perde força.', dur: [3, 3], weight: 1, district: 'cais',
      onStart: s => { s.factions.docas.power = clamp(s.factions.docas.power - 8, 10, 100); },
      mods: { econ: (c, e) => inD(e, c, -.3), reward: (c, e) => inD(e, c, -20) } },
    guerra: { title: 'Guerra entre facções em {d}', desc: 'Facções se enfrentam: disputas e confrontos no bairro +12, risco local +6.', dur: [2, 2], weight: 0,
      mods: { dispute: (c, e) => inD(e, c, 12), risk: (c, e) => inD(e, c, 6) } },
    feriadao: { title: 'Feriadão prolongado', desc: 'Por 3 dias: +15 de energia ao amanhecer e negócios +15%. Missões -5%.', dur: [3, 3], weight: 1, mods: { energy: 15, bizMult: 1.15, reward: -5 } },
    eleicao: { title: 'Eleição municipal', desc: 'Por 4 dias: risco +5 e ações de influência +40%.', dur: [4, 4], weight: 1, mods: { risk: 5, influenceMult: 1.4 } },
    pagamento: { title: 'Dia de pagamento', desc: 'A cidade está cheia de dinheiro vivo: Mercadinho, Caixa eletrônico, Lotérica, Cofre da joalheria e os assaltos do bando rendem +30%.', dur: [1, 1], fixedDays: [5, 20], weight: 0, mods: { payday: 1 } },
    fluxo: { title: 'Noite de fluxo', desc: 'Fim de semana: seus negócios da noite rendem o dobro, mas a chance de batida nos lugares baratos sobe.', dur: [1, 1], fixedDays: [6, 7, 13, 14, 21, 27], weight: 0, mods: { bizMult: c => c.biz && c.biz.tags.includes('noite') ? 2 : 1, nightRiskMult: 1.6 } },
    fechames: { title: 'Operação Fecha-Mês', desc: 'A polícia quer bater meta: risco +8 nos roubos e Procurado gerado +15% até o fim do mês. No dia 30 atraca o Último Navio, pagando 25% a mais.', dur: [3, 3], fixed: 28, weight: 0, mods: { risk: 8, heatMult: 1.15 } },
    temporal: { title: 'Temporal de verão', desc: 'Chuva forte: missões -10%, risco -5 e -10 de energia ao amanhecer.', dur: [1, 1], weight: 2, mods: { reward: -10, risk: -5, energy: -10 } }
  };
  /* Mapeia o antigo eventIndex (0.1–0.4) para os eventos atuais. */
  const LEGACY_EVENTS = ['movimentado', 'fiscalizacao', 'festival', 'rotina', 'patrulhas', 'comercio'];

  /* Notícias com decisões. `when` limita quando podem aparecer. */
  const NEWS = [
    { id: 'feira', name: 'Feira do bairro', desc: 'O comércio local organiza uma feira. Seu apoio pode melhorar seus contatos.', choices: [
      { label: 'Patrocinar a feira', desc: 'R$ 180 · +14 influência local · +2 respeito', cash: 180, influence: 14, respect: 2 },
      { label: 'Ajudar na montagem', desc: '25 energia · +R$ 90 · +7 influência local', energy: 25, influence: 7, money: 90 }] },
    { id: 'fiscalizacao', name: 'Boletim de fiscalização', desc: 'A cidade intensificou a fiscalização. Há caminhos para reduzir sua exposição.', choices: [
      { label: 'Contratar assessoria jurídica', desc: 'R$ 260 · -24 de Procurado', cash: 260, heat: -24 },
      { label: 'Diminuir o ritmo', desc: '18 energia · -12 de Procurado', energy: 18, heat: -12 }] },
    { id: 'boatos', name: 'Rumores na vizinhança', desc: 'O grupo que lidera o bairro espalha boatos sobre você.', choices: [
      { label: 'Organizar reunião', desc: 'R$ 160 e 12 energia · +12 influência · presença rival -8 · relação +6', cash: 160, energy: 12, influence: 12, rival: -8, relation: 6 },
      { label: 'Responder publicamente', desc: '18 energia · +4 respeito · +10 de Procurado · presença rival +6 · tensão +8', energy: 18, respect: 4, heat: 10, rival: 6, tension: 8 }] },
    { id: 'festival', name: 'Festival da cidade', desc: 'Um festival movimenta clientes e abre oportunidades.', choices: [
      { label: 'Investir em barracas', desc: 'R$ 320 agora · R$ 480 amanhã', cash: 320, nextBonus: 480, notLastDay: true },
      { label: 'Ajudar na produção', desc: '25 energia · +R$ 150 · +6 influência', energy: 25, money: 150, influence: 6 }] },
    { id: 'comercio', name: 'Convite de comerciantes', desc: 'Uma associação comercial pede apoio para reorganizar a região.', choices: [
      { label: 'Apoiar a associação', desc: 'R$ 240 · +10 influência · presença rival -4', cash: 240, influence: 10, rival: -4 },
      { label: 'Oferecer seu tempo', desc: '20 energia · +6 influência · -5 de Procurado', energy: 20, influence: 6, heat: -5 }] },
    { id: 'informante', name: 'Informante de confiança', desc: 'Alguém oferece dicas sobre a rotina da cidade.', choices: [
      { label: 'Pagar pela dica', desc: 'R$ 250 · próxima missão hoje ou amanhã +12 de chance', cash: 250, tip: 2 },
      { label: 'Desconfiar', desc: 'Sem custo · -4 de Procurado', heat: -4 }] },
    { id: 'insatisfacao', name: 'Integrantes reclamam', desc: 'Sua equipe está desanimada e cobra reconhecimento.', when: s => !!s.gangName && s.crewMorale < 50 && s.crew.length > 0, choices: [
      { label: 'Pagar uma gratificação', desc: 'R$ 60 por integrante · +20 ânimo', cashPerMember: 60, morale: 20 },
      { label: 'Conversar com o grupo', desc: '15 energia · +8 ânimo', energy: 15, morale: 8 }] },
    { id: 'sociedade', name: 'Proposta de sociedade', desc: 'Um comerciante oferece participação num negócio de bairro.', when: s => s.businesses.length > 0 || s.career === 'empreendedor', choices: [
      { label: 'Investir R$ 800', desc: '+R$ 95 por dia durante 10 dias (sujeito à economia)', cash: 800, contract: { daily: 95, days: 10 } },
      { label: 'Recusar', desc: 'Sem custo', none: true }] },
    { id: 'aliado', name: 'Seu aliado pede apoio', desc: 'Um grupo aliado precisa de ajuda contra um rival.', when: s => FACTIONS.some(f => s.factions[f.id].allied), choices: [
      { label: 'Mandar ajuda', desc: 'R$ 300 e 15 energia · relação +12 · inimigo do aliado: tensão +10', cash: 300, energy: 15, allyHelp: true },
      { label: 'Negar ajuda', desc: 'Relação com o aliado -20 (a aliança pode acabar)', allyRefuse: true }] },
    { id: 'oferta', name: 'Proposta de acordo', desc: 'Um grupo rival manda um recado propondo um acordo.', offer: true, choices: [
      { label: 'Aceitar o acordo', desc: 'Trégua de 3 dias sem custo · relação +5', acceptOffer: true },
      { label: 'Recusar', desc: 'Relação -5', declineOffer: true }] }
  ];

  const CATEGORIES = [
    { id: 'fortuna', name: 'Fortuna', desc: 'Patrimônio final (caixa, banco e revenda dos negócios).', unit: 'money', tiers: [6500, 10000, 14500] },
    { id: 'fama', name: 'Fama', desc: 'Respeito acumulado na temporada.', unit: 'num', tiers: [95, 135, 185] },
    { id: 'territorio', name: 'Território', desc: 'Soma dos dias liderando bairros.', unit: 'num', tiers: [10, 25, 45] },
    { id: 'diplomacia', name: 'Diplomacia', desc: 'Acordos, alianças, diálogos e boas relações.', unit: 'num', tiers: [35, 70, 110] },
    { id: 'gangue', name: 'Gangue', desc: 'Operações coletivas, confrontos vencidos e experiência da equipe.', unit: 'num', tiers: [40, 90, 140] },
    { id: 'comercio', name: 'Comércio', desc: 'Lucro com mercadorias: vendas e remessas menos compras.', unit: 'money', tiers: [3500, 8000, 14000] }
  ];
  const MEDALS = ['—', 'Bronze', 'Prata', 'Ouro'];

  const ACHIEVEMENTS = [
    { id: 'primeira', name: 'Primeiro passo', desc: 'Concluir a primeira missão.' },
    { id: 'cofre', name: 'O grande golpe', desc: 'Concluir “Cofre da joalheria”.' },
    { id: 'dono', name: 'Dono do pedaço', desc: 'Liderar um bairro.' },
    { id: 'tres', name: 'Três bandeiras', desc: 'Liderar 3 bairros ao mesmo tempo.' },
    { id: 'diplomata', name: 'Diplomata', desc: 'Firmar 3 tréguas na mesma temporada.' },
    { id: 'alianca', name: 'Palavra empenhada', desc: 'Formar uma aliança.' },
    { id: 'traidor', name: 'Sem palavra', desc: 'Romper um acordo com uma facção.' },
    { id: 'empresario', name: 'Rede de negócios', desc: 'Possuir 4 negócios ao mesmo tempo.' },
    { id: 'cofrecheio', name: 'Cofre cheio', desc: 'Atingir R$ 35.000 de patrimônio.' },
    { id: 'bonde', name: 'Bonde completo', desc: 'Ter 8 integrantes.' },
    { id: 'veterano', name: 'Veterano', desc: 'Ter um integrante no nível 5.' },
    { id: 'fichalimpa', name: 'Ficha limpa', desc: 'Encerrar uma temporada sem ser detido.' },
    { id: 'ouro', name: 'Medalha de ouro', desc: 'Ganhar ouro em qualquer categoria.' },
    { id: 'versatil', name: 'Versátil', desc: 'Medalhas em 3 categorias na mesma temporada.' },
    { id: 'determinado', name: 'Determinação', desc: 'Cumprir 3 metas de temporada.' },
    { id: 'fianca', name: 'Porta da frente', desc: 'Sair da cadeia com o advogado de porta de cadeia.' },
    { id: 'virada', name: 'Virada', desc: 'Vencer um confronto com chance de 40% ou menos.' },
    { id: 'mestre', name: 'Mestre da carreira', desc: 'Alcançar o nível 3 da especialização.' },
    { id: 'arsenal', name: 'Bem equipado', desc: 'Comprar o FAL ou o Carro blindado.' },
    { id: 'atacadista', name: 'Atacadista', desc: 'Vender R$ 20.000 em mercadorias numa temporada.' },
    { id: 'exportador', name: 'Rota de fora', desc: 'Fechar uma remessa com o comprador de fora.' },
    { id: 'industria', name: 'Indústria de fundo de quintal', desc: 'Ter os três pontos de produção.' },
    { id: 'brigao', name: 'Nome na roda', desc: 'Vencer 10 duelos de rua.' },
    { id: 'reidopedaco', name: 'Destronou o rei', desc: 'Vencer o Rei do Pedaço.' },
    { id: 'primeiroassalto', name: 'Primeiro assalto', desc: 'Concluir um assalto do bando.' },
    { id: 'golpedoano', name: 'Golpe do ano', desc: 'Concluir o Cofre central.' },
    { id: 'deunobicho', name: 'Deu no bicho', desc: 'Acertar o bicho na banca.' },
    { id: 'reidanoite', name: 'Rei da noite', desc: 'Ter 3 negócios da noite ao mesmo tempo.' }
  ];

  /* ------------------------------------------------------------------ */
  /* 3. Estado: criação, validação e migração                            */
  /* ------------------------------------------------------------------ */
  const startFactions = () => Object.fromEntries(FACTIONS.map(f => [f.id, {
    relation: f.initialRelation, tension: 20 + f.temperament, truceUntil: 0, lastActionDay: 0,
    power: 50, grudge: 0, allied: false, allyDays: 0, lastMove: '', deals: 0, cooldown: 0
  }]));
  const startGangStats = () => ({ heists: 0, heistFails: 0, confrontWins: 0, confrontLosses: 0, pacts: 0, dialogs: 0, retaliations: 0, groupWins: 0, alliances: 0, betrayals: 0 });
  const initialInfluence = () => Object.fromEntries(DISTRICTS.map(d => [d.id, d.id === 'centro' ? 8 : 0]));
  /** Presença das facções por bairro. O dono herda o antigo "rival" da 0.4. */
  const initialPresence = (legacyRivals) => Object.fromEntries(DISTRICTS.map((d, i) => {
    const owner = factionFor(d.id).id;
    return [d.id, Object.fromEntries(FACTIONS.map(f => [f.id, f.id === owner ? (legacyRivals && isNum(legacyRivals[d.id]) ? clamp(Math.round(legacyRivals[d.id]), 0, 100) : 22 + i * 3) : (f.id === 'aurora' ? 4 : 2)]))];
  }));
  const initialDistrictState = () => Object.fromEntries(DISTRICTS.map(d => [d.id, { vigil: 0, econ: 1 }]));
  const emptyToday = () => ({ missions: {}, contacts: {}, op: false, training: 0, night: 0, duels: 0, clinic: false, bribe: false, bets: 0, detox: false, despachante: false, termas: false, venue: null, doses: 0, dose: {}, chem: 0, home: 0 });
  const startMarket = () => Object.fromEntries(DISTRICTS.map((d, i) => [d.id, Object.fromEntries(GOODS.map((g, j) => [g.id, 85 + ((i * 7 + j * 11) % 5) * 8]))]));
  const emptySeasonStats = () => ({ arrests: 0, startRespect: 5, bailPaid: 0, controlDays: Object.fromEntries(DISTRICTS.map(d => [d.id, 0])), bestCash: 0 });

  function factionFor(districtId) { return FACTIONS.find(f => f.districts.includes(districtId)) || FACTIONS[0]; }

  function defaultState(name, city) {
    return {
      schema: SCHEMA, version: VERSION, name, city, season: 1, day: 1,
      cash: START_CASH, bank: 0, energy: 100, heat: 0, respect: 5,
      stats: { astucia: 6, forca: 4, labia: 4, influencia: 3 },
      district: 'centro', jail: 0, businesses: [], gangName: null, gangLevel: 0,
      successful: 0, failed: 0, seasonHistory: [],
      log: [{ day: 1, msg: 'Você chegou à cidade com algum dinheiro, poucos contatos e muita ambição.' }],
      avatar: null, clock: null, career: null, careerXP: 0, goal: null, goalDone: false, goalWins: 0,
      influence: initialInfluence(), presence: initialPresence(null), dstate: initialDistrictState(),
      events: [{ id: 'rotina', start: 1, until: 1, district: null }],
      newsPending: { id: 'feira', day: 1, faction: null }, lastEvent: 'rotina', nextBonus: 0, tip: 0, contracts: [], extorted: {},
      crew: [], crewMorale: 0, crewLastRecruit: 0, crewLastRally: 0, nextMemberId: 1,
      factions: startFactions(), gangStats: startGangStats(), treachery: 0,
      today: emptyToday(), seasonStats: emptySeasonStats(),
      achievements: {}, prestige: 0, nemesis: null, records: {},
      tutorial: { step: 0, done: false, trained: false, contacted: false, banked: false, nighted: false },
      gear: { arma: null, protecao: null, veiculo: null }, goods: Object.fromEntries(GOODS.map(g => [g.id, 0])), market: startMarket(),
      labs: Object.fromEntries(LABS.map(l => [l.id, 0])), labDown: {}, exportDeal: { day: 5, good: 'cigarro' }, exportDone: 0, ressaca: 0,
      trade: { sold: 0, spent: 0, exported: 0, blitz: 0 },
      health: 100, hospital: 0, beaten: {}, done: emptyDone(), duelStats: { wins: 0, losses: 0 },
      heist: null, heistReady: 0, vicio: 0, overdoses: 0, betStats: { won: 0, lost: 0 }
    };
  }

  /**
   * Verificação estrutural mínima. Saves que passam aqui são então
   * higienizados campo a campo por normalizeSave (nada é confiado).
   * Retorna '' se aceitável ou o motivo da recusa.
   */
  function structuralProblem(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return 'O arquivo não contém um salvamento.';
    if (obj.schema !== 1 && obj.schema !== 2) return 'Versão de salvamento desconhecida (schema ' + String(obj.schema).slice(0, 10) + ').';
    if (typeof obj.name !== 'string' || obj.name.trim().length < 2 || obj.name.length > 22) return 'Codinome ausente ou inválido.';
    if (typeof obj.city !== 'string' || obj.city.length > 40) return 'Cidade de origem inválida.';
    if (!Number.isInteger(obj.day) || obj.day < 1 || obj.day > MAXDAY) return 'Dia da temporada inválido.';
    if (!Number.isInteger(obj.season) || obj.season < 1 || obj.season > 9999) return 'Número da temporada inválido.';
    if (!obj.stats || typeof obj.stats !== 'object') return 'Atributos ausentes.';
    if (!Array.isArray(obj.businesses) || !Array.isArray(obj.log)) return 'Listas obrigatórias ausentes.';
    return '';
  }
  function validate(obj) { return structuralProblem(obj) === ''; }

  const cleanText = (v, max) => typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').slice(0, max) : '';

  /**
   * Converte qualquer save aceito (schema 1 da 0.1–0.4 ou schema 2) em um
   * estado 0.5 íntegro. Valores fora de faixa são limitados; campos
   * desconhecidos são descartados. Retorna { state, notes }.
   */
  function normalizeSave(saved) {
    const notes = [];
    const base = defaultState(cleanText(saved.name, 22).trim(), cityOf(cleanText(saved.city, 40)).name);
    const s = base;
    const fromV04 = saved.schema === 1;
    if (fromV04) notes.push('Salvamento da versão 0.4 (ou anterior) convertido para a 0.5.');
    s.season = saved.season; s.day = saved.day;
    const BIG = 1e12;
    for (const k of ['cash', 'bank', 'respect', 'successful', 'failed', 'goalWins', 'prestige', 'treachery']) {
      const v = toInt(saved[k], base[k], 0, BIG);
      if (isNum(saved[k]) && v !== saved[k]) notes.push(`Campo “${k}” ajustado para ${v}.`);
      s[k] = v;
    }
    s.energy = toInt(saved.energy, 100, 0, 100);
    s.heat = toInt(saved.heat, 0, 0, 100);
    s.jail = toInt(saved.jail, 0, 0, 5);
    s.gangLevel = toInt(saved.gangLevel, 0, 0, 8);
    for (const st of STATS) s.stats[st.id] = toInt(saved.stats[st.id], base.stats[st.id], 1, 1e6);
    s.district = DISTRICTS.some(d => d.id === saved.district) ? saved.district : 'centro';
    const biz = [...new Set(saved.businesses.filter(id => BUSINESSES.some(b => b.id === id)))];
    if (biz.length !== saved.businesses.length) notes.push('Negócios inválidos ou repetidos foram removidos.');
    s.businesses = biz;
    s.gangName = typeof saved.gangName === 'string' && saved.gangName.trim().length >= 3 ? cleanText(saved.gangName, 25).trim() : null;
    if (!s.gangName) s.gangLevel = 0;
    else s.gangLevel = Math.max(1, s.gangLevel);
    s.career = CAREERS.some(c => c.id === saved.career) ? saved.career : null;
    // Relógio do modo online (null no jogo local).
    s.clock = null;
    if (saved.clock && typeof saved.clock === 'object' && isNum(saved.clock.t) && saved.clock.t > 0) {
      const c = saved.clock, tt = toInt(c.t, 0, 1, 1e14);
      s.clock = { t: tt, day: /^\d{4}-\d{2}-\d{2}$/.test(c.day) ? c.day : dayKey(tt), month: /^\d{4}-\d{2}$/.test(c.month) ? c.month : monthKey(tt), home: toInt(c.home, 0, 0, 1e14),
        e: toInt(c.e, 0, 0, 864e5), h: toInt(c.h, 0, 0, 864e5), v: toInt(c.v, 0, 0, 864e5), j: toInt(c.j, 0, 0, 864e5) };
    }
    s.avatar = AVATARS.some(a => a.id === saved.avatar) ? saved.avatar : null;
    s.careerXP = toInt(saved.careerXP, fromV04 && s.career ? Math.min(20, Math.floor(s.successful / 2)) : 0, 0, 9999);
    s.goal = GOALS.some(g => g.id === saved.goal) ? saved.goal : null;
    s.goalDone = s.goal ? saved.goalDone === true : false;
    s.log = saved.log.filter(x => x && typeof x.msg === 'string').slice(0, MAX_LOG)
      .map(x => ({ day: toInt(x.day, 1, 1, MAXDAY), msg: cleanText(x.msg, 400) }));
    if (!s.log.length) s.log = [{ day: s.day, msg: 'Registro restaurado.' }];
    s.seasonHistory = (Array.isArray(saved.seasonHistory) ? saved.seasonHistory : []).filter(h => h && typeof h === 'object').slice(-200).map(h => ({
      season: toInt(h.season, 0, 0, 9999), respect: toInt(h.respect, 0, 0, BIG), money: toInt(h.money, 0, 0, BIG),
      success: toInt(h.success, 0, 0, BIG), failed: toInt(h.failed, 0, 0, BIG),
      goal: GOALS.some(g => g.id === h.goal) ? h.goal : null, goalComplete: h.goalComplete === true,
      career: CAREERS.some(c => c.id === h.career) || OLD_CAREERS[h.career] ? h.career : null, districts: toInt(h.districts, 0, 0, 5),
      gangName: typeof h.gangName === 'string' ? cleanText(h.gangName, 25) : null,
      confrontWins: toInt(h.confrontWins, 0, 0, BIG), pacts: toInt(h.pacts, 0, 0, BIG), groupWins: toInt(h.groupWins, 0, 0, BIG),
      score: toInt(h.score, 0, 0, BIG), title: typeof h.title === 'string' ? cleanText(h.title, 40) : '',
      medals: h.medals && typeof h.medals === 'object' ? Object.fromEntries(CATEGORIES.map(c => [c.id, toInt(h.medals[c.id], 0, 0, 3)])) : null
    }));
    s.influence = Object.fromEntries(DISTRICTS.map(d => [d.id, toInt(saved.influence && saved.influence[d.id], base.influence[d.id], 0, 100)]));
    // Presença das facções: schema 2 usa presence; schema 1 usa rivals.
    if (saved.presence && typeof saved.presence === 'object') {
      s.presence = Object.fromEntries(DISTRICTS.map(d => [d.id, Object.fromEntries(FACTIONS.map(f => [f.id, toInt(saved.presence[d.id] && saved.presence[d.id][f.id], base.presence[d.id][f.id], 0, 100)]))]));
    } else s.presence = initialPresence(saved.rivals);
    s.dstate = Object.fromEntries(DISTRICTS.map(d => {
      const o = saved.dstate && saved.dstate[d.id] || {};
      return [d.id, { vigil: toInt(o.vigil, 0, 0, 100), econ: toNum(o.econ, 1, .6, 1.4) }];
    }));
    // Eventos ativos
    if (Array.isArray(saved.events)) {
      s.events = saved.events.filter(e => e && EVENTS[e.id]).slice(0, 6).map(e => ({
        id: e.id, start: toInt(e.start, s.day, 1, MAXDAY), until: toInt(e.until, s.day, 1, MAXDAY),
        district: DISTRICTS.some(d => d.id === e.district) ? e.district : null
      })).filter(e => e.until >= s.day);
      for (const e of s.events) if ((EVENTS[e.id].randomDistrict || EVENTS[e.id].district || e.id === 'guerra') && !e.district) e.district = EVENTS[e.id].district || 'centro';
    } else {
      const legacy = LEGACY_EVENTS[toInt(saved.eventIndex, 3, 0, LEGACY_EVENTS.length - 1)];
      s.events = [{ id: legacy, start: s.day, until: s.day, district: null }];
    }
    // Notícias e ofertas
    const np = saved.newsPending;
    s.newsPending = (np && NEWS.some(n => n.id === np.id) && np.day === s.day) ? { id: np.id, day: s.day, faction: FACTIONS.some(f => f.id === np.faction) ? np.faction : null } : null;
    if (s.newsPending && s.newsPending.id === 'oferta' && !s.newsPending.faction) s.newsPending = null;
    s.lastEvent = EVENTS[saved.lastEvent] ? saved.lastEvent : 'rotina';
    s.nextBonus = toInt(saved.nextBonus, 0, 0, 100000);
    s.tip = toInt(saved.tip, 0, 0, 2);
    s.contracts = (Array.isArray(saved.contracts) ? saved.contracts : []).slice(0, 5).map(c => ({ daily: toInt(c && c.daily, 0, 0, 1000), days: toInt(c && c.days, 0, 0, 30) })).filter(c => c.daily > 0 && c.days > 0);
    s.extorted = {};
    if (saved.extorted && typeof saved.extorted === 'object') for (const b of BUSINESSES) if (isNum(saved.extorted[b.id])) s.extorted[b.id] = toInt(saved.extorted[b.id], 0, 0, MAXDAY);
    // Equipe: schema 1 só tinha crewSize → gera integrantes.
    s.nextMemberId = toInt(saved.nextMemberId, 1, 1, 1e6);
    if (s.gangName) {
      if (Array.isArray(saved.crew)) {
        s.crew = saved.crew.filter(m => m && ROLES.some(r => r.id === m.role)).slice(0, 8).map((m, i) => ({
          id: isNum(m.id) ? toInt(m.id, 1, 1, 1e6) : 100000 + i, name: cleanText(m.name, 20) || pick(NICKNAMES), role: m.role,
          level: toInt(m.level, 1, 1, 5), xp: toInt(m.xp, 0, 0, 100)
        }));
      } else {
        const n = toInt(saved.crewSize, 2, 2, 8);
        s.crew = [];
        for (let i = 0; i < n; i++) s.crew.push(newMember(s, ROLES[i % ROLES.length].id, i));
        notes.push(`Sua equipe de ${n} integrante(s) recebeu nomes e funções.`);
      }
      s.crewMorale = toInt(saved.crewMorale, 70, 0, 100);
      s.nextMemberId = Math.max(s.nextMemberId, ...s.crew.map(m => m.id + 1));
    } else { s.crew = []; s.crewMorale = 0; }
    s.crewLastRecruit = toInt(saved.crewLastRecruit, 0, 0, MAXDAY);
    s.crewLastRally = toInt(saved.crewLastRally, 0, 0, MAXDAY);
    s.factions = Object.fromEntries(FACTIONS.map(f => {
      const o = saved.factions && saved.factions[f.id] || {};
      const b = startFactions()[f.id];
      return [f.id, {
        relation: toInt(o.relation, b.relation, -100, 100), tension: toInt(o.tension, b.tension, 0, 100),
        truceUntil: toInt(o.truceUntil, 0, 0, MAXDAY), lastActionDay: toInt(o.lastActionDay, 0, 0, MAXDAY),
        power: toInt(o.power, 50, 10, 100), grudge: toInt(o.grudge, 0, 0, 10), allied: o.allied === true && !!s.gangName,
        allyDays: toInt(o.allyDays, 0, 0, 999), lastMove: cleanText(o.lastMove, 160),
        deals: toInt(o.deals, 0, 0, 99), cooldown: toInt(o.cooldown, 0, 0, MAXDAY + 5)
      }];
    }));
    s.gangStats = Object.fromEntries(Object.keys(startGangStats()).map(k => [k, toInt(saved.gangStats && saved.gangStats[k], 0, 0, 10000)]));
    s.today = emptyToday();
    if (saved.today && typeof saved.today === 'object') {
      for (const m of MISSIONS) if (isNum(saved.today.missions && saved.today.missions[m.id])) s.today.missions[m.id] = toInt(saved.today.missions[m.id], 0, 0, 99);
      for (const d of DISTRICTS) if (isNum(saved.today.contacts && saved.today.contacts[d.id])) s.today.contacts[d.id] = toInt(saved.today.contacts[d.id], 0, 0, 9);
      s.today.op = saved.today.op === true;
      s.today.training = toInt(saved.today.training, 0, 0, 9);
      s.today.night = toInt(saved.today.night, 0, 0, 9);
      s.today.duels = toInt(saved.today.duels, 0, 0, 9);
      s.today.clinic = saved.today.clinic === true;
      s.today.bribe = saved.today.bribe === true;
      s.today.bets = toInt(saved.today.bets, 0, 0, 99);
      for (const k of ['detox', 'despachante', 'termas']) s.today[k] = saved.today[k] === true;
      s.today.venue = NIGHT.some(n => n.id === saved.today.venue) ? saved.today.venue : null;
      s.today.doses = toInt(saved.today.doses, 0, 0, 99);
      s.today.chem = toInt(saved.today.chem, 0, 0, CHEM_CAP);
      s.today.home = toInt(saved.today.home, 0, 0, 9);
      for (const d of DOSES) if (isNum(saved.today.dose && saved.today.dose[d.id])) s.today.dose[d.id] = toInt(saved.today.dose[d.id], 0, 0, 99);
    }
    const ss = saved.seasonStats || {};
    s.seasonStats = {
      arrests: toInt(ss.arrests, 0, 0, 999), startRespect: toInt(ss.startRespect, 5, 0, BIG), bailPaid: toInt(ss.bailPaid, 0, 0, 999),
      controlDays: Object.fromEntries(DISTRICTS.map(d => [d.id, toInt(ss.controlDays && ss.controlDays[d.id], 0, 0, MAXDAY)])),
      bestCash: toInt(ss.bestCash, 0, 0, BIG)
    };
    s.achievements = {};
    if (saved.achievements && typeof saved.achievements === 'object') for (const a of ACHIEVEMENTS) if (isNum(saved.achievements[a.id])) s.achievements[a.id] = toInt(saved.achievements[a.id], 1, 1, 9999);
    s.nemesis = FACTIONS.some(f => f.id === saved.nemesis) ? saved.nemesis : null;
    s.records = {};
    if (saved.records && typeof saved.records === 'object') for (const c of CATEGORIES) if (isNum(saved.records[c.id])) s.records[c.id] = toInt(saved.records[c.id], 0, 0, BIG);
    // v0.7: equipamentos, mercadorias, produção e noite (ausentes em saves antigos → padrão).
    for (const sl of SLOTS) { const it = ITEMS.find(x => x.id === (saved.gear && saved.gear[sl.id]) && x.slot === sl.id); s.gear[sl.id] = it ? it.id : null; }
    for (const g of GOODS) s.goods[g.id] = toInt(saved.goods && saved.goods[g.id], 0, 0, 9999);
    for (const d of DISTRICTS) for (const g of GOODS) s.market[d.id][g.id] = toInt(saved.market && saved.market[d.id] && saved.market[d.id][g.id], s.market[d.id][g.id], 60, 150);
    for (const l of LABS) { s.labs[l.id] = toInt(saved.labs && saved.labs[l.id], 0, 0, 3); if (isNum(saved.labDown && saved.labDown[l.id])) s.labDown[l.id] = toInt(saved.labDown[l.id], 0, 0, MAXDAY + 3); }
    const ed = saved.exportDeal;
    s.exportDeal = ed && GOODS.some(g => g.id === ed.good) ? { day: toInt(ed.day, 5, 1, MAXDAY + 5), good: ed.good } : { day: Math.min(MAXDAY, Math.ceil(s.day / 5) * 5), good: 'cigarro' };
    s.ressaca = toInt(saved.ressaca, 0, 0, 30);
    s.exportDone = toInt(saved.exportDone, 0, 0, MAXDAY);
    s.trade = { sold: toInt(saved.trade && saved.trade.sold, 0, 0, BIG), spent: toInt(saved.trade && saved.trade.spent, 0, 0, BIG), exported: toInt(saved.trade && saved.trade.exported, 0, 0, BIG), blitz: toInt(saved.trade && saved.trade.blitz, 0, 0, 9999) };
    // v0.8: saúde, internação e duelos.
    s.health = toInt(saved.health, 100, 0, 100);
    s.hospital = toInt(saved.hospital, 0, 0, 5);
    s.beaten = {};
    // Trilha: save sem o campo (anterior à v1.5) entra com tudo liberado nesta temporada.
    s.done = emptyDone();
    for (const k of Object.keys(s.done)) { const all = (k === 'items' ? ITEMS : k === 'biz' ? BUSINESSES : chainList(k)).map(x => x.id); s.done[k] = saved.done && typeof saved.done === 'object' ? (Array.isArray(saved.done[k]) ? [...new Set(saved.done[k].filter(id => all.includes(id)))] : []) : all; }
    if (saved.beaten && typeof saved.beaten === 'object') for (const r of RIVALS) if (isNum(saved.beaten[r.id])) s.beaten[r.id] = toInt(saved.beaten[r.id], 1, 1, 999);
    s.duelStats = { wins: toInt(saved.duelStats && saved.duelStats.wins, 0, 0, 99999), losses: toInt(saved.duelStats && saved.duelStats.losses, 0, 0, 99999) };
    // v1.3: vício e apostas.
    s.vicio = toInt(saved.vicio, 0, 0, 100);
    s.overdoses = toInt(saved.overdoses, 0, 0, 999);
    s.betStats = { won: toInt(saved.betStats && saved.betStats.won, 0, 0, BIG), lost: toInt(saved.betStats && saved.betStats.lost, 0, 0, BIG) };
    // v1.0: assalto planejado.
    const hp = saved.heist;
    s.heist = hp && HEISTS.some(h => h.id === hp.id) && s.gangName ? { id: hp.id, day: toInt(hp.day, s.day, 1, MAXDAY), intel: toInt(hp.intel, 0, 0, 40), scoutDay: toInt(hp.scoutDay, 0, 0, MAXDAY), hires: toInt(hp.hires, 0, 0, HEIST_MAX_HIRES) } : null;
    s.heistReady = toInt(saved.heistReady, 0, 0, MAXDAY + HEIST_COOLDOWN);
    // Primeiros passos: saves anteriores à 0.6 não tinham tutorial; quem já jogou não é obrigado a refazê-lo.
    const tu = saved.tutorial;
    if (tu && typeof tu === 'object') s.tutorial = { step: toInt(tu.step, 0, 0, TUTORIAL.length), done: tu.done === true, trained: tu.trained === true, contacted: tu.contacted === true, banked: tu.banked === true, nighted: tu.nighted === true };
    else s.tutorial = { step: 0, done: s.season > 1 || s.day > 1, trained: false, contacted: false, banked: false, nighted: false };
    if (s.tutorial.step >= TUTORIAL.length) s.tutorial.done = true;
    s.schema = SCHEMA; s.version = VERSION;
    return { state: s, notes };
  }

  /** Lê um texto JSON (localStorage ou arquivo) e devolve {ok, state, notes, error}. */
  function parseSave(text) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { return { ok: false, error: 'O conteúdo não é um JSON válido (arquivo corrompido ou incompleto).' }; }
    if (obj && obj.game === 'Submundo Brasil' && obj.save) obj = obj.save; // formato de exportação
    const problem = structuralProblem(obj);
    if (problem) return { ok: false, error: problem };
    try { const r = normalizeSave(obj); return { ok: true, state: r.state, notes: r.notes }; }
    catch (e) { return { ok: false, error: 'Falha ao converter o salvamento: ' + e.message }; }
  }
  /** Soma de verificação simples (FNV-1a) para detectar arquivos alterados. */
  function checksum(text) { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16); }
  function exportPayload(s) { const save = JSON.stringify(s); return { game: 'Submundo Brasil', version: VERSION, exportedAt: new Date().toISOString(), checksum: checksum(save), save: s }; }

  /* ------------------------------------------------------------------ */
  /* 4. Fórmulas derivadas                                                */
  /* ------------------------------------------------------------------ */
  const district = (s, id) => DISTRICTS.find(d => d.id === (id || s.district)) || DISTRICTS[0];
  const faction = id => FACTIONS.find(f => f.id === id);
  const business = id => BUSINESSES.find(b => b.id === id);
  const mission = id => MISSIONS.find(m => m.id === id);
  const careerLevel = s => s.career ? CAREER_XP.filter(x => s.careerXP >= x).length : 0;
  const hasPerk = (s, c, lvl) => s.career === c && careerLevel(s) >= lvl;
  const pactActive = (s, fid) => s.day <= s.factions[fid].truceUntil;
  const agreement = (s, fid) => pactActive(s, fid) || s.factions[fid].allied;

  function log(s, msg) { s.log.unshift({ day: s.day, msg }); s.log = s.log.slice(0, MAX_LOG); }

  /** Eventos válidos hoje, com definição. */
  function activeEvents(s) { return s.events.filter(e => e.start <= s.day && e.until >= s.day && EVENTS[e.id]).map(e => ({ ...e, def: EVENTS[e.id] })); }
  function eventTitle(e) { const n = e.district ? district(null, e.district).name : ''; return EVENTS[e.id].title.replace('{d}', n); }
  /** Descrição do evento com os nomes da cidade atual. */
  function eventDesc(e) {
    return EVENTS[e.id].desc.replace(/\{(\w+)\}/g, (m, k) => {
      const d = DISTRICTS.find(x => x.id === k); if (d) return d.name;
      const b = BUSINESSES.find(x => x.id === k); if (b) return b.name;
      const f = FACTIONS.find(x => x.id === k); if (f) return f.name;
      return m;
    });
  }
  function eventMod(s, key, ctx) {
    const mult = key.endsWith('Mult');
    let total = mult ? 1 : 0;
    for (const e of activeEvents(s)) {
      const m = e.def.mods[key]; if (m === undefined) continue;
      const v = typeof m === 'function' ? m(ctx || {}, e) : m;
      total = mult ? total * v : total + v;
    }
    return total;
  }

  /** Líder de um bairro entre as facções. */
  function leader(s, did) {
    let best = null;
    for (const f of FACTIONS) { const v = s.presence[did][f.id]; if (!best || v > best.value) best = { id: f.id, value: v }; }
    return best;
  }
  const controlled = (s, did) => s.influence[did] >= 60 && s.influence[did] >= leader(s, did).value + 10;
  const controls = s => DISTRICTS.filter(d => controlled(s, d.id));
  const allyTurf = (s, did) => { const l = leader(s, did); return l.value >= 10 && s.factions[l.id].allied; };

  /* Equipe */
  function newMember(s, role, i) {
    const used = new Set((s.crew || []).map(m => m.name));
    const free = NICKNAMES.filter(n => !used.has(n));
    return { id: s.nextMemberId++, name: free.length ? pick(free) : 'Novato ' + (i || s.nextMemberId), role, level: 1, xp: 0 };
  }
  const roleLevels = (s, role) => sum(s.crew.filter(m => m.role === role).map(m => m.level));
  const crewSize = s => s.crew.length;
  const memberUpkeep = m => 20 + m.level * 8;
  const groupUpkeep = s => s.gangName ? sum(s.crew.map(memberUpkeep)) : 0;
  const recruitCost = s => Math.round((550 + crewSize(s) * 60) * (controlled(s, 'jardim') ? .75 : 1) * eventMod(s, 'recruitMult'));

  /* Missões */
  const missionCost = (s, m) => s.career === 'operador' ? Math.round(m.cost * .9) : m.cost;
  function missionScore(s, m) {
    const st = s.stats;
    const total = st.astucia + st.forca + st.labia + st.influencia;
    return st[m.stat] * 2 + total * .4 + s.gangLevel * 1.5;
  }
  function missionChance(s, m) {
    const d = s.district, ds = s.dstate[d];
    let heatPen = s.heat * .35 + ds.vigil * .3;
    if (hasPerk(s, 'operador', 3)) heatPen /= 2;
    let fatigue = (s.today.missions[m.id] || 0) * 6;
    if (hasPerk(s, 'operador', 2)) fatigue /= 2;
    let c = 72 + (missionScore(s, m) - m.difficulty) * 2 - heatPen - district(s).risk - eventMod(s, 'risk', { district: d }) - fatigue;
    if (s.career === 'empreendedor' && m.stat === 'forca') c -= 5;
    if (s.tip > 0) c += 12;
    c -= healthPenalty(s);
    if (m.stat === 'forca') c += armPower(s, true) * .5;
    // Arma acima do mínimo exigido dá folga no roubo (até +10).
    if (m.req && m.req.power) c += Math.min(10, (armPower(s, true) - m.req.power) * 1.5);
    return clamp(Math.round(c), 8, 95);
  }
  function missionRewardMult(s, m) {
    const d = s.district;
    const pct = district(s).bonus + eventMod(s, 'reward', { district: d }) + (controlled(s, d) ? 12 : 0) + (allyTurf(s, d) ? 10 : 0) + (m.festive && eventMod(s, 'festive') ? 25 : 0);
    let mult = (1 + pct / 100) * s.dstate[d].econ;
    mult *= Math.max(.5, 1 - .12 * (s.today.missions[m.id] || 0));

    if (eventMod(s, 'payday') && PAYDAY_MISSIONS.includes(m.id)) mult *= 1.3;
    if (s.career === 'operador') mult *= 1.2; // linha de frente
    if (d === 'vila' && cityIs(s, 'rio')) mult *= 1.1;
    if (m.req && m.req.power) mult *= 1.25; // roubo armado paga mais: a arma se paga
    return Math.max(.2, mult);
  }
  function arrestChance(s, m) {
    if (!s.tutorial.done && s.successful === 0) return 0; // primeiros passos: o primeiro roubo que falha não dá cadeia
    let a = m.arrest + s.heat * .3 + s.dstate[s.district].vigil * .15 - Math.min(20, roleLevels(s, 'olheiro') * 2) - gearVal(s, 'def') - gearVal(s, 'escape');
    if (hasPerk(s, 'operador', 1)) a -= 15;
    return clamp(Math.round(a), 5, 90);
  }
  const failLoss = (s, m) => m.loss;
  /** Motivo de bloqueio ('' se pode executar). */
  function missionLock(s, m) {
    if (m.district && m.district !== s.district) return 'Disponível somente em ' + district(s, m.district).name + '.';
    { const c = chainLock(s, 'missions', m.id); if (c) return c; }
    if (s.respect < m.unlock) return `Requer ${m.unlock} de respeito.`;
    const r = m.req || {};
    if (r.gang && !s.gangName) return 'Requer uma gangue fundada.';
    if (r.power && gearVal(s, 'power') < r.power) return `Requer arma de poder ${r.power} ou mais (Feira do Rolo).`;
    if (r.influence && s.influence[s.district] < r.influence) return `Requer ${r.influence} de influência no bairro.`;
    if (r.stat) { const need = (m.id === 'cofre' && hasPerk(s, 'operador', 3)) ? 18 : r.stat[1]; if (s.stats[r.stat[0]] < need) return `Requer ${STATS.find(x => x.id === r.stat[0]).name} ${need}.`; }
    if (r.oncePerDay && s.today.missions[m.id]) return 'Já realizada hoje.';
    if (s.jail > 0) return 'Você está detido.';
    if (s.hospital > 0) return 'Você está internado.';
    if (atHome(s)) return 'Você está em casa descansando.';
    if (s.energy < missionCost(s, m)) return 'Energia insuficiente.';
    return '';
  }
  const heatGain = (s, h) => Math.ceil(h * eventMod(s, 'heatMult'));
  function respectGain(s, m) { return s.respect > m.unlock + 90 ? Math.ceil(m.respect / 3) : m.respect; }

  /* Economia */
  function businessIncome(s, b) {
    let v = b.net * s.dstate[b.district].econ;
    let em = eventMod(s, 'bizMult', { biz: b, district: b.district });
    if (em < 1 && hasPerk(s, 'empreendedor', 2)) em = 1 - (1 - em) / 2;
    v *= em;
    if (s.career === 'empreendedor' && !b.tags.includes('noite')) v *= 1.35;
    if (s.career === 'barao' && b.tags.includes('noite')) v *= hasPerk(s, 'barao', 3) ? 1.5 : 1.3;
    if (s.career === 'operador') v *= .9;
    if (controlled(s, b.district)) v *= 1.15;
    if (controlled(s, 'industrial')) v *= 1.12;
    if (cityIs(s, 'sp')) v *= 1.08;
    if (b.id === 'bar' && cityIs(s, 'bh')) v *= 1.4;
    const l = leader(s, b.district);
    const fs = s.factions[l.id];
    if (!controlled(s, b.district) && !agreement(s, l.id) && fs.relation < 0 && l.value >= s.influence[b.district] + 25) v *= .85; // pressão rival
    if (s.extorted[b.id] === s.day) v *= hasPerk(s, 'empreendedor', 2) ? .75 : .5;
    return Math.max(0, Math.round(v));
  }
  const income = s => sum(s.businesses.map(id => businessIncome(s, business(id))));
  const tribute = (s, did) => Math.round(district(s, did).tribute * s.dstate[did].econ * (hasPerk(s, 'articulador', 3) ? 1.6 : 1));
  const resaleValue = s => sum(s.businesses.map(id => Math.round(business(id).cost * RESALE)));
  const stockValue = s => Math.round(sum(GOODS.map(g => s.goods[g.id] * g.base * .7)));
  /** Equipamentos e pontos de produção contam pela metade do que custaram. */
  const assetValue = s => Math.round(sum(SLOTS.map(sl => { const it = ITEMS.find(x => x.id === s.gear[sl.id]); return it ? it.cost * ITEM_RESALE : 0; })) + sum(LABS.map(l => [0, 1, 1.8, 3][s.labs[l.id]] * l.cost * .5)));
  const patrimony = s => s.cash + s.bank + resaleValue(s) + stockValue(s) + assetValue(s);
  const depositRate = s => hasPerk(s, 'empreendedor', 1) ? .0075 : s.career === 'empreendedor' ? .015 : .03;
  const depositFee = (s, amount) => Math.max(1, Math.ceil(amount * depositRate(s)));
  const buyCost = (s, b) => Math.round(b.cost * (s.career === 'barao' && b.tags.includes('noite') ? .8 : s.career === 'empreendedor' ? .88 : 1));
  const trainCost = (s, id) => { const l = s.stats[id]; return Math.round((250 + l * 40 + l * l * 1.2) * (cityIs(s, 'poa') ? .9 : 1) * (s.career === 'empreendedor' && id === 'forca' ? 1.25 : 1)); };
  const travelCost = s => ({ cash: cityIs(s, 'recife') ? 45 : 90, energy: cityIs(s, 'recife') || gearVal(s, 'freeRide') ? 0 : 5 });
  const bailCost = s => s.jail > 0 ? Math.round((250 + s.jail * 250 + Math.floor(s.respect * 1.5)) * (s.career === 'empreendedor' ? .7 : 1)) : 0;
  const contactCost = s => Math.round(180 * (hasPerk(s, 'articulador', 1) ? .7 : 1) * (controlled(s, 'centro') ? .8 : 1));
  const allianceCost = s => Math.round(900 * (hasPerk(s, 'articulador', 2) ? .6 : 1));
  const allianceFee = s => 50 + s.gangLevel * 15;
  const upgradeCost = s => 1200 + s.gangLevel * 900;
  /** Cada nova trégua com o mesmo grupo custa mais: acordos não são gratuitos. */
  const pactCost = (s, fid) => 400 + s.factions[fid].deals * 200;


  /* Equipamentos, mercadorias e produção (v0.7) */
  const item = id => ITEMS.find(x => x.id === id);
  const good = id => GOODS.find(x => x.id === id);
  /** Soma um atributo dos itens equipados (power, def, escape, cargo) ou indica se algum tem a marca (freeRide). */
  function gearVal(s, key) { let t = 0; for (const sl of SLOTS) { const it = item(s.gear[sl.id]); if (it && it[key]) t += it[key] === true ? 1 : it[key]; } return t; }
  const cargoUsed = s => sum(GOODS.map(g => s.goods[g.id]));
  const cargoCap = s => 30 + gearVal(s, 'cargo') + 40 * LABS.filter(l => s.labs[l.id] > 0).length + (hasPerk(s, 'traficante', 2) ? 15 : 0);
  const goodPrice = (s, g, did) => Math.max(1, Math.round(g.base * s.market[did || s.district][g.id] / 100));
  const goodSellPrice = (s, g, did) => Math.max(1, Math.floor(goodPrice(s, g, did) * SELL_SPREAD * (allyTurf(s, did || s.district) ? 1.05 : 1)));
  /** Cada unidade negociada move o preço local: mercadoria cara satura depressa. */
  const priceImpact = (g, qty) => Math.ceil(qty * g.base / 160);
  const buyTotal = (s, g, qty) => Math.round(g.base * (s.market[s.district][g.id] + priceImpact(g, qty) / 2) / 100 * qty);
  const sellTotal = (s, g, qty) => Math.max(1, Math.floor(g.base * Math.max(60, s.market[s.district][g.id] - priceImpact(g, qty) / 2) / 100 * qty * SELL_SPREAD * (allyTurf(s, s.district) ? 1.05 : 1)));
  /** Chance de blitz ao viajar com a carga atual. */
  const blitzChance = s => { const load = sum(GOODS.map(g => s.goods[g.id] * g.risk)); return load > 0 ? clamp(Math.round(load / 12 - (hasPerk(s, 'traficante', 1) ? 12 : 0) + s.heat * .25 - gearVal(s, 'escape')), 0, 60) : 0; };
  /** Preço do comprador de fora. No último dia do mês atraca o Último Navio (+25%). */
  const exportPrice = (g, s) => Math.round(g.base * 1.9 * (s && s.career === 'traficante' ? 1.1 : 1) * (s && s.day === MAXDAY ? 1.25 : 1));
  const EXPORT_LIMIT = 60;
  const exportLimit = s => hasPerk(s, 'traficante', 3) ? 70 : EXPORT_LIMIT;
  const labCost = (s, l) => Math.round(l.cost * (s.career === 'traficante' ? .9 : 1) * [1, .8, 1.2][s.labs[l.id]] || 0);
  const labOutput = (s, l, n = l.out) => Math.round((n || 0) * LAB_MULT[s.labs[l.id]] * (s.career === 'traficante' ? 1.25 : s.career === 'operador' ? .9 : 1));
  const labCash = (s, l) => Math.round((l.cash || 0) * LAB_MULT[s.labs[l.id]] * (s.career === 'empreendedor' ? 1.35 : s.career === 'operador' ? .9 : 1));
  const labUpkeep = s => sum(LABS.map(l => s.labs[l.id] * (30 + (l.bribe || 0))));
  const labRaid = (s, l) => l.cash || good(l.good).risk === 0 ? 0 : Math.round(raidChance(s) * (l.bribe ? .5 : 1));
  const raidChance = s => clamp(Math.round((s.heat - 40) * .5 * (hasPerk(s, 'traficante', 3) ? .5 : 1)), 0, 25);
  const NIGHT_LIMIT = 3;
  /** Dono do Bar bebe de graça no boteco; cada saída extra no dia custa 50% a mais. */
  /** Sua própria Termas VIP dá uma recarga limpa por dia: grátis, sem vício e sem exigir respeito. */
  const ownTermas = (s, n) => n.id === 'termas' && s.businesses.includes('termas') && !s.today.termas;
  const nightCost = (s, n) => (ownTermas(s, n) || (n.id === 'boteco' && s.businesses.includes('bar')) || (n.id === 'inferninho' && s.businesses.includes('inferninho'))) ? 0 : Math.round(n.cost * (s.career === 'barao' ? .6 : 1) * (1 + s.today.night * .5));
  /** Dose: Barão paga 40% menos; dono do Bar paga metade no Boteco. */
  const doseCost = (s, d, n = NIGHT.find(x => x.id === s.today.venue)) => Math.round(d.price * (s.career === 'barao' ? .6 : 1) * (n && n.id === 'boteco' && s.businesses.includes('bar') ? .5 : 1));
  const doseVicio = (s, d) => Math.ceil(d.vicio * (s.career === 'barao' && ['whisky', 'lolo', 'bala', 'po'].includes(d.id) ? .5 : 1));
  const doseOf = id => DOSES.find(d => d.id === id);
  /** Casa abastecida: tem o esquema produtor e estoque suficiente. Devolve o que seria gasto. */
  function supplyPlan(s, sp) {
    if (!s.businesses.includes(sp.biz) || !sp.labs.some(id => s.labs[id] > 0)) return null;
    let need = sp.qty; const use = {};
    for (const g of sp.goods) { const q = Math.min(need, s.goods[g]); if (q > 0) { use[g] = q; need -= q; } }
    return need > 0 ? null : use;
  }
  /** Quanto mais viciado, menos cada saída recarrega (no mínimo 40%). */
  /** Quanto a próxima dose deste tipo rende hoje: tolerância do dia (por tipo) e vício. */
  const doseTolerance = (s, d) => Math.pow(TOLERANCE, (s.today.dose && s.today.dose[d.id]) || 0);
  const nightEnergy = (s, d) => Math.max(1, Math.round(d.energy * Math.max(.4, 1 - s.vicio / 160) * doseTolerance(s, d)));
  const chemLeft = s => Math.max(0, CHEM_CAP - (s.today.chem || 0));
  const overdoseChance = s => s.vicio >= 70 ? clamp(s.vicio - 60, 0, 40) : 0;
  const detoxCost = s => s.vicio * 18;
  /** Dono da Casa de Shows não corre risco de briga no baile: a segurança é sua. */
  const nightSafe = (s, n) => n.id === 'baile' && s.businesses.includes('show');


  /* Saúde e duelos (v0.8) */
  const rival = id => RIVALS.find(x => x.id === id);
  /** Penalidade de saúde nas chances: começa abaixo de 60. */
  const healthPenalty = s => s.health < 60 ? Math.round((60 - s.health) * .4) : 0;
  const injured = s => s.health < 25;
  /** Arma e colete como contam para você: Assaltante +15%; a arma do Dono da Noite conta 20% menos nos roubos. */
  const armPower = (s, robbery = false) => gearVal(s, 'power') * (s.career === 'operador' ? 1.15 : s.career === 'barao' && robbery ? .8 : 1);
  const armDef = s => gearVal(s, 'def') * (s.career === 'operador' ? 1.15 : 1);
  const combatRating = s => Math.round(s.stats.forca * 1.6 + s.stats.astucia * .6 + armPower(s) * 1.8 + armDef(s) + s.gangLevel * 1.5);
  function duelOdds(s, r) { return clamp(Math.round(50 + (combatRating(s) - r.rating) * 2.2 - healthPenalty(s) - (s.today.duels || 0) * 4), 8, 92); }
  const clinicCost = s => Math.max(0, (100 - s.health) * CLINIC_PRICE);
  /** Aplica dano reduzido pela proteção; chegar a zero significa internação. Devolve o texto do resultado. */
  function hurt(s, amount) {
    const dmg = Math.max(1, Math.round(amount - armDef(s) * .8));
    s.health = clamp(s.health - dmg, 0, 100);
    if (s.health > 0) return ` Saúde -${dmg}.`;
    s.hospital = 2; s.health = 35; addHeat(s, -10);
    const bill = Math.min(s.cash, 300); s.cash -= bill;
    log(s, `Você foi internado por 2 dias. Conta do hospital: ${money(bill)}.`);
    return ` Saúde zerada: internado por 2 dias (conta de ${money(bill)}).`;
  }
  /** Perde uma fração do respeito (a moral cai na rua). Devolve quanto perdeu. */
  function loseRespect(s, frac) { const l = Math.min(s.respect, Math.max(1, Math.ceil(s.respect * frac))); s.respect -= l; return l; }
  /** Bloqueio comum a ações físicas: detenção e internação. */
  const atHome = s => !!(s.clock && s.clock.home > s.clock.t);
  const blocked = s => s.jail > 0 ? 'Você está detido.' : s.hospital > 0 ? 'Você está internado.' : atHome(s) ? 'Você está em casa descansando.' : '';


  /* Assaltos do bando (v1.0) */
  const heist = id => HEISTS.find(x => x.id === id);
  const heistHires = (s, h) => Math.max(0, h.need - crewSize(s));
  const heistPlanCost = (s, h) => h.plan + heistHires(s, h) * h.hire;
  /** Poder do bando: o líder, os integrantes (nível e função) e os avulsos. */
  function heistPower(s, hires) {
    return Math.round(combatRating(s) + sum(s.crew.map(m => m.level)) * 3 + crewSize(s) * 2 + roleLevels(s, 'musculo') * 2 + (hires || 0) * 4);
  }
  /** Chance de execução. Usa os avulsos do plano em curso, ou os que seriam contratados agora. */
  function heistOdds(s, h) {
    const hires = s.heist && s.heist.id === h.id ? s.heist.hires : heistHires(s, h);
    const intel = s.heist && s.heist.id === h.id ? s.heist.intel : 0;
    return clamp(Math.round(40 + (heistPower(s, hires) - h.rating) * 1.2 + intel * .5 + (s.crewMorale - 50) * .15 - s.heat * .3 - healthPenalty(s) - eventMod(s, 'risk', { district: s.district }) * .5), 5, 90);
  }
  /** Motivo de bloqueio para planejar ('' se pode). */
  /* v1.5: trilha de compra. Na Feira (por prateleira: arma, proteção, veículo) e nos negócios (casas da
   * noite e negócios de rua), o item só libera depois que o anterior foi comprado nesta temporada.
   * As outras listas (roubos, noite, duelos, esquemas, assaltos) não têm trilha. */
  const CHAIN_KINDS = ['items', 'biz'];
  function chainList(kind, ref) {
    if (kind === 'missions') return MISSIONS.filter(m => !m.district).slice().sort((a, b) => a.difficulty - b.difficulty);
    if (kind === 'items') return ITEMS.filter(i => i.slot === ref.slot && !i.trophy);
    if (kind === 'rivals') return RIVALS;
    if (kind === 'heists') return HEISTS;
    if (kind === 'labs') return LABS;
    if (kind === 'biz') { const night = !!(ref && ref.tags && ref.tags.includes('noite')); return BUSINESSES.filter(b => b.tags.includes('noite') === night).sort((a, b) => a.cost - b.cost); }
    if (kind === 'night') return NIGHT;
    return [];
  }
  const chainDone = (s, kind, id) => s.done[kind].includes(id);
  const CHAIN_VERB = { missions: 'Primeiro faça', items: 'Primeiro compre', rivals: 'Primeiro vença', heists: 'Primeiro faça o assalto', labs: 'Primeiro monte', biz: 'Primeiro compre', night: 'Primeiro conheça' };
  /** Devolve o motivo do bloqueio pela trilha ("Primeiro faça: Bater carteira.") ou ''. */
  function chainLock(s, kind, id) {
    if (!CHAIN_KINDS.includes(kind)) return '';
    const list = chainList(kind, kind === 'items' ? item(id) || {} : kind === 'biz' ? business(id) || {} : null), i = list.findIndex(x => x.id === id);
    if (i <= 0) return '';
    const prev = list[i - 1];
    return chainDone(s, kind, prev.id) ? '' : `${CHAIN_VERB[kind]}: ${prev.name}.`;
  }
  /** Marca o item como feito na trilha (sem repetir). */
  function markDone(s, kind, id) { if (CHAIN_KINDS.includes(kind) && !s.done[kind].includes(id)) s.done[kind].push(id); }
  const emptyDone = () => Object.fromEntries(CHAIN_KINDS.map(k => [k, []]));
  function heistLock(s, h) {
    if (!s.gangName) return 'Requer uma gangue fundada.';
    { const c = chainLock(s, 'heists', h.id); if (c) return c; }
    if (s.respect < h.unlock) return `Requer ${h.unlock} de respeito.`;
    if (s.gangLevel < h.sede) return `Requer sede nível ${h.sede}.`;
    if (gearVal(s, 'power') < h.minPower) return `Requer arma de poder ${h.minPower} ou mais com o líder.`;
    if (heistHires(s, h) > HEIST_MAX_HIRES) return `Faltam integrantes: no máximo ${HEIST_MAX_HIRES} avulsos (você tem ${crewSize(s)} de ${h.need}).`;
    return '';
  }

  /* Gangue e facções */
  function gangOdds(s) {
    const d = s.district;
    return clamp(Math.round(46 + s.gangLevel * 4 + s.stats.influencia * .6 + crewSize(s) * 1.5 + roleLevels(s, 'musculo') * 1.2 + gearVal(s, 'power') * .6 +
      (s.crewMorale - 50) * .18 - healthPenalty(s) - s.heat * .35 - s.dstate[d].vigil * .3 - leader(s, d).value * .08 - eventMod(s, 'risk', { district: d }) * .5), 12, 90);
  }
  function enemyHelp(s, fid) { return FACTIONS.some(a => s.factions[a.id].allied && FACTION_ENEMY[a.id] === fid) ? 8 : 0; }
  function clashOdds(s, did) {
    const l = leader(s, did), r = s.factions[l.id];
    return clamp(Math.round(38 + s.stats.influencia * 1.1 + s.stats.labia * .4 + s.gangLevel * 2.5 + crewSize(s) * 1.5 + roleLevels(s, 'musculo') * 1.5 + gearVal(s, 'power') +
      (s.crewMorale - 50) * .12 - healthPenalty(s) - (l.value - s.influence[did]) * .2 - s.heat * .18 - r.tension * .08 - (r.power - 50) * .15 +
      (s.career === 'articulador' ? 5 : 0) + eventMod(s, 'dispute', { district: did }) + enemyHelp(s, l.id)), 15, 88);
  }
  function disputeOdds(s, did) {
    const l = leader(s, did), r = s.factions[l.id];
    return clamp(Math.round(40 + s.stats.influencia * 1.2 + s.gangLevel * 3 + roleLevels(s, 'negociador') - s.heat * .15 -
      (l.value - s.influence[did]) * .22 + (s.career === 'articulador' ? 5 : 0) - r.tension * .07 - (r.power - 50) * .1 + eventMod(s, 'dispute', { district: did }) + enemyHelp(s, l.id)), 18, 85);
  }
  function dialogueOdds(s, fid) {
    const f = faction(fid), r = s.factions[fid];
    return clamp(Math.round(55 + s.stats.labia * 1.1 + s.stats.influencia * .35 + r.relation * .12 - r.tension * .22 - f.temperament * .45 +
      roleLevels(s, 'negociador') * 2 + (s.career === 'articulador' ? 8 : 0) + (controlled(s, 'centro') ? 8 : 0) + (cityIs(s, 'bh') ? 4 : 0) - Math.min(20, s.treachery * 5) - r.grudge * 2), 25, 92);
  }
  function factionStatus(s, fid) {
    const r = s.factions[fid];
    if (r.allied) return 'Aliado';
    if (pactActive(s, fid)) return 'Trégua em vigor';
    return r.relation >= 45 ? 'Relações favoráveis' : r.relation <= -40 ? 'Rivalidade aberta' : r.relation < 0 ? 'Relações tensas' : 'Neutro';
  }
  const strength = s => Math.floor(s.respect + sum(Object.values(s.stats)) + s.businesses.length * 5 + s.gangLevel * 9 + crewSize(s) * 3);
  const cityPower = s => sum(DISTRICTS.map(d => s.influence[d.id])) + controls(s).length * 30;
  const factionCityPower = (s, fid) => sum(DISTRICTS.map(d => s.presence[d.id][fid])) + DISTRICTS.filter(d => leader(s, d.id).id === fid && !controlled(s, d.id)).length * 30;

  /* ------------------------------------------------------------------ */
  /* 5. Ações do jogador                                                  */
  /* ------------------------------------------------------------------ */
  const refuse = msg => ({ ok: false, good: false, msg });
  const done = (good, msg, extra) => Object.assign({ ok: true, good, msg }, extra || {});
  const addHeat = (s, v) => { s.heat = clamp(s.heat + v, 0, 100); };
  const addInf = (s, did, v) => { s.influence[did] = clamp(Math.round(s.influence[did] + v), 0, 100); };
  const addPres = (s, did, fid, v) => { s.presence[did][fid] = clamp(Math.round(s.presence[did][fid] + v), 0, 100); };
  const addRel = (s, fid, v) => { s.factions[fid].relation = clamp(Math.round(s.factions[fid].relation + v), -100, 100); };
  const addTen = (s, fid, v) => { s.factions[fid].tension = clamp(Math.round(s.factions[fid].tension + v), 0, 100); };
  const addMorale = (s, v) => { if (s.gangName) s.crewMorale = clamp(Math.round(s.crewMorale + v), 0, 100); };
  const addXP = (s, career, v) => { if (s.career === career) { const before = careerLevel(s); s.careerXP += v; const after = careerLevel(s); if (after > before) log(s, `Especialização ${CAREERS.find(c => c.id === career).name} nível ${after}: ${CAREERS.find(c => c.id === career).perks[after - 1]}`); } };
  function memberXP(s, v, role) {
    for (const m of s.crew) {
      if (role && m.role !== role) continue;
      m.xp += v;
      while (m.level < 5 && m.xp >= m.level * 4) { m.xp -= m.level * 4; m.level++; log(s, `${m.name} (${ROLES.find(r => r.id === m.role).name}) subiu para o nível ${m.level}.`); }
      if (m.level >= 5) m.xp = 0;
    }
  }
  /** Atrito com a facção que lidera o bairro quando você age no território dela. */
  function turfFriction(s, did, t) {
    if (!t) return;
    const l = leader(s, did);
    if (l.value < 10 || s.factions[l.id].allied) return;
    if (pactActive(s, l.id)) {
      // Compromisso da trégua: agir no território do grupo desgasta o acordo.
      addRel(s, l.id, -3); addTen(s, l.id, t);
      if (s.factions[l.id].relation < 15) {
        s.factions[l.id].truceUntil = 0; addRel(s, l.id, -10);
        log(s, `${faction(l.id).name} considerou suas ações uma violação e encerrou a trégua.`);
      }
      return;
    }
    addTen(s, l.id, t);
    if (t >= 4) addRel(s, l.id, -2);
  }

  function doMission(s, id) {
    const m = mission(id); if (!m) return refuse('Missão desconhecida.');
    const lock = missionLock(s, m); if (lock) return refuse(lock);
    const odds = missionChance(s, m), mult = missionRewardMult(s, m), d = s.district;
    s.energy -= missionCost(s, m);
    s.today.missions[m.id] = (s.today.missions[m.id] || 0) + 1;
    if (s.tip > 0) s.tip = 0;
    s.dstate[d].vigil = clamp(s.dstate[d].vigil + m.vigil, 0, 100);
    if (roll(odds)) {
      const reward = Math.max(1, Math.round(rand(m.low, m.high) * mult));
      const rg = respectGain(s, m);
      s.cash += reward; s.respect += rg; addHeat(s, heatGain(s, m.heat)); s.successful++; markDone(s, 'missions', m.id);
      if (roll(30)) s.stats[m.stat] += 1;
      if (m.influence) addInf(s, d, m.influence * (s.career === 'articulador' ? 1.3 : 1));
      addXP(s, 'operador', m.difficulty >= 33 ? 2 : 1);
      turfFriction(s, d, m.tension);
      if (m.id === 'cofre') unlock(s, 'cofre');
      unlock(s, 'primeira');
      log(s, `${m.name}: sucesso (${odds}%). +${money(reward)} e +${rg} de respeito.`);
      return done(true, `${m.name}: sucesso! +${money(reward)}`);
    }
    const lost = Math.min(s.cash, Math.ceil(s.cash * failLoss(s, m)));
    s.cash -= lost; addHeat(s, heatGain(s, m.heat + rand(4, 10))); s.failed++;
    turfFriction(s, d, Math.ceil(m.tension / 2));
    // Roubo armado que dá errado vira trocação: é o colete que segura o dano.
    const armed = m.req && m.req.power;
    const wound = armed ? ' Trocação com a segurança:' + hurt(s, rand(8, 14) + armed).replace(/^ /, ' ') : m.stat === 'forca' ? hurt(s, rand(6, 12)) : '';
    const ac = arrestChance(s, m);
    let jailMsg = '';
    if (roll(ac)) { s.jail = rand(1, 3) + (s.heat >= 70 ? 1 : 0) + (gearVal(s, 'power') >= 7 ? 1 : 0); s.seasonStats.arrests++; jailMsg = ` Você foi detido por ${s.jail} dia(s) e perdeu ${loseRespect(s, .04)} de respeito.`; }
    log(s, `${m.name}: fracasso (${odds}%). Perda de ${money(lost)} em mãos.${wound}${jailMsg}`);
    return done(false, `${m.name} falhou. -${money(lost)}.${wound}${jailMsg}`);
  }

  function doTrain(s, id) {
    const st = STATS.find(x => x.id === id); if (!st) return refuse('Atributo desconhecido.');
    const cost = trainCost(s, id);
    if (blocked(s)) return refuse(blocked(s));
    if (s.today.training >= 3) return refuse('Limite de 3 treinos por dia. Descanse até amanhã.');
    if (s.energy < 22 || s.cash < cost) return refuse('Energia ou dinheiro insuficiente para o treino.');
    s.energy -= 22; s.cash -= cost; s.today.training++;
    const gain = s.stats[id] < 25 ? 2 : 1;
    s.stats[id] += gain; s.respect += 1; s.tutorial.trained = true;
    log(s, `Treinamento em ${st.name}: +${gain} ponto(s) por ${money(cost)}.`);
    return done(true, `${st.name}: +${gain} ponto(s)!`);
  }

  function doTravel(s, id) {
    const d = DISTRICTS.find(x => x.id === id);
    if (!d || d.id === s.district) return refuse('Destino inválido.');
    const tc = travelCost(s);
    if (blocked(s)) return refuse(blocked(s));
    if (s.cash < tc.cash || s.energy < tc.energy) return refuse('Não foi possível viajar: verifique dinheiro e energia.');
    s.cash -= tc.cash; s.energy -= tc.energy; s.district = id;
    // Blitz: viajar carregado é arriscado; depende da carga, da sua vigilância e do veículo.
    {
      const pct = blitzChance(s);
      if (pct > 0 && roll(pct)) {
        let lost = 0;
        for (const g of GOODS) { const q = Math.ceil(s.goods[g.id] / 2); s.goods[g.id] -= q; lost += q * g.base; }
        addHeat(s, 10); s.trade.blitz++;
        log(s, `Blitz no caminho para ${d.name}: metade da carga apreendida (cerca de ${money(lost)}).`);
        return done(false, `Blitz no caminho! Metade da carga apreendida (${money(lost)}).`);
      }
    }
    log(s, `Você foi para ${d.name}.`);
    return done(true, `Agora você está em ${d.name}.`);
  }

  function doGig(s) {
    if (blocked(s)) return refuse(blocked(s));
    if (s.energy < 28) return refuse('O bico exige 28 de energia.');
    const pay = Math.round(rand(110, 170) * eventMod(s, 'gigMult'));
    s.energy -= 28; s.cash += pay; addHeat(s, -4);
    log(s, `Bico realizado: ${money(pay)} recebidos.`);
    return done(true, `Bico concluído. +${money(pay)}`);
  }
  function doLayLow(s) {
    if (blocked(s)) return refuse(blocked(s));
    if (s.energy < 18 || s.heat === 0) return refuse('Não é necessário reduzir exposição agora.');
    s.energy -= 18; addHeat(s, -20); s.dstate[s.district].vigil = clamp(s.dstate[s.district].vigil - 10, 0, 100);
    log(s, 'Você ficou longe dos holofotes: -20 de Procurado e -10 de polícia no bairro.');
    return done(true, 'Procurado reduzido.');
  }
  function doBail(s) {
    if (s.jail <= 0) return refuse('Você não está detido.');
    const c = bailCost(s);
    if (s.cash < c) return refuse(`A fiança custa ${money(c)} em mãos.`);
    s.cash -= c; s.jail = 0; s.seasonStats.bailPaid++; addHeat(s, 5);
    unlock(s, 'fianca');
    log(s, `Advogado de porta de cadeia: ${money(c)}. Você está livre, mas chamou atenção (+5 de Procurado).`);
    return done(true, 'O advogado de porta de cadeia te tirou.');
  }
  /** Suborno: mais barato que o advogado, mas pode dar errado (+1 dia e mais vigilância). */
  const bribeCost = s => s.jail > 0 ? Math.round(bailCost(s) * .45) : 0;
  function doBribe(s) {
    if (s.jail <= 0) return refuse('Você não está detido.');
    if (s.today.bribe) return refuse('O carcereiro já foi procurado hoje.');
    const c = bribeCost(s);
    if (s.cash < c) return refuse(`O carcereiro quer ${money(c)} em mãos.`);
    s.cash -= c; s.today.bribe = true;
    const odds = clamp(55 + s.stats.labia - s.heat * .3, 15, 85);
    if (roll(odds)) { s.jail = 0; addHeat(s, 3); log(s, `Carcereiro molhado com ${money(c)}: você saiu pelos fundos.`); return done(true, 'O carcereiro aceitou. Você saiu pelos fundos.'); }
    s.jail = Math.min(5, s.jail + 1); addHeat(s, 8);
    log(s, `O carcereiro pegou ${money(c)} e te dedurou: +1 dia e +8 de Procurado.`);
    return done(false, 'O carcereiro te dedurou: +1 dia de cadeia.');
  }

  function doBank(s, mode, amount) {
    if (!Number.isSafeInteger(amount) || amount <= 0) return refuse('Digite um valor inteiro maior que zero.');
    if (mode === 'deposit') {
      const fee = depositFee(s, amount);
      if (amount + fee > s.cash) return refuse(`Dinheiro em mãos insuficiente (valor + taxa de ${money(fee)}).`);
      s.cash -= amount + fee; s.bank += amount; s.tutorial.banked = true;
      log(s, `Depósito de ${money(amount)} (taxa ${money(fee)}).`);
      return done(true, `Depositado. Taxa: ${money(fee)}.`);
    }
    if (mode === 'withdraw') {
      if (amount > s.bank) return refuse('Saldo no banco insuficiente.');
      s.bank -= amount; s.cash += amount;
      log(s, `Saque de ${money(amount)}.`);
      return done(true, 'Saque realizado.');
    }
    return refuse('Operação bancária inválida.');
  }
  /** Maior depósito possível considerando a taxa. */
  function maxDeposit(s) { let a = Math.floor(s.cash / (1 + depositRate(s))); while (a > 0 && a + depositFee(s, a) > s.cash) a--; return Math.max(0, a); }

  function doBuy(s, id) {
    const b = business(id);
    if (!b || s.businesses.includes(id)) return refuse('Compra indisponível.');
    if (s.jail > 0) return refuse('Não é possível fechar negócios detido.');
    { const cl = chainLock(s, 'biz', id); if (cl) return refuse(cl); }
    const c = buyCost(s, b);
    if (s.cash < c) return refuse(`Você precisa de ${money(c)} em mãos.`);
    s.cash -= c; s.businesses.push(id); s.respect += b.respect; markDone(s, 'biz', id);
    addXP(s, 'empreendedor', 3);
    if (b.tags.includes('noite')) addXP(s, 'barao', 3);
    if (s.businesses.filter(x => business(x).tags.includes('noite')).length >= 3) unlock(s, 'reidanoite');
    if (s.businesses.length >= 4) unlock(s, 'empresario');
    log(s, `Você adquiriu ${b.name} (${district(s, b.district).name}) por ${money(c)}.`);
    return done(true, `${b.name} adquirido!`);
  }
  function doSell(s, id) {
    const b = business(id);
    if (!b || !s.businesses.includes(id)) return refuse('Você não possui este negócio.');
    if (s.jail > 0) return refuse('Não é possível negociar detido.');
    const v = Math.round(b.cost * RESALE);
    s.businesses = s.businesses.filter(x => x !== id); s.cash += v;
    log(s, `Você vendeu ${b.name} por ${money(v)}.`);
    return done(true, `${b.name} vendido por ${money(v)}.`);
  }

  function doContact(s) {
    if (blocked(s)) return refuse(blocked(s));
    const d = s.district, cost = contactCost(s), used = s.today.contacts[d] || 0;
    if (used >= 2) return refuse('Você já fez 2 contatos neste bairro hoje.');
    if (s.energy < 22 || s.cash < cost) return refuse('Energia ou dinheiro insuficiente.');
    s.energy -= 22; s.cash -= cost; s.today.contacts[d] = used + 1;
    const boost = Math.max(1, Math.round((10 + Math.floor(s.stats.influencia / 5) + roleLevels(s, 'negociador')) * (s.career === 'articulador' ? 1.3 : 1) * eventMod(s, 'influenceMult') * (used ? .5 : 1)));
    addInf(s, d, boost); s.respect += 1; addHeat(s, 2); s.tutorial.contacted = true;
    addXP(s, 'articulador', 1);
    log(s, `Contatos em ${district(s).name}: +${boost} de influência.`);
    return done(true, `+${boost} influência em ${district(s).name}.`);
  }

  function doDispute(s) {
    if (blocked(s)) return refuse(blocked(s));
    const d = s.district, l = leader(s, d), fs = s.factions[l.id];
    if (s.influence[d] < 20) return refuse('Construa pelo menos 20 de influência no bairro antes de disputar.');
    if (agreement(s, l.id)) return refuse(`Você tem um acordo com ${faction(l.id).short}. Rompa-o na tela Gangue se quiser disputar.`);
    if (fs.lastActionDay === s.day) return refuse('Você já agiu contra esta facção hoje.');
    if (s.energy < 33 || s.cash < 320) return refuse('Energia ou dinheiro insuficiente.');
    const odds = disputeOdds(s, d);
    s.energy -= 33; s.cash -= 320; fs.lastActionDay = s.day; addRel(s, l.id, -10); addTen(s, l.id, 12);
    s.dstate[d].econ = clamp(s.dstate[d].econ - .03, .6, 1.4);
    if (roll(odds)) {
      addInf(s, d, 15); addPres(s, d, l.id, -12); s.respect += 5; addHeat(s, 8); addXP(s, 'articulador', 1);
      log(s, `Disputa vencida em ${district(s).name} (${odds}%). ${faction(l.id).short} perdeu espaço.`);
      return done(true, `Disputa vencida! (${odds}%)`);
    }
    addInf(s, d, -6); addPres(s, d, l.id, 8); addHeat(s, 11);
    log(s, `Disputa perdida em ${district(s).name} (${odds}%). ${faction(l.id).short} avançou.`);
    return done(false, 'Disputa perdida. O rival avançou.');
  }

  function doDialogue(s, fid) {
    const f = faction(fid); if (!f) return refuse('Facção desconhecida.');
    if (s.jail > 0) return refuse('Você está detido.');
    const r = s.factions[fid];
    if (r.lastActionDay === s.day) return refuse('Você já interagiu com este grupo hoje.');
    if (s.energy < 18 || s.cash < 170) return refuse('Diálogo exige R$ 170 e 18 de energia.');
    const odds = dialogueOdds(s, fid);
    s.energy -= 18; s.cash -= 170; r.lastActionDay = s.day;
    if (roll(odds)) {
      addRel(s, fid, 14); addTen(s, fid, -12); s.gangStats.dialogs++; addXP(s, 'articulador', 2);
      log(s, `Conversa com ${f.name}: aproximação bem-sucedida (${odds}%).`);
      return done(true, `Diálogo positivo com ${f.short}!`);
    }
    addRel(s, fid, -6); addTen(s, fid, 5);
    log(s, `Conversa com ${f.name}: sem acordo (${odds}%). A tensão aumentou.`);
    return done(false, 'O diálogo não avançou.');
  }

  function doPact(s, fid, free) {
    const f = faction(fid); if (!f) return refuse('Facção desconhecida.');
    const r = s.factions[fid];
    if (!s.gangName && !free) return refuse('Tréguas exigem uma gangue fundada.');
    if (s.jail > 0) return refuse('Você está detido.');
    if (s.day >= MAXDAY) return refuse('A temporada está no último dia.');
    if (agreement(s, fid)) return refuse('Já existe um acordo com este grupo.');
    if (!free) {
      if (r.lastActionDay === s.day) return refuse('Você já interagiu com este grupo hoje.');
      if (r.relation < 35) return refuse('A trégua exige relação +35.');
      if (s.day <= r.cooldown) return refuse(`${f.short} só aceita nova trégua após o dia ${r.cooldown}.`);
      const c = pactCost(s, fid);
      if (s.energy < 24 || s.cash < c) return refuse(`A trégua exige ${money(c)} e 24 de energia.`);
      s.energy -= 24; s.cash -= c; r.lastActionDay = s.day;
    }
    r.deals++;
    const len = hasPerk(s, 'articulador', 2) ? 5 : 3;
    r.truceUntil = Math.min(MAXDAY, s.day + len);
    r.cooldown = r.truceUntil + 2;
    addRel(s, fid, free ? 5 : 3); addTen(s, fid, -15); s.gangStats.pacts++; addXP(s, 'articulador', 3);
    if (s.gangStats.pacts >= 3) unlock(s, 'diplomata');
    log(s, `Trégua com ${f.name} até o dia ${r.truceUntil}: sem disputas, avanços ou retaliações entre vocês.`);
    return done(true, `Trégua com ${f.short} até o dia ${r.truceUntil}.`);
  }

  function doAlliance(s, fid) {
    const f = faction(fid); if (!f) return refuse('Facção desconhecida.');
    const r = s.factions[fid], cost = allianceCost(s);
    if (!s.gangName || s.gangLevel < 2) return refuse('Alianças exigem gangue com sede nível 2.');
    if (s.jail > 0) return refuse('Você está detido.');
    if (r.allied) return refuse('Vocês já são aliados.');
    if (FACTIONS.some(x => s.factions[x.id].allied)) return refuse('Você só pode ter uma aliança por vez.');
    if (r.lastActionDay === s.day) return refuse('Você já interagiu com este grupo hoje.');
    if (r.relation < 60) return refuse('A aliança exige relação +60.');
    if (s.energy < 20 || s.cash < cost) return refuse(`A aliança exige ${money(cost)} e 20 de energia.`);
    s.energy -= 20; s.cash -= cost; r.lastActionDay = s.day; r.allied = true; r.allyDays = 0; r.truceUntil = 0;
    addTen(s, fid, -20); s.gangStats.alliances++; s.gangStats.pacts++;
    const enemy = FACTION_ENEMY[fid];
    if (enemy) { addRel(s, enemy, -12); addTen(s, enemy, 10); }
    addXP(s, 'articulador', 3); unlock(s, 'alianca');
    log(s, `Aliança com ${f.name}! Contribuição diária de ${money(allianceFee(s))}. ${enemy ? faction(enemy).short + ' não gostou.' : ''}`);
    return done(true, `Aliança firmada com ${f.short}.`);
  }

  /** Romper acordo: traição do jogador. Reduz a confiança de todas as facções. */
  function betrayPenalty(s, fid) {
    addRel(s, fid, -40); s.factions[fid].grudge = clamp(s.factions[fid].grudge + 3, 0, 10); addTen(s, fid, 20);
    for (const f of FACTIONS) if (f.id !== fid) addRel(s, f.id, -8);
    s.treachery++; s.gangStats.betrayals++; unlock(s, 'traidor');
  }
  function doBreak(s, fid) {
    const f = faction(fid); if (!f) return refuse('Facção desconhecida.');
    const r = s.factions[fid];
    if (!agreement(s, fid)) return refuse('Não há acordo para romper.');
    r.allied = false; r.truceUntil = 0;
    betrayPenalty(s, fid);
    log(s, `Você rompeu o acordo com ${f.name}. Todos na cidade souberam: sua palavra vale menos.`);
    return done(false, `Acordo com ${f.short} rompido.`);
  }

  function doClash(s, fid) {
    const f = faction(fid); if (!f) return refuse('Facção desconhecida.');
    if (!s.gangName) return refuse('Confrontos exigem uma gangue.');
    if (s.jail > 0) return refuse('Você está detido.');
    const r = s.factions[fid], d = s.district;
    if (leader(s, d).id !== fid) return refuse(`${f.short} não lidera este bairro.`);
    if (s.influence[d] < 20) return refuse('Você precisa de 20 de influência no bairro.');
    if (s.hospital > 0) return refuse('Você está internado.');
    if (injured(s)) return refuse('Você está ferido demais para um confronto. Cuide da saúde.');
    if (agreement(s, fid)) return refuse('Há um acordo ativo. Rompa-o antes de confrontar.');
    if (r.lastActionDay === s.day) return refuse('Você já interagiu com este grupo hoje.');
    if (s.energy < 32 || s.cash < 300) return refuse('O confronto exige R$ 300 e 32 de energia.');
    const odds = clashOdds(s, d);
    s.energy -= 32; s.cash -= 300; r.lastActionDay = s.day;
    addRel(s, fid, -18); addTen(s, fid, 19); r.grudge = clamp(r.grudge + 1, 0, 10);
    s.dstate[d].econ = clamp(s.dstate[d].econ - .04, .6, 1.4); s.dstate[d].vigil = clamp(s.dstate[d].vigil + 10, 0, 100);
    if (roll(odds)) {
      addInf(s, d, 16); addPres(s, d, fid, -14); r.power = clamp(r.power - 6, 10, 100);
      s.respect += 6; addHeat(s, 9); addMorale(s, 5); s.gangStats.confrontWins++; memberXP(s, 2, 'musculo'); memberXP(s, 1);
      if (odds <= 40) unlock(s, 'virada');
      log(s, `${s.gangName} venceu ${f.name} em ${district(s).name} (${odds}%).`);
      return done(true, `Confronto vencido! (${odds}%)`);
    }
    addInf(s, d, -9); addPres(s, d, fid, 11); addHeat(s, 16); addMorale(s, -10); s.gangStats.confrontLosses++; memberXP(s, 1, 'musculo');
    const wound = hurt(s, rand(12, 22));
    log(s, `${s.gangName} perdeu para ${f.name} em ${district(s).name} (${odds}%). A equipe ficou abalada.${wound}`);
    return done(false, `Confronto perdido: influência e ânimo reduzidos.${wound}`);
  }

  function doFoundGang(s, rawName) {
    const name = String(rawName || '').trim().replace(/\s+/g, ' ');
    if (name.length < 3 || name.length > 25) return refuse('Use um nome entre 3 e 25 caracteres.');
    if (s.gangName) return refuse('Você já lidera um grupo.');
    if (s.jail > 0) return refuse('Você está detido.');
    if (s.respect < 30 || s.cash < 1800) return refuse('Requisitos: 30 de respeito e R$ 1.800 em mãos.');
    s.cash -= 1800; s.gangName = name; s.gangLevel = 1; s.crewMorale = 70;
    s.crew = [newMember(s, 'musculo', 0), newMember(s, 'olheiro', 1)];
    log(s, `Você fundou ${name}, com ${s.crew[0].name} (Músculo) e ${s.crew[1].name} (Olheiro).`);
    return done(true, 'Seu grupo foi fundado.');
  }
  function doRecruit(s, role) {
    if (!ROLES.some(r => r.id === role)) return refuse('Escolha uma função.');
    const c = recruitCost(s);
    if (!s.gangName || s.jail > 0) return refuse('Recrutamento indisponível.');
    if (crewSize(s) >= 8) return refuse('Sua equipe já tem 8 integrantes.');
    if (s.crewLastRecruit === s.day) return refuse('Apenas um recrutamento por dia.');
    if (s.cash < c || s.energy < 18) return refuse(`Recrutar exige ${money(c)} e 18 de energia.`);
    s.cash -= c; s.energy -= 18; s.crewLastRecruit = s.day;
    const m = newMember(s, role); s.crew.push(m); addMorale(s, 3);
    if (crewSize(s) >= 8) unlock(s, 'bonde');
    log(s, `${m.name} entrou na equipe como ${ROLES.find(r => r.id === role).name}. Manutenção: ${money(groupUpkeep(s))}/dia.`);
    return done(true, `${m.name} entrou para o grupo.`);
  }
  function doDismiss(s, memberId) {
    const m = s.crew.find(x => x.id === memberId);
    if (!m) return refuse('Integrante não encontrado.');
    s.crew = s.crew.filter(x => x.id !== memberId); addMorale(s, -6);
    log(s, `${m.name} foi dispensado. A equipe ficou apreensiva (-6 ânimo).`);
    return done(true, `${m.name} dispensado.`);
  }
  function doRally(s) {
    if (!s.gangName || s.jail > 0 || s.crewLastRally === s.day || s.crewMorale >= 100) return refuse('Reunião indisponível agora.');
    if (s.cash < 180 || s.energy < 12) return refuse('A reunião exige R$ 180 e 12 de energia.');
    s.cash -= 180; s.energy -= 12; addMorale(s, 18); s.crewLastRally = s.day;
    log(s, 'A equipe se reuniu e recuperou parte do ânimo.');
    return done(true, 'Ânimo do grupo recuperado.');
  }
  function doUpgrade(s) {
    const c = upgradeCost(s);
    if (!s.gangName || s.gangLevel >= 8) return refuse('Melhoria indisponível.');
    if (s.jail > 0) return refuse('Você está detido.');
    if (s.cash < c) return refuse(`A melhoria custa ${money(c)}.`);
    s.cash -= c; s.gangLevel++; s.respect += 4;
    log(s, `A sede foi melhorada para o nível ${s.gangLevel}.`);
    return done(true, 'Melhoria concluída!');
  }
  function doGangOp(s) {
    if (!s.gangName || s.jail > 0) return refuse('Operação indisponível.');
    if (s.today.op) return refuse('Apenas uma operação coletiva por dia.');
    if (s.hospital > 0) return refuse('Você está internado.');
    if (injured(s)) return refuse('Você está ferido demais para liderar a operação.');
    if (crewSize(s) < 2) return refuse('A operação exige pelo menos 2 integrantes.');
    if (s.energy < 35) return refuse('Energia insuficiente (35).');
    const d = s.district, odds = gangOdds(s);
    s.energy -= 35; s.today.op = true;
    s.dstate[d].vigil = clamp(s.dstate[d].vigil + 15, 0, 100);
    const olheiro = Math.min(8, roleLevels(s, 'olheiro'));
    if (roll(odds)) {
      const reward = Math.round(rand(700, 1350) * s.dstate[d].econ * (1 + crewSize(s) * .05) * (controlled(s, 'cais') ? 1.2 : 1) * (1 + eventMod(s, 'reward', { district: d }) / 200));
      s.cash += reward; s.respect += 5; addHeat(s, heatGain(s, 14 - olheiro)); addMorale(s, 3); s.successful++; s.gangStats.groupWins++;
      memberXP(s, 1); turfFriction(s, d, 5);
      log(s, `Operação de ${s.gangName} concluída (${odds}%): +${money(reward)}.`);
      return done(true, `Operação concluída! +${money(reward)}`);
    }
    const lost = Math.ceil(s.cash * .08);
    s.cash -= lost; s.failed++; addHeat(s, heatGain(s, 20 - olheiro)); addMorale(s, -8); turfFriction(s, d, 3);
    const wound = hurt(s, rand(4, 9));
    log(s, `Operação de ${s.gangName} falhou (${odds}%). Perda: ${money(lost)}.${wound}`);
    return done(false, 'A operação coletiva falhou.');
  }


  /* ---------- v0.7: Feira do Rolo, Galpão e Vida noturna ---------- */
  function doBuyItem(s, id) {
    const it = item(id); if (!it) return refuse('Item desconhecido.');
    if (s.jail > 0) return refuse('Você está detido.');
    if (s.gear[it.slot] === id) return refuse('Você já usa este item.');
    { const c = chainLock(s, 'items', it.id); if (c) return refuse(c); }
    if (s.respect < it.unlock) return refuse(`Requer ${it.unlock} de respeito.`);
    if (it.trophy && !s.achievements[it.trophy]) return refuse('Só para quem venceu o Rei do Pedaço (conquista).');
    const old = item(s.gear[it.slot]), back = old ? Math.round(old.cost * ITEM_RESALE) : 0;
    if (s.cash + back < it.cost) return refuse(`Você precisa de ${money(it.cost - back)} em mãos.`);
    if (it.slot === 'veiculo' && cargoUsed(s) > 30 + (it.cargo || 0) + 40 * LABS.filter(l => s.labs[l.id] > 0).length) return refuse('Sua carga não cabe neste veículo. Venda parte antes.');
    s.cash += back - it.cost; s.gear[it.slot] = id; markDone(s, 'items', id);
    if (it.id === 'fuzil' || it.id === 'blindado') unlock(s, 'arsenal');
    log(s, `Feira do Rolo: ${it.name} por ${money(it.cost)}${old ? ` (o ${old.name} voltou por ${money(back)})` : ''}.`);
    return done(true, `${it.name} agora é seu.`);
  }
  function doBuyGood(s, id, qty) {
    const g = good(id); if (!g) return refuse('Mercadoria desconhecida.');
    if (!Number.isSafeInteger(qty) || qty <= 0) return refuse('Quantidade inválida.');
    if (blocked(s)) return refuse(blocked(s));
    if (s.respect < g.unlock) return refuse(`Requer ${g.unlock} de respeito.`);
    if (s.energy < 3) return refuse('Negociar exige 3 de energia.');
    if (cargoUsed(s) + qty > cargoCap(s)) return refuse(`Sem espaço: cabem mais ${Math.max(0, cargoCap(s) - cargoUsed(s))} unidade(s).`);
    const d = s.district, imp = priceImpact(g, qty);
    const total = buyTotal(s, g, qty);
    if (s.cash < total) return refuse(`Custa ${money(total)} em mãos.`);
    s.cash -= total; s.energy -= 3; s.goods[g.id] += qty; s.trade.spent += total;
    s.market[d][g.id] = clamp(s.market[d][g.id] + imp, 60, 150);
    addHeat(s, Math.ceil(qty * g.risk / 12 * (s.career === 'traficante' ? 1.6 : 1)));
    log(s, `Galpão: comprou ${qty} × ${g.name} por ${money(total)} em ${district(s).name}.`);
    return done(true, `Comprou ${qty} × ${g.name} por ${money(total)}.`);
  }
  function doSellGood(s, id, qty) {
    const g = good(id); if (!g) return refuse('Mercadoria desconhecida.');
    if (!Number.isSafeInteger(qty) || qty <= 0) return refuse('Quantidade inválida.');
    if (blocked(s)) return refuse(blocked(s));
    if (s.goods[g.id] < qty) return refuse('Você não tem essa quantidade.');
    if (s.energy < 3) return refuse('Negociar exige 3 de energia.');
    const d = s.district, imp = priceImpact(g, qty);
    const total = sellTotal(s, g, qty);
    s.cash += total; s.energy -= 3; s.goods[g.id] -= qty; s.trade.sold += total;
    if (total >= 300) addXP(s, 'traficante', 1);
    s.market[d][g.id] = clamp(s.market[d][g.id] - imp, 60, 150);
    addHeat(s, Math.ceil(qty * g.risk / 12 * (s.career === 'traficante' ? 1.6 : 1)));
    s.dstate[d].vigil = clamp(s.dstate[d].vigil + Math.ceil(qty * g.risk / 10), 0, 100);
    turfFriction(s, d, g.risk >= 2 ? 2 : 1); // vender na área de outro grupo incomoda
    if (s.trade.sold >= 20000) unlock(s, 'atacadista');
    log(s, `Galpão: vendeu ${qty} × ${g.name} por ${money(total)} em ${district(s).name}.`);
    return done(true, `Vendeu ${qty} × ${g.name} por ${money(total)}.`);
  }
  const exportOpen = s => s.exportDeal.day === s.day && s.district === 'cais';
  function doExport(s) {
    const g = good(s.exportDeal.good);
    if (blocked(s)) return refuse(blocked(s));
    if (s.exportDeal.day !== s.day) return refuse(`O comprador de fora só chega no dia ${s.exportDeal.day}.`);
    if (s.district !== 'cais') return refuse(`O comprador espera em ${district(s, 'cais').name}.`);
    const qty = Math.min(exportLimit(s), s.goods[g.id]);
    if (qty <= 0) return refuse(`Você não tem ${g.name} para entregar.`);
    if (s.exportDone === s.day) return refuse('O comprador já fechou negócio com você hoje.');
    const total = exportPrice(g, s) * qty;
    s.cash += total; s.goods[g.id] -= qty; s.trade.sold += total; s.trade.exported += qty; s.exportDone = s.day;
    addXP(s, 'traficante', 3);
    s.respect += Math.ceil(qty / 10) * (g.id === 'po' ? 3 : 1); addHeat(s, 6);
    unlock(s, 'exportador');
    log(s, `Remessa para fora: ${qty} × ${g.name} por ${money(total)}.`);
    return done(true, `Remessa fechada: ${qty} × ${g.name} por ${money(total)}.`);
  }
  /** Texto do que um esquema rende por dia no nível atual. */
  const labYield = (s, l) => l.cash ? `${money(labCash(s, l))} no banco` : `${labOutput(s, l)} × ${good(l.good).name}${l.good2 ? ` e ${labOutput(s, l, l.out2)} × ${good(l.good2).name}` : ''}`;
  function doBuildLab(s, id) {
    const l = LABS.find(x => x.id === id); if (!l) return refuse('Produção desconhecida.');
    if (s.jail > 0) return refuse('Você está detido.');
    if (s.labs[l.id] >= 3) return refuse('Produção no nível máximo.');
    if (!s.labs[l.id]) { const c = chainLock(s, 'labs', l.id); if (c) return refuse(c); }
    if (s.respect < l.unlock) return refuse(`Requer ${l.unlock} de respeito.`);
    const c = labCost(s, l);
    if (s.cash < c) return refuse(`Custa ${money(c)} em mãos.`);
    s.cash -= c; s.labs[l.id]++; markDone(s, 'labs', l.id);
    addXP(s, 'traficante', 2);
    if (LABS.filter(x => s.labs[x.id] > 0).length >= 3) unlock(s, 'industria');
    log(s, `${l.name} ${s.labs[l.id] === 1 ? 'montado' : 'ampliado para o nível ' + s.labs[l.id]} por ${money(c)}: ${labYield(s, l)} por dia.`);
    return done(true, `${l.name}: nível ${s.labs[l.id]}.`);
  }
  function doNight(s, id) {
    const n = NIGHT.find(x => x.id === id); if (!n) return refuse('Lugar desconhecido.');
    if (blocked(s)) return refuse(blocked(s));
    if (s.today.venue === n.id) return refuse(`Você já está no ${n.name}. Peça no balcão.`);
    if (s.today.night >= NIGHT_LIMIT) return refuse('Três saídas por dia já é demais. Durma e amanhã tem mais.');
    if (s.energy >= 100) return refuse('Você já está com a energia cheia.');
    const own = ownTermas(s, n), barao2 = hasPerk(s, 'barao', 2);
    if (!own && !s.businesses.includes(n.id)) { const c = chainLock(s, 'night', n.id); if (c) return refuse(c); }
    if (n.unlock && s.respect < n.unlock && !own) return refuse(`A porta só abre para quem tem ${n.unlock} de respeito.`);
    const c = nightCost(s, n);
    if (s.cash < c) return refuse(`A entrada custa ${money(c)} em mãos.`);
    s.cash -= c; s.today.night++; s.today.venue = n.id; markDone(s, 'night', n.id);
    addXP(s, 'barao', 1);
    if (s.career === 'barao') s.respect += 1; // é visto, é lembrado
    if (n.morale) addMorale(s, n.morale);
    if (n.heat) addHeat(s, n.heat);
    let extra = '';
    if (own) { s.today.termas = true; s.tutorial.nighted = true; s.energy = 100; extra += ' Na sua casa: energia cheia, sem vício e sem conta.'; }
    if (n.contact && roll(n.contact)) { const b = 3 + Math.floor(s.stats.labia / 8); addInf(s, s.district, b); extra += ` Você firmou contatos: +${b} de influência em ${district(s).name}.`; }
    if (n.brawl && !nightSafe(s, n) && !barao2 && roll(n.brawl)) { addHeat(s, 5); extra += ` Cruzou com gente de outra gangue e saiu na mão:${hurt(s, rand(8, 16))}`; }
    if (n.raid && !barao2 && !s.hospital && roll(Math.round(n.raid * eventMod(s, 'nightRiskMult')))) { const fine = Math.min(s.cash, 500, Math.ceil(s.cash * .05)); s.cash -= fine; addHeat(s, 8); extra += ` Batida policial: ${money(fine)} de "cafezinho" e +8 de Procurado.`; }
    if (n.boss) { const l = leader(s, s.district); addRel(s, l.id, 5); extra += ` Negócio fechado com ${faction(l.id).short}: relação +5.`; }
    if (s.hospital) s.today.venue = null;
    log(s, `${n.name}: entrada ${money(c)}.${extra}`);
    return done(true, `Você entrou no ${n.name}.${extra}`);
  }
  /** Uma dose do cardápio da casa onde você está; `fromStock` usa a sua mercadoria em vez de pagar. */
  function doDose(s, id, fromStock) {
    const n = NIGHT.find(x => x.id === s.today.venue); if (!n) return refuse('Entre numa casa da noite primeiro.');
    if (blocked(s)) return refuse(blocked(s));
    const d = doseOf(id); if (!d || !n.menu.includes(d.id)) return refuse('Isso não tem aqui.');
    if (s.today.doses >= DOSE_LIMIT) return refuse(`Por hoje chega: ${DOSE_LIMIT} doses é o limite do corpo.`);
    if (d.max && (s.today.dose[d.id] || 0) >= d.max) return refuse(`${d.name}: no máximo ${d.max} por dia.`);
    if (s.energy >= 100) return refuse('Você já está com a energia cheia.');
    if (chemLeft(s) <= 0) return refuse(`Seu corpo não aguenta mais nada hoje (${CHEM_CAP} de energia em doses). Vá descansar.`);
    const stock = !!fromStock;
    if (stock && (!d.good || s.goods[d.good] < 1)) return refuse('Você não tem isso no estoque.');
    const c = stock ? 0 : doseCost(s, d, n);
    if (s.cash < c) return refuse(`Custa ${money(c)} em mãos.`);
    const gain = Math.min(nightEnergy(s, d), chemLeft(s), 100 - s.energy), od = d.strong ? overdoseChance(s) : 0;
    if (stock) s.goods[d.good]--; else s.cash -= c;
    s.today.doses++; s.today.dose[d.id] = (s.today.dose[d.id] || 0) + 1; s.tutorial.nighted = true;
    s.energy = clamp(s.energy + gain, 0, 100); s.today.chem += gain;
    s.vicio = clamp(s.vicio + doseVicio(s, d), 0, 100);
    s.ressaca = clamp(s.ressaca + Math.ceil(d.ressaca * (hasPerk(s, 'barao', 1) ? .5 : 1)), 0, 30);
    let extra = '';
    if (d.azia && roll(d.azia)) { s.health = clamp(s.health - 5, 1, 100); extra += ' Veio batizado demais: azia braba, −5 de saúde.'; }
    if (od && !s.hospital && roll(od)) {
      s.hospital = 1; s.today.venue = null; s.health = clamp(s.health - 25, 1, 100); const lostR = loseRespect(s, .03); s.overdoses++;
      extra += ` Teto preto: overdose. Um dia na UPA, −25 de saúde e −${lostR} de respeito.`;
      log(s, `${n.name}, ${d.name}: overdose (vício ${s.vicio}).${extra}`);
      return done(false, `${d.name}: você passou mal.${extra}`);
    }
    log(s, `${n.name}: ${d.name} ${stock ? 'do seu estoque' : 'por ' + money(c)}, +${gain} de energia.${extra} Vício ${s.vicio}/100.`);
    return done(true, `${d.name}: +${gain} de energia.${extra}`);
  }



  /* ---------- v0.8: duelos e hospital ---------- */
  function doDuel(s, id) {
    const r = rival(id); if (!r) return refuse('Adversário desconhecido.');
    if (blocked(s)) return refuse(blocked(s));
    { const c = chainLock(s, 'rivals', r.id); if (c) return refuse(c); }
    if (s.respect < r.unlock) return refuse(`Requer ${r.unlock} de respeito.`);
    if (injured(s)) return refuse('Você está ferido demais para duelar. Cuide da saúde.');
    if (s.today.duels >= DUEL_LIMIT) return refuse(`Limite de ${DUEL_LIMIT} duelos por dia.`);
    if (s.energy < DUEL_ENERGY) return refuse(`O duelo exige ${DUEL_ENERGY} de energia.`);
    const odds = duelOdds(s, r);
    s.energy -= DUEL_ENERGY; s.today.duels++;
    const noisy = gearVal(s, 'power') >= 7 ? 4 : 1; // arma de fogo chama atenção
    addHeat(s, noisy); s.dstate[s.district].vigil = clamp(s.dstate[s.district].vigil + 3, 0, 100);
    if (roll(odds)) {
      const prize = rand(r.low, r.high), first = !s.beaten[r.id];
      const rg = first ? r.respect * 2 : r.respect;
      s.cash += prize; s.respect += rg; s.duelStats.wins++; s.beaten[r.id] = (s.beaten[r.id] || 0) + 1; markDone(s, 'rivals', r.id);
      if (roll(25)) s.stats.forca += 1;
      const wound = hurt(s, rand(3, 9));
      if (r.id === 'rei') unlock(s, 'reidopedaco');
      if (s.duelStats.wins >= 10) unlock(s, 'brigao');
      log(s, `Duelo com ${r.name} (${odds}%): vitória. +${money(prize)} e +${rg} de respeito${first ? ' (primeira vez)' : ''}.${wound}`);
      return done(true, `Você venceu ${r.name}! +${money(prize)}.${wound}`);
    }
    const lost = Math.min(s.cash, Math.ceil(s.cash * .05));
    s.cash -= lost; s.duelStats.losses++;
    const wound = hurt(s, rand(14, 26) + Math.round(r.rating / 10));
    log(s, `Duelo com ${r.name} (${odds}%): derrota. -${money(lost)}.${wound}`);
    return done(false, `${r.name} levou a melhor. -${money(lost)}.${wound}`);
  }
  function doClinic(s, kind) {
    if (s.jail > 0) return refuse('Você está detido.');
    if (s.hospital > 0) return refuse('Você já está internado; a alta sai sozinha.');
    if (s.health >= 100) return refuse('Sua saúde está cheia.');
    if (kind === 'posto') {
      if (s.today.clinic) return refuse('A UPA só atende você uma vez por dia.');
      if (s.energy < 20) return refuse('O corredor da UPA exige 20 de energia.');
      s.energy -= 20; s.today.clinic = true;
      const g = Math.min(100 - s.health, 25); s.health += g;
      log(s, `UPA: +${g} de saúde depois de horas no corredor.`);
      return done(true, `UPA: +${g} de saúde.`);
    }
    if (kind === 'clinica') {
      const c = clinicCost(s);
      if (s.cash < c) return refuse(`O plantonista quer ${money(c)} em mãos.`);
      const g = 100 - s.health; s.cash -= c; s.health = 100;
      log(s, `Propina pro plantonista: alta na hora por ${money(c)}.`);
      return done(true, `Plantonista molhado: +${g} de saúde por ${money(c)}.`);
    }
    return refuse('Atendimento desconhecido.');
  }


  /* ---------- v1.0: assaltos do bando ---------- */
  function doHeistPlan(s, id) {
    const h = heist(id); if (!h) return refuse('Assalto desconhecido.');
    if (blocked(s)) return refuse(blocked(s));
    if (s.heist) return refuse('Já existe um assalto planejado. Execute ou cancele antes.');
    if (s.day < s.heistReady) return refuse(`O bando ainda está esfriando: novo plano a partir do dia ${s.heistReady}.`);
    if (s.day >= MAXDAY) return refuse('Não há dias suficientes na temporada para executar.');
    const lock = heistLock(s, h); if (lock) return refuse(lock);
    const c = heistPlanCost(s, h);
    if (s.cash < c) return refuse(`O plano custa ${money(c)} em mãos (inclui os avulsos).`);
    if (s.energy < 15) return refuse('Planejar exige 15 de energia.');
    const hires = heistHires(s, h);
    s.cash -= c; s.energy -= 15;
    s.heist = { id: h.id, day: s.day, intel: 0, scoutDay: 0, hires };
    log(s, `Plano montado: ${h.name}, por ${money(c)}${hires ? ` com ${hires} avulso(s)` : ''}. Execute entre os dias ${s.day + 1} e ${Math.min(MAXDAY, s.day + HEIST_WINDOW)}.`);
    return done(true, `Plano montado: ${h.name}.`);
  }
  function doHeistScout(s) {
    if (!s.heist) return refuse('Não há assalto planejado.');
    if (blocked(s)) return refuse(blocked(s));
    if (s.heist.scoutDay === s.day) return refuse('O terreno já foi estudado hoje.');
    if (s.heist.intel >= 40) return refuse('O bando já sabe tudo que dá para saber.');
    if (s.energy < 15) return refuse('Reconhecer o terreno exige 15 de energia.');
    const g = Math.min(40 - s.heist.intel, 12 + Math.min(10, roleLevels(s, 'olheiro') * 2));
    s.energy -= 15; s.heist.scoutDay = s.day; s.heist.intel += g;
    s.dstate[s.district].vigil = clamp(s.dstate[s.district].vigil + 4, 0, 100);
    memberXP(s, 1, 'olheiro');
    log(s, `Reconhecimento para ${heist(s.heist.id).name}: +${g} de informação (${s.heist.intel}/40).`);
    return done(true, `Terreno estudado: informação ${s.heist.intel}/40.`);
  }
  function doHeistCancel(s) {
    if (!s.heist) return refuse('Não há assalto planejado.');
    const h = heist(s.heist.id);
    s.heist = null; addMorale(s, -5);
    log(s, `Plano cancelado: ${h.name}. O dinheiro do plano foi perdido e o bando ficou desconfiado.`);
    return done(false, 'Plano cancelado. O bando ficou desconfiado (-5 de ânimo).');
  }
  function doHeistRun(s) {
    if (!s.heist) return refuse('Não há assalto planejado.');
    const h = heist(s.heist.id);
    if (blocked(s)) return refuse(blocked(s));
    if (s.day <= s.heist.day) return refuse('O bando precisa de pelo menos uma noite entre o plano e a ação.');
    if (injured(s)) return refuse('Você está ferido demais para liderar o assalto.');
    if (crewSize(s) + s.heist.hires < h.need) return refuse(`Falta gente: o plano pede ${h.need} e o bando tem ${crewSize(s) + s.heist.hires}.`);
    if (gearVal(s, 'power') < h.minPower) return refuse(`A arma do líder precisa de poder ${h.minPower}.`);
    if (s.crewMorale < 30) return refuse('O bando está desanimado demais (ânimo abaixo de 30).');
    if (s.energy < 40) return refuse('Executar exige 40 de energia.');
    const odds = heistOdds(s, h), d = s.district;
    s.energy -= 40; s.heist = null; s.heistReady = s.day + HEIST_COOLDOWN;
    s.dstate[d].vigil = clamp(s.dstate[d].vigil + 25, 0, 100);
    turfFriction(s, d, 8);
    if (roll(odds)) {
      const total = Math.round(rand(h.low, h.high) * s.dstate[d].econ * (eventMod(s, 'payday') ? 1.3 : 1) * (s.career === 'operador' ? 1.2 : 1)), cut = Math.round(total * HEIST_CUT), take = total - cut;
      s.cash += take; s.respect += h.respect; addHeat(s, heatGain(s, h.heat)); addMorale(s, 6);
      s.gangStats.heists++; memberXP(s, 2); markDone(s, 'heists', h.id);
      unlock(s, 'primeiroassalto'); if (h.id === 'cofrecentral') unlock(s, 'golpedoano');
      log(s, `${h.name}: deu certo (${odds}%). Total ${money(total)}; o bando ficou com ${money(cut)} e você com ${money(take)}. +${h.respect} de respeito.`);
      return done(true, `${h.name}: deu certo! Sua parte: ${money(take)}.`, { lines: [`Total: ${money(total)} · parte do bando (25%): ${money(cut)}.`] });
    }
    const lost = Math.min(s.cash, Math.ceil(s.cash * .1));
    s.cash -= lost; addHeat(s, heatGain(s, h.heat + 10)); addMorale(s, -15); s.gangStats.heistFails++;
    const lines = [];
    if (s.crew.length && roll(35)) { const m = s.crew.splice(rand(0, s.crew.length - 1), 1)[0]; lines.push(`${m.name} rodou e foi preso.`); }
    const wound = hurt(s, rand(10, 20));
    let jailMsg = '';
    if (!s.hospital && roll(clamp(Math.round(h.arrest + s.heat * .2 - gearVal(s, 'def') - gearVal(s, 'escape')), 5, 85))) {
      s.jail = rand(2, 3) + (gearVal(s, 'power') >= 7 ? 1 : 0); s.seasonStats.arrests++; jailMsg = ` Você foi preso por ${s.jail} dia(s) e perdeu ${loseRespect(s, .04)} de respeito.`;
    }
    log(s, `${h.name}: deu errado (${odds}%). -${money(lost)}.${wound}${jailMsg} ${lines.join(' ')}`);
    return done(false, `${h.name} deu errado. -${money(lost)}.${wound}${jailMsg}`, { lines });
  }


  /* ---------- v1.3: desintoxicação, despachante e apostas ---------- */
  function doDetox(s, kind) {
    if (s.jail > 0) return refuse('Você está detido.');
    if (s.vicio <= 0) return refuse('Você está limpo.');
    if (kind === 'soro') {
      if (s.today.detox) return refuse('Um soro por dia.');
      if (s.energy < 25) return refuse('O soro na veia exige 25 de energia.');
      s.energy -= 25; s.today.detox = true; const g = Math.min(s.vicio, 20); s.vicio -= g;
      log(s, `Soro na veia na UPA: -${g} de vício (${s.vicio}/100).`);
      return done(true, `Soro na veia: -${g} de vício.`);
    }
    if (kind === 'clinica') {
      const c = detoxCost(s);
      if (s.cash < c) return refuse(`A clínica de desintoxicação cobra ${money(c)} em mãos.`);
      s.cash -= c; s.vicio = 0;
      log(s, `Clínica de desintoxicação: vício zerado por ${money(c)}.`);
      return done(true, `Desintoxicação completa por ${money(c)}.`);
    }
    return refuse('Tratamento desconhecido.');
  }
  const cleanCost = s => 150 + s.heat * 14;
  function doCleanRecord(s) {
    if (s.jail > 0) return refuse('Você está detido.');
    if (s.today.despachante) return refuse('O despachante só resolve uma vez por dia.');
    if (s.heat < 20) return refuse('Sua ficha está limpa o bastante.');
    const c = cleanCost(s);
    if (s.cash < c) return refuse(`O despachante cobra ${money(c)} em mãos.`);
    s.cash -= c; s.today.despachante = true; addHeat(s, -35);
    log(s, `Despachante: ficha aliviada por ${money(c)} (-35 de Procurado).`);
    return done(true, 'O despachante deu um jeito na sua ficha.');
  }
  const sinucaOdds = s => clamp(Math.round(34 + s.stats.astucia * .5 + s.stats.labia * .2), 34, 49);
  const bichoPays = s => s.career === 'empreendedor' ? 20 : 18;
  function doBet(s, game, stake, pick) {
    if (blocked(s)) return refuse(blocked(s));
    if (!Number.isSafeInteger(stake) || stake < 10) return refuse('A aposta mínima é R$ 10.');
    if (stake > BET_MAX) return refuse(`A banca não aceita mais que ${money(BET_MAX)} por aposta.`);
    if (stake > s.cash) return refuse('Você não tem esse dinheiro em mãos.');
    if (s.today.bets >= BET_LIMIT) return refuse(`${BET_LIMIT} apostas por dia. A banca fechou para você.`);
    let odds, mult, label;
    if (game === 'bicho') { if (!Number.isInteger(pick) || pick < 0 || pick > 24) return refuse('Escolha um dos 25 bichos.'); odds = 4; mult = bichoPays(s); label = `Jogo do bicho (${ANIMALS[pick]})`; }
    else if (game === 'roleta') { odds = 47; mult = 2; label = 'Roleta clandestina'; }
    else if (game === 'sinuca') { if (stake > 2000) return refuse('Na sinuca do bar, o teto é R$ 2.000.'); odds = sinucaOdds(s); mult = 2; label = 'Sinuca valendo dinheiro'; }
    else return refuse('Jogo desconhecido.');
    s.today.bets++; addHeat(s, 1);
    let win;
    if (game === 'bicho') { const drawn = rand(0, 24); win = drawn === pick; label += win ? '' : `, deu ${ANIMALS[drawn]}`; }
    else win = roll(odds);
    if (win) {
      const gain = stake * (mult - 1); s.cash += gain; s.betStats.won += gain;
      if (game === 'bicho') unlock(s, 'deunobicho');
      log(s, `${label}: ganhou ${money(gain)}.`);
      return done(true, `${label}: ganhou ${money(gain)}!`);
    }
    s.cash -= stake; s.betStats.lost += stake;
    log(s, `${label}: perdeu ${money(stake)}.`);
    return done(false, `${label}: perdeu ${money(stake)}.`);
  }

  /** Retratos que o jogador pode escolher no Perfil (só aparência; não mudam regras). */
  const AVATARS = [
    { id: 'malandro', name: 'Malandro' }, { id: 'funkeira', name: 'Funkeira' }, { id: 'motoboy', name: 'Motoboy' },
    { id: 'sertanejo', name: 'Sertanejo' }, { id: 'gaucho', name: 'Gaúcho' }, { id: 'coroa', name: 'Coroa' },
    { id: 'skatista', name: 'Skatista' }, { id: 'capoeirista', name: 'Capoeirista' }, { id: 'golpista', name: 'Golpista' },
    { id: 'marombeiro', name: 'Marombeiro' }
  ];
  function doAvatar(s, id) {
    const pick = id === 'none' ? null : AVATARS.find(a => a.id === id);
    if (pick === undefined) return refuse('Retrato desconhecido.');
    if ((pick ? pick.id : null) === s.avatar) return refuse('Esse já é o seu retrato.');
    s.avatar = pick ? pick.id : null;
    return done(true, pick ? `Retrato trocado: ${pick.name}.` : 'Retrato da classe de volta.');
  }
  function pickCareer(s, id) {
    if (s.career) return refuse('A carreira já foi escolhida nesta temporada.');
    const c = CAREERS.find(x => x.id === id); if (!c) return refuse('Carreira desconhecida.');
    s.career = id; s.careerXP = 0;
    log(s, `Você escolheu a especialização ${c.name}.`);
    return done(true, `Carreira definida: ${c.name}.`);
  }
  function chooseGoal(s, id) {
    if (s.goal || s.day > 5 || !GOALS.some(g => g.id === id)) return refuse('A meta não pode mais ser escolhida.');
    s.goal = id; log(s, `Meta escolhida: ${GOALS.find(g => g.id === id).name}.`);
    return done(true, 'Meta da temporada definida.');
  }

  /* Notícias */
  const currentNews = s => s.newsPending ? NEWS.find(n => n.id === s.newsPending.id) : null;
  function newsChoiceCost(s, c) { return (c.cash || 0) + (c.cashPerMember ? c.cashPerMember * crewSize(s) : 0); }
  function newsChoiceBlocked(s, c) {
    if (s.jail > 0) return 'Você está detido.';
    if (s.cash < newsChoiceCost(s, c) || s.energy < (c.energy || 0)) return 'Recursos insuficientes.';
    if (c.notLastDay && s.day >= MAXDAY) return 'Não há próximo dia nesta temporada.';
    return '';
  }
  function newsChoice(s, id, index) {
    const n = NEWS.find(x => x.id === id), c = n && n.choices[index];
    if (!n || !c || !s.newsPending || s.newsPending.id !== id || s.newsPending.day !== s.day) return refuse('Notícia indisponível.');
    const block = newsChoiceBlocked(s, c); if (block) return refuse(block);
    const d = s.district, l = leader(s, d);
    s.cash -= newsChoiceCost(s, c); s.energy -= c.energy || 0; s.cash += c.money || 0;
    s.respect += c.respect || 0; addHeat(s, c.heat || 0);
    if (c.influence) addInf(s, d, c.influence * (s.career === 'articulador' ? 1.3 : 1) * eventMod(s, 'influenceMult'));
    if (c.rival) addPres(s, d, l.id, c.rival);
    if (c.relation) addRel(s, l.id, c.relation);
    if (c.tension) addTen(s, l.id, c.tension);
    if (c.nextBonus) s.nextBonus += c.nextBonus;
    if (c.tip) s.tip = c.tip;
    if (c.morale) addMorale(s, c.morale * (s.career === 'articulador' && c.energy ? 2 : 1));
    if (c.contract) s.contracts.push({ daily: c.contract.daily, days: c.contract.days });
    const fid = s.newsPending.faction;
    if (c.allyHelp) { const a = FACTIONS.find(f => s.factions[f.id].allied); if (a) { addRel(s, a.id, 12); const e = FACTION_ENEMY[a.id]; if (e) addTen(s, e, 10); } }
    if (c.allyRefuse) { const a = FACTIONS.find(f => s.factions[f.id].allied); if (a) { addRel(s, a.id, -20); if (s.factions[a.id].relation < 40) { s.factions[a.id].allied = false; log(s, `${faction(a.id).name} desfez a aliança: “quem não ajuda não é aliado”.`); } } }
    if (c.acceptOffer && fid) { const r = doPact(s, fid, true); if (!r.ok) { s.newsPending = null; return r; } }
    if (c.declineOffer && fid) addRel(s, fid, -5);
    addXP(s, 'articulador', 1);
    s.newsPending = null;
    log(s, `${n.name}: ${c.label}.`);
    return done(true, 'Decisão registrada.');
  }
  function skipNews(s) {
    if (!s.newsPending) return refuse('Não há notícia pendente.');
    const n = currentNews(s);
    if (n && n.offer && s.newsPending.faction) addRel(s, s.newsPending.faction, -3);
    s.newsPending = null;
    log(s, `${n ? n.name : 'Notícia'}: você preferiu não se envolver.`);
    return done(true, 'Notícia encerrada.');
  }

  /* ------------------------------------------------------------------ */
  /* 6. Virada do dia: economia, eventos e IA                            */
  /* ------------------------------------------------------------------ */
  function startEvent(s, id, districtId) {
    const def = EVENTS[id];
    let len = rand(def.dur[0], def.dur[1]);
    if (id === 'carnaval') len = cityIs(s, 'salvador') ? 5 : cityIs(s, 'rio') ? 4 : len;
    const e = { id, start: s.day, until: Math.min(MAXDAY, s.day + len - 1), district: districtId || def.district || (def.randomDistrict ? pick(DISTRICTS).id : null) };
    s.events.push(e);
    if (def.onStart) def.onStart(s, e);
    return e;
  }
  function tickEvents(s, lines) {
    s.events = s.events.filter(e => e.until >= s.day);
    for (const [id, def] of Object.entries(EVENTS)) if ((def.fixed === s.day || (def.fixedDays && def.fixedDays.includes(s.day))) && !s.events.some(e => e.id === id)) { const e = startEvent(s, id); lines.push(`Evento: ${eventTitle(e)}.`); }
    const randomActive = s.events.filter(e => !EVENTS[e.id].fixed && !EVENTS[e.id].fixedDays && e.id !== 'guerra');
    if (!randomActive.length) {
      const last = s.lastEvent;
      const opts = Object.entries(EVENTS).filter(([id, d]) => d.weight > 0 && id !== last && !(id === 'crise' && s.day > 25)).map(([id, d]) => ({ id, w: d.weight }));
      const e = startEvent(s, weighted(opts).id);
      s.lastEvent = e.id;
      if (e.id !== 'rotina') lines.push(`Evento: ${eventTitle(e)}.`);
    }
  }

  /** Um turno de IA para uma facção. Retorna texto explicando a decisão. */
  function factionTurn(s, f, ctx) {
    const fs = s.factions[f.id], P = f.persona;
    const truce = pactActive(s, f.id);
    // Traição: oportunistas rompem acordos quando você parece fraco.
    if ((truce || fs.allied) && P.opportunism >= .5) {
      const weak = (crewSize(s) < 3 ? 1 : 0) + (s.crewMorale < 35 ? 1 : 0) + (s.heat >= 70 ? 1 : 0) + (cityPower(s) < factionCityPower(s, f.id) / 2 ? 1 : 0);
      const pct = Math.round(P.opportunism * weak * 4);
      if (pct > 0 && roll(pct)) {
        const wasAlly = fs.allied;
        fs.allied = false; fs.truceUntil = 0; addRel(s, f.id, -30); addTen(s, f.id, 15);
        const best = DISTRICTS.slice().sort((a, b) => s.influence[b.id] - s.influence[a.id])[0];
        addInf(s, best.id, -8); addPres(s, best.id, f.id, 6);
        return `Traição! ${f.name} rompeu a ${wasAlly ? 'aliança' : 'trégua'} ao perceber sua fragilidade e avançou em ${best.name}.`;
      }
    }
    const hostile = !truce && !fs.allied && fs.relation <= -30 && fs.tension >= 35;
    const opts = [];
    opts.push({ id: 'expand', w: P.expand * (1 + (fs.power - 50) / 100) });
    opts.push({ id: 'consolidate', w: .3 + Math.max(0, 60 - fs.power) / 60 });
    if (hostile && !ctx.pressured) opts.push({ id: 'pressure', w: P.aggr * (fs.tension / 55) * (1 + fs.grudge / 5) });
    const enemy = FACTION_ENEMY[f.id];
    if (enemy) opts.push({ id: 'war', w: P.aggr * .3 });
    if (!truce && !fs.allied && fs.relation >= 30 && !ctx.offer && s.day < MAXDAY - 1) opts.push({ id: 'offer', w: P.diplo * .45 });
    const choice = weighted(opts).id;

    if (choice === 'expand') {
      const targets = DISTRICTS.filter(d => {
        if (truce && s.influence[d.id] >= 10) return false;
        if (fs.allied && controlled(s, d.id)) return false;
        return true;
      }).map(d => {
        const p = s.presence[d.id][f.id];
        let v = d.tribute / 100 * s.dstate[d.id].econ * (p > 0 ? 1.3 : .8);
        if (s.district !== d.id) v *= 1 + P.opportunism * .5; else v *= .7;
        if (controlled(s, d.id)) v *= .5 + P.aggr;
        if (f.districts.includes(d.id)) v *= 1.4;
        return { d, w: v * (0.8 + rng() * .4) };
      });
      if (!targets.length) return `${f.short} recuou por causa da trégua.`;
      const t = targets.sort((a, b) => b.w - a.w)[0].d;
      const before = leader(s, t.id).id;
      const gain = 2 + rand(0, 3) + Math.floor(fs.power / 40);
      addPres(s, t.id, f.id, gain);
      for (const o of FACTIONS) if (o.id !== f.id && !(o.id === enemy)) addPres(s, t.id, o.id, -1);
      if (enemy) addPres(s, t.id, enemy, -1);
      const after = leader(s, t.id).id;
      return `${f.short} ampliou presença em ${t.name} (+${gain})${s.district !== t.id && s.influence[t.id] > 0 ? ', aproveitando sua ausência' : ''}.${before !== after && after === f.id ? ` Agora lidera ${t.name}!` : ''}`;
    }
    if (choice === 'consolidate') {
      fs.power = clamp(fs.power + rand(2, 5), 10, 100); addTen(s, f.id, -3);
      return `${f.short} reorganizou suas fileiras (força ${fs.power}).`;
    }
    if (choice === 'pressure') {
      ctx.pressured = true; s.gangStats.retaliations++;
      if (hasPerk(s, 'articulador', 3) && roll(50)) return `${f.short} tentou retaliar, mas sua rede no bairro avisou a tempo.`;
      addTen(s, f.id, -8);
      if (P.pressure === 'extorsao') {
        const target = s.businesses.map(business).filter(b => s.presence[b.district][f.id] >= 10).sort((a, b) => b.net - a.net)[0];
        if (target) { s.extorted[target.id] = s.day; return `Retaliação de ${f.short}: cobrança sobre ${target.name}. A renda dele cai hoje.`; }
      }
      if (P.pressure === 'denuncia') {
        addHeat(s, 10); s.dstate[s.district].vigil = clamp(s.dstate[s.district].vigil + 10, 0, 100);
        return `Retaliação de ${f.short}: denúncia anônima. +10 de Procurado e +10 de polícia no bairro.`;
      }
      const best = DISTRICTS.filter(d => s.presence[d.id][f.id] > 0).sort((a, b) => s.influence[b.id] - s.influence[a.id])[0] || district(s);
      const removed = Math.min(rand(5, 9), s.influence[best.id]);
      addInf(s, best.id, -removed); addPres(s, best.id, f.id, 4); addHeat(s, 4);
      return `Retaliação de ${f.short}: -${removed} de influência sua em ${best.name}.`;
    }
    if (choice === 'war') {
      const field = DISTRICTS.filter(d => s.presence[d.id][enemy] >= 8 && s.presence[d.id][f.id] >= 5).sort((a, b) => s.presence[b.id][enemy] - s.presence[a.id][enemy])[0];
      if (!field) { fs.power = clamp(fs.power + 2, 10, 100); return `${f.short} se preparou contra ${faction(enemy).short}.`; }
      addPres(s, field.id, enemy, -rand(4, 8)); addPres(s, field.id, f.id, -rand(1, 4));
      s.factions[enemy].power = clamp(s.factions[enemy].power - 3, 10, 100);
      if (!s.events.some(e => e.id === 'guerra' && e.until >= s.day)) startEvent(s, 'guerra', field.id);
      return `${f.short} entrou em choque com ${faction(enemy).short} em ${field.name}: brecha para disputas por 2 dias.`;
    }
    if (choice === 'offer') {
      ctx.offer = f.id;
      return `${f.short} mandou um recado propondo acordo.`;
    }
    return '';
  }

  /** Virada do dia. No jogo local é o botão Dormir; com relógio (online), `clockDay` é o dia do
   *  calendário e a virada vem de tick(): energia, Procurado, vício e detenção correm pelo tempo real. */
  /* ------------------------------------------------------------------ */
  /* v1.5 — Relógio do modo online. O tempo é sempre recebido de fora     */
  /* (`now`, em ms): o motor não lê o relógio da máquina.                 */
  /* ------------------------------------------------------------------ */
  const CLOCK = { energyMs: 3 * 60000, lockMs: 2 * 3600000, homeMs: 3 * 3600000, vicioMs: 8 * 3600000, homesPerDay: 2, maxDays: 33 };
  const BR = 3 * 3600000; // Brasília = UTC−3, sem horário de verão
  const brIso = ms => new Date(ms - BR).toISOString();
  const dayKey = ms => brIso(ms).slice(0, 10), monthKey = ms => brIso(ms).slice(0, 7), calDay = ms => Number(brIso(ms).slice(8, 10));
  const nextMidnight = ms => (Math.floor((ms - BR) / 864e5) + 1) * 864e5 + BR;
  /** Liga o relógio: o dia do jogo passa a ser o dia do mês. */
  function startClock(s, now) {
    s.clock = { t: now, day: dayKey(now), month: monthKey(now), home: 0, e: 0, h: 0, v: 0, j: 0 };
    s.day = clamp(calDay(now), 1, MAXDAY);
    s.events = s.events.filter(e => e.until >= s.day); // o que era do dia 1 não vale no meio do mês
    if (s.newsPending && s.newsPending.day !== s.day) s.newsPending = null;
    return s;
  }
  /** O que corre pelo tempo real entre dois instantes do mesmo dia. */
  function flow(s, from, to, lines) {
    const c = s.clock, dt = to - from; if (dt <= 0) return;
    if (c.home && to >= c.home) { c.home = 0; s.energy = 100; s.today.doses = 0; s.today.dose = {}; s.today.chem = 0; lines.push('Você descansou em casa: energia cheia e o corpo zerado.'); }
    if (s.energy < 100) { c.e += dt; const n = Math.floor(c.e / CLOCK.energyMs); c.e -= n * CLOCK.energyMs; s.energy = clamp(s.energy + n, 0, 100); }
    if (s.energy >= 100) c.e = 0;
    const d = heatDecayPerDay(s);
    if (s.heat > 0 && d > 0) { c.h += dt; const step = 864e5 / d, n = Math.floor(c.h / step); c.h -= n * step; addHeat(s, -n); } else c.h = 0;
    if (s.vicio > 0) { c.v += dt; const n = Math.floor(c.v / CLOCK.vicioMs); c.v -= n * CLOCK.vicioMs; s.vicio = clamp(s.vicio - n, 0, 100); } else c.v = 0;
    if (s.jail > 0 || s.hospital > 0) {
      c.j += dt;
      while (c.j >= CLOCK.lockMs && (s.jail > 0 || s.hospital > 0)) {
        c.j -= CLOCK.lockMs;
        if (s.jail > 0) { s.jail--; if (!s.jail) lines.push('Você saiu da cadeia.'); }
        if (s.hospital > 0) { s.hospital--; s.health = clamp(s.health + 15, 0, 100); if (!s.hospital) lines.push('Alta do hospital.'); }
      }
    }
    if (!(s.jail > 0 || s.hospital > 0)) c.j = 0;
  }
  /** Avança o jogo até `now`. Devolve o estado (pode ser outro, se o mês virou), os avisos e, com
   *  `local: true` (previsão no aparelho), para antes da meia-noite e avisa que há virada pendente. */
  function tick(s, now, opts) {
    const lines = [], local = !!(opts && opts.local);
    if (!s.clock || !isNum(now) || !(now > s.clock.t)) return { state: s, lines, pending: false };
    applyCity(s.city);
    for (let guard = 0; guard < CLOCK.maxDays; guard++) {
      const mid = nextMidnight(s.clock.t);
      if (now < mid) break;
      if (local) { flow(s, s.clock.t, mid - 1, lines); s.clock.t = mid - 1; return { state: s, lines, pending: true }; }
      flow(s, s.clock.t, mid, lines); s.clock.t = mid;
      if (monthKey(mid) !== s.clock.month) {
        const r = closeSeason(s, true);
        lines.push(r.msg, `Pontuação do mês: ${r.record.score}. Começa uma temporada nova.`);
        s = startClock(r.state, mid);
      } else {
        const r = turnDay(s, clamp(calDay(mid), 1, MAXDAY));
        s.clock.day = dayKey(mid);
        lines.push(`Virou o dia ${s.day}.`, ...(r.lines || []));
      }
    }
    if (nextMidnight(s.clock.t) <= now) { // ausência longa demais: retoma de agora
      if (monthKey(now) !== s.clock.month) { const r = closeSeason(s, true); lines.push(r.msg); s = r.state; }
      startClock(s, now);
    }
    flow(s, s.clock.t, now, lines); s.clock.t = now;
    return { state: s, lines, pending: false };
  }
  /** Tempos que a interface mostra (ms a partir do último tick). */
  const clockInfo = s => s.clock ? {
    home: Math.max(0, s.clock.home - s.clock.t), nextEnergy: s.energy >= 100 ? 0 : CLOCK.energyMs - s.clock.e,
    lock: Math.max(0, Math.max(s.jail, s.hospital) * CLOCK.lockMs - s.clock.j), midnight: nextMidnight(s.clock.t) - s.clock.t, homesLeft: Math.max(0, CLOCK.homesPerDay - (s.today.home || 0))
  } : null;
  function doGoHome(s) {
    if (!s.clock) return refuse('No jogo local, use Dormir.');
    if (blocked(s)) return refuse(blocked(s));
    if ((s.today.home || 0) >= CLOCK.homesPerDay) return refuse(`Só dá para ir pra casa ${CLOCK.homesPerDay} vezes por dia.`);
    if (s.energy >= 100 && !s.today.doses) return refuse('Você está inteiro: não precisa ir pra casa agora.');
    s.clock.home = s.clock.t + CLOCK.homeMs; s.today.home = (s.today.home || 0) + 1; s.today.venue = null;
    log(s, 'Você foi pra casa: 3 horas de descanso.');
    return done(true, 'Você foi pra casa. Em 3 horas: energia cheia e o corpo zerado.');
  }
  function doLeaveHome(s) {
    if (!atHome(s)) return refuse('Você não está em casa.');
    s.clock.home = 0;
    log(s, 'Você saiu de casa antes da hora.');
    return done(true, 'Você saiu de casa antes da hora: sem o descanso completo.');
  }

  const heatDecayPerDay = s => 15 + eventMod(s, 'heatDecay') + (controlled(s, 'vila') ? 5 : 0) - controls(s).length * 2;
  function turnDay(s, clockDay) {
    const rt = clockDay !== undefined;
    if (s.clock && !rt) return refuse('O dia vira sozinho à meia-noite (horário de Brasília).');
    if (!rt && s.day >= MAXDAY) return refuse('Fim de temporada. Acesse Temporada para encerrar.');
    const lines = [];
    if (s.newsPending) { const n = currentNews(s); if (n && n.offer && s.newsPending.faction) addRel(s, s.newsPending.faction, -3); lines.push('Uma notícia passou sem resposta.'); }
    if (rt) s.day = clockDay; else s.day++;
    if (!rt) s.jail = Math.max(0, s.jail - 1);
    if (s.hospital > 0) { if (!rt) { s.hospital--; s.health = clamp(s.health + 15, 0, 100); lines.push(s.hospital ? 'Internado: mais 1 dia de recuperação.' : 'Alta do hospital.'); } }
    else if (s.health < 100) { const h = s.jail > 0 ? 6 : 10; s.health = clamp(s.health + h, 0, 100); }
    s.today = emptyToday();
    if (s.tip > 0) s.tip--;
    tickEvents(s, lines);

    // Energia e vigilância
    s.energy = clamp(s.energy + (rt ? 0 : 70 + eventMod(s, 'energy')) - s.ressaca, 0, 100);
    if (s.ressaca) lines.push(`Ressaca: -${s.ressaca} de energia ao acordar.`);
    if (!rt && s.vicio > 0) s.vicio = clamp(s.vicio - 3, 0, 100);
    s.ressaca = 0;
    const ctrl = controls(s);
    if (gearVal(s, 'heavy')) { addHeat(s, 3); lines.push('Arma pesada não passa despercebida: +3 de Procurado.'); }
    if (!rt) addHeat(s, -heatDecayPerDay(s));

    // Bairros: vigilância local e economia
    for (const d of DISTRICTS) {
      const ds = s.dstate[d.id];
      ds.vigil = clamp(ds.vigil - 10, 0, 100);
      const target = 1 + eventMod(s, 'econ', { district: d.id }) - ds.vigil * .002;
      ds.econ = clamp(Math.round((ds.econ + (target - ds.econ) * .25 + (rng() - .5) * .06) * 100) / 100, .6, 1.4);
    }

    // Receitas
    const biz = income(s);
    let trib = 0; for (const d of ctrl) trib += tribute(s, d.id);
    let contracts = 0;
    for (const c of s.contracts) { contracts += Math.round(c.daily * s.dstate.centro.econ); c.days--; }
    s.contracts = s.contracts.filter(c => c.days > 0);
    let interest = 0; if (hasPerk(s, 'empreendedor', 3)) interest = Math.min(120, Math.floor(s.bank * .004));
    const bonus = s.nextBonus; s.nextBonus = 0;
    s.cash += biz + trib + contracts + bonus; s.bank += interest;
    if (biz) lines.push(`Negócios: +${money(biz)}.`);
    if (trib) lines.push(`Tributo de ${ctrl.length} bairro(s) liderado(s): +${money(trib)}.`);
    if (contracts) lines.push(`Sociedades: +${money(contracts)}.`);
    if (bonus) lines.push(`Bônus do festival: +${money(bonus)}.`);
    if (interest) lines.push(`Rendimento bancário: +${money(interest)}.`);
    if (biz >= 150) addXP(s, 'empreendedor', 1);
    if (sum(s.businesses.map(business).filter(b => b.tags.includes('noite')).map(b => businessIncome(s, b))) >= 100) addXP(s, 'barao', 1);

    // Equipe
    if (s.gangName) {
      const cost = groupUpkeep(s);
      if (s.cash >= cost) { s.cash -= cost; addMorale(s, -2); if (cost) lines.push(`Manutenção da equipe: -${money(cost)}.`); }
      else { addMorale(s, -12); lines.push('Caixa insuficiente para pagar a equipe: -12 de ânimo.'); }
      addMorale(s, eventMod(s, 'morale') + (controlled(s, 'jardim') ? 2 : 0) + (cityIs(s, 'salvador') ? 1 : 0));
      if (s.crewMorale < 25 && crewSize(s) > 1 && roll(35)) {
        const m = s.crew.splice(rand(0, s.crew.length - 1), 1)[0];
        const to = FACTIONS.slice().sort((a, b) => s.factions[a.id].relation - s.factions[b.id].relation)[0];
        s.factions[to.id].power = clamp(s.factions[to.id].power + 3, 10, 100); addHeat(s, 5);
        lines.push(`${m.name} abandonou a equipe e foi para ${to.short}, levando informações (+5 de Procurado).`);
      }
      for (const f of FACTIONS) {
        const r = s.factions[f.id];
        if (!r.allied) continue;
        r.allyDays++;
        const fee = allianceFee(s);
        if (s.cash >= fee) { s.cash -= fee; lines.push(`Contribuição para ${f.short}: -${money(fee)}.`); }
        else { addRel(s, f.id, -15); lines.push(`Você não pagou a contribuição a ${f.short}: relação -15.`); if (r.relation < 40) { r.allied = false; lines.push(`${f.name} desfez a aliança.`); } }
      }
    }

    if (s.heist && s.day > Math.min(MAXDAY, s.heist.day + HEIST_WINDOW)) { lines.push(`O plano de ${heist(s.heist.id).name} esfriou: o prazo passou.`); s.heist = null; addMorale(s, -5); }
    if (s.career === 'empreendedor' && s.bank >= 10000) { const r = Math.min(3, Math.floor(s.bank / 10000)); s.respect += r; lines.push(`Dono da Área: +${r} de respeito pelo dinheiro no banco.`); }
    if (s.career === 'traficante') { const n = LABS.filter(l => s.labs[l.id] && !l.cash && !(s.labDown[l.id] >= s.day)).length; if (n) { addHeat(s, n); lines.push(`Polícia Federal de olho nos seus esquemas: +${n} de Procurado.`); } }
    // Galpão: preços oscilam, a produção rende e a polícia pode estourar um ponto.
    for (const d of DISTRICTS) for (const g of GOODS) { const m = s.market[d.id][g.id]; s.market[d.id][g.id] = clamp(Math.round(m + (100 - m) * .12 + rand(-14, 14)), 60, 150); }
    const labFee = labUpkeep(s);
    let labPaid = true;
    if (labFee) { if (s.cash >= labFee) { s.cash -= labFee; lines.push(`Custo da produção: -${money(labFee)}.`); } else { labPaid = false; lines.push('Sem caixa para manter a produção: nada foi produzido hoje.'); } }
    for (const l of LABS) {
      if (!s.labs[l.id]) continue;
      if (s.labDown[l.id] >= s.day) continue;
      if (roll(labRaid(s, l))) {
        const lost = [l.good, l.good2].filter(Boolean).map(id => { const q = s.goods[id]; s.goods[id] = 0; return q ? `${q} × ${good(id).name}` : ''; }).filter(Boolean);
        s.labDown[l.id] = s.day + 2; addHeat(s, 8);
        lines.push(`Batida policial: ${l.name} fechado por 2 dias${lost.length ? ` e ${lost.join(' e ')} apreendidos` : ''}.`);
        continue;
      }
      if (!labPaid) continue;
      if (l.cash) { const v = labCash(s, l); s.bank += v; lines.push(`${l.name}: +${money(v)} de mensalidades no banco.`); continue; }
      const made = [];
      for (const [gid, n] of [[l.good, l.out], [l.good2, l.out2]]) {
        if (!gid) continue;
        const q = Math.min(labOutput(s, l, n), Math.max(0, cargoCap(s) - cargoUsed(s)));
        if (q > 0) { s.goods[gid] += q; made.push(`+${q} × ${good(gid).name}`); }
      }
      lines.push(made.length ? `${l.name}: ${made.join(', ')}.` : `${l.name} parado: galpão cheio.`);
    }
    // Casa da noite abastecida com a própria produção: renda dobrada.
    for (const sp of SUPPLY) {
      const use = supplyPlan(s, sp); if (!use) continue;
      const b = business(sp.biz), v = Math.round(b.net * s.dstate[b.district].econ * SUPPLY_BONUS); // renda base, sem somar bônus de classe
      for (const g in use) s.goods[g] -= use[g];
      s.cash += v;
      lines.push(`${business(sp.biz).name} abastecido com a sua produção (${Object.entries(use).map(([g, q]) => `${q} × ${good(g).name}`).join(', ')}): +${money(v)}.`);
    }
    if (s.exportDeal.day < s.day) {
      const pool = GOODS.filter(g => g.unlock <= s.respect + 40);
      s.exportDeal = { day: Math.min(MAXDAY, (Math.floor((s.day - 1) / 5) + 1) * 5), good: pick(pool).id };
    }
    if (s.exportDeal.day === s.day) lines.push(`O comprador de fora chegou em ${district(s, 'cais').name}: paga ${money(exportPrice(good(s.exportDeal.good), s))} por ${good(s.exportDeal.good).name}.`);

    // Influência se dissipa onde você não está
    for (const d of DISTRICTS) if (d.id !== s.district) addInf(s, d.id, -1);

    // Facções: deriva natural + decisões
    const ctx = { pressured: false, offer: null };
    for (const f of FACTIONS) {
      const r = s.factions[f.id];
      addTen(s, f.id, r.grudge >= 3 ? -1 : -2);
      // Relações exigem manutenção: sem acordo, voltam aos poucos ao padrão do grupo.
      if (!agreement(s, f.id) && r.relation !== f.initialRelation) addRel(s, f.id, r.relation > f.initialRelation ? -(r.relation - f.initialRelation > 40 ? 2 : 1) : 1);
      const target = 30 + factionCityPower(s, f.id) / 4;
      r.power = clamp(Math.round(r.power + (target - r.power) * .1), 10, 100);
    }
    const order = FACTIONS.slice().sort(() => rng() - .5);
    for (const f of order) {
      const txt = factionTurn(s, f, ctx);
      s.factions[f.id].lastMove = txt;
      if (txt) lines.push(txt);
    }
    for (const d of DISTRICTS) {
      if (controlled(s, d.id)) { s.seasonStats.controlDays[d.id]++; unlock(s, 'dono'); }
    }
    if (controls(s).length >= 3) unlock(s, 'tres');

    // Notícias: ofertas de facções têm prioridade; senão a cada 3 dias.
    s.newsPending = null;
    if (ctx.offer) s.newsPending = { id: 'oferta', day: s.day, faction: ctx.offer };
    else if (s.day % 3 === 0) {
      const pool = NEWS.filter(n => !n.offer && (!n.when || n.when(s)));
      s.newsPending = { id: pick(pool).id, day: s.day, faction: null };
    }
    afterAction(s);
    log(s, `Dia ${s.day}. ` + (lines.length ? lines.join(' ') : 'Dia tranquilo.'));
    return done(true, `Dia ${s.day} iniciado.`, { lines });
  }

  /* ------------------------------------------------------------------ */
  /* 7. Metas, conquistas e temporada                                    */
  /* ------------------------------------------------------------------ */
  function unlock(s, id) { if (!s.achievements[id] && ACHIEVEMENTS.some(a => a.id === id)) { s.achievements[id] = s.season; log(s, `Conquista desbloqueada: ${ACHIEVEMENTS.find(a => a.id === id).name}.`); } }

  function goalProgress(s, id) {
    const goodRel = FACTIONS.filter(f => s.factions[f.id].relation >= 50).length;
    if (id === 'capital') { const v = patrimony(s); return { value: v, max: 10000, unit: 'money', complete: v >= 10000 }; }
    if (id === 'renome') return { value: Math.min(130, s.respect) / 130 * 50 + Math.min(25, s.successful) / 25 * 50, max: 100, unit: 'pct', complete: s.respect >= 130 && s.successful >= 25 };
    if (id === 'dominio') { const days = sum(Object.values(s.seasonStats.controlDays)); return { value: Math.min(100, days / 12 * 100), max: 100, unit: 'pct', complete: days >= 12 }; }
    if (id === 'diplomacia') return { value: Math.min(3, s.gangStats.pacts) / 3 * 50 + Math.min(2, goodRel) * 25, max: 100, unit: 'pct', complete: s.gangStats.pacts >= 3 && goodRel >= 2 };
    if (id === 'bonde') return { value: Math.min(5, crewSize(s)) * 10 + Math.min(8, s.gangStats.groupWins) / 8 * 50, max: 100, unit: 'pct', complete: crewSize(s) >= 5 && s.gangStats.groupWins >= 8 };
    return { value: 0, max: 100, unit: 'pct', complete: false };
  }
  /** Executado após cada ação: trava metas cumpridas e verifica conquistas. */
  function afterAction(s) {
    if (s.goal && !s.goalDone && goalProgress(s, s.goal).complete) { s.goalDone = true; log(s, `Meta da temporada cumprida: ${GOALS.find(g => g.id === s.goal).name}!`); }
    if (patrimony(s) >= 35000) unlock(s, 'cofrecheio');
    if (s.crew.some(m => m.level >= 5)) unlock(s, 'veterano');
    if (careerLevel(s) >= 3) unlock(s, 'mestre');
    s.seasonStats.bestCash = Math.max(s.seasonStats.bestCash, patrimony(s));
  }

  /** Avança os primeiros passos enquanto as condições estiverem cumpridas. Devolve linhas para o resumo. */
  function advanceTutorial(s) {
    const out = [], t = s.tutorial;
    while (!t.done && t.step < TUTORIAL.length && TUTORIAL[t.step].check(s)) {
      const st = TUTORIAL[t.step];
      s.cash += st.reward; t.step++;
      out.push(`Primeiros passos ${t.step}/${TUTORIAL.length}: ${st.title}${st.reward ? ` · +${money(st.reward)}` : ''}.`);
      if (t.step >= TUTORIAL.length) { t.done = true; out.push('Primeiros passos concluídos. Agora é com você: 30 dias e seis formas de vencer.'); log(s, 'Primeiros passos concluídos.'); }
    }
    return out;
  }
  function skipTutorial(s) {
    if (s.tutorial.done) return refuse('Os primeiros passos já terminaram.');
    s.tutorial.done = true;
    return done(true, 'Primeiros passos dispensados. O guia continua em “Como jogar”.');
  }
  const tutorialStep = s => s.tutorial.done ? null : TUTORIAL[s.tutorial.step] || null;

  const TITLES = [[0, 'Aprendiz da rua'], [110, 'Figura conhecida'], [200, 'Nome respeitado'], [300, 'Chefão da cidade'], [420, 'Lenda do Submundo']];
  function categoryValue(s, id) {
    if (id === 'fortuna') return patrimony(s);
    if (id === 'fama') return Math.max(0, s.respect - s.seasonStats.startRespect);
    if (id === 'territorio') return sum(Object.values(s.seasonStats.controlDays));
    if (id === 'diplomacia') return Math.min(5, s.gangStats.pacts) * 9 + s.gangStats.alliances * 20 + Math.min(20, sum(FACTIONS.map(f => s.factions[f.id].allyDays))) + FACTIONS.filter(f => s.factions[f.id].relation >= 50).length * 10 - s.gangStats.betrayals * 15;
    if (id === 'comercio') return Math.max(0, s.trade.sold - s.trade.spent);
    if (id === 'gangue') return s.gangStats.heists * 15 + s.gangStats.groupWins * 6 + s.gangStats.confrontWins * 10 + sum(s.crew.map(m => m.level)) * 3 + s.gangLevel * 4;
    return 0;
  }
  const medalFor = (c, v) => c.tiers.filter(t => v >= t).length;
  function seasonScore(s) {
    const cats = CATEGORIES.map(c => { const v = Math.max(0, Math.round(categoryValue(s, c.id))); return { id: c.id, name: c.name, value: v, medal: medalFor(c, v), pct: Math.min(100, Math.round(v / c.tiers[2] * 100)) }; });
    const score = sum(cats.map(c => Math.min(150, c.pct))) + sum(cats.map(c => c.medal * 15)) + (s.goalDone ? 40 : 0);
    const rs = Math.round(score), ti = TITLES.filter(t => rs >= t[0]).length - 1;
    return { cats, score: rs, title: TITLES[ti][1], next: TITLES[ti + 1] ? { title: TITLES[ti + 1][1], at: TITLES[ti + 1][0] } : null };
  }
  function seasonRanking(s) {
    const rows = [{ id: 'player', name: s.gangName || s.name, power: cityPower(s), player: true }]
      .concat(FACTIONS.map(f => ({ id: f.id, name: f.name, power: factionCityPower(s, f.id), player: false })));
    return rows.sort((a, b) => b.power - a.power);
  }

  function closeSeason(s, force) {
    if (s.clock && force !== true) return refuse('A temporada fecha sozinha no fim do mês.');
    if (force !== true && s.day !== MAXDAY) return refuse('A temporada termina no dia 30.');
    const sc = seasonScore(s);
    const medals = Object.fromEntries(sc.cats.map(c => [c.id, c.medal]));
    const medalCount = sc.cats.filter(c => c.medal > 0).length;
    if (sc.cats.some(c => c.medal === 3)) unlock(s, 'ouro');
    if (medalCount >= 3) unlock(s, 'versatil');
    if (s.seasonStats.arrests === 0) unlock(s, 'fichalimpa');
    const goalWins = s.goalWins + (s.goalDone ? 1 : 0);
    if (goalWins >= 3) unlock(s, 'determinado');
    const money_ = patrimony(s);
    const record = {
      season: s.season, respect: s.respect, money: money_, success: s.successful, failed: s.failed, goal: s.goal, goalComplete: s.goalDone,
      career: s.career, districts: controls(s).length, gangName: s.gangName, confrontWins: s.gangStats.confrontWins, pacts: s.gangStats.pacts,
      groupWins: s.gangStats.groupWins, score: sc.score, title: sc.title, medals
    };
    const records = { ...s.records };
    for (const c of sc.cats) records[c.id] = Math.max(records[c.id] || 0, c.value);
    // Rival histórico: a facção com mais rancor (≥3) começa a próxima temporada hostil.
    const nem = FACTIONS.slice().sort((a, b) => s.factions[b.id].grudge - s.factions[a.id].grudge)[0];
    const nemesis = s.factions[nem.id].grudge >= 3 ? nem.id : null;
    const medalBonus = Math.min(800, sum(sc.cats.map(c => [0, 30, 80, 200][c.medal])));
    const n = defaultState(s.name, s.city); n.avatar = s.avatar;
    n.season = s.season + 1;
    n.seasonHistory = [...s.seasonHistory, record].slice(-200);
    n.goalWins = goalWins;
    n.achievements = { ...s.achievements };
    n.prestige = s.prestige + sum(sc.cats.map(c => c.medal));
    n.records = records;
    n.nemesis = nemesis;
    n.tutorial = { ...s.tutorial, done: true };
    if (nemesis) { n.factions[nemesis].relation -= 25; n.factions[nemesis].tension += 15; n.factions[nemesis].grudge = 2; }
    n.cash = START_CASH + Math.min(1200, Math.floor(money_ * .05)) + (s.goalDone ? 600 : 0) + medalBonus;
    n.log = [{ day: 1, msg: `Temporada ${n.season} iniciada. Anterior: “${sc.title}” (${sc.score} pontos). Legado: ${money(n.cash - START_CASH)} para começar.${nemesis ? ` ${faction(nemesis).name} não esqueceu a rivalidade.` : ''}` }];
    return done(true, `Temporada ${s.season} encerrada: ${sc.title}.`, { state: n, record });
  }

  /* ------------------------------------------------------------------ */
  /* API pública                                                         */
  /* ------------------------------------------------------------------ */
  const act = {
    mission: doMission, train: doTrain, travel: doTravel, gig: doGig, layLow: doLayLow, bail: doBail,
    bank: doBank, buy: doBuy, sell: doSell, contact: doContact, dispute: doDispute,
    dialogue: doDialogue, pact: (s, f) => doPact(s, f, false), alliance: doAlliance, breakDeal: doBreak, clash: doClash,
    foundGang: doFoundGang, recruit: doRecruit, dismiss: doDismiss, rally: doRally, upgrade: doUpgrade, gangOp: doGangOp,
    duel: doDuel, clinic: doClinic, bribe: doBribe, detox: doDetox, cleanRecord: doCleanRecord, bet: doBet, heistPlan: doHeistPlan, heistScout: doHeistScout, heistRun: doHeistRun, heistCancel: doHeistCancel, buyItem: doBuyItem, buyGood: doBuyGood, sellGood: doSellGood, exportGoods: doExport, buildLab: doBuildLab, dose: doDose, night: doNight,
    avatar: doAvatar, career: pickCareer, goal: chooseGoal, news: newsChoice, skipNews, skipTutorial, nextDay: s => turnDay(s), endSeason: s => closeSeason(s), goHome: doGoHome, leaveHome: doLeaveHome // sem repassar argumentos do pedido
  };
  /** Executa uma ação e roda verificações pós-ação. */
  function perform(s, name, ...args) {
    const fn = act[name]; if (!fn) return refuse('Ação desconhecida.');
    applyCity(s.city);
    const r = fn(s, ...args);
    if (r.ok && name !== 'endSeason') {
      const tut = advanceTutorial(s);
      if (tut.length) r.lines = (r.lines || []).concat(tut);
      afterAction(s);
    }
    return r;
  }

  const SB = {
    VERSION, SCHEMA, MAXDAY, STORAGE_KEY, RESALE, CAREER_XP,
    STATS, MISSIONS, DISTRICTS, BUSINESSES, HEISTS, HEIST_MAX_HIRES, HEIST_WINDOW, HEIST_COOLDOWN, HEIST_CUT, RIVALS, DUEL_LIMIT, DUEL_ENERGY, ITEMS, SLOTS, GOODS, LABS, NIGHT, ITEM_RESALE, EXPORT_LIMIT, CITIES, TUTORIAL, TITLES, AVATARS, CAREERS, OLD_CAREERS, GOALS, ROLES, FACTIONS, FACTION_ENEMY, EVENTS, NEWS, CATEGORIES, MEDALS, ACHIEVEMENTS,
    setRandom, seeded, rand, clamp, money,
    defaultState, validate, structuralProblem, normalizeSave, parseSave, checksum, exportPayload,
    district, faction, business, mission, factionFor, careerLevel, hasPerk, pactActive, agreement, activeEvents, eventTitle, eventDesc, eventMod, cityOf, applyCity, travelCost, tutorialStep, item, good, gearVal, cargoUsed, cargoCap, goodPrice, goodSellPrice, exportPrice, exportOpen, labCost, labOutput, labUpkeep, raidChance, nightCost, nightSafe, nightEnergy, doseCost, doseVicio, doseOf, doseTolerance, chemLeft, TOLERANCE, CHEM_CAP, DOSES, DOSE_LIMIT, SUPPLY, supplyPlan, labCash, labYield, labRaid, ownTermas, overdoseChance, detoxCost, cleanCost, sinucaOdds, bichoPays, exportLimit, week, WEEKS, ANIMALS, BET_LIMIT, BET_MAX, NIGHT_LIMIT, PHASES, GATES, phase, phaseIndex, placeOpen, stockValue, assetValue, bribeCost, heist, heistHires, heistPlanCost, heistPower, heistOdds, heistLock, rival, healthPenalty, injured, combatRating, duelOdds, clinicCost, blocked, buyTotal, sellTotal, blitzChance,
    leader, controlled, controls, allyTurf, crewSize, groupUpkeep, memberUpkeep, recruitCost, roleLevels,
    missionScore, missionCost, missionChance, armPower, armDef, depositRate, missionRewardMult, missionLock, arrestChance, failLoss, respectGain,
    businessIncome, income, tribute, resaleValue, patrimony, depositFee, maxDeposit, buyCost, trainCost, bailCost, contactCost, allianceCost, allianceFee, upgradeCost, pactCost,
    gangOdds, clashOdds, disputeOdds, dialogueOdds, factionStatus, strength, cityPower, factionCityPower,
    currentNews, newsChoiceBlocked, newsChoiceCost, goalProgress, seasonScore, seasonRanking, categoryValue,
    chainLock, chainList, CHAIN_KINDS, CLOCK, startClock, tick, clockInfo, atHome, dayKey, monthKey, act, perform
  };
  applyCity(CITIES[0].name); // as tabelas sempre refletem uma cidade real
  root.SB = SB;
  if (typeof module !== 'undefined' && module.exports) module.exports = SB;
})(typeof window !== 'undefined' ? window : globalThis);
