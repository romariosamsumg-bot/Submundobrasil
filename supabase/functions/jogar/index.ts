// Servidor do jogo (Supabase Edge Function). As regras rodam aqui, não no aparelho:
// o jogador manda a ação, o servidor aplica com o mesmo motor do jogo e grava o resultado.
// Esquina (chat, desafios e mercado entre jogadores): as regras ficam no motor (SB.pvp); aqui só se guarda
// a oferta ou o desafio e se entrega a cada lado o que é dele, sempre por "reivindicação" atômica
// (update ... where status = 'aberto'), para ninguém comprar a mesma oferta ou aceitar o mesmo desafio duas vezes.
import './engine.js';
import { aplicar } from './logica.js';
import { ESQUINA_ACOES, CHAT, limparMensagem, salaValida, conferir } from './esquina.js';
import { createClient } from 'npm:@supabase/supabase-js@2';

// deno-lint-ignore no-explicit-any
const SB = (globalThis as any).SB;
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const DIA = 864e5, BRT = 3 * 36e5;
const inicioDoDia = (agora: number) => new Date(Math.floor((agora - BRT) / DIA) * DIA + BRT).toISOString(); // meia-noite de Brasília
const sorteio = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

// deno-lint-ignore no-explicit-any
type Db = any;

/** Entrega ao jogador o que outros jogadores deixaram para ele: venda paga, resultado de desafio, aposta devolvida. */
// deno-lint-ignore no-explicit-any
async function entregar(db: Db, uid: string, estado: any, agora: number): Promise<string[]> {
  const avisos: string[] = [];
  // desafios dele que ninguém respondeu em 24 h: a aposta volta
  const limite = new Date(agora - SB.PVP.EXPIRE_H * 36e5).toISOString();
  const { data: velhos } = await db.from('desafios').select('id, aposta').eq('desafiante', uid).eq('status', 'aberto').lt('criado_em', limite);
  for (const d of velhos || []) await db.from('desafios').update({ status: 'expirado', resolvido_em: new Date(agora).toISOString(), efeito_a: { kind: 'devolve', cash: d.aposta, why: 'ninguém respondeu em 24 horas' }, entregue_a: false }).eq('id', d.id).eq('status', 'aberto');
  const { data: pend } = await db.from('desafios').update({ entregue_a: true }).eq('desafiante', uid).eq('entregue_a', false).select('id, efeito_a');
  for (const d of pend || []) { const m = SB.pvp.settle(estado, d.efeito_a); if (m) avisos.push(m); }
  const { data: vendas } = await db.from('mercado').update({ pago: true }).eq('vendedor', uid).eq('status', 'vendido').eq('pago', false).select('id, mercadoria, qtd, preco, comprador_nome');
  for (const v of vendas || []) { const m = SB.pvp.settle(estado, SB.pvp.saleCredit({ good: v.mercadoria, qty: v.qtd, price: v.preco, buyer: v.comprador_nome })); if (m) avisos.push(m); }
  return avisos;
}

