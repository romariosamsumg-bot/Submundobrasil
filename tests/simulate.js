/* Simulador de balanceamento: bots com estratégias distintas jogam
 * temporadas completas usando o MESMO motor do jogo (extraído do HTML).
 * Uso: node tests/simulate.js [runs=300] [seed=1]
 */
'use strict';
const SB = require('./load-engine.js')();
/* v1.5, trilha de progresso: para chegar ao item ou negócio X, o robô compra antes o que falta na
 * trilha, como faria um jogador. As escolhas de duelo, assalto e noite olham só o que está liberado. */
const perform0 = SB.perform;
SB.perform = (s, a, ...args) => {
  const kind = a === 'buyItem' ? 'items' : a === 'buy' ? 'biz' : null;
  const it = kind === 'items' ? SB.item(args[0]) : kind === 'biz' ? SB.business(args[0]) : null;
  if (it && !it.trophy) {
    const list = SB.chainList(kind, it), i = list.findIndex(x => x.id === it.id);
    for (let j = 0; j < i; j++) if (!s.done[kind].includes(list[j].id)) { const r = perform0(s, a, list[j].id); if (!r.ok) return r; }
  }
  return perform0(s, a, ...args);
};
const RUNS = Number(process.argv[2] || 300);
const SEED = Number(process.argv[3] || 1);

/* ---------- utilidades dos bots ---------- */
function ev(s, m) {
  if (SB.missionLock(s, m)) return -Infinity;
  const p = SB.missionChance(s, m) / 100;
  const avg = (m.low + m.high) / 2 * SB.missionRewardMult(s, m);
  const loss = s.cash * SB.failLoss(s, m) + SB.arrestChance(s, m) / 100 * 600;
  return (p * avg - (1 - p) * loss) / m.cost - s.heat * .4;
}
function bestMission(s, minChance = 50) {
  let best = null, bv = 0;
  for (const m of SB.MISSIONS) { const v = ev(s, m); if (v > bv && SB.missionChance(s, m) >= minChance) { bv = v; best = m; } }
  return best;
}
/** Compra a melhor arma que cabe no bolso quando algum roubo está travado por arma (ou não há arma). */
/** Compra a arma mais barata que destrava o próximo roubo travado por arma (sacando do banco se preciso). */
function armUp(s, factor = 1.25) {
  if (s.jail || s.hospital) return;
  const cur = SB.item(s.gear.arma) || { cost: 0, power: 0 };
  const locked = SB.MISSIONS.filter(m => (SB.missionLock(s, m) || '').startsWith('Requer arma')).map(m => m.req.power);
  const want = locked.length ? Math.min(...locked) : (s.gear.arma ? 0 : 1);
  if (!want) return;
  const funds = s.cash + s.bank; // v1.5: sem devolução na troca, e a trilha cobra as anteriores da prateleira
  const path = it => { const list = SB.chainList('items', it), i = list.findIndex(x => x.id === it.id); return list.slice(0, i + 1).filter(x => !SB.owns(s, x.id)).reduce((a, x) => a + x.cost, 0); };
  const pick = SB.ITEMS.filter(i => i.slot === 'arma' && !i.trophy && i.power >= want && i.power > cur.power && s.respect >= i.unlock && funds >= path(i) * factor)[0];
  if (!pick) return;
  const missing = path(pick) - s.cash;
  if (missing > 0) SB.perform(s, 'bank', 'withdraw', Math.min(s.bank, Math.ceil(missing)));
  SB.perform(s, 'buyItem', pick.id);
}
/** v1.5: equipamento pesa em todo roubo. Compra o veículo que destrava um roubo e, com folga no caixa, a próxima proteção e o próximo veículo. */
function kitUp(s) {
  if (s.jail || s.hospital) return;
  const path = it => { const list = SB.chainList('items', it), i = list.findIndex(x => x.id === it.id); return list.slice(0, i + 1).filter(x => !SB.owns(s, x.id)).reduce((a, x) => a + x.cost, 0); };
  const needEsc = SB.MISSIONS.filter(m => (SB.missionLock(s, m) || '').startsWith('Requer veículo')).map(m => m.req.escape);
  for (const slot of ['veiculo', 'protecao']) {
    const cur = SB.item(s.gear[slot]) || { cost: 0, escape: 0 };
    const want = slot === 'veiculo' && needEsc.length ? Math.min(...needEsc) : 0;
    const next = SB.ITEMS.filter(i => i.slot === slot && !SB.owns(s, i.id) && i.cost > cur.cost && s.respect >= i.unlock && (want ? i.escape >= want : true))[0];
    if (!next) continue;
    const cost = path(next), funds = s.cash + s.bank;
    if (funds < cost * (want ? 1.25 : 3)) continue;
    if (cost > s.cash) SB.perform(s, 'bank', 'withdraw', Math.min(s.bank, Math.ceil(cost - s.cash)));
    SB.perform(s, 'buyItem', next.id);
  }
}
function grind(s, minChance, reserve = 0) {
  armUp(s); kitUp(s);
  for (let i = 0; i < 12; i++) {
    if (s.energy - reserve < 16) break;
    if (s.heat >= 65 && s.energy >= 18) { SB.perform(s, 'layLow'); continue; }
    const m = bestMission(s, minChance);
    if (!m || s.energy - m.cost < reserve) break;
    SB.perform(s, 'mission', m.id);
    if (s.jail) break;
  }
}
function trainBest(s, stat, keep) { while (s.cash - SB.trainCost(s, stat) > keep && SB.perform(s, 'train', stat).ok); }
/** Noite v1.4: entra na casa e pede a dose mais forte que cabe no bolso e no vício, até encher. */
function nightOut(s, venueId, maxVicio = 60, reserve = 300) {
  if (s.today.venue !== venueId && !SB.perform(s, 'night', venueId).ok) return false;
  for (let i = 0; i < SB.DOSE_LIMIT && s.energy < 85 && !s.hospital; i++) {
    const n = SB.NIGHT.find(x => x.id === s.today.venue); if (!n) break;
    const opts = n.menu.map(SB.doseOf).filter(d => (!d.max || (s.today.dose[d.id] || 0) < d.max) && s.vicio + SB.doseVicio(s, d) <= maxVicio + 10 && (s.cash - SB.doseCost(s, d, n) >= reserve || (d.good && s.goods[d.good] > 0)));
    const d = opts.filter(x => x.energy <= 100 - s.energy + 15).pop() || opts[0]; if (!d) break;
    const stock = d.good && s.goods[d.good] > 0;
    if (!SB.perform(s, 'dose', d.id, stock).ok) break;
  }
  return true;
}
function bankSurplus(s, keep) { const v = Math.min(SB.maxDeposit(s), s.cash - keep); if (v > 200) SB.perform(s, 'bank', 'deposit', v); }
function handleNews(s) {
  const n = SB.currentNews(s); if (!n) return;
  // escolhe a primeira opção possível que não seja pura perda
  for (let i = 0; i < n.choices.length; i++) if (!SB.newsChoiceBlocked(s, n.choices[i])) { if (SB.perform(s, 'news', n.id, i).ok) return; }
  SB.perform(s, 'skipNews');
}
function bail(s) { if (s.jail && s.cash > SB.bailCost(s) * 3) SB.perform(s, 'bail'); }

