/* Testes do motor (sem navegador). Uso: node tests/engine.test.js */
'use strict';
const SB = require('./load-engine.js')();
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('  FALHA ' + name + '\n        ' + e.message); } }
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ''} esperado ${JSON.stringify(b)}, obtido ${JSON.stringify(a)}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'condição falsa'); };
const fresh = () => SB.defaultState('Teste', 'Recife');
const withGang = (n = 2) => { const s = fresh(); s.respect = 40; s.cash = 5000; SB.perform(s, 'foundGang', 'Bonde'); while (s.crew.length < n) { s.crewLastRecruit = 0; s.energy = 100; s.cash += 2000; SB.perform(s, 'recruit', 'musculo'); } return s; };
SB.setRandom(SB.seeded(123));

console.log('Personagem iniciante e limites');
t('estado inicial é válido e reidratável', () => { const r = SB.parseSave(JSON.stringify(fresh())); ok(r.ok, r.error); eq(r.state.cash, 1900); });
t('missão sem energia é recusada sem alterar estado', () => { const s = fresh(); s.energy = 5; const c = JSON.stringify(s); const r = SB.perform(s, 'mission', 'correria'); eq(r.ok, false); eq(JSON.stringify(s), c); });
t('missão bloqueada por respeito', () => { const s = fresh(); eq(SB.perform(s, 'mission', 'cofre').ok, false); });
t('missão exclusiva só no bairro', () => { const s = fresh(); s.respect = 50; ok(SB.missionLock(s, SB.mission('carga')).includes('Cais')); s.district = 'cais'; eq(SB.missionLock(s, SB.mission('carga')), ''); });
t('chances iniciais coerentes (fácil ≥ 75%, cofre impossível)', () => { const s = fresh(); ok(SB.missionChance(s, SB.mission('correria')) >= 75); ok(SB.missionChance(s, SB.mission('cofre')) <= 15); });
t('detido não treina, viaja nem compra; banco continua', () => { const s = fresh(); s.jail = 2; s.cash = 9000; for (const [a, x] of [['train', 'astucia'], ['travel', 'cais'], ['buy', 'bar'], ['mission', 'correria']]) eq(SB.perform(s, a, x).ok, false, a); eq(SB.perform(s, 'bank', 'deposit', 100).ok, true); });
t('fiança liberta e cobra o custo', () => { const s = fresh(); s.jail = 2; s.cash = 5000; const c = SB.bailCost(s); eq(SB.perform(s, 'bail').ok, true); eq(s.jail, 0); eq(s.cash, 5000 - c); });
t('fiança com pouco dinheiro é recusada', () => { const s = fresh(); s.jail = 3; s.cash = 10; eq(SB.perform(s, 'bail').ok, false); });

