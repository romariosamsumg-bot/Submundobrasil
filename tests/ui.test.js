/* Teste de interface com Playwright (Chromium) em 360×780.
 * Uso: node tests/ui.test.js  — gera capturas em tests/screens/ */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const FILE = 'file://' + path.join(__dirname, '..', 'Submundo-Brasil-v1.5.html');
const V04 = 'file://' + path.join(__dirname, '..', 'Submundo-Brasil-v0.4.html');
let failures = 0;
const check = (cond, msg) => { console.log((cond ? '  ok  ' : '  FALHA ') + msg); if (!cond) failures++; };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', d => d.accept());
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const st = () => page.evaluate(() => JSON.parse(localStorage.getItem('submundo_brasil_v01')));
  const go = v => page.evaluate(x => window.__SB_UI.go(x), v);

  console.log('1. Novo jogo e navegação (360×780)');
  await page.goto(FILE); await page.evaluate(() => localStorage.clear()); await page.reload();
  check(await page.isVisible('#welcome'), 'tela de boas-vindas aparece sem save');
  await page.screenshot({ path: path.join(__dirname, 'screens', 'v6-capa.png') });
  await page.click('#playOffline');
  check(await page.isVisible('#welcome') && !(await page.isVisible('#setup')), 'sem marcar 18+ o jogo não começa');
  await page.check('#ageOk'); await page.click('#playOffline');
  check(await page.isVisible('#setup') && await page.locator('[data-action=su-avatar]').count() === 10, 'tela 1 da ficha: 10 retratos, vulgo e cidade');
  await page.fill('#suName', 'Malandro'); await page.click('[data-action=su-next]');
  check(await page.isVisible('#suName'), 'sem retrato não avança');
  await page.click('[data-action=su-avatar][data-id=capoeirista]');
  await page.selectOption('#suCity', 'Salvador');
  check((await page.textContent('.cityTrait')).includes('Terra da festa'), 'vantagem da cidade aparece na ficha');
  check(await page.inputValue('#suName') === 'Malandro', 'trocar a cidade não apaga o vulgo');
  await page.screenshot({ path: path.join(__dirname, 'screens', 'v15-ficha-1.png'), fullPage: true });
  await page.click('[data-action=su-next]');
  check(await page.locator('[data-action=su-class]').count() === 4 && await page.locator('[data-action=su-save]').count() === 0, 'tela 2: 4 classes e o Salvar só aparece depois de escolher');
  await page.click('[data-action=su-class][data-id=operador]');
  check((await page.textContent('.suWarn')).includes('próxima temporada'), 'aviso: só muda na próxima temporada');
  await page.screenshot({ path: path.join(__dirname, 'screens', 'v15-ficha-2.png'), fullPage: true });
  await page.click('[data-action=su-save]');
  check(!(await page.isVisible('#welcome')) && !(await page.isVisible('#setup')), 'jogo iniciado');
  { const s0 = await st(); check(s0.name === 'Malandro' && s0.avatar === 'capoeirista' && s0.career === 'operador' && s0.city === 'Salvador' && s0.cash === 0, 'ficha salva: vulgo, retrato, classe e cidade'); }
  check((await page.textContent('.guide')).includes('2/9') && (await page.textContent('.guide')).toLowerCase().includes('roubo'), 'logo em seguida o guia começa, no primeiro roubo');
  await page.click('.guide [data-action=help]'); for (let i = 0; i < 3; i++) await page.click('[data-action=help-next]');
  check((await page.textContent('#helpBox')).includes('Largo das Ladeiras'), 'ajuda mostra os bairros da cidade escolhida');
  await page.click('#helpBox .btn.primary');
  check((await page.locator('.mobileNav button').allTextContents()).join('>') === 'Rua>Roubar>Noite>Feira>Cidade', 'abas na ordem do ciclo');
  check((await page.textContent('#hudSub')).includes('Pé de chinelo'), 'fase aparece na barra do personagem');
  check((await page.textContent('.plate')).includes('Largo das Ladeiras'), 'placa do bairro com nome de Salvador');
  check(await page.isVisible('.rumo'), 'cartão "Seu rumo" visível');
  await page.screenshot({ path: path.join(__dirname, 'screens', 'v6-inicio.png'), fullPage: true });
  for (const v of ['painel', 'acoes', 'hub', 'cidade', 'gestao', 'feira', 'galpao', 'noite', 'gangue', 'perfil', 'temporada']) {
    await go(v);
    check(await overflow() <= 0, `sem rolagem horizontal em "${v}"`);
    await page.screenshot({ path: path.join(__dirname, 'screens', `360-${v}.png`), fullPage: v === 'painel' || v === 'acoes' });
  }

  await go('hub');
  check(await page.locator('.place.locked').count() === 5, 'iniciante vê 5 lugares trancados com o respeito exigido');
  check((await page.textContent('.place.locked')).includes('respeito'), 'lugar trancado diz o que falta');
  await page.screenshot({ path: path.join(__dirname, 'screens', 'v12-cidade-iniciante.png'), fullPage: true });
  console.log('2. Ações e feedback');
  await go('painel');
  check((await st()).tutorial.step === 1, 'guia no passo 2 (a classe veio da ficha)');
  check(await page.isVisible('.mobileNav [data-view=acoes].hint'), 'aba do próximo passo fica destacada');
  await go('acoes');
  const before = await st();
  await page.click('[data-action=mission][data-id=correria]');
  const after = await st();
  check(after.energy === before.energy - 14, 'missão consome 14 de energia (Assaltante gasta 10% menos que 16)');
  check(after.tutorial.step === 2, 'primeiro serviço conclui o passo 2');
  await page.screenshot({ path: path.join(__dirname, 'screens', 'v6-servicos-guia.png') });
  check(await page.isVisible('.resultCard'), 'cartão de resultado exibido');
  await page.screenshot({ path: path.join(__dirname, 'screens', '360-resultado.png') });
  // a missão acima pode falhar e prender o personagem (sem confirmação nesse caso): normaliza antes de testar
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('submundo_brasil_v01')); s.jail = 0; s.energy = 80; localStorage.setItem('submundo_brasil_v01', JSON.stringify(s)); });
  await page.reload();
  await go('painel');
  await page.click('[data-action=next-day]');
  check((await st()).day === 1, 'primeiro toque em "Avançar dia" pede confirmação');
  check(await page.isVisible('.btn.armed'), 'botão armado visível');
  await page.click('[data-action=next-day]');
  check((await st()).day === 2, 'segundo toque avança o dia');
  check(await page.isVisible('.resultCard ul'), 'resumo do dia exibido');
  await page.screenshot({ path: path.join(__dirname, 'screens', '360-resumo-dia.png') });

  console.log('3. Banco com taxa');
  await page.evaluate(() => { const k = 'submundo_brasil_v01', s = JSON.parse(localStorage.getItem(k)); s.cash += 5000; localStorage.setItem(k, JSON.stringify(s)); }); await page.reload();
  await go('gestao');
  const c0 = (await st()).cash;
  await page.fill('#bankAmount', '1000'); await page.click('[data-action=bank][data-mode=deposit]');
  const s3 = await st();
  check(s3.bank === 1000 && s3.cash === c0 - 1030, 'depósito de R$ 1.000 cobra 3% (R$ 30)');
  await page.fill('#bankAmount', '-5'); await page.click('[data-action=bank][data-mode=deposit]');
  check((await st()).bank === 1000, 'valor negativo recusado');

  console.log('3b. Cidade, Feira do Rolo, Galpão, noite e Perfil (v0.7)');
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('submundo_brasil_v01')); s.cash = 6000; s.respect = 50; s.jail = 0; s.energy = 60; s.heat = 0; localStorage.setItem('submundo_brasil_v01', JSON.stringify(s)); });
  await page.reload(); await go('hub');
  check(await page.locator('.place').count() === 8, 'tela Cidade mostra 8 lugares');
  check(await page.locator('.place.locked').count() === 0, 'com 50 de respeito nada fica trancado');
  await page.click('.mobileNav [data-view=feira]');
  check(await page.isDisabled('[data-action=buy-item][data-id=cinquentinha]') && (await page.textContent('.shopRow:has([data-id=cinquentinha])')).includes('Primeiro compre: Bicicleta'), 'trilha: a Cinquentinha pede a bicicleta antes, com o motivo à vista');
  await page.click('[data-action=buy-item][data-id=bike]');
  await page.click('[data-action=buy-item][data-id=cinquentinha]');
  check((await st()).gear.veiculo === 'cinquentinha', 'veículo comprado na Feira do Rolo');
  check(await page.isVisible('[data-action=equip][data-id=bike]') && (await page.textContent('.shopRow:has([data-id=bike])')).includes('É seu'), 'a bicicleta continua sua, com o botão Usar');
  { const c0 = (await st()).cash; await page.click('[data-action=equip][data-id=bike]'); const s1 = await st(); check(s1.gear.veiculo === 'bike' && s1.cash === c0 && s1.owned.includes('cinquentinha'), 'Usar troca de graça e não perde o outro'); }
  await page.click('[data-action=equip][data-id=cinquentinha]');
  check(await page.isDisabled('[data-action=buy-item][data-id=fuzil]'), 'item acima do seu respeito fica bloqueado');
  await go('galpao');
  await page.click('[data-action=buy-good][data-id=cigarro][data-qty="5"]');
  let g7 = await st();
  check(g7.goods.cigarro === 5 && g7.energy === 57, 'compra de mercadoria: +5 unidades e -3 de energia');
  await page.click('[data-action=sell-good][data-id=cigarro][data-qty="5"]');
  check((await st()).goods.cigarro === 0, 'venda de mercadoria esvazia o estoque');
  check(await page.isDisabled('[data-action=build-lab][data-id=laboratorio]'), 'produção acima do seu respeito fica bloqueada');
  await go('noite');
  const e0 = (await st()).energy;
  await page.click('[data-action=night][data-id=boteco]');
  check((await st()).today.venue === 'boteco' && await page.isVisible('[data-action=dose][data-id=pinga]'), 'entrar no boteco abre o balcão com o cardápio');
  await page.click('[data-action=dose][data-id=pinga]');
  g7 = await st();
  check(g7.energy === e0 + 10 && g7.ressaca === 1 && g7.vicio === 2, 'pinga: +10 de energia, vício e ressaca registrados');
  await go('perfil');
  check((await page.textContent('.gearGrid')).includes('Cinquentinha'), 'Perfil mostra o equipamento');
  check(await page.isVisible('.mobileNav [data-view=hub].active') && await page.isVisible('.backLink'), 'Perfil fica dentro de Cidade');
  await go('painel'); await page.click('#hud .hudWho');
  check(await page.isVisible('.sheet'), 'tocar no retrato abre o Perfil');
  await go('temporada');
  check(await page.isVisible('.mobileNav [data-view=hub].active') && await page.isVisible('.backLink'), 'Temporada fica dentro de Perfil, com botão de voltar');
  await go('duelos');
  const d0 = await st();