/* ---------- estratégias ---------- */
const STRATEGIES = {
  operador_grind: { career: 'operador', goal: 'renome', day(s) {
    bail(s); handleNews(s); grind(s, 55, 22); trainBest(s, 'astucia', 900); if (s.stats.astucia > 24) trainBest(s, 'forca', 900); bankSurplus(s, 600); } },
  empreendedor_negocios: { career: 'empreendedor', goal: 'capital', day(s) {
    bail(s); handleNews(s);
    if (s.bank) SB.perform(s, 'bank', 'withdraw', s.bank);
    for (const b of SB.BUSINESSES.slice().reverse()) if (s.day < 22 && !s.businesses.includes(b.id)) SB.perform(s, 'buy', b.id);
    grind(s, 65); if (s.day >= 22) bankSurplus(s, 300); } },
  articulador_territorio: { career: 'empreendedor', goal: 'dominio', day(s) {
    bail(s); handleNews(s);
    const target = SB.DISTRICTS.filter(d => !SB.controlled(s, d.id)).sort((a, b) => (s.influence[b.id] - SB.leader(s, b.id).value) - (s.influence[a.id] - SB.leader(s, a.id).value))[0] || SB.district(s);
    if (target.id !== s.district && SB.controls(s).length && !SB.controlled(s, s.district)) SB.perform(s, 'travel', target.id);
    else if (target.id !== s.district && !SB.controls(s).length && s.influence[s.district] < 15) SB.perform(s, 'travel', target.id);
    if (!s.gangName && s.respect >= 30 && s.cash >= 2300) SB.perform(s, 'foundGang', 'Rede');
    SB.perform(s, 'contact'); SB.perform(s, 'contact');
    if (SB.disputeOdds(s, s.district) >= 50) SB.perform(s, 'dispute');
    if (s.gangName && SB.clashOdds(s, s.district) >= 50) SB.perform(s, 'clash', SB.leader(s, s.district).id);
    grind(s, 60); trainBest(s, 'influencia', 1200); } },
  articulador_diplomata: { career: 'empreendedor', goal: 'diplomacia', day(s) {
    bail(s); handleNews(s);
    if (!s.gangName && s.respect >= 30 && s.cash >= 1900) SB.perform(s, 'foundGang', 'Conselho');
    for (const f of SB.FACTIONS.slice().sort((a, b) => s.factions[b.id].relation - s.factions[a.id].relation)) {
      const r = s.factions[f.id];
      if (r.relation >= 60 && s.gangLevel >= 2 && SB.perform(s, 'alliance', f.id).ok) continue;
      if (r.relation >= 35 && !SB.agreement(s, f.id) && SB.perform(s, 'pact', f.id).ok) continue;
      if (!SB.agreement(s, f.id) || r.relation < 60) SB.perform(s, 'dialogue', f.id);
    }
    if (s.gangName && s.gangLevel < 2 && s.cash > SB.upgradeCost(s) + 800) SB.perform(s, 'upgrade');
    grind(s, 60); trainBest(s, 'labia', 1000); } },
  gangue_bonde: { career: 'operador', goal: 'bonde', day(s) {
    bail(s); handleNews(s);
    if (!s.gangName && s.respect >= 30 && s.cash >= 1800) SB.perform(s, 'foundGang', 'Bonde');
    if (s.gangName) {
      if (s.crewMorale < 45) SB.perform(s, 'rally');
      if (s.crew.length < 6 && s.cash > SB.recruitCost(s) + 500) SB.perform(s, 'recruit', ['musculo', 'olheiro', 'musculo', 'negociador'][s.crew.length % 4]);
      SB.perform(s, 'gangOp');
      if (s.gangLevel < 4 && s.cash > SB.upgradeCost(s) + 1500) SB.perform(s, 'upgrade');
      if (s.influence[s.district] >= 20 && SB.clashOdds(s, s.district) >= 55) SB.perform(s, 'clash', SB.leader(s, s.district).id);
      else if (s.influence[s.district] < 20) SB.perform(s, 'contact');
    }
    grind(s, 55); trainBest(s, 'forca', 1500); } },
  comerciante: { career: 'empreendedor', goal: 'capital', day(s) {
    // Compra barato, viaja para onde vende melhor, produz e despacha para o comprador de fora.
    bail(s); handleNews(s);
    for (const id of ['bike', 'cinquentinha', 'moto', 'opala']) if (s.cash > SB.item(id).cost * 2.5) SB.perform(s, 'buyItem', id);
    for (const l of SB.LABS) if (s.cash > SB.labCost(s, l) * 1.15 && s.day < 16) SB.perform(s, 'buildLab', l.id);
    if (s.exportDeal.day === s.day && s.goods[s.exportDeal.good] > 0) { if (s.district !== 'cais') SB.perform(s, 'travel', 'cais'); SB.perform(s, 'exportGoods'); }
    const sellHere = () => { for (const g of SB.GOODS) { if (s.goods[g.id] > 0 && s.market[s.district][g.id] >= 112 && !(g.id === s.exportDeal.good && s.exportDeal.day >= s.day && s.exportDeal.day - s.day <= 3)) SB.perform(s, 'sellGood', g.id, s.goods[g.id]); } };
    sellHere();
    // viaja se outro bairro paga bem mais pela carga
    let best = null, gain = 0;
    for (const d of SB.DISTRICTS) { let v = 0; for (const g of SB.GOODS) v += s.goods[g.id] * (SB.goodSellPrice(s, g, d.id) - SB.goodSellPrice(s, g, s.district)); if (v > gain) { gain = v; best = d; } }
    if (best && gain > 250 && SB.blitzChance(s) < 25) { SB.perform(s, 'travel', best.id); sellHere(); }
    for (const g of SB.GOODS.slice().reverse()) { if (s.respect < g.unlock || s.market[s.district][g.id] > 88) continue; let q = Math.min(SB.cargoCap(s) - SB.cargoUsed(s), 40); while (q > 0 && SB.buyTotal(s, g, q) > s.cash - 400) q -= 5; if (q > 0) SB.perform(s, 'buyGood', g.id, q); }
    grind(s, 60); trainBest(s, 'astucia', 2500); if (s.day >= 24) bankSurplus(s, 400); } },
  operador_noite: { career: 'operador', goal: 'renome', day(s) {
    // Farma serviços, compra arsenal e usa a noite para render mais energia.
    bail(s); handleNews(s);
    for (const id of ['soco', 'jaqueta', 'peixeira', 'colete', 'trezoitao', 'pistola']) if (s.gear[SB.item(id).slot] !== id && s.cash > SB.item(id).cost * 3 && (SB.item(s.gear[SB.item(id).slot]) || { cost: 0 }).cost < SB.item(id).cost) SB.perform(s, 'buyItem', id);
    grind(s, 55, 0);
    for (let i = 0; i < 2; i++) if (s.cash > 2500 && s.energy < 55 && !s.jail) { nightOut(s, 'baile', 55, 2000); grind(s, 55, 0); }
    trainBest(s, 'astucia', 1200); bankSurplus(s, 900); } },
  brigao: { career: 'operador', goal: 'renome', day(s) {
    // Arma e proteção, duelos contra o melhor adversário com boa chance, hospital quando precisa.
    bail(s); handleNews(s);
    for (const id of ['soco', 'jaqueta', 'peixeira', 'colete', 'trezoitao', 'pistola', 'tatico', 'doze'])
      if (s.gear[SB.item(id).slot] !== id && s.cash > SB.item(id).cost * 1.8 && (SB.item(s.gear[SB.item(id).slot]) || { cost: 0 }).cost < SB.item(id).cost) SB.perform(s, 'buyItem', id);
    if (s.health < 60) { SB.perform(s, 'clinic', 'posto'); if (s.health < 50 && s.cash > SB.clinicCost(s) * 3) SB.perform(s, 'clinic', 'clinica'); }
    for (let i = 0; i < 3; i++) {
      const r = SB.RIVALS.filter(x => s.respect >= x.unlock && SB.duelOdds(s, x) >= 55).sort((a, b) => b.rating - a.rating)[0];
      if (!r || s.health < 45 || !SB.perform(s, 'duel', r.id).ok) break;
    }
    grind(s, 55); trainBest(s, 'forca', 1500); bankSurplus(s, 1200); } },
  bando_assaltos: { career: 'operador', goal: 'bonde', day(s) {
    // Gangue que vive de assaltos: recruta, arma o líder, reconhece e executa quando a chance compensa.
    bail(s); handleNews(s);
    if (!s.gangName && s.respect >= 30 && s.cash >= 1800) SB.perform(s, 'foundGang', 'Bonde');
    for (const id of ['vergalhao', 'peixeira', 'trezoitao', 'pistola', 'doze', 'uzi', 'fuzil']) if (s.gear.arma !== id && s.cash > SB.item(id).cost * 2 && (SB.item(s.gear.arma) || { cost: 0 }).cost < SB.item(id).cost) SB.perform(s, 'buyItem', id);
    if (s.gangName) {
      if (s.crewMorale < 45) SB.perform(s, 'rally');
      if (s.crew.length < 6 && s.cash > SB.recruitCost(s) + 1500) SB.perform(s, 'recruit', ['musculo', 'olheiro', 'musculo'][s.crew.length % 3]);
      if (s.gangLevel < 3 && s.cash > SB.upgradeCost(s) + 3000) SB.perform(s, 'upgrade');
      if (s.health < 55) SB.perform(s, 'clinic', 'posto');
      if (s.heist) {
        const h = SB.heist(s.heist.id), last = Math.min(SB.MAXDAY, s.heist.day + SB.HEIST_WINDOW);
        SB.perform(s, 'heistScout');
        if (s.day > s.heist.day && (s.heist.intel >= 36 || s.day >= last || SB.heistOdds(s, h) >= 75)) SB.perform(s, 'heistRun');
      } else {
        const h = SB.HEISTS.filter(x => !SB.heistLock(s, x) && SB.heistOdds(s, x) + 20 >= 55 && s.cash > SB.heistPlanCost(s, x) + 800).pop();
        if (h) { SB.perform(s, 'heistPlan', h.id); SB.perform(s, 'heistScout'); }
      }
      SB.perform(s, 'gangOp');
    }
    grind(s, 55, 40); trainBest(s, 'forca', 2500); } },
  traficante_galpao: { career: 'traficante', goal: 'capital', day(s) { STRATEGIES.comerciante.day(s); } },
  barao_noite: { career: 'barao', goal: 'capital', day(s) {
    // Monta o império da noite e usa a própria noite para render mais roubos.
    bail(s); handleNews(s);
    if (s.bank) SB.perform(s, 'bank', 'withdraw', s.bank);
    for (const id of ['termas', 'inferninho', 'pensao', 'show', 'bar', 'bicho', 'mercado', 'oficina']) if (s.day < 20 && !s.businesses.includes(id) && s.cash > SB.buyCost(s, SB.business(id)) + 300) SB.perform(s, 'buy', id);
    if (s.vicio >= 60) SB.perform(s, 'detox', 'soro');
    grind(s, 60);
    for (let i = 0; i < 3; i++) if (s.energy < 30 && !s.jail && !s.hospital && s.vicio < 65) { const n = SB.NIGHT.filter(x => (!x.unlock || s.respect >= x.unlock || SB.ownTermas(s, x)) && SB.nightCost(s, x) <= s.cash - 300).pop(); if (!n || !nightOut(s, n.id, 60)) break; grind(s, 60); }
    if (s.day >= 22) bankSurplus(s, 400); } },
  imperio_noite: { career: 'barao', goal: 'capital', day(s) {
    // v1.4: Inferninho e Termas abastecidos pela própria produção (bebida falsa, laboratório, refinaria).
    bail(s); handleNews(s);
    if (s.bank) SB.perform(s, 'bank', 'withdraw', s.bank);
    for (const id of ['inferninho', 'pensao', 'termas']) if (s.day < 20 && !s.businesses.includes(id) && s.cash > SB.buyCost(s, SB.business(id)) + 300) SB.perform(s, 'buy', id);
    for (const id of ['alambique', 'laboratorio', 'refinaria']) { const l = SB.LABS.find(x => x.id === id); if (s.day < 18 && s.labs[id] < 2 && s.cash > SB.labCost(s, l) + 500) SB.perform(s, 'buildLab', id); }
    if (s.vicio >= 60) SB.perform(s, 'detox', 'soro');
    for (const g of SB.GOODS) { const keep = ['bebida', 'po'].includes(g.id) ? 10 : 0, q = s.goods[g.id] - keep; if (q >= 5 && s.market[s.district][g.id] >= 95) SB.perform(s, 'sellGood', g.id, q); }
    if (s.exportDeal.day === s.day && s.goods[s.exportDeal.good] > 10) { if (s.district !== 'cais') SB.perform(s, 'travel', 'cais'); SB.perform(s, 'exportGoods'); }
    grind(s, 60);
    for (let i = 0; i < 3; i++) if (s.energy < 30 && !s.jail && !s.hospital && s.vicio < 65) { const n = SB.NIGHT.filter(x => (!x.unlock || s.respect >= x.unlock || SB.ownTermas(s, x)) && SB.nightCost(s, x) <= s.cash - 300).pop(); if (!n || !nightOut(s, n.id, 60)) break; grind(s, 60); }
    if (s.day >= 22) bankSurplus(s, 400); } },
  apostador: { career: 'empreendedor', goal: 'capital', day(s) {
    // Rouba como todo mundo e joga metade do que tem na roleta, três vezes por dia.
    bail(s); handleNews(s); grind(s, 55);
    for (let i = 0; i < 3; i++) { const st = Math.min(20000, Math.floor(s.cash / 2)); if (st >= 10) SB.perform(s, 'bet', 'roleta', st); } } },
  exploit_repetir: { career: 'operador', goal: 'capital', day(s) {
    // Repete sempre a missão de maior recompensa desbloqueada e deposita tudo.
    if (s.bank) SB.perform(s, 'bank', 'withdraw', s.bank);
    for (let i = 0; i < 10; i++) {
      const m = SB.MISSIONS.filter(x => !SB.missionLock(s, x)).sort((a, b) => b.high - a.high)[0];
      if (!m) break; SB.perform(s, 'mission', m.id);
    }
    bankSurplus(s, 0); } },
  aleatorio: { career: null, goal: null, day(s) {
    const acts = ['mission', 'train', 'gig', 'contact', 'travel', 'layLow', 'buy', 'dialogue'];
    for (let i = 0; i < 8; i++) {
      const a = acts[SB.rand(0, acts.length - 1)];
      const arg = a === 'mission' ? SB.MISSIONS[SB.rand(0, SB.MISSIONS.length - 1)].id : a === 'train' ? SB.STATS[SB.rand(0, 3)].id :
        a === 'travel' ? SB.DISTRICTS[SB.rand(0, 4)].id : a === 'buy' ? SB.BUSINESSES[SB.rand(0, 4)].id : a === 'dialogue' ? SB.FACTIONS[SB.rand(0, 2)].id : undefined;
      SB.perform(s, a, arg);
    }
    handleNews(s); } }
};

