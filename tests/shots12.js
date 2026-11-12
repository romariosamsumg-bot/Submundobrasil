/* Capturas do fluxo v1.2: iniciante e meio de jogo. Uso: node tests/shots12.js */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const SB = require('./load-engine.js')();
(async () => {
  SB.setRandom(SB.seeded(7));
  const novo = SB.defaultState('Malandro', 'Rio de Janeiro'); novo.career = 'operador'; novo.tutorial.step = 1;
  const semEnergia = JSON.parse(JSON.stringify(novo)); Object.assign(semEnergia, { energy: 6, cash: 2600, respect: 14, successful: 6 }); semEnergia.tutorial.done = true; semEnergia.gear.arma = 'soco';
  const meio = JSON.parse(JSON.stringify(novo)); Object.assign(meio, { energy: 74, cash: 7200, respect: 62, day: 11, heat: 18 }); meio.tutorial.done = true; meio.gear = { arma: 'peixeira', protecao: 'jaqueta', veiculo: 'cinquentinha' };
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, '..', 'Submundo-Brasil-v1.2.html'));
  const load = async s => { await p.evaluate(x => { localStorage.setItem('submundo_brasil_v01', x); localStorage.setItem('submundo_brasil_18', '1'); }, JSON.stringify(s)); await p.reload(); };
  const shot = async (name, view, full) => { await p.evaluate(x => window.__SB_UI.go(x), view); await p.screenshot({ path: path.join(__dirname, 'screens', `v12-${name}.png`), fullPage: !!full }); console.log(name, 'rolagem:', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)); };
  await load(novo); await shot('rua-iniciante', 'painel', true); await shot('roubar-iniciante', 'acoes');
  await load(semEnergia); await shot('rua-sem-energia', 'painel'); await shot('noite', 'noite', true);
  await load(meio); await shot('rua-meio', 'painel', true); await shot('cidade-meio', 'hub', true); await shot('feira', 'feira');
  console.log('erros:', errs.length ? errs : 'nenhum'); await b.close();
})();
