/* Ritmo da Feira: um jogador começa do zero, rouba e compra a próxima arma da trilha assim que pode.
 * Mostra em que roubo e em que dia (mediana) ele chega a cada arma. Uso: node tests/ritmo.js [jogos] [caixa inicial] */
'use strict';
const SB = require('./load-engine.js')();
const RUNS = Number(process.argv[2] || 200), START = Number(process.argv[3] || 0);
SB.setRandom(SB.seeded(11));
const guns = SB.ITEMS.filter(i => i.slot === 'arma' && !i.trophy);
const hits = guns.map(() => ({ rob: [], day: [] }));
function best(s) {
  let b = null, bv = -Infinity;
  for (const m of SB.MISSIONS) { if (SB.missionLock(s, m)) continue; const p = SB.missionChance(s, m) / 100; if (p < .5) continue; const v = p * (m.low + m.high) / 2 * SB.missionRewardMult(s, m) / SB.missionCost(s, m); if (v > bv) { bv = v; b = m; } }
  return b;
}
for (let r = 0; r < RUNS; r++) {
  const s = SB.defaultState('Ritmo', 'Recife'); s.tutorial.done = true; s.cash = START; SB.perform(s, 'career', 'operador');
  let robs = 0;
  const buy = () => { for (;;) { const i = guns.findIndex(g => !s.done.items.includes(g.id)); if (i < 0) return; const g = guns[i]; if (!SB.perform(s, 'buyItem', g.id).ok) return; hits[i].rob.push(robs); hits[i].day.push(s.day); } };
  while (s.day < SB.MAXDAY) {
    buy();
    const m = !s.jail && !s.hospital && best(s);
    if (m && s.energy >= SB.missionCost(s, m)) { const ok = SB.perform(s, 'mission', m.id); if (ok.good) robs++; continue; }
    if (!s.jail && !s.hospital && s.energy < 20 && s.today.night < 1 && s.cash > 60) { SB.perform(s, 'night', 'boteco'); while (s.energy < 60 && SB.perform(s, 'dose', 'pinga').ok); continue; }
    if (!s.jail && !s.hospital && s.energy >= 28 && !m) { SB.perform(s, 'gig'); continue; }
    SB.perform(s, 'nextDay');
  }
}
const med = a => { if (!a.length) return '—'; const x = a.slice().sort((p, q) => p - q); return x[Math.floor(x.length / 2)]; };
console.log(`Ritmo da Feira (${RUNS} jogos, começo com R$ ${START}): mediana do roubo e do dia em que compra cada arma`);
guns.forEach((g, i) => console.log(`${String(i + 1).padStart(2)}. ${g.name.padEnd(28)} R$ ${String(g.cost).padStart(6)}  respeito ${String(g.unlock).padStart(3)}  →  roubo ${String(med(hits[i].rob)).padStart(4)} · dia ${String(med(hits[i].day)).padStart(3)} · ${Math.round(hits[i].rob.length / RUNS * 100)}% chegam`));
