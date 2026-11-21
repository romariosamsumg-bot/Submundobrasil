/* Esquina (servidor): verificações sem rede nem banco. Testado em tests/online.test.js.
 * O jogo é 18+ e palavrão faz parte da rua; o que não passa é ódio e preconceito, ameaça de violência sexual,
 * link e número de telefone ou documento (golpe e exposição de gente de verdade). */
export const ESQUINA_ACOES = ['chat', 'denunciar', 'vender', 'cancelar_venda', 'comprar', 'desafiar', 'responder', 'cancelar_desafio'];
export const CHAT = { MAX: 200, POR_MINUTO: 12, INTERVALO_MS: 2500, DENUNCIAS_PARA_OCULTAR: 3 };

const semAcento = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/@/g, 'a').replace(/5/g, 's').replace(/7/g, 't');
// Ofensas de ódio e preconceito (raça, orientação, identidade, deficiência) e violência sexual. Lista curta e conservadora.
const ODIO = /\b(crioul[oa]s?|tiziu|viad(o|a|inho|inha)s?|baitola|boiola|travec[oa]s?|mongoloide|retardad[oa]s?|estupr\w*|nazis\w*|hitler)\b/;

export function limparMensagem(t) {
  const x = String(t == null ? '' : t).replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028\u2029\u202a-\u202e]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!x) return { erro: 'Escreva alguma coisa.' };
  if (x.length > CHAT.MAX) return { erro: `Mensagem longa demais (até ${CHAT.MAX} letras).` };
  if (/(https?:\/\/|www\.|\b[\w-]+\.(com|net|org|br|io|gg|ly|me|app|xyz|site|link)\b)/i.test(x)) return { erro: 'Link não passa na Esquina.' };
  if (/(\d[\s.()-]*){8,}/.test(x)) return { erro: 'Nada de telefone ou documento na Esquina.' };
  if (ODIO.test(semAcento(x).replace(/[^a-z\s]/g, ' '))) return { erro: 'Essa não passa: ódio e preconceito são proibidos na Esquina.' };
  return { texto: x };
}
/** A sala geral ou a da própria cidade (ninguém escreve na sala de outra cidade). */
export function salaValida(sala, cidade) { return sala === 'geral' || (typeof sala === 'string' && sala === cidade); }
export const inteiro = (v, min, max) => Number.isSafeInteger(v) && v >= min && v <= max;
export const codinomeValido = c => typeof c === 'string' && /^[\p{L}\p{N} .'_-]{2,22}$/u.test(c);

/** Confere o formato do pedido antes de qualquer acesso ao banco. Devolve '' se está bem formado. */
export function conferir(p) {
  if (!p || typeof p !== 'object') return 'Pedido inválido.';
  switch (p.acao) {
    case 'chat': return typeof p.sala === 'string' && p.sala.length <= 40 && typeof p.texto === 'string' && p.texto.length <= 600 ? '' : 'Pedido inválido.';
    case 'denunciar': case 'cancelar_venda': case 'comprar': case 'cancelar_desafio': return inteiro(p.id, 1, Number.MAX_SAFE_INTEGER) ? '' : 'Pedido inválido.';
    case 'vender': return typeof p.mercadoria === 'string' && p.mercadoria.length <= 20 && inteiro(p.qtd, 1, 500) && inteiro(p.preco, 1, 1e7) ? '' : 'Pedido inválido.';
    case 'desafiar': return codinomeValido(p.alvo) && inteiro(p.aposta, 1, 1e7) ? '' : 'Pedido inválido.';
    case 'responder': return inteiro(p.id, 1, Number.MAX_SAFE_INTEGER) && typeof p.aceitar === 'boolean' ? '' : 'Pedido inválido.';
    default: return 'Pedido desconhecido.';
  }
}