console.log('Economia');
t('depósito cobra 3% e saque é gratuito', () => { const s = fresh(); SB.perform(s, 'bank', 'deposit', 1000); eq(s.bank, 1000); eq(s.cash, 870); SB.perform(s, 'bank', 'withdraw', 1000); eq(s.cash, 1870); });
t('maxDeposit nunca excede o caixa', () => { for (const c of [0, 1, 2, 33, 103, 1900, 99999]) { const s = fresh(); s.cash = c; const v = SB.maxDeposit(s); if (v > 0) { eq(SB.perform(s, 'bank', 'deposit', v).ok, true, 'c=' + c); ok(s.cash >= 0); } } });
t('valores bancários inválidos recusados', () => { const s = fresh(); for (const v of [0, -1, 1.5, NaN, Infinity, 1e20]) eq(SB.perform(s, 'bank', 'deposit', v).ok, false, String(v)); });
t('patrimônio conta negócio pela revenda (60%)', () => { const s = fresh(); s.cash = 1250; SB.perform(s, 'buy', 'bar'); eq(SB.patrimony(s), 750); });
t('venda devolve 60%', () => { const s = fresh(); s.cash = 1250; SB.perform(s, 'buy', 'bar'); SB.perform(s, 'sell', 'bar'); eq(s.cash, 750); });
t('empreendedor paga 12% menos e rende 25% mais', () => { const s = fresh(); s.career = 'empreendedor'; s.cash = 1250; SB.perform(s, 'buy', 'bar'); eq(s.cash, 150); const base = fresh(); base.businesses = ['bar']; ok(SB.businessIncome(s, SB.business('bar')) > SB.businessIncome(base, SB.business('bar'))); });
t('crise reduz renda de negócios', () => { const s = fresh(); s.businesses = ['mercado']; const a = SB.income(s); s.events = [{ id: 'crise', start: 1, until: 4, district: null }]; ok(SB.income(s) < a); });
t('carnaval multiplica a Casa de Shows', () => { const s = fresh(); s.businesses = ['show']; const a = SB.income(s); s.events = [{ id: 'carnaval', start: 1, until: 3, district: null }]; ok(SB.income(s) >= a * 1.7); });
t('custo de treino cresce de forma superlinear', () => { const s = fresh(); const c1 = SB.trainCost(s, 'astucia'); s.stats.astucia = 30; ok(SB.trainCost(s, 'astucia') > c1 * 3); });
t('limite de 3 treinos por dia', () => { const s = fresh(); s.cash = 99999; for (let i = 0; i < 3; i++) { s.energy = 100; eq(SB.perform(s, 'train', 'forca').ok, true); } s.energy = 100; eq(SB.perform(s, 'train', 'forca').ok, false); });
t('excesso de dinheiro não quebra fórmulas', () => { const s = fresh(); s.cash = 1e11; s.bank = 1e11; SB.perform(s, 'mission', 'correria'); ok(Number.isSafeInteger(s.cash)); ok(Number.isSafeInteger(SB.patrimony(s))); });

console.log('Repetição e diversidade');
t('repetir a mesma missão reduz chance e recompensa', () => { const s = fresh(); s.cash = 0; const m = SB.mission('correria'); const c0 = SB.missionChance(s, m), r0 = SB.missionRewardMult(s, m); s.today.missions.correria = 3; ok(SB.missionChance(s, m) < c0); ok(SB.missionRewardMult(s, m) < r0); });
t('vigilância local sobe com missões e cai no dia seguinte', () => { const s = fresh(); SB.perform(s, 'mission', 'correria'); ok(s.dstate.centro.vigil > 0); const v = s.dstate.centro.vigil; SB.perform(s, 'nextDay'); ok(s.dstate.centro.vigil < v || s.events.some(e => e.id === 'operacao')); });
t('cofre só uma vez por dia', () => { const s = fresh(); s.respect = 200; s.stats.astucia = 40; s.energy = 100; SB.perform(s, 'mission', 'cofre'); s.jail = 0; s.energy = 100; eq(SB.perform(s, 'mission', 'cofre').ok, false); });
t('respeito diminui em missões fáceis demais', () => { const s = fresh(); s.respect = 200; eq(SB.respectGain(s, SB.mission('correria')), 1); });
t('1000 ações seguidas com energia infinita mantêm invariantes', () => { const s = fresh(); s.respect = 300; s.stats.astucia = 60; for (let i = 0; i < 1000; i++) { s.energy = 100; s.jail = 0; SB.perform(s, 'mission', 'deposito'); } ok(s.heat <= 100 && s.cash >= 0 && Number.isInteger(s.cash)); ok(SB.missionChance(s, SB.mission('deposito')) <= 95); });