function playSeason(strategy, s) {
  const st = STRATEGIES[strategy];
  if (st.career) SB.perform(s, 'career', st.career);
  else SB.perform(s, 'career', SB.CAREERS[SB.rand(0, SB.CAREERS.length - 1)].id);
  // v1.5: sem meta da temporada
  while (s.day < SB.MAXDAY) { st.day(s); SB.perform(s, 'nextDay'); }
  st.day(s);
  const sc = SB.seasonScore(s);
  const out = { patrimony: SB.patrimony(s), respect: s.respect, score: sc.score, goal: s.goalDone ? 1 : 0, arrests: s.seasonStats.arrests,
    sold: s.trade.sold, spent: s.trade.spent, exported: s.trade.exported, blitz: s.trade.blitz, labs: SB.LABS.filter(l => s.labs[l.id]).length, controls: SB.controls(s).length, crew: s.crew.length, careerLvl: SB.careerLevel(s), success: s.successful, failed: s.failed, health: s.health, duels: s.duelStats.wins, hospital: s.hospital, heists: s.gangStats.heists, heistFails: s.gangStats.heistFails };
  for (const c of sc.cats) { out['v_' + c.id] = c.value; out['m_' + c.id] = c.medal; }
  return out;
}

function stats(arr) {
  const a = arr.slice().sort((x, y) => x - y), n = a.length;
  const mean = a.reduce((p, c) => p + c, 0) / n;
  return { mean: Math.round(mean * 10) / 10, p10: a[Math.floor(n * .1)], p50: a[Math.floor(n * .5)], p90: a[Math.floor(n * .9)] };
}

