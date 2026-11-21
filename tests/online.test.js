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
  console.log('Esquina: verificações do servidor');
  const E = await import(path.join(__dirname, '..', 'supabase', 'functions', 'jogar', 'esquina.js'));
  await t('chat: palavrão passa (jogo 18+); ódio, link, telefone, vazio e texto longo não', () => {
    eq(E.limparMensagem('  caralho,   que   porra de dia  ').texto, 'caralho, que porra de dia');
    for (const x of ['', '   ', 'a'.repeat(201), 'entra em www.golpe.com', 'https://x.io', 'me chama 11 98765-4321', 'cpf 123.456.789-00', 'seu V1AD0', 'cRiOuLo', 'vou estuprar', 'viva hitler'])
      ok(E.limparMensagem(x).erro, 'devia barrar: ' + x);
    ok(E.limparMensagem('deu Macaco no bicho, 3 vezes').texto, 'bicho do jogo não é ofensa');
    ok(E.limparMensagem('linha\u0000com\u202econtrole').texto.indexOf('\u0000') < 0);
  });
  await t('chat: só a sala geral ou a da própria cidade', () => { ok(E.salaValida('geral', 'Recife')); ok(E.salaValida('Recife', 'Recife')); ok(!E.salaValida('Salvador', 'Recife')); ok(!E.salaValida(null, 'Recife')); });
  await t('pedidos da Esquina são conferidos antes de tocar no banco', () => {
    eq(E.conferir({ acao: 'chat', sala: 'geral', texto: 'oi' }), ''); eq(E.conferir({ acao: 'vender', mercadoria: 'erva', qtd: 5, preco: 100 }), ''); eq(E.conferir({ acao: 'desafiar', alvo: 'Zé do Morro', aposta: 200 }), '');
    eq(E.conferir({ acao: 'responder', id: 3, aceitar: true }), '');
    for (const p of [null, {}, { acao: 'x' }, { acao: 'chat', sala: {}, texto: 'oi' }, { acao: 'vender', mercadoria: 'erva', qtd: 0, preco: 1 }, { acao: 'vender', mercadoria: 'erva', qtd: 1.5, preco: 1 },
      { acao: 'comprar', id: -1 }, { acao: 'comprar', id: '1' }, { acao: 'desafiar', alvo: '<b>', aposta: 1 }, { acao: 'desafiar', alvo: 'Zé', aposta: 1e9 }, { acao: 'responder', id: 1, aceitar: 'sim' }])
      ok(E.conferir(p), JSON.stringify(p));
    ok(E.ESQUINA_ACOES.every(a => !Object.prototype.hasOwnProperty.call(SB.act, a)), 'as ações da Esquina não existem no motor do jogador');
  });
  await t('o servidor da Esquina usa as regras do motor (nada de regra só no servidor)', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'jogar', 'index.ts'), 'utf8');
    for (const f of ['SB.pvp.challenge', 'SB.pvp.accept', 'SB.pvp.fight', 'SB.pvp.outcome', 'SB.pvp.settle', 'SB.pvp.list', 'SB.pvp.buy', 'SB.pvp.unlist']) ok(src.includes(f), f);
    { const i = src.indexOf("update({ status: 'vendido'"); ok(i > 0 && src.slice(i, i + 260).includes(".eq('id', p.id).eq('status', 'aberto')"), 'compra por reivindicação atômica'); }
    { const i = src.indexOf("update({ status: 'aceito'"); ok(i > 0 && src.slice(i, i + 160).includes(".eq('status', 'aberto')"), 'aceite por reivindicação atômica'); }
  });
  console.log(`\n${pass} passaram, ${fail} falharam.`); process.exit(fail ? 1 : 0);
})();
