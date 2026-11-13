/* Lógica do servidor do jogo (sem rede nem banco): recebe o save atual, o pedido do jogador e a
 * hora do servidor; aplica o tempo que passou e as regras do motor (o mesmo engine.js do jogo) e
 * devolve o que gravar. Testado em tests/online.test.js. */
const ARG_MAX = 4, AVISOS_MAX = 14;
const limpo = v => typeof v === 'string' ? v.length <= 40 : typeof v === 'number' ? Number.isFinite(v) : typeof v === 'boolean';
const codinomeOk = c => typeof c === 'string' && /^[\p{L}\p{N} .'_-]{2,22}$/u.test(c);

export function aplicar(SB, salvo, pedido, agora) {
  const lido = salvo ? SB.parseSave(JSON.stringify(salvo)) : null;
  let atual = lido && lido.ok ? lido.state : null, avisos = [];
  if (atual) { // o tempo anda no servidor, antes de qualquer pedido
    if (!atual.clock || atual.clock.t > agora + 864e5) SB.startClock(atual, agora); // sem relógio, ou relógio no futuro (banco adulterado)
    const tk = SB.tick(atual, agora); atual = tk.state; avisos = tk.lines.slice(0, AVISOS_MAX);
  }
  const acao = pedido && pedido.acao;
  const ok = (corpo, salvar, extra) => Object.assign({ status: 200, corpo: Object.assign({ agora, avisos }, corpo), salvar }, extra);
  if (acao === 'estado') return ok({ estado: atual }, atual);
  if (acao === 'novo') {
    if (atual) return { status: 409, corpo: { erro: 'Você já tem um personagem.' }, salvar: atual };
    const codinome = String(pedido.codinome || '').trim().replace(/\s+/g, ' ');
    if (!codinomeOk(codinome)) return { status: 400, corpo: { erro: 'Escolha um codinome entre 2 e 22 caracteres (letras, números e espaço).' } };
    const cidade = SB.CITIES.find(c => c.name === pedido.cidade);
    if (!cidade) return { status: 400, corpo: { erro: 'Cidade desconhecida.' } };
    const estado = SB.startClock(SB.defaultState(codinome, cidade.name), agora);
    return ok({ estado }, estado, { novo: { codinome, cidade: cidade.name } });
  }
  if (acao === 'agir') {
    if (!atual) return { status: 404, corpo: { erro: 'Crie seu personagem primeiro.' } };
    const nome = pedido.nome, args = Array.isArray(pedido.args) ? pedido.args : [];
    if (typeof nome !== 'string' || !Object.prototype.hasOwnProperty.call(SB.act, nome)) return { status: 400, corpo: { erro: 'Ação desconhecida.' }, salvar: atual };
    if (args.length > ARG_MAX || !args.every(limpo)) return { status: 400, corpo: { erro: 'Pedido inválido.' }, salvar: atual };
    let r;
    try { r = SB.perform(atual, nome, ...args); } catch (e) { return { status: 500, corpo: { erro: 'Erro ao aplicar a ação.' } }; }
    const { state: _fora, ...resultado } = r;
    return ok({ resultado, estado: atual }, atual);
  }
  return { status: 400, corpo: { erro: 'Pedido desconhecido.' }, salvar: atual };
}
