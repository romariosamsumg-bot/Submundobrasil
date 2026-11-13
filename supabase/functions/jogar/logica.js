/* Lógica do servidor do jogo (sem rede nem banco): recebe o save atual e o pedido do
 * jogador, aplica as regras do motor (o mesmo engine.js do jogo) e devolve o que gravar.
 * Testado em tests/online.test.js. */
const ARG_MAX = 4;
const limpo = v => typeof v === 'string' ? v.length <= 40 : typeof v === 'number' ? Number.isFinite(v) : typeof v === 'boolean';
const codinomeOk = c => typeof c === 'string' && /^[\p{L}\p{N} .'_-]{2,22}$/u.test(c.trim().replace(/\s+/g, ' '));

export function aplicar(SB, salvo, pedido) {
  const estadoSalvo = salvo ? SB.parseSave(JSON.stringify(salvo)) : null;
  const atual = estadoSalvo && estadoSalvo.ok ? estadoSalvo.state : null;
  const acao = pedido && pedido.acao;
  if (acao === 'estado') return { status: 200, corpo: { estado: atual } };
  if (acao === 'novo') {
    if (atual) return { status: 409, corpo: { erro: 'Você já tem um personagem.' } };
    const codinome = String(pedido.codinome || '').trim().replace(/\s+/g, ' ');
    if (!codinomeOk(codinome)) return { status: 400, corpo: { erro: 'Escolha um codinome entre 2 e 22 caracteres (letras, números e espaço).' } };
    const cidade = SB.CITIES.find(c => c.name === pedido.cidade);
    if (!cidade) return { status: 400, corpo: { erro: 'Cidade desconhecida.' } };
    const estado = SB.defaultState(codinome, cidade.name);
    return { status: 200, corpo: { estado }, salvar: estado, novo: { codinome, cidade: cidade.name } };
  }
  if (acao === 'agir') {
    if (!atual) return { status: 404, corpo: { erro: 'Crie seu personagem primeiro.' } };
    const nome = pedido.nome, args = Array.isArray(pedido.args) ? pedido.args : [];
    if (typeof nome !== 'string' || !Object.prototype.hasOwnProperty.call(SB.act, nome)) return { status: 400, corpo: { erro: 'Ação desconhecida.' } };
    if (args.length > ARG_MAX || !args.every(limpo)) return { status: 400, corpo: { erro: 'Pedido inválido.' } };
    let r;
    try { r = SB.perform(atual, nome, ...args); } catch (e) { return { status: 500, corpo: { erro: 'Erro ao aplicar a ação.' } }; }
    const { state: novoEstado, ...resultado } = r;
    const estado = nome === 'endSeason' && r.ok ? novoEstado : atual;
    return { status: 200, corpo: { resultado, estado }, salvar: r.ok ? estado : null };
  }
  return { status: 400, corpo: { erro: 'Pedido desconhecido.' } };
}
