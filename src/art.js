/* =====================================================================
 * SUBMUNDO BRASIL — ARTE v1.1
 * Ilustrações em SVG (geradas em código, sem arquivos externos) para os
 * lugares da Cidade, os adversários de duelo e os assaltos do bando.
 *
 * Imagens pintadas: se o build encontrar arquivos em art/ (ex.: art/place-galpao.webp),
 * eles entram em window.SB_ART e substituem o SVG da mesma chave.
 * Chaves: place-<id>, rival-<id>, heist-<id>. Ver PROMPTS_ARTE.md.
 * ===================================================================== */
(function (root) {
  'use strict';
  const INK = '#0a0f12', FAR = '#1d2c33', MID = '#26363d', AMBER = '#f0c06e', WARM = '#c9873f', RED = '#c9503a', BLUE = '#3f6fd0', CREAM = '#e7d9b8';
  const R = (x, y, w, h, f, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}" ${extra}/>`;
  const C = (x, y, r, f, extra = '') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" ${extra}/>`;
  const P = (d, f, extra = '') => `<path d="${d}" fill="${f}" ${extra}/>`;
  const L = (d, c, w = 1.5, extra = '') => `<path d="${d}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round" ${extra}/>`;
  /** Janelas acesas com padrão fixo (não pisca entre renderizações). */
  function wins(x, y, cols, rows, seed, dx = 6, dy = 8) {
    let o = '';
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { seed = (seed * 31 + 7) % 97; if (seed % 3 === 0) o += R(x + c * dx, y + r * dy, 2.5, 3.5, seed % 2 ? AMBER : WARM); }
    return o;
  }
  const sky = (id, a, b) => `<defs><linearGradient id="g-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>${R(0, 0, 160, 100, `url(#g-${id})`)}`;
  const svg = (vb, body, cls = 'art') => `<svg class="${cls}" viewBox="${vb}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${body}</svg>`;
  const ground = (y = 92) => R(0, y, 160, 100 - y, '#05080a');

  /* ---------------- Lugares da Cidade (160×100) ---------------- */
  const PLACES = {
    cidade: () => sky('cidade', '#24364a', '#a0603c') + C(128, 24, 9, '#f3d9a4', 'opacity=".85"') +
      [[0, 46, 22], [20, 34, 18], [40, 52, 20], [62, 28, 16], [80, 44, 22], [104, 38, 18], [124, 50, 36]].map(([x, y, w]) => R(x, y, w, 100 - y, FAR)).join('') +
      [[4, 58, 24], [30, 50, 20], [52, 62, 26], [80, 54, 22], [104, 60, 24], [130, 56, 30]].map(([x, y, w], i) => R(x, y, w, 100 - y, INK) + wins(x + 3, y + 5, Math.floor((w - 4) / 6), 4, i * 11 + 3)).join('') +
      R(70, 66, 30, 14, '#2563b8', 'stroke="#f4f1e8" stroke-width="1.5" rx="1.5"') + R(74, 70, 22, 2, CREAM) + R(74, 74, 14, 2, CREAM) + R(84, 80, 2, 12, INK) + ground(),
    galpao: () => sky('galpao', '#2c2f36', '#5a4636') +
      P('M14 92V44l66-22 66 22v48z', INK) + P('M14 44l66-22 66 22', 'none', `stroke="${MID}" stroke-width="2"`) +
      R(48, 56, 64, 36, '#151b1f') + [0, 1, 2, 3, 4, 5].map(i => R(48, 56 + i * 4, 64, 1.2, '#2a3439')).join('') + R(48, 80, 64, 12, '#3a2c1c') +
      R(54, 82, 12, 10, '#7a5a34') + R(68, 84, 10, 8, '#8a6a40') + R(80, 80, 14, 12, '#6e4f2c') + R(96, 85, 10, 7, '#7a5a34') +
      L('M80 34v10', '#55606a', 1) + P('M74 44h12l-2 4h-8z', '#55606a') + `<path d="M76 48h8l10 44H66z" fill="${AMBER}" opacity=".16"/>` +
      R(120, 76, 18, 10, '#c79a3d') + R(136, 66, 2, 20, '#c79a3d') + C(124, 88, 3, INK) + C(134, 88, 3, INK) + ground(),
    feira: () => sky('feira', '#1f2d3a', '#7a4a34') +
      R(8, 30, 70, 62, FAR) + R(96, 36, 58, 56, FAR) +
      L('M0 22q80 16 160 2', INK, 1) + [12, 30, 48, 66, 84, 102, 120, 138, 152].map((x, i) => C(x, 24 + Math.sin(i / 1.6) * 3 + (i > 4 ? -2 : 3), 2.2, i % 2 ? AMBER : CREAM)).join('') +
      P('M18 50h124l8 12H10z', RED) + [0, 1, 2, 3, 4, 5, 6].map(i => P(`M${22 + i * 18} 50h9l2 12h-13z`, CREAM)).join('') +
      R(18, 62, 124, 30, '#3a2c1c') + R(18, 62, 124, 4, '#2a1e12') +
      L('M28 72l10-6M44 74l14-4M64 70v10M72 70v10M86 72l12 0M104 70l8 8M120 72l12-2', '#9aa6a8', 2) + R(30, 80, 100, 2, '#2a1e12') +
      P('M150 92v-20l-6-4h-6v24', INK) + C(146, 64, 4, INK) + ground(),
    noite: () => sky('noite', '#120f22', '#3a2640') + C(132, 18, 7, '#f3d9a4', 'opacity=".9"') + C(129, 16, 6, '#120f22') +
      [[0, 40, 40], [36, 52, 30], [64, 34, 34], [96, 48, 28], [122, 38, 38]].map(([x, y, w], i) => R(x, y, w, 100 - y, INK) + wins(x + 4, y + 6, Math.floor((w - 6) / 6), 5, i * 9 + 2)).join('') +
      L('M40 50q30 12 60 0', '#0a0f12', 1) + [44, 52, 60, 68, 76, 84, 92].map((x, i) => C(x, 52 + Math.sin(i / 1.4) * 2 + 2, 1.8, [AMBER, RED, '#7fc8a4', '#5c8fd6'][i % 4])).join('') +
      R(52, 68, 12, 18, '#151b1f') + R(54, 71, 8, 8, '#1c2428') + C(58, 75, 3, '#0b0f12') + R(96, 68, 12, 18, '#151b1f') + C(102, 75, 3, '#0b0f12') +
      [70, 76, 82, 88].map((x, i) => P(`M${x} 92v-${10 + (i % 2) * 3}c0-3 4-3 4 0v${10 + (i % 2) * 3}z`, '#05080a') + C(x + 2, 76 - (i % 2) * 3, 2.4, '#05080a')).join('') +
      `<path d="M58 66l-14 26h28z" fill="${AMBER}" opacity=".08"/><path d="M102 66l-14 26h28z" fill="#c9503a" opacity=".1"/>` + ground(),
    duelos: () => sky('duelos', '#1a2228', '#3a2a22') +
      R(0, 18, 46, 82, INK) + R(114, 12, 46, 88, INK) + wins(6, 26, 6, 6, 5) + wins(118, 20, 6, 7, 17) +
      R(78, 26, 3, 66, '#151b1f') + P('M72 26h16l-3 4h-10z', '#151b1f') + `<path d="M74 30h12l22 62H52z" fill="${AMBER}" opacity=".18"/>` +
      P('M58 92v-18c0-6 3-9 7-9s7 3 7 9v18z', INK) + C(65, 60, 5, INK) + P('M60 70l-6 8', 'none', `stroke="${INK}" stroke-width="3" stroke-linecap="round"`) +
      P('M90 92v-20c0-6 3-9 8-9s8 3 8 9v20z', INK) + C(98, 57, 5.5, INK) + P('M106 70l7 6', 'none', `stroke="${INK}" stroke-width="3.2" stroke-linecap="round"`) + R(93, 52, 11, 2, INK) +
      R(66, 88, 30, 4, '#0b0f12', 'opacity=".6"') + ground(),
    hospital: () => sky('hospital', '#22303c', '#5c6a72') +
      R(20, 34, 120, 58, '#d8d4c8') + R(20, 34, 120, 8, '#b8b3a6') + [0, 1, 2, 3, 4, 5].map(i => R(28 + i * 18, 48, 10, 8, '#7fa6bd')).join('') + [0, 1, 2, 3, 4, 5].map(i => R(28 + i * 18, 62, 10, 8, '#7fa6bd')).join('') +
      R(64, 74, 32, 18, '#5c7f8f') + R(70, 26, 20, 10, '#f4f1e8', 'stroke="#c9503a" stroke-width="1"') + R(78, 27, 4, 8, RED) + R(76, 29, 8, 4, RED) +
      R(104, 76, 40, 14, '#f4f1e8') + R(130, 72, 14, 10, '#f4f1e8') + R(108, 80, 14, 3, RED) + C(112, 91, 3.5, INK) + C(136, 91, 3.5, INK) + R(136, 70, 4, 2, '#5c8fd6') + ground(),
    gestao: () => sky('gestao', '#1d2c3a', '#4a5a50') +
      P('M20 40L80 18l60 22z', '#c9c2b0') + R(22, 40, 116, 6, '#b8b1a0') + [0, 1, 2, 3, 4].map(i => R(30 + i * 22, 46, 8, 38, '#d8d1bf')).join('') +
      R(18, 84, 124, 8, '#a8a190') + R(72, 58, 16, 26, '#3a3226') + C(80, 30, 4, AMBER) +
      R(146, 60, 12, 24, '#4a5a60') + R(148, 64, 8, 6, '#7fc8a4', 'opacity=".8"') + ground(),
    temporada: () => sky('temporada', '#2a2418', '#6a4a2a') +
      R(20, 20, 120, 72, '#2a2118') + R(24, 24, 112, 64, '#3a2c1c') +
      P('M68 34h24v12a12 12 0 0 1-24 0z', AMBER) + L('M68 38h-6c0 6 3 9 7 9M92 38h6c0 6-3 9-7 9', AMBER, 2) + R(78, 58, 4, 8, AMBER) + R(70, 66, 20, 4, '#c79a3d') +
      [[32, '#8a6643'], [116, '#b8c0c4']].map(([x, c]) => C(x, 52, 9, c) + C(x, 52, 6, '#2a2118')).join('') + R(40, 78, 80, 4, '#5a4632') + ground(),
    assaltos: () => sky('assaltos', '#141d24', '#3a2420') +
      R(0, 30, 52, 70, INK) + wins(6, 38, 7, 5, 9) + R(118, 22, 42, 78, INK) + wins(122, 30, 6, 7, 21) +
      P('M50 82v-12l10-10h40l10 10v12z', '#1c2428') + R(62, 62, 14, 8, '#7fa6bd', 'opacity=".5"') + R(80, 62, 14, 8, '#7fa6bd', 'opacity=".5"') + C(62, 84, 6, INK) + C(98, 84, 6, INK) +
      P('M108 74l10-4 4 8-10 4z', '#c79a3d') + P('M30 92c0-8 6-10 12-10s12 2 12 10z', '#4a3a24') + R(38, 80, 8, 3, '#2a1e12') + L('M42 84v6', CREAM, 1.5) +
      `<g class="siren">${C(150, 90, 16, RED, 'opacity=".25"')}${C(10, 90, 16, BLUE, 'opacity=".22"')}</g>` + ground()
  };

  /* ---------------- Retratos dos adversários (64×64) ---------------- */
  const bust = (skin, shirt) => P('M8 64c2-14 11-20 24-20s22 6 24 20z', shirt) + `<ellipse cx="32" cy="28" rx="11" ry="13" fill="${skin}"/>` + R(28, 38, 8, 8, skin);
  const eyes = (y = 27, c = '#0a0f12') => R(26, y, 4, 2, c) + R(34, y, 4, 2, c);
  const RIVALS = {
    marrento: ['#3a2a20', bust('#a8794f', '#c9503a') + P('M20 22c2-10 22-10 24 0z', '#2e5f9e') + R(40, 20, 10, 3, '#2e5f9e') + eyes() + L('M27 35q5 3 10 0', '#3a2216', 1.5)],
    tonhao: ['#2a2a22', P('M2 64c2-16 13-24 30-24s28 8 30 24z', '#4a6a4a') + `<ellipse cx="32" cy="27" rx="13" ry="14" fill="#7a5032"/>` + R(26, 38, 12, 8, '#7a5032') + eyes(26) + L('M26 34h12', '#2a160c', 2) + L('M19 22h26', '#5a3820', 1)],
    bagre: ['#22302a', bust('#c08a5c', '#6a5a3a') + `<ellipse cx="32" cy="24" rx="15" ry="16" fill="#c08a5c"/>` + eyes(24) + L('M26 33q6 2 12 0', '#5a3216', 2) + C(20, 22, 2, '#a8794f')],
    maozinha: ['#1d2630', P('M12 64c2-12 10-18 20-18s18 6 20 18z', '#2a3a4a') + P('M18 30c0-14 28-14 28 0v8H18z', '#2a3a4a') + `<ellipse cx="32" cy="31" rx="9" ry="10" fill="#8a5c3a"/>` + eyes(30) + L('M29 37h6', '#3a1e0e', 1.5)],
    galego: ['#2e2a1c', bust('#e0b48a', '#1c2428') + P('M20 22c0-12 24-12 24 0-4-4-20-4-24 0z', '#e6c45a') + R(23, 25, 18, 5, '#0a0f12', 'rx="2"') + L('M28 35q4 2 8 0', '#7a3a1e', 1.5) + C(24, 52, 1.5, AMBER) + C(40, 52, 1.5, AMBER)],
    sargento: ['#1f2a22', bust('#9a6a42', '#3a4a3a') + P('M18 20c4-8 24-8 28 0l2 4H16z', '#2a3a2a') + eyes() + P('M24 33c4-3 12-3 16 0-4 3-12 3-16 0z', '#2a1a10') + R(14, 48, 36, 3, '#c79a3d')],
    carcara: ['#2a1c1c', P('M8 64c2-14 11-20 24-20s22 6 24 20z', '#1a1a1a') + P('M16 34c0-20 32-20 32 0v10H16z', '#222') + `<ellipse cx="32" cy="30" rx="9" ry="11" fill="#6a4228"/>` + R(22, 34, 20, 8, '#5a1e1e') + R(26, 28, 4, 2, AMBER) + R(34, 28, 4, 2, AMBER)],
    rei: ['#33281a', bust('#7a4a2a', '#111') + P('M18 18l4-10 5 6 5-8 5 8 5-6 4 10z', AMBER) + R(18, 18, 28, 3, '#c79a3d') + eyes() + L('M26 34q6 3 12 0', '#2a120a', 1.5) + L('M18 50q14 8 28 0', AMBER, 2.5) + C(32, 56, 2.5, AMBER)]
  };

  /* ---------------- Assaltos (160×70) ---------------- */
  const hs = (id, a, b) => `<defs><linearGradient id="h-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>${R(0, 0, 160, 70, `url(#h-${id})`)}`;
  const road = y => R(0, y, 160, 70 - y, '#14181b') + [0, 1, 2, 3, 4].map(i => R(8 + i * 34, y + 6, 16, 1.6, '#c79a3d')).join('');
  const HEISTS = {
    arrastao: () => hs('arrastao', '#1a2430', '#3a3040') + R(16, 14, 128, 42, '#2a3640') + R(20, 18, 120, 6, '#c9503a') +
      [0, 1, 2, 3, 4].map(i => R(22 + i * 24, 28, 20, 20, '#7fa6bd', 'opacity=".55"')).join('') + R(70, 28, 20, 28, '#0b1013') +
      L('M30 40l6-4M54 38l4 4M102 40l6-6', CREAM, 1.5) + R(0, 56, 160, 14, '#14181b') + P('M118 66l8-6h10l4 6z', INK) + C(122, 66, 3, INK) + C(138, 66, 3, INK),
    rodovia: () => hs('rodovia', '#2a2a3a', '#7a5040') + P('M0 40l40-14 30 10 40-16 50 12v8H0z', FAR) + road(46) +
      R(70, 30, 48, 18, '#d8d4c8') + R(118, 34, 18, 14, '#c9503a') + R(124, 36, 8, 5, '#7fa6bd') + C(80, 50, 4, INK) + C(110, 50, 4, INK) + C(128, 50, 4, INK) +
      P('M20 50l12-6h14l4 6z', INK) + C(26, 52, 3, INK) + C(44, 52, 3, INK) + [0, 1, 2].map(i => P(`M${60 + i * 6} 56l3-6 3 6z`, '#e07a3a')).join(''),
    agencia: () => hs('agencia', '#1c2a3a', '#4a4a3a') + R(14, 26, 30, 30, FAR) + P('M14 26l15-10 15 10z', FAR) + R(26, 8, 6, 10, FAR) + R(28, 4, 2, 6, FAR) +
      R(60, 22, 70, 34, '#c9c2b0') + R(60, 22, 70, 6, '#2e5f9e') + R(66, 34, 12, 10, '#7fa6bd') + R(84, 34, 14, 22, '#3a3226') + R(104, 34, 12, 10, '#7fa6bd') + R(0, 56, 160, 14, '#14181b') +
      P('M136 60l6-6h10l4 6z', '#d8d4c8') + R(140, 52, 10, 2, BLUE),
    carroforte: () => hs('carroforte', '#3a4248', '#6a6a60') + P('M0 30q40-20 80-6t80-14V70H0z', '#2a3a34') + P('M0 70q60-40 160-30v30z', '#14181b') +
      `<rect x="0" y="0" width="160" height="70" fill="#d8d8d0" opacity=".12"/>` + R(62, 34, 44, 18, '#5a6a5a') + R(98, 36, 14, 14, '#4a5a4a') + R(102, 38, 6, 5, '#7fa6bd', 'opacity=".6"') +
      R(66, 38, 26, 3, '#3a4a3a') + C(72, 54, 4, INK) + C(102, 54, 4, INK),
    transportadora: () => hs('transportadora', '#141c24', '#2a3036') + R(0, 34, 160, 26, '#3a3a38') + [0, 1, 2, 3, 4, 5, 6, 7].map(i => R(i * 20 + 2, 30, 2, 6, '#55606a')).join('') + L('M0 32h160', '#55606a', 1) +
      R(60, 14, 10, 22, '#2a3036') + R(56, 10, 18, 6, '#2a3036') + `<path d="M64 14l-30 22h22z" fill="${AMBER}" opacity=".2"/>` + R(96, 20, 50, 16, '#4a4a46') + R(116, 26, 10, 10, '#1a1a18') + R(0, 60, 160, 10, '#14181b'),
    cofrecentral: () => hs('cofrecentral', '#2a2418', '#141210') + R(30, 6, 100, 58, '#4a4232') + C(80, 35, 24, '#6a5e46') + C(80, 35, 19, '#5a4e38') +
      [0, 45, 90, 135].map(a => `<rect x="78" y="14" width="4" height="10" fill="#8a7a56" transform="rotate(${a} 80 35)"/>`).join('') + C(80, 35, 7, '#8a7a56') + C(80, 35, 3, '#2a2418') +
      R(126, 26, 8, 18, '#3a3226') + [[44, 58], [52, 60], [108, 58], [116, 60]].map(([x, y]) => R(x, y, 10, 4, '#7fc8a4')).join('')
  };

  const painted = key => (root.SB_ART && root.SB_ART[key]) ? `<img class="art painted" src="${root.SB_ART[key]}" alt="" loading="lazy">` : '';
  const SBArt = {
    place: id => painted('place-' + id) || (PLACES[id] ? svg('0 0 160 100', PLACES[id]()) : ''),
    rival: id => painted('rival-' + id) || (RIVALS[id] ? svg('0 0 64 64', R(0, 0, 64, 64, RIVALS[id][0]) + RIVALS[id][1], 'art portrait') : ''),
    heist: id => painted('heist-' + id) || (HEISTS[id] ? svg('0 0 160 70', HEISTS[id]()) : ''),
    keys: () => [...Object.keys(PLACES).map(k => 'place-' + k), ...Object.keys(RIVALS).map(k => 'rival-' + k), ...Object.keys(HEISTS).map(k => 'heist-' + k)],
    paintedCount: () => root.SB_ART ? Object.keys(root.SB_ART).length : 0
  };
  root.SBArt = SBArt;
})(typeof window !== 'undefined' ? window : globalThis);