console.log('Gangue e facções');
t('operação coletiva: 1 por dia e exige 2 integrantes', () => { const s = withGang(2); s.energy = 100; eq(SB.perform(s, 'gangOp').ok, true); s.energy = 100; eq(SB.perform(s, 'gangOp').ok, false); });
t('gangue grande tem chance maior que a pequena', () => { const a = withGang(2), b = withGang(7); a.energy = b.energy = 100; ok(SB.gangOdds(b) > SB.gangOdds(a)); });
t('equipe limitada a 8', () => { const s = withGang(8); s.crewLastRecruit = 0; s.cash = 99999; s.energy = 100; eq(SB.perform(s, 'recruit', 'olheiro').ok, false); });
t('ânimo baixo pode causar deserção', () => { let left = 0; for (let i = 0; i < 40; i++) { const s = withGang(5); s.crewMorale = 5; s.cash = 0; SB.perform(s, 'nextDay'); if (s.crew.length < 5) left++; } ok(left > 0, 'nenhuma deserção em 40 tentativas'); });
t('integrantes sobem de nível', () => { const s = withGang(3); for (let i = 0; i < 30; i++) { s.today.op = false; s.energy = 100; s.jail = 0; SB.perform(s, 'gangOp'); } ok(s.crew.some(m => m.level > 1)); });
t('trégua exige relação +35 e bloqueia confronto e disputa', () => { const s = withGang(3); eq(SB.perform(s, 'pact', 'esquina').ok, false); s.factions.esquina.relation = 40; s.energy = 100; s.cash = 5000; eq(SB.perform(s, 'pact', 'esquina').ok, true); s.influence.centro = 40; s.factions.esquina.lastActionDay = 0; s.energy = 100; eq(SB.perform(s, 'clash', 'esquina').ok, false); eq(SB.perform(s, 'dispute').ok, false); });
t('trégua seguinte custa mais e tem carência', () => { const s = withGang(3); s.factions.esquina.relation = 60; s.cash = 9000; s.energy = 100; const c1 = SB.pactCost(s, 'esquina'); SB.perform(s, 'pact', 'esquina'); ok(SB.pactCost(s, 'esquina') > c1); s.day = s.factions.esquina.truceUntil + 1; s.factions.esquina.lastActionDay = 0; s.energy = 100; eq(SB.perform(s, 'pact', 'esquina').ok, false); });
t('trégua impede retaliação e avanço onde você tem influência', () => { const s = withGang(3); s.influence.centro = 30; s.influence.vila = 30; s.factions.esquina.relation = -80; s.factions.esquina.tension = 90; s.factions.esquina.truceUntil = 30; const before = s.influence.centro; for (let i = 0; i < 5; i++) SB.perform(s, 'nextDay'); ok(!s.factions.esquina.lastMove.startsWith('Retaliação de Esquina'), s.factions.esquina.lastMove); ok(s.influence.centro >= before - 5); });
t('romper acordo pune relação com todas as facções', () => { const s = withGang(3); s.factions.aurora.relation = 50; s.factions.aurora.truceUntil = 10; const d0 = s.factions.docas.relation; eq(SB.perform(s, 'breakDeal', 'aurora').ok, true); ok(s.factions.aurora.relation <= 10); ok(s.factions.docas.relation < d0); eq(s.treachery, 1); ok(s.achievements.traidor); });
t('aliança: requisitos, contribuição diária e inimigo do aliado', () => { const s = withGang(3); s.gangLevel = 2; s.factions.esquina.relation = 70; s.cash = 5000; s.energy = 100; const d0 = s.factions.docas.relation; eq(SB.perform(s, 'alliance', 'esquina').ok, true); ok(s.factions.docas.relation < d0); const c = s.cash; SB.perform(s, 'nextDay'); ok(s.factions.esquina.allied); ok(SB.clashOdds(s, 'cais') >= 15); ok(s.log[0].msg.includes('Contribuição')); ok(s.cash !== c); });
t('rival dominante: confronto mais difícil', () => { const a = withGang(3), b = withGang(3); a.influence.centro = b.influence.centro = 30; b.presence.centro.esquina = 95; b.factions.esquina.power = 90; ok(SB.clashOdds(b, 'centro') < SB.clashOdds(a, 'centro')); });
t('facções hostis retaliam ao longo do tempo', () => { const s = withGang(3); for (const f of SB.FACTIONS) { s.factions[f.id].relation = -90; s.factions[f.id].tension = 95; } s.influence.cais = 50; s.influence.centro = 50; for (let i = 0; i < 12; i++) { SB.perform(s, 'nextDay'); for (const f of SB.FACTIONS) s.factions[f.id].tension = 95; } ok(s.gangStats.retaliations > 0); });
t('IA: liderança de bairro pode mudar', () => { let changed = 0; for (let k = 0; k < 20; k++) { const s = fresh(); const init = SB.DISTRICTS.map(d => SB.leader(s, d.id).id).join(); while (s.day < 30) SB.perform(s, 'nextDay'); if (SB.DISTRICTS.map(d => SB.leader(s, d.id).id).join() !== init) changed++; } ok(changed > 0, 'território nunca mudou em 20 temporadas'); });
t('controle de bairro gera tributo', () => { const s = fresh(); s.influence.jardim = 80; s.presence.jardim.aurora = 10; ok(SB.controlled(s, 'jardim')); const c = s.cash; s.district = 'jardim'; SB.perform(s, 'nextDay'); ok(s.cash > c); ok(s.seasonStats.controlDays.jardim >= 1 || !SB.controlled(s, 'jardim')); });

