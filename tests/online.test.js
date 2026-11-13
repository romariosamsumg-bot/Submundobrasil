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
  await t('sem save: estado vazio; criar personagem valida codinome e cidade', () => {
    eq(aplicar(SB, null, { acao: 'estado' }).corpo.estado, null);
    eq(aplicar(SB, null, { acao: 'novo', codinome: 'x', cidade: 'Recife' }).status, 400);
    eq(aplicar(SB, null, { acao: 'novo', codinome: '<img onerror>', cidade: 'Recife' }).status, 400);
    eq(aplicar(SB, null, { acao: 'novo', codinome: 'Zé do Morro', cidade: 'Atlântida' }).status, 400);
    const r = aplicar(SB, null, { acao: 'novo', codinome: '  Zé   do Morro ', cidade: 'Recife' });
    eq(r.status, 200); eq(r.novo.codinome, 'Zé do Morro'); eq(r.salvar.cash, 0); eq(r.salvar.city, 'Recife');
  });
  await t('com personagem: não cria outro; agir aplica a regra e grava', () => {
    const e = aplicar(SB, null, { acao: 'novo', codinome: 'Teste', cidade: 'Recife' }).salvar;
    eq(aplicar(SB, e, { acao: 'novo', codinome: 'Outro', cidade: 'Recife' }).status, 409);
    const r = aplicar(SB, e, { acao: 'agir', nome: 'mission', args: ['correria'] });
    eq(r.status, 200); ok(r.corpo.resultado.ok); ok(r.salvar && r.salvar.energy < 100); eq(r.corpo.estado, r.salvar);
  });
  await t('ação recusada não grava nada; ação ou argumento estranho é barrado', () => {
    const e = aplicar(SB, null, { acao: 'novo', codinome: 'Teste', cidade: 'Recife' }).salvar;
    const r = aplicar(SB, e, { acao: 'agir', nome: 'mission', args: ['cofre'] }); eq(r.corpo.resultado.ok, false); eq(r.salvar, null);
    for (const p of [{ nome: 'perform' }, { nome: '__proto__' }, { nome: 'constructor' }, { nome: 'mission', args: [{ x: 1 }] }, { nome: 'bank', args: ['deposit', Infinity] }, { nome: 'mission', args: [1, 2, 3, 4, 5] }, { nome: 'mission', args: ['x'.repeat(41)] }])
      eq(aplicar(SB, e, Object.assign({ acao: 'agir' }, p)).status, 400, JSON.stringify(p).slice(0, 40));
    eq(aplicar(SB, null, { acao: 'agir', nome: 'mission', args: ['correria'] }).status, 404);
    eq(aplicar(SB, e, { acao: 'hackear' }).status, 400); eq(aplicar(SB, e, null).status, 400);
  });
  await t('save adulterado no banco é normalizado antes de jogar', () => {
    const e = aplicar(SB, null, { acao: 'novo', codinome: 'Teste', cidade: 'Recife' }).salvar;
    e.cash = 1e15; e.respect = -5; e.name = '<b>x</b>';
    const st = aplicar(SB, e, { acao: 'estado' }).corpo.estado; ok(st.cash <= 1e12, String(st.cash)); ok(st.respect >= 0); ok(typeof st.name === 'string' && st.name.length <= 22);
  });
  await t('fim de temporada troca o estado pelo da nova temporada', () => {
    const e = aplicar(SB, null, { acao: 'novo', codinome: 'Teste', cidade: 'Recife' }).salvar; e.day = 30;
    const r = aplicar(SB, e, { acao: 'agir', nome: 'endSeason' }); eq(r.salvar.season, 2); eq(r.salvar.day, 1); eq(r.corpo.resultado.state, undefined);
  });
  console.log(`\n${pass} passaram, ${fail} falharam.`); process.exit(fail ? 1 : 0);
})();
