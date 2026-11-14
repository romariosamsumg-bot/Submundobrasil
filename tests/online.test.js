/* Testes da lógica do servidor online (supabase/functions/jogar/logica.js), sem rede. Uso: node tests/online.test.js */
'use strict';
const path = require('path'), fs = require('fs');
const SB = require('./load-engine.js')();
let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log('  ok  ' + n); } catch (e) { fail++; console.log('  FALHA ' + n + '\n        ' + e.message); } };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ''} esperado ${JSON.stringify(b)}, obtido ${JSON.stringify(a)}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'condição falsa'); };
(async () => {
  const { aplicar } = await import(path.join(__dirname, '..', 'supabase', 'functions', 'jogar', 'logica.js'));
  console.log('Servidor online: lógica');
  await t('o servidor usa o mesmo motor do jogo', () => { eq(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'jogar', 'engine.js'), 'utf8'), fs.readFileSync(path.join(__dirname, '..', 'src', 'engine.js'), 'utf8')); });
  const T0 = Date.UTC(2026, 10, 13, 15, 0, 0), MIN = 60000, H = 3600000; // 13/11/2026, 12:00 em Brasília
  const novo = () => aplicar(SB, null, { acao: 'novo', codinome: 'Teste', cidade: 'Recife' }, T0).salvar;
  await t('sem save: estado vazio; criar personagem valida codinome e cidade e liga o relógio', () => {
    eq(aplicar(SB, null, { acao: 'estado' }, T0).corpo.estado, null);
    eq(aplicar(SB, null, { acao: 'novo', codinome: 'x', cidade: 'Recife' }, T0).status, 400);
    eq(aplicar(SB, null, { acao: 'novo', codinome: '<img onerror>', cidade: 'Recife' }, T0).status, 400);
    eq(aplicar(SB, null, { acao: 'novo', codinome: 'Zé do Morro', cidade: 'Atlântida' }, T0).status, 400);
    const r = aplicar(SB, null, { acao: 'novo', codinome: '  Zé   do Morro ', cidade: 'Recife' }, T0);
    eq(r.status, 200); eq(r.novo.codinome, 'Zé do Morro'); eq(r.salvar.cash, 0); eq(r.salvar.city, 'Recife'); eq(r.salvar.day, 13); eq(r.salvar.clock.month, '2026-11'); eq(r.corpo.agora, T0);
  });
  await t('com personagem: não cria outro; agir aplica a regra e grava', () => {
    const e = novo();
    eq(aplicar(SB, e, { acao: 'novo', codinome: 'Outro', cidade: 'Recife' }, T0).status, 409);
    const r = aplicar(SB, e, { acao: 'agir', nome: 'mission', args: ['correria'] }, T0 + 1000);
    eq(r.status, 200); ok(r.corpo.resultado.ok); ok(r.salvar && r.salvar.energy < 100); eq(r.corpo.estado, r.salvar);
  });
  await t('o tempo anda no servidor: energia volta, e o pedido não escolhe a hora', () => {
    const e = novo(); e.energy = 10;
    const r = aplicar(SB, e, { acao: 'estado', agora: T0 + 99 * H }, T0 + 30 * MIN); eq(r.salvar.energy, 20); eq(r.salvar.clock.t, T0 + 30 * MIN);
    const v = aplicar(SB, r.salvar, { acao: 'agir', nome: 'nextDay', args: [25] }, T0 + 31 * MIN); eq(v.corpo.resultado.ok, false); eq(v.salvar.day, 13);
    const f = aplicar(SB, r.salvar, { acao: 'agir', nome: 'endSeason', args: [true] }, T0 + 31 * MIN); eq(f.corpo.resultado.ok, false); eq(f.salvar.season, 1);
  });
  await t('virada do dia e do mês acontecem sozinhas, com avisos', () => {
    const e = novo();
    const d = aplicar(SB, e, { acao: 'estado' }, T0 + 13 * H); eq(d.salvar.day, 14); ok(d.corpo.avisos.some(l => l.includes('Virou o dia 14')));
    const m = aplicar(SB, d.salvar, { acao: 'estado' }, Date.UTC(2026, 11, 1, 3, 0, 5)); eq(m.salvar.season, 2); eq(m.salvar.clock.month, '2026-12'); ok(m.corpo.avisos.length <= 14);
  });
  await t('save antigo sem relógio ganha relógio ao entrar', () => { const e = SB.defaultState('Antigo', 'Recife'); const r = aplicar(SB, e, { acao: 'estado' }, T0); eq(r.salvar.clock.day, '2026-11-13'); eq(r.salvar.day, 13); });
  await t('ação recusada não muda o jogo; ação ou argumento estranho é barrado', () => {
    const e = novo(), antes = JSON.stringify(e);
    const r = aplicar(SB, e, { acao: 'agir', nome: 'mission', args: ['cofre'] }, T0); eq(r.corpo.resultado.ok, false); eq(JSON.stringify(r.salvar), antes);
    for (const p of [{ nome: 'perform' }, { nome: '__proto__' }, { nome: 'constructor' }, { nome: 'mission', args: [{ x: 1 }] }, { nome: 'bank', args: ['deposit', Infinity] }, { nome: 'mission', args: [1, 2, 3, 4, 5] }, { nome: 'mission', args: ['x'.repeat(41)] }])
      eq(aplicar(SB, e, Object.assign({ acao: 'agir' }, p), T0).status, 400, JSON.stringify(p).slice(0, 40));
    eq(aplicar(SB, null, { acao: 'agir', nome: 'mission', args: ['correria'] }, T0).status, 404);
    eq(aplicar(SB, e, { acao: 'hackear' }, T0).status, 400); eq(aplicar(SB, e, null, T0).status, 400);
  });
  await t('save adulterado no banco é normalizado antes de jogar', () => {
    const e = novo(); e.cash = 1e15; e.respect = -5; e.clock.t = 1e30;
    const st = aplicar(SB, e, { acao: 'estado' }, T0).corpo.estado; ok(st.cash <= 1e12, String(st.cash)); ok(st.respect >= 0); ok(st.clock.t <= 1e14);
  });
  await t('criar com a ficha completa: retrato e classe já saem salvos; ficha inválida é recusada', () => {
    const r = aplicar(SB, null, { acao: 'novo', codinome: 'Zé', cidade: 'Recife', avatar: 'coroa', classe: 'barao' }, T0);
    eq(r.status, 200); eq(r.salvar.avatar, 'coroa'); eq(r.salvar.career, 'barao');
    eq(aplicar(SB, null, { acao: 'novo', codinome: 'Zé', cidade: 'Recife', avatar: 'x', classe: 'barao' }, T0).status, 400);
    eq(aplicar(SB, null, { acao: 'novo', codinome: 'Zé', cidade: 'Recife', avatar: { a: 1 }, classe: 'barao' }, T0).status, 400);
  });
  await t('trocar o vulgo na temporada nova pede renomear no banco', () => {
    const e = novo(); const r = aplicar(SB, e, { acao: 'agir', nome: 'setup', args: ['malandro', 'Novo Vulgo', 'operador'] }, T0);
    eq(r.corpo.resultado.ok, true); eq(r.renomear, 'Novo Vulgo');
    const r2 = aplicar(SB, r.salvar, { acao: 'agir', nome: 'mission', args: ['correria'] }, T0 + 1000); eq(r2.renomear, undefined);
  });
  console.log(`\n${pass} passaram, ${fail} falharam.`); process.exit(fail ? 1 : 0);
})();