console.log('Temporada');
t('não encerra antes do dia 30', () => { const s = fresh(); eq(SB.perform(s, 'endSeason').ok, false); });
t('29 viradas levam ao dia 30 e a 31ª é recusada', () => { const s = fresh(); let n = 0; while (SB.perform(s, 'nextDay').ok) n++; eq(n, 29); eq(s.day, 30); });
t('virada de temporada preserva histórico, conquistas e recordes', () => { const s = fresh(); s.achievements.primeira = 1; s.day = 30; s.cash = 30000; const r = SB.perform(s, 'endSeason'); const n = r.state; eq(n.season, 2); eq(n.day, 1); eq(n.seasonHistory.length, 1); ok(n.achievements.primeira); ok(n.records.fortuna >= 30000); ok(n.cash > 1900 && n.cash <= 1900 + 1200 + 600 + 800); });
t('legado inicial é limitado (sem bola de neve)', () => { const s = fresh(); s.day = 30; s.cash = 1e9; s.goal = 'capital'; s.goalDone = true; const n = SB.perform(s, 'endSeason').state; ok(n.cash <= 4500, String(n.cash)); });
t('rival histórico herdado', () => { const s = fresh(); s.day = 30; s.factions.docas.grudge = 5; const n = SB.perform(s, 'endSeason').state; eq(n.nemesis, 'docas'); ok(n.factions.docas.relation < -20); });
t('meta fica travada quando cumprida', () => { const s = fresh(); s.goal = 'capital'; s.cash = 20000; SB.perform(s, 'gig'); eq(s.goalDone, true); s.cash = 0; SB.perform(s, 'nextDay'); eq(s.goalDone, true); });
t('meta só até o dia 5', () => { const s = fresh(); s.day = 6; eq(SB.perform(s, 'goal', 'renome').ok, false); });
t('eventos fixos: Carnaval no dia 9', () => { const s = fresh(); while (s.day < 9) SB.perform(s, 'nextDay'); ok(SB.activeEvents(s).some(e => e.id === 'carnaval')); });