/** Ações da Esquina. Devolvem { status, corpo, salvar? } como a lógica do jogo. */
// deno-lint-ignore no-explicit-any
async function esquina(db: Db, uid: string, estado: any, p: any, agora: number) {
  const erro = (msg: string, status = 400) => ({ status, corpo: { resultado: { ok: false, good: false, msg } } });
  const certo = (msg: string, extra = {}) => ({ status: 200, corpo: { resultado: { ok: true, good: true, msg, ...extra } }, salvar: estado });
  const fora = conferir(p); if (fora) return erro(fora);
  const nome = estado.name, cidade = estado.city;

  if (p.acao === 'chat') {
    if (!salaValida(p.sala, cidade)) return erro('Você só fala na sala geral ou na da sua cidade.');
    const m = limparMensagem(p.texto); if (m.erro) return erro(m.erro);
    const { data: ult } = await db.from('mensagens').select('criado_em').eq('jogador', uid).gte('criado_em', new Date(agora - 60000).toISOString()).order('criado_em', { ascending: false });
    if ((ult || []).length >= CHAT.POR_MINUTO) return erro('Calma: muitas mensagens em um minuto.');
    if (ult && ult[0] && agora - Date.parse(ult[0].criado_em) < CHAT.INTERVALO_MS) return erro('Calma: espere um pouco entre uma mensagem e outra.');
    const { error } = await db.from('mensagens').insert({ sala: p.sala, jogador: uid, codinome: nome, texto: m.texto });
    if (error) return erro('Não foi possível enviar.', 500);
    return { status: 200, corpo: { resultado: { ok: true, good: true, msg: '' } } };
  }
  if (p.acao === 'denunciar') {
    const { data: msg } = await db.from('mensagens').select('id, jogador').eq('id', p.id).maybeSingle();
    if (!msg) return erro('Mensagem não encontrada.', 404);
    if (msg.jogador === uid) return erro('Não dá para denunciar a própria mensagem.');
    await db.from('denuncias').upsert({ mensagem: p.id, jogador: uid }, { onConflict: 'mensagem,jogador', ignoreDuplicates: true });
    const { count } = await db.from('denuncias').select('mensagem', { count: 'exact', head: true }).eq('mensagem', p.id);
    if ((count || 0) >= CHAT.DENUNCIAS_PARA_OCULTAR) await db.from('mensagens').update({ oculta: true }).eq('id', p.id);
    return { status: 200, corpo: { resultado: { ok: true, good: true, msg: 'Denúncia registrada. Com mais denúncias, a mensagem some.' } } };
  }
  if (p.acao === 'vender') {
    const { count } = await db.from('mercado').select('id', { count: 'exact', head: true }).eq('vendedor', uid).eq('status', 'aberto');
    if ((count || 0) >= SB.PVP.LISTINGS) return erro(`Você já tem ${SB.PVP.LISTINGS} ofertas na banca. Venda ou recolha uma antes.`);
    const r = SB.pvp.list(estado, p.mercadoria, p.qtd, p.preco); if (!r.ok) return erro(r.msg);
    const { error } = await db.from('mercado').insert({ vendedor: uid, vendedor_nome: nome, cidade, mercadoria: r.good, qtd: r.qty, preco: r.price });
    if (error) return erro('Não foi possível pôr na banca.', 500); // sem gravar o save: a mercadoria fica com você
    return certo(r.msg);
  }
  if (p.acao === 'cancelar_venda') {
    const { data } = await db.from('mercado').update({ status: 'cancelado' }).eq('id', p.id).eq('vendedor', uid).eq('status', 'aberto').select('mercadoria, qtd');
    if (!data || !data.length) return erro('Essa oferta já foi vendida ou recolhida.', 409);
    const r = SB.pvp.unlist(estado, { good: data[0].mercadoria, qty: data[0].qtd });
    return certo(r.msg);
  }
  if (p.acao === 'comprar') {
    const { data: l } = await db.from('mercado').select('id, vendedor, vendedor_nome, mercadoria, qtd, preco').eq('id', p.id).eq('status', 'aberto').maybeSingle();
    if (!l) return erro('Essa oferta já saiu da banca.', 409);
    if (l.vendedor === uid) return erro('Essa oferta é sua.');
    const oferta = { good: l.mercadoria, qty: l.qtd, price: l.preco, seller: l.vendedor_nome };
    const b = SB.pvp.buyBlock(estado, oferta); if (b) return erro(b);
    const { data: pego } = await db.from('mercado').update({ status: 'vendido', comprador: uid, comprador_nome: nome, vendido_em: new Date(agora).toISOString() }).eq('id', p.id).eq('status', 'aberto').select('id');
    if (!pego || !pego.length) return erro('Alguém comprou antes de você.', 409);
    const r = SB.pvp.buy(estado, oferta);
    return certo(r.msg);
  }
  if (p.acao === 'desafiar') {
    const { data: alvo } = await db.from('jogadores').select('id, codinome').eq('codinome', p.alvo).maybeSingle();
    if (!alvo) return erro('Ninguém com esse vulgo na cidade.', 404);
    if (alvo.id === uid) return erro('Desafiar a si mesmo não vale.');
    const hoje = inicioDoDia(agora);
    const { count: meus } = await db.from('desafios').select('id', { count: 'exact', head: true }).eq('desafiante', uid).gte('criado_em', hoje);
    if ((meus || 0) >= SB.PVP.DAILY) return erro(`Você já lançou ${SB.PVP.DAILY} desafios hoje.`);
    const { count: par } = await db.from('desafios').select('id', { count: 'exact', head: true }).gte('criado_em', hoje).neq('status', 'cancelado')
      .or(`and(desafiante.eq.${uid},alvo.eq.${alvo.id}),and(desafiante.eq.${alvo.id},alvo.eq.${uid})`);
    if ((par || 0) >= 1) return erro('Um desafio por dia contra o mesmo rival.');
    const { count: fila } = await db.from('desafios').select('id', { count: 'exact', head: true }).eq('alvo', alvo.id).eq('status', 'aberto');
    if ((fila || 0) >= 5) return erro(`${alvo.codinome} já tem desafios demais esperando resposta.`);
    const r = SB.pvp.challenge(estado, p.aposta, alvo.codinome); if (!r.ok) return erro(r.msg);
    const { error } = await db.from('desafios').insert({ desafiante: uid, desafiante_nome: nome, alvo: alvo.id, alvo_nome: alvo.codinome, aposta: p.aposta, poder_a: r.power, respeito_a: r.respect });
    if (error) return erro('Não foi possível lançar o desafio.', 500);
    return certo(r.msg);
  }
  if (p.acao === 'cancelar_desafio') {
    const { data } = await db.from('desafios').update({ status: 'cancelado', resolvido_em: new Date(agora).toISOString() }).eq('id', p.id).eq('desafiante', uid).eq('status', 'aberto').select('aposta');
    if (!data || !data.length) return erro('Esse desafio já foi respondido.', 409);
    SB.pvp.settle(estado, { kind: 'devolve', cash: data[0].aposta, why: 'você cancelou o desafio' });
    return certo('Desafio cancelado: a aposta voltou.');
  }
  if (p.acao === 'responder') {
    const { data: d } = await db.from('desafios').select('*').eq('id', p.id).eq('alvo', uid).eq('status', 'aberto').maybeSingle();
    if (!d) return erro('Esse desafio não está mais de pé.', 409);
    const quando = new Date(agora).toISOString();
    if (agora - Date.parse(d.criado_em) > SB.PVP.EXPIRE_H * 36e5) {
      await db.from('desafios').update({ status: 'expirado', resolvido_em: quando, efeito_a: { kind: 'devolve', cash: d.aposta, why: 'ninguém respondeu em 24 horas' }, entregue_a: false }).eq('id', d.id).eq('status', 'aberto');
      return erro('Esse desafio venceu (mais de 24 horas).', 409);
    }
    if (!p.aceitar) {
      const { data: ok } = await db.from('desafios').update({ status: 'recusado', resolvido_em: quando, efeito_a: { kind: 'devolve', cash: d.aposta, why: `${nome} recusou o desafio` }, entregue_a: false }).eq('id', d.id).eq('status', 'aberto').select('id');
      if (!ok || !ok.length) return erro('Esse desafio não está mais de pé.', 409);
      return certo('Desafio recusado. Ninguém perdeu nada.');
    }
    const b = SB.pvp.acceptBlock(estado, d.aposta); if (b) return erro(b);
    const { data: pego } = await db.from('desafios').update({ status: 'aceito', resolvido_em: quando }).eq('id', d.id).eq('status', 'aberto').select('id');
    if (!pego || !pego.length) return erro('Esse desafio não está mais de pé.', 409);
    const eu = SB.pvp.accept(estado, d.aposta, d.desafiante_nome);
    const briga = SB.pvp.fight({ power: d.poder_a }, { power: eu.power }, sorteio());
    const res = briga.aWins ? SB.pvp.outcome(d.aposta, { respect: d.respeito_a }, { respect: eu.respect }) : SB.pvp.outcome(d.aposta, { respect: eu.respect }, { respect: d.respeito_a });
    const efeitoA = Object.assign({}, briga.aWins ? res.win : res.lose, { rival: nome });
    const efeitoB = Object.assign({}, briga.aWins ? res.lose : res.win, { rival: d.desafiante_nome });
    await db.from('desafios').update({ chance: 100 - briga.odds, venceu: briga.aWins ? 'desafiante' : 'alvo', efeito_a: efeitoA, entregue_a: false }).eq('id', d.id);
    const msg = SB.pvp.settle(estado, efeitoB);
    return certo(msg, { venceu: !briga.aWins, chance: 100 - briga.odds });
  }
  return erro('Pedido desconhecido.');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { erro: 'Use POST.' });
  try {
    const url = Deno.env.get('SUPABASE_URL')!, anon = Deno.env.get('SUPABASE_ANON_KEY')!, service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const quem = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data: { user } } = await quem.auth.getUser();
    if (!user) return json(401, { erro: 'Entre na sua conta.' });
    const pedido = await req.json().catch(() => null);
    const db = createClient(url, service, { auth: { persistSession: false } });
    const { data: linha } = await db.from('saves').select('estado, mes, respeito').eq('jogador', user.id).maybeSingle();
    const agora = Date.now();
    let estadoBase = linha ? linha.estado : null, extras: string[] = [];
    // Com personagem: o tempo anda e chega o que os outros jogadores deixaram (antes de qualquer pedido).
    if (estadoBase) {
      const base = aplicar(SB, estadoBase, { acao: 'estado' }, agora);
      if (base.salvar) {
        extras = base.corpo.avisos || [];
        const entregues = await entregar(db, user.id, base.salvar, agora);
        estadoBase = base.salvar; extras = extras.concat(entregues);
      }
    }
    let saida;
    if (estadoBase && pedido && ESQUINA_ACOES.includes(pedido.acao)) {
      // Trabalha numa cópia: se a ação falhar no meio (banco recusou), o save fica como estava (só com o que foi entregue).
      const trabalho = structuredClone(estadoBase);
      const e = await esquina(db, user.id, trabalho, pedido, agora);
      const final = e.salvar ? trabalho : estadoBase;
      saida = { status: e.status, corpo: Object.assign({ agora, avisos: extras, estado: final }, e.corpo), salvar: final };
    } else {
      saida = aplicar(SB, estadoBase, pedido, agora);
      if (saida.corpo && extras.length) saida.corpo.avisos = extras.concat(saida.corpo.avisos || []).slice(0, 20);
      if (!saida.salvar && estadoBase) saida.salvar = estadoBase; // o que foi entregue não se perde
    }
    if (saida.novo) {
      const { error } = await db.from('jogadores').upsert({ id: user.id, codinome: saida.novo.codinome, cidade: saida.novo.cidade }, { onConflict: 'id' });
      if (error) return json(409, { erro: error.code === '23505' ? 'Esse codinome já está em uso. Escolha outro.' : 'Não foi possível criar o personagem.' });
    }
    if (saida.renomear) { // vulgo novo na temporada nova: precisa ser único
      const { error } = await db.from('jogadores').update({ codinome: saida.renomear }).eq('id', user.id);
      if (error) return json(409, { erro: error.code === '23505' ? 'Esse vulgo já está em uso. Escolha outro.' : 'Não foi possível trocar o vulgo.' });
    }
    if (saida.salvar) {
      const e = saida.salvar;
      // Virou o mês: guarda o respeito final do mês que acabou (Galeria da fama).
      const mesNovo = e.clock ? e.clock.month : null;
      if (linha && linha.mes && mesNovo && linha.mes !== mesNovo) {
        const v = linha.estado || {};
        await db.from('historico').upsert({ jogador: user.id, mes: linha.mes, respeito: linha.respeito, codinome: String(v.name || '').slice(0, 22) || 'Sem vulgo', cidade: String(v.city || ''), classe: v.career || null, avatar: v.avatar || null }, { onConflict: 'jogador,mes', ignoreDuplicates: true });
      }
      const { error } = await db.from('saves').upsert({ jogador: user.id, estado: e, temporada: e.season, dia: e.day, mes: e.clock ? e.clock.month : null, respeito: e.respect, patrimonio: SB.patrimony(e), atualizado_em: new Date().toISOString() }, { onConflict: 'jogador' });
      if (error) return json(500, { erro: 'Não foi possível salvar no servidor.' });
    }
    return json(saida.status, saida.corpo);
  } catch (_e) {
    return json(500, { erro: 'Erro no servidor do jogo.' });
  }
});
