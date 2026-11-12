/* Capturas das telas da v0.7 com um save adiantado. Uso: node tests/shots.js */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const SB = require('./load-engine.js')();
(async () => {
  SB.setRandom(SB.seeded(21));
  const s = SB.defaultState('Malandro', 'Salvador');
  Object.assign(s, { cash: 9400, respect: 96, career: 'operador', day: 9, energy: 70, heat: 22 });
  s.tutorial.done = true; s.gear = { arma: 'trezoitao', protecao: 'colete', veiculo: 'moto' };
  s.goods.erva = 12; s.health = 42; s.duelStats.wins = 3; s.beaten.marrento = 2; s.goods.cigarro = 20; s.labs.plantacao = 1; s.exportDeal = { day: 10, good: 'erva' };
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, '..', 'Submundo-Brasil-v0.9.html'));
  await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.selectOption('#homeCity', 'Rio de Janeiro');
  await p.screenshot({ path: path.join(__dirname, 'screens', 'v9-capa.png') });
  await p.evaluate(x => { localStorage.setItem('submundo_brasil_v01', x); localStorage.setItem('submundo_brasil_18', '1'); }, JSON.stringify(s)); await p.reload();
  for (const v of ['hub', 'duelos', 'hospital', 'feira', 'galpao', 'noite', 'perfil', 'acoes']) {
    await p.evaluate(x => window.__SB_UI.go(x), v);
    const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    await p.screenshot({ path: path.join(__dirname, 'screens', `v9-${v}.png`), fullPage: ['galpao', 'duelos', 'feira', 'noite', 'acoes'].includes(v) });
    console.log(v, 'rolagem horizontal:', over);
  }
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('submundo_brasil_v01')); s.jail = 2; localStorage.setItem('submundo_brasil_v01', JSON.stringify(s)); });
  await p.reload(); await p.screenshot({ path: path.join(__dirname, 'screens', 'v9-cadeia.png') });
  console.log('erros:', errs.length ? errs : 'nenhum'); await b.close();
})();