console.log('Salvamentos');
const v04 = { schema: 1, name: 'Antigo', city: 'Salvador', season: 3, day: 12, cash: 4200, bank: 800, energy: 55, heat: 33, respect: 77, stats: { astucia: 12, forca: 6, labia: 5, influencia: 9 }, district: 'cais', jail: 0, businesses: ['bar', 'oficina'], gangName: 'Os Antigos', gangLevel: 2, successful: 40, failed: 9, seasonHistory: [{ season: 1, respect: 100, money: 9000, goal: 'capital', goalComplete: true }], log: [{ day: 12, msg: 'oi' }], eventIndex: 1, career: 'articulador', goal: 'dominio', influence: { centro: 30, cais: 22, jardim: 0, industrial: 0, vila: 5 }, rivals: { centro: 20, cais: 50, jardim: 28, industrial: 31, vila: 34 }, newsPending: null, nextBonus: 0, goalWins: 1, crewSize: 5, crewMorale: 61, crewLastRecruit: 11, crewLastRally: 0, factions: { esquina: { relation: 20, tension: 30, truceUntil: 14, lastActionDay: 12 }, docas: { relation: -50, tension: 60, truceUntil: 0, lastActionDay: 0 }, aurora: { relation: 0, tension: 10, truceUntil: 0, lastActionDay: 0 } }, gangStats: { confrontWins: 3, confrontLosses: 1, pacts: 2, dialogs: 4, retaliations: 2, groupWins: 6 } };
t('save da 0.4 migra integralmente', () => { const r = SB.parseSave(JSON.stringify(v04)); ok(r.ok, r.error); const s = r.state; eq(s.schema, 2); eq(s.cash, 4200); eq(s.crew.length, 5); eq(s.presence.cais.docas, 50); eq(s.factions.esquina.truceUntil, 14); eq(s.events[0].id, 'fiscalizacao'); eq(s.seasonHistory[0].goalComplete, true); eq(s.gangStats.groupWins, 6); });
t('save migrado é jogável por uma temporada', () => { const s = SB.parseSave(JSON.stringify(v04)).state; while (s.day < 30) { SB.perform(s, 'mission', 'carga'); SB.perform(s, 'nextDay'); } eq(SB.perform(s, 'endSeason').ok, true); });
t('arquivo de exportação da 0.4 (envelope) é aceito', () => { ok(SB.parseSave(JSON.stringify({ game: 'Submundo Brasil', version: '0.4', save: v04 })).ok); });
t('JSON corrompido é recusado com motivo', () => { const r = SB.parseSave('{"schema":1,'); eq(r.ok, false); ok(r.error.length > 5); });
t('schema desconhecido é recusado', () => { eq(SB.parseSave(JSON.stringify({ ...v04, schema: 99 })).ok, false); });
t('dia fora da faixa é recusado', () => { eq(SB.parseSave(JSON.stringify({ ...v04, day: 31 })).ok, false); });
t('valores extremos são limitados', () => { const r = SB.parseSave(JSON.stringify({ ...v04, cash: 1e30, energy: 9999, heat: -50, jail: 400, stats: { astucia: -3, forca: 'x', labia: 1e15, influencia: 2.7 } })); ok(r.ok); const s = r.state; eq(s.cash, 1e12); eq(s.energy, 100); eq(s.heat, 0); eq(s.jail, 5); eq(s.stats.astucia, 1); eq(s.stats.forca, 4); eq(s.stats.influencia, 3); ok(r.notes.length > 0); });
t('campos com HTML são texto puro (sem chaves extras)', () => { const r = SB.parseSave(JSON.stringify({ ...v04, evil: '<script>', seasonHistory: [{ season: '<img>', money: '1' }] })); ok(r.ok); eq(r.state.evil, undefined); eq(r.state.seasonHistory[0].season, 0); });
t('ida e volta schema 2 é estável', () => { const s = SB.parseSave(JSON.stringify(v04)).state; const a = JSON.stringify(s); eq(JSON.stringify(SB.parseSave(a).state), a); });
t('checksum detecta alteração', () => { const p = SB.exportPayload(fresh()); eq(SB.checksum(JSON.stringify(p.save)), p.checksum); p.save.cash = 999999; ok(SB.checksum(JSON.stringify(p.save)) !== p.checksum); });

console.log(`\n${pass} passaram, ${fail} falharam.`);
process.exit(fail ? 1 : 0);