await page.click('[data-action=duel][data-id=marrento]');
  const d1 = await st();
  check(d1.today.duels === 1 && d1.energy === d0.energy - 15, 'duelo: conta no limite diário e gasta 15 de energia');
  check(await page.isDisabled('[data-action=duel][data-id=rei]'), 'adversário acima do seu respeito fica bloqueado');
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('submundo_brasil_v01')); s.health = 40; s.energy = 60; localStorage.setItem('submundo_brasil_v01', JSON.stringify(s)); });
  await page.reload(); await go('hospital');
  check((await page.textContent('#hudHealthTxt')).includes('40'), 'barra de saúde no topo mostra 40');
  await page.click('[data-action=clinic][data-id=posto]');
  check((await st()).health === 65, 'posto de saúde: +25');
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('submundo_brasil_v01')); s.gangName = 'Bonde'; s.gangLevel = 1; s.crewMorale = 70; s.crew = [{ id: 1, name: 'Tatu', role: 'musculo', level: 1, xp: 0 }, { id: 2, name: 'Coruja', role: 'olheiro', level: 1, xp: 0 }]; s.respect = 50; s.cash = 9000; s.energy = 100; s.health = 100; s.gear.arma = 'vergalhao'; s.heist = null; s.heistReady = 0; localStorage.setItem('submundo_brasil_v01', JSON.stringify(s)); });
  await page.reload(); await go('gangue');
  await page.click('.place[data-view=assaltos]');
  await page.click('[data-action=heist-plan][data-id=arrastao]');
  let hs = await st();
  check(hs.heist && hs.heist.id === 'arrastao' && hs.heist.hires === 1, 'assalto planejado com 1 avulso');
  check(await page.isVisible('.heistPlan') && await page.isDisabled('[data-action=heist-run]'), 'plano visível; executar só a partir de amanhã');
  await page.click('[data-action=heist-scout]');
  check((await st()).heist.intel > 0, 'reconhecimento soma informação');
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('submundo_brasil_v01')); s.day += 1; s.energy = 100; localStorage.setItem('submundo_brasil_v01', JSON.stringify(s)); });
  await page.reload(); await go('assaltos');
  await page.click('[data-action=heist-run]');
  hs = await st();
  check(hs.heist === null && hs.heistReady === hs.day + 3 && await page.isVisible('.resultCard'), 'assalto executado: resultado e espera de 3 dias');
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('submundo_brasil_v01')); s.jail = 2; s.cash = 9000; localStorage.setItem('submundo_brasil_v01', JSON.stringify(s)); });
  await page.reload(); await go('painel');
  check(await page.isVisible('[data-action=bail]') && await page.isVisible('[data-action=bribe]'), 'na cadeia: advogado e carcereiro');
  await page.click('[data-action=bail]');
  check((await st()).jail === 0, 'advogado de porta de cadeia tira da cadeia');
  await page.evaluate(() => { localStorage.removeItem('submundo_brasil_18'); });
  await page.reload();
  check(await page.isVisible('#help') && (await page.textContent('#helpBox')).includes('18'), 'jogador antigo vê o aviso 18+ uma vez');
  await page.click('[data-action=age-ok]');
  await page.reload();
  check(!(await page.isVisible('#help')), 'aviso 18+ não volta depois de confirmado');
  await go('gestao');

  console.log('3d. Apostas, vício e despachante (v1.3)');
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('submundo_brasil_v01')); s.jail = 0; s.hospital = 0; s.cash = 5000; s.vicio = 40; s.heat = 50; s.energy = 60; s.today.bets = 0; s.today.detox = false; s.today.despachante = false; localStorage.setItem('submundo_brasil_v01', JSON.stringify(s)); });
  await page.reload(); await go('apostas');
  await page.fill('#betStake', '200'); await page.selectOption('#betAnimal', '6');
  await page.click('[data-action=bet][data-id=bicho]');
  let bs = await st();
  check(bs.today.bets === 1 && (bs.cash === 4800 || bs.cash === 5000 + 200 * 17), 'jogo do bicho: aposta de R$ 200 perdida ou paga 18×');
  await page.click('[data-action=bet-stake][data-id="50"]');
  check(await page.inputValue('#betStake') === '50', 'atalho de valor preenche a aposta');
  await go('hospital');
  await page.click('[data-action=detox][data-id=soro]');
  check((await st()).vicio === 20, 'soro na veia: -20 de vício');
  await go('acoes');
  await page.click('[data-action=clean-record]');
  check((await st()).heat === 16, 'despachante: -35 de vigilância (50 + 1 da aposta - 35)');
  await go('noite');
  check((await page.textContent('#content')).includes('Vício'), 'tela da Noite mostra o vício');
  await go('painel');
  check((await page.textContent('.dayBar')).includes('Semana'), 'Rua mostra a semana do mês');
  check(await page.evaluate(() => document.querySelector('#hudHeatTxt').textContent.startsWith('Procurado') && document.querySelector('#hudVicioTxt').textContent.startsWith('Vício')), 'topo mostra Procurado e Vício');
  await page.click('[data-action=locale-help]');
  check(await page.isVisible('.localeInfo') && (await page.textContent('.localeInfo')).includes('Procurado'), 'tocar na faixa da placa explica dono, grana e polícia');
  await page.click('.localeInfo [data-action=locale-help]');
  check(await page.locator('.localeInfo').count() === 0, 'a explicação fecha');
  check(await page.evaluate(() => { const keep = window.SB_ART; window.SB_ART = {}; window.__SB_UI.go('painel'); const drawn = !document.querySelector('.locale .paintedScene') && !!document.querySelector('.locale svg.scene'); window.SB_ART = keep; window.__SB_UI.go('painel'); return drawn && !!document.querySelector('.locale .paintedScene img'); }), 'imagem pintada do bairro substitui a cena desenhada (e sem ela volta o desenho)');
  check(await page.locator('.loop').count() === 0, 'Rua sem o bloco Seu ciclo (a barra de baixo já leva às telas)');
  check(await page.locator('.ficha .fichaRow').count() >= 2, 'ficha da temporada reúne patente, classe, meta e título');

  console.log('3c. Arte (v1.1)');
  await go('hub');
  check(await page.locator('.place .placeScene .art').count() === 8, 'os 8 lugares da Cidade têm cena ilustrada');
  check(await page.evaluate(() => { window.__ART = window.SB_ART; window.SB_ART = { 'place-galpao': 'data:image/png;base64,iVBORw0KGgo=' }; return window.SBArt.place('galpao').startsWith('<img') && window.SBArt.place('feira').startsWith('<svg'); }), 'imagem pintada substitui só a chave correspondente');
  await page.evaluate(() => { window.SB_ART = window.__ART; });
  check(await page.evaluate(() => window.SBArt.keys().length) === 24, '24 chaves de arte (10 lugares, 8 adversários, 6 assaltos)');

  await go('perfil');
  check(await page.locator('#content .avatarPick, #content [data-action=avatar]').count() === 0, 'Perfil não troca mais o retrato');
  check(await page.evaluate(() => !!document.querySelector('#hudAvatar img')), 'retrato da ficha aparece no topo');
  console.log('4. Save inválido e XSS');
  await page.evaluate(() => localStorage.setItem('submundo_brasil_v01', '{"schema":1,"name":"Quebrado"'));
  await page.reload();
  check(await page.isVisible('#welcome'), 'save corrompido leva à tela inicial');
  check(await page.isVisible('#welcomeNotice .notice'), 'aviso de save ilegível exibido');
  check(await page.evaluate(() => !!localStorage.getItem('submundo_brasil_corrupt_backup')), 'cópia do save ilegível preservada');
  const evil = JSON.parse(JSON.stringify(s3));
  evil.seasonHistory = [{ season: '<img src=x onerror="window.__xss=1">', respect: 1, money: 1, title: '<img src=x onerror="window.__xss=2">' }];
  evil.log = [{ day: '<img src=x onerror="window.__xss=3">', msg: '<img src=x onerror="window.__xss=4">' }];
  evil.gangName = '<img src=x onerror="window.__xss=5">';
  await page.evaluate(s => localStorage.setItem('submundo_brasil_v01', JSON.stringify(s)), evil);
  await page.reload();
  for (const v of ['painel', 'gangue', 'temporada']) await go(v);
  await page.waitForTimeout(200);
  check(!(await page.evaluate(() => window.__xss)), 'nenhum script injetado executou');

  console.log('5. Compatibilidade: save real da v0.4');
  const p4 = await ctx.newPage(); p4.on('dialog', d => d.accept());
  await p4.goto(V04); await p4.evaluate(() => localStorage.clear()); await p4.reload();
  await p4.fill('#playerName', 'Veterano'); await p4.click('#newGameForm button');
  await p4.click('[data-action=career][data-id=empreendedor]');
  for (let d = 0; d < 6; d++) { for (let i = 0; i < 4; i++) { const b = await p4.$('[data-action=mission][data-id=correria]:not([disabled])'); if (b) await b.click(); } const nd = await p4.$('[data-action=next-day]'); if (nd) await nd.click(); }
  // força um save "avançado" da 0.4 com gangue e trégua
  const s04 = await p4.evaluate(() => { const s = JSON.parse(localStorage.getItem('submundo_brasil_v01')); s.respect = 60; s.cash = 6000; s.gangName = 'Velha Guarda'; s.gangLevel = 2; s.crewSize = 4; s.crewMorale = 55; s.businesses = ['bar']; s.factions.esquina.truceUntil = s.day + 2; s.factions.esquina.relation = 40; s.rivals.cais = 47; localStorage.setItem('submundo_brasil_v01', JSON.stringify(s)); return s; });
  await p4.close();
  await page.reload();
  check(!(await page.isVisible('#welcome')), 'save da 0.4 abre direto na versão atual');
  check(await page.isVisible('[data-action=age-ok]'), 'quem vem da 0.4 confirma o aviso 18+');
  await page.click('[data-action=age-ok]');
  const m = await st();
  check(m.schema === 2 && m.name === 'Veterano' && m.day === s04.day && m.cash === 6000, 'nome, dia e dinheiro preservados');
  check(m.crew.length === 4 && m.gangName === 'Velha Guarda', '4 integrantes gerados a partir do crewSize');
  check(m.presence.cais.docas === 47, 'rival do Cais (47) virou presença dos Armazéns');
  check(m.factions.esquina.truceUntil === s04.day + 2, 'trégua ativa preservada');
  check(m.businesses.join() === 'bar' && m.career === 'empreendedor', 'negócios e carreira preservados');
  check(await page.evaluate(() => !!localStorage.getItem('submundo_brasil_v04_backup')), 'cópia original da 0.4 guardada');
  check(await page.isVisible('.resultCard'), 'aviso de conversão exibido');
  await page.screenshot({ path: path.join(__dirname, 'screens', '360-migracao.png') });
  for (const v of ['acoes', 'cidade', 'gestao', 'gangue', 'temporada']) { await go(v); check(await overflow() <= 0, `migrado: sem rolagem horizontal em "${v}"`); }
  await page.screenshot({ path: path.join(__dirname, 'screens', '360-gangue-migrada.png'), fullPage: true });

  console.log('6. Temporada completa pela interface');
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('submundo_brasil_v01')); s.day = 29; localStorage.setItem('submundo_brasil_v01', JSON.stringify(s)); });
  await page.reload(); await go('temporada');
  await page.click('[data-action=next-day]'); await page.click('[data-action=next-day]').catch(() => {});
  let sv = await st(); if (sv.day === 29) { await page.click('[data-action=next-day]'); sv = await st(); }
  check(sv.day === 30, 'chegou ao dia 30');
  await page.click('[data-action=end-season]');
  sv = await st();
  check(sv.season === 2 && sv.day === 1 && sv.seasonHistory.length >= 1, 'temporada encerrada e histórico registrado');
  check(typeof sv.seasonHistory.at(-1).score === 'number', 'pontuação registrada no histórico');
  await page.screenshot({ path: path.join(__dirname, 'screens', '360-nova-temporada.png'), fullPage: true });
  check(await page.isVisible('#setup') && (await page.inputValue('#suName')).length >= 2 && await page.locator('#suCity').count() === 0, 'temporada nova: a ficha reabre com o vulgo preenchido, sem trocar a cidade');
  await page.click('[data-action=su-avatar][data-id=coroa]'); await page.click('[data-action=su-next]'); await page.click('[data-action=su-class][data-id=empreendedor]'); await page.click('[data-action=su-save]');
  sv = await st();
  check(!(await page.isVisible('#setup')) && sv.avatar === 'coroa' && sv.career === 'empreendedor', 'ficha da temporada nova salva');

  console.log('7. Exportação e importação');
  await go('temporada');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-action=export]')]);
  const fpath = await dl.path();
  const payload = JSON.parse(require('fs').readFileSync(fpath, 'utf8'));
  check(payload.game === 'Submundo Brasil' && payload.version === '1.5' && payload.checksum, 'arquivo exportado com versão e checksum');
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.setInputFiles('#welcomeImportFile', fpath);
  await page.waitForTimeout(300);
  check((await st())?.season === 2, 'importação pela tela inicial restaura a carreira');

  console.log('7b. Nenhum texto cortado no celular (360 px)');
  {
    const cutViews = ['painel', 'acoes', 'noite', 'feira', 'hub', 'cidade', 'gestao', 'galpao', 'duelos', 'apostas', 'hospital', 'gangue', 'assaltos', 'perfil', 'temporada'];
    const cutStates = await page.evaluate(() => { const out = []; for (const c of SB.CITIES) { const s = SB.defaultState('Wellington Aparecido S', c.name); s.tutorial.done = true; Object.assign(s, { respect: 180, cash: 123456, bank: 987654, day: 18, heat: 72, vicio: 48, career: 'barao', gangName: 'Bonde do Morro Alto', gangLevel: 3, crewMorale: 66, avatar: 'golpista' }); s.businesses = ['pensao', 'bar', 'inferninho']; s.labs.gelo = 1; s.labs.laboratorio = 2; out.push(JSON.stringify(s)); } out.push(JSON.stringify(SB.defaultState('Zé', SB.CITIES[0].name))); return out; });
    const cuts = new Set();
    const scan = () => page.evaluate(() => { const bad = []; for (const el of document.querySelectorAll('#hud *, #content *, #helpBox *, #setupBox *')) { if (!el.getClientRects().length) continue; const cs = getComputedStyle(el); if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue; const hid = cs.overflowX !== 'visible' || cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none'; if (hid && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 2)) bad.push(el.textContent.trim().slice(0, 50)); if (el.getBoundingClientRect().right > innerWidth + 1) bad.push('fora da tela: ' + el.textContent.trim().slice(0, 40)); } return bad; });
    for (const st of cutStates) {
      await page.evaluate(x => { localStorage.setItem('submundo_brasil_v01', x); localStorage.setItem('submundo_brasil_18', '1'); }, st); await page.reload();
      if (await page.isVisible('#setup')) { for (const x of await scan()) cuts.add('ficha 1: ' + x); await page.click('[data-action=su-avatar][data-id=golpista]'); await page.fill('#suName', 'Wellington Aparecido S'); await page.click('[data-action=su-next]'); await page.click('[data-action=su-class][data-id=traficante]'); for (const x of await scan()) cuts.add('ficha 2: ' + x); await page.click('[data-action=su-save]'); }
      if (!await page.isVisible('#hud .hudWho')) { cuts.add('save não carregou'); continue; }
      for (const v of cutViews) { await go(v); for (const x of await scan()) cuts.add(v + ': ' + x); }
    }
    await page.click('#hud .hudWho'); await page.click('[data-action=help]').catch(() => {});
    for (let i = 0; i < 8 && await page.isVisible('#help'); i++) { for (const x of await scan()) cuts.add('ajuda: ' + x); const nx = page.locator('#helpBox .btn.primary'); if (await nx.count()) await nx.first().click(); else break; }
    check(cuts.size === 0, 'nenhum texto cortado em 15 telas, 6 cidades, nome longo e valores altos' + (cuts.size ? ': ' + [...cuts].slice(0, 5).join(' | ') : ''));
  }
  console.log('7c. Online com servidor simulado (mesma lógica do servidor, sem rede)');
  {
    const SBn = require('./load-engine.js')();
    const { aplicar } = await import(path.join(__dirname, '..', 'supabase', 'functions', 'jogar', 'logica.js'));
    let saved = null, calls = 0, codinome = null, fakeLater = 0;
    const octx = await browser.newContext({ viewport: { width: 360, height: 780 } });
    const op = await octx.newPage();
    op.on('pageerror', e => errors.push('online: ' + e.message)); op.on('dialog', d => d.accept());
    const reply = (route, status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
    await op.route('**/auth/v1/**', route => reply(route, 200, { access_token: 'tk', refresh_token: 'rf', expires_in: 3600, user: { email: 'teste@exemplo.com' } }));
    await op.route('**/functions/v1/jogar', route => { calls++; const out = aplicar(SBn, saved, JSON.parse(route.request().postData() || 'null'), Date.now() + fakeLater); if (out.salvar) saved = JSON.parse(JSON.stringify(out.salvar)); if (out.novo) codinome = out.novo.codinome; return reply(route, out.status, out.corpo); });
    await op.route('**/rest/v1/rpc/ranking', route => reply(route, 200, saved ? [{ posicao: 1, codinome, cidade: saved.city, respeito: saved.respect, dia: saved.day }] : []));
    await op.goto(FILE);
    check(await op.isVisible('#onlineBox'), 'tela inicial oferece jogar online');
    await op.fill('#onEmail', 'teste@exemplo.com'); await op.fill('#onPass', 'segredo1'); await op.check('#ageOk');
    await op.click('[data-action=on-signup]');
    await op.waitForSelector('#setup:not(.hidden) [data-action=su-avatar]');
    check(true, 'conta criada: abre a ficha (retrato, vulgo e cidade)');
    await op.click('[data-action=su-avatar][data-id=gaucho]'); await op.fill('#suName', 'Zé Online'); await op.selectOption('#suCity', 'Recife');
    await op.click('[data-action=su-next]'); await op.click('[data-action=su-class][data-id=traficante]'); await op.click('[data-action=su-save]');
    await op.waitForFunction(() => window.__SB_UI.state && window.__SB_UI.state.name === 'Zé Online');
    check(saved && saved.name === 'Zé Online' && saved.cash === 0 && saved.avatar === 'gaucho' && saved.career === 'traficante', 'personagem criado no servidor com a ficha completa, começando com R$ 0');
    await op.evaluate(() => { const h = document.querySelector('#help'); if (h) h.classList.add('hidden'); });
    const before = calls;
    await op.evaluate(() => window.__SB_UI.go('acoes'));
    await op.click('[data-action=mission][data-id=correria]');
    await op.waitForFunction(() => window.__SB_UI.state.energy < 100);
    check(calls === before + 1 && saved.energy === (await op.evaluate(() => window.__SB_UI.state.energy)), 'roubo calculado pelo servidor e mostrado no jogo');
    check(await op.evaluate(() => localStorage.getItem('submundo_brasil_v01') === null), 'no online o save não fica no aparelho');
    await op.evaluate(() => window.__SB_UI.go('perfil'));
    await op.click('[data-action=on-ranking]');
    await op.waitForSelector('.rankList li');
    check((await op.textContent('.rankList')).includes('Zé Online'), 'ranking de respeito aparece no Perfil');
    await op.evaluate(() => window.__SB_UI.go('painel'));
    check(await op.locator('[data-action=next-day]').count() === 0 && (await op.textContent('.dayStrip')).includes('O dia vira em'), 'online: sem Dormir; a faixa do dia mostra quando o dia vira');
    await op.click('[data-action=go-home]');
    await op.waitForSelector('.homeNote');
    check((await op.textContent('.homeNote')).includes('volta em 3 h') && saved.clock.home > 0, 'Ir pra casa: aviso com o tempo de volta');
    fakeLater = 3 * 3600000 + 1000;
    await op.click('[data-action=leave-home]').catch(() => {});
    await op.waitForFunction(() => window.__SB_UI.state.energy === 100);
    check(await op.locator('.homeNote').count() === 0 && saved.energy === 100, 'três horas depois: fora de casa com a energia cheia');
    fakeLater = 30 * 3600000; // mais de um dia depois: a ação recusada ainda traz o estado do servidor
    await op.evaluate(() => window.__SB_UI.go('painel'));
    const dayBefore = await op.evaluate(() => window.__SB_UI.state.day);
    await op.evaluate(() => { const b = document.querySelector('[data-action=go-home]'); if (b) { b.disabled = false; b.click(); } });
    await op.waitForFunction(d => window.__SB_UI.state.day !== d, dayBefore);
    check(true, 'ação recusada no online também atualiza o dia e a energia vindos do servidor');
    await op.evaluate(() => window.__SB_UI.go('perfil'));
    await op.click('[data-action=on-logout]');
    check(await op.isVisible('#welcome') && await op.evaluate(() => localStorage.getItem('submundo_brasil_sessao') === null), 'sair da conta volta para a tela inicial e apaga a sessão');
    await op.reload(); await op.waitForTimeout(300);
    await op.fill('#onEmail', 'teste@exemplo.com'); await op.fill('#onPass', 'segredo1'); await op.check('#ageOk');
    await op.click('[data-action=on-login]');
    await op.waitForFunction(() => window.__SB_UI.state && window.__SB_UI.state.name === 'Zé Online');
    check(true, 'entrar de novo continua do mesmo ponto');
    await octx.close();
  }
  console.log('8. Tela larga (1280×900)');
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const v of ['painel', 'gangue']) { await go(v); check(await overflow() <= 0, `desktop sem rolagem horizontal em "${v}"`); }
  await page.screenshot({ path: path.join(__dirname, 'screens', '1280-painel.png') });

  check(errors.length === 0, 'nenhum erro de console/página' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(failures ? `\n${failures} falha(s).` : '\nTodos os testes de interface passaram.');
  process.exit(failures ? 1 : 0);
})();