function runAll() {
  SB.setRandom(SB.seeded(SEED));
  const report = {};
  for (const name of Object.keys(STRATEGIES)) {
    const rows = [];
    for (let r = 0; r < RUNS; r++) rows.push(playSeason(name, SB.defaultState('Bot', 'Recife')));
    const keys = Object.keys(rows[0]);
    report[name] = Object.fromEntries(keys.map(k => [k, stats(rows.map(x => x[k]))]));
  }
  return report;
}

if (require.main === module) {
  const t0 = Date.now();
  const rep = runAll();
  const cols = ['patrimony', 'respect', 'score', 'goal', 'arrests', 'controls', 'v_fortuna', 'm_fortuna', 'v_fama', 'm_fama', 'v_territorio', 'm_territorio', 'v_diplomacia', 'm_diplomacia', 'v_gangue', 'm_gangue', 'careerLvl'];
  console.log(`Simulação: ${RUNS} temporadas por estratégia, seed ${SEED} (${Date.now() - t0} ms)\n`);
  console.log(['estratégia'.padEnd(24)].concat(cols.map(c => c.padStart(12))).join(''));
  for (const [name, r] of Object.entries(rep)) console.log([name.padEnd(24)].concat(cols.map(c => String(r[c].mean).padStart(12))).join(''));
  console.log('\nPercentis de patrimônio (p10 / p50 / p90):');
  for (const [name, r] of Object.entries(rep)) console.log('  ' + name.padEnd(24) + `${r.patrimony.p10} / ${r.patrimony.p50} / ${r.patrimony.p90}`);
}
module.exports = { runAll, STRATEGIES, playSeason };
