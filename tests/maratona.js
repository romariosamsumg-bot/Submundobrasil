/* Maratonista: dinheiro infinito, rouba, se droga e zera o vício na clínica o dia todo. Mede o teto real de energia por dia. Uso: node tests/maratona.js */
// Jogador com dinheiro infinito: rouba até cansar, entra nas casas e toma a dose que mais rende, repete.
const SB = require('./load-engine.js')();
SB.setRandom(SB.seeded(7));
let energyDrug = 0, missions = 0, days = 0, od = 0;
for (let run = 0; run < 40; run++) {
  const s = SB.defaultState('M', 'Recife'); s.tutorial.done = true; SB.perform(s, 'career', 'operador'); s.respect = 100; s.stats.astucia = 40; s.stats.forca = 40;
  for (let d = 0; d < 10; d++) {
    for (let loop = 0; loop < 200; loop++) {
      s.cash = 1e6; s.heat = 0; s.jail = 0;
      const m = SB.MISSIONS.filter(x => !SB.missionLock(s, x) && s.energy >= x.cost).sort((a, b) => SB.missionChance(s, b) - SB.missionChance(s, a))[0];
      if (m) { SB.perform(s, 'mission', m.id); missions++; continue; }
      if (s.hospital) break;
      if (s.vicio >= 40) SB.perform(s, 'detox', 'clinica');
      let got = false;
      for (const n of SB.NIGHT.slice().reverse()) {
        if (s.today.venue !== n.id && !SB.perform(s, 'night', n.id).ok) continue;
        const v = SB.NIGHT.find(x => x.id === s.today.venue); if (!v) continue;
        const ds = v.menu.map(SB.doseOf).sort((a, b) => SB.nightEnergy(s, b) - SB.nightEnergy(s, a));
        for (const dd of ds) { const e = s.energy; const r = SB.perform(s, 'dose', dd.id); if (r.ok) { energyDrug += s.energy - e; got = true; if (s.hospital) od++; break; } }
        if (got) break;
      }
      if (!got) break;
    }
    days++; s.energy = Math.min(s.energy, 100); SB.perform(s, 'nextDay'); s.jail = 0; s.hospital = 0;
  }
}
console.log(`energia de drogas por dia: ${(energyDrug / days).toFixed(0)} · roubos por dia: ${(missions / days).toFixed(1)} · overdoses por 10 dias: ${(od / 40).toFixed(1)}`);
