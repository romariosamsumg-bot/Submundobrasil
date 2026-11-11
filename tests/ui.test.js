/* Teste de interface com Playwright (Chromium) em 360×780.
 * Uso: node tests/ui.test.js  — gera capturas em tests/screens/ */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const FILE = 'file://' + path.join(__dirname, '..', 'Submundo-Brasil-v0.5.html');
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

  console.log('1. Novo jogo e navegação (360×780)');
  await page.goto(FILE); await page.evaluate(() => localStorage.clear()); await page.reload();
  check(await page.isVisible('#welcome'), 'tela de boas-vindas aparece sem save');
  await page.fill('#playerName', 'Malandro'); await page.click('#newGameForm button[type=submit]');
  check(!(await page.isVisible('#welcome')), 'jogo iniciado');
  for (const v of ['painel', 'acoes', 'cidade', 'gestao', 'gangue', 'temporada']) {
    await page.click(`.mobileNav [data-view=${v}]`);
    check(await overflow() <= 0, `sem rolagem horizontal em "${v}"`);
    await page.screenshot({ path: path.join(__dirname, 'screens', `360-${v}.png`), fullPage: v === 'painel' || v === 'acoes' });
  }

  console.log('2. Ações e feedback');
  await page.click('.mobileNav [data-view=painel]');
  await page.click('[data-action=career][data-id=operador]');
  check((await st()).career === 'operador', 'carreira escolhida (com confirmação)');
  await page.click('.mobileNav [data-view=acoes]');
  const before = await st();
  await page.click('[data-action=mission][data-id=correria]');
  const after = await st();
  check(after.energy === before.energy - 16, 'missão consome 16 de energia');
  check(await page.isVisible('.resultCard'), 'cartão de resultado exibido');
  await page.screenshot({ path: path.join(__dirname, 'screens', '360-resultado.png') });
  await page.click('.mobileNav [data-view=painel]');
  await page.click('[data-action=next-day]');
  check((await st()).day === 1, 'primeiro toque em "Avançar dia" pede confirmação');
  check(await page.isVisible('.btn.armed'), 'botão armado visível');
  await page.click('[data-action=next-day]');
  check((await st()).day === 2, 'segundo toque avança o dia');
  check(await page.isVisible('.resultCard ul'), 'resumo do dia exibido');
  await page.screenshot({ path: path.join(__dirname, 'screens', '360-resumo-dia.png') });

  console.log('3. Banco com taxa');
  await page.click('.mobileNav [data-view=gestao]');
  const c0 = (await st()).cash;
  await page.fill('#bankAmount', '1000'); await page.click('[data-action=bank][data-mode=deposit]');
  const s3 = await st();
  check(s3.bank === 1000 && s3.cash === c0 - 1030, 'depósito de R$ 1.000 cobra 3% (R$ 30)');
  await page.fill('#bankAmount', '-5'); await page.click('[data-action=bank][data-mode=deposit]');
  check((await st()).bank === 1000, 'valor negativo recusado');

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
  for (const v of ['painel', 'gangue', 'temporada']) await page.click(`.mobileNav [data-view=${v}]`);
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
  check(!(await page.isVisible('#welcome')), 'save da 0.4 abre direto na 0.5');
  const m = await st();
  check(m.schema === 2 && m.name === 'Veterano' && m.day === s04.day && m.cash === 6000, 'nome, dia e dinheiro preservados');
  check(m.crew.length === 4 && m.gangName === 'Velha Guarda', '4 integrantes gerados a partir do crewSize');
  check(m.presence.cais.docas === 47, 'rival do Cais (47) virou presença dos Armazéns');
  check(m.factions.esquina.truceUntil === s04.day + 2, 'trégua ativa preservada');
  check(m.businesses.join() === 'bar' && m.career === 'empreendedor', 'negócios e carreira preservados');
  check(await page.evaluate(() => !!localStorage.getItem('submundo_brasil_v04_backup')), 'cópia original da 0.4 guardada');
  check(await page.isVisible('.resultCard'), 'aviso de conversão exibido');
  await page.screenshot({ path: path.join(__dirname, 'screens', '360-migracao.png') });
  for (const v of ['acoes', 'cidade', 'gestao', 'gangue', 'temporada']) { await page.click(`.mobileNav [data-view=${v}]`); check(await overflow() <= 0, `migrado: sem rolagem horizontal em "${v}"`); }
  await page.screenshot({ path: path.join(__dirname, 'screens', '360-gangue-migrada.png'), fullPage: true });

  console.log('6. Temporada completa pela interface');
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('submundo_brasil_v01')); s.day = 29; localStorage.setItem('submundo_brasil_v01', JSON.stringify(s)); });
  await page.reload(); await page.click('.mobileNav [data-view=temporada]');
  await page.click('[data-action=next-day]'); await page.click('[data-action=next-day]').catch(() => {});
  let sv = await st(); if (sv.day === 29) { await page.click('[data-action=next-day]'); sv = await st(); }
  check(sv.day === 30, 'chegou ao dia 30');
  await page.click('[data-action=end-season]');
  sv = await st();
  check(sv.season === 2 && sv.day === 1 && sv.seasonHistory.length >= 1, 'temporada encerrada e histórico registrado');
  check(typeof sv.seasonHistory.at(-1).score === 'number', 'pontuação registrada no histórico');
  await page.screenshot({ path: path.join(__dirname, 'screens', '360-nova-temporada.png'), fullPage: true });

  console.log('7. Exportação e importação');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-action=export]')]);
  const fpath = await dl.path();
  const payload = JSON.parse(require('fs').readFileSync(fpath, 'utf8'));
  check(payload.game === 'Submundo Brasil' && payload.version === '0.5' && payload.checksum, 'arquivo exportado com versão e checksum');
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.setInputFiles('#welcomeImportFile', fpath);
  await page.waitForTimeout(300);
  check((await st())?.season === 2, 'importação pela tela inicial restaura a carreira');

  console.log('8. Tela larga (1280×900)');
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const v of ['painel', 'gangue']) { await page.click(`.nav [data-view=${v}]`); check(await overflow() <= 0, `desktop sem rolagem horizontal em "${v}"`); }
  await page.screenshot({ path: path.join(__dirname, 'screens', '1280-painel.png') });

  check(errors.length === 0, 'nenhum erro de console/página' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(failures ? `\n${failures} falha(s).` : '\nTodos os testes de interface passaram.');
  process.exit(failures ? 1 : 0);
})();
