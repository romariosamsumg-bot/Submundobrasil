/* Compara especializações: cada estratégia é jogada com as 3 carreiras. */
'use strict';
const sim = require('./simulate.js');
const SB = require('./load-engine.js')();
const RUNS = Number(process.argv[2] || 150);
SB.setRandom(SB.seeded(7));
const rows = [];
for (const strat of ['operador_grind', 'empreendedor_negocios', 'articulador_territorio', 'articulador_diplomata', 'gangue_bonde']) {
  const line = [strat.padEnd(24)];
  for (const c of SB.CAREERS) {
    const orig = sim.STRATEGIES[strat].career; sim.STRATEGIES[strat].career = c.id;
    let score = 0, pat = 0;
    for (let i = 0; i < RUNS; i++) { const r = sim.playSeason(strat, SB.defaultState('Bot', 'Recife')); score += r.score; pat += r.patrimony; }
    sim.STRATEGIES[strat].career = orig;
    line.push(`${c.name}: ${Math.round(score / RUNS)} resp. / R$ ${Math.round(pat / RUNS)}`.padEnd(34));
  }
  rows.push(line.join(''));
}
console.log(`Respeito médio por estratégia × especialização (${RUNS} temporadas cada)\n` + rows.join('\n'));
