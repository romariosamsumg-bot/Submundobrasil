/* =====================================================================
 * SUBMUNDO BRASIL — INTERFACE v1.5
 * Responsável por: persistência (localStorage, backup, importação e
 * exportação), renderização das telas e tratamento dos cliques.
 * Todas as regras ficam em window.SB (motor). Esta camada só chama
 * SB.perform(...) e mostra o resultado.
 * ===================================================================== */
(() => {
  'use strict';
  const SB = window.SB;
  const KEY = SB.STORAGE_KEY;
  const CORRUPT_KEY = 'submundo_brasil_corrupt_backup';
  const V04_BACKUP_KEY = 'submundo_brasil_v04_backup';
  const VIEWS = ['painel', 'acoes', 'hub', 'cidade', 'gestao', 'feira', 'galpao', 'noite', 'duelos', 'apostas', 'hospital', 'gangue', 'assaltos', 'perfil', 'temporada'];
  /* Telas que ficam "dentro" de uma aba da navegação. */
  const PARENT = { cidade: 'hub', gestao: 'hub', galpao: 'hub', duelos: 'hub', apostas: 'hub', hospital: 'hub', gangue: 'hub', assaltos: 'gangue', perfil: 'hub', temporada: 'perfil' };
  const tabOf = v => { while (PARENT[v]) v = PARENT[v]; return v; };
  const MAXDAY = SB.MAXDAY;

  let state = null, view = 'painel', result = null, toastTimer = null;
  let localeHelp = false, armedNext = false, armTimer = null, missionFilter = 'disponiveis', corrupt = null, saveFailed = false;

  /* ---------- utilidades de apresentação ---------- */
  const $ = sel => document.querySelector(sel);
  const $all = sel => Array.from(document.querySelectorAll(sel));
  const fmt = n => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Math.round(n || 0));
  const num = n => new Intl.NumberFormat('pt-BR').format(Math.round(n || 0));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const signed = n => (n > 0 ? '+' : '') + num(n);
  const pct = v => Math.max(0, Math.min(100, v));
  const button = (label, action, attrs = '', disabled = false, cls = '') => `<button type="button" class="btn ${cls}" data-action="${action}" ${attrs} ${disabled ? 'disabled' : ''}>${label}</button>`;
  const D = id => SB.district(state, id);
  const F = id => SB.faction(id);

  /* ---------- arte gerada (SVG inline, sem arquivos externos) ---------- */
  const R = (x, y, w, h, f, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}" ${extra}/>`;
  /** Janelas acesas em grade; padrão determinístico para não "piscar" a cada render. */
  function wins(x, y, cols, rows, seed, dx = 7, dy = 9) {
    let o = '';
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { seed = (seed * 31 + 7) % 97; if (seed % 3 === 0) o += R(x + c * dx, y + r * dy, 3, 4, seed % 2 ? '#f0c06e' : '#c9873f'); }
    return o;
  }
  const INK = '#0a0f12', FAR = '#1b2c33';
  const SCENES = {
    centro: () => {
      let o = '';
      [[0, 52, 30], [28, 40, 26], [70, 58, 34], [130, 34, 24], [186, 50, 40], [250, 44, 30], [300, 60, 60]].forEach(([x, y, w], i) => { o += R(x, y, w, 120 - y, FAR); });
      const b = [[4, 58, 46], [52, 44, 40], [94, 62, 50], [146, 36, 34], [182, 54, 56], [240, 48, 44], [286, 64, 70]];
      b.forEach(([x, y, w], i) => {
        o += R(x, y, w, 120 - y, INK) + R(x - 2, y, w + 4, 3, INK) + wins(x + 6, y + 10, Math.floor((w - 8) / 7), 4, i * 13 + 5);
        if (i % 2 === 0) o += `<path d="M${x + w / 2 - 8} ${y} q8 -12 16 0z" fill="${INK}"/>`;
      });
      o += R(162, 14, 4, 24, INK) + `<path d="M158 16h12M164 8v8" stroke="${INK}" stroke-width="2"/>`;
      [[18, '#b5482f'], [76, '#d9a441'], [128, '#2f7d5b'], [204, '#b5482f'], [262, '#d9a441'], [318, '#2e5f9e']].forEach(([x, c]) => { o += `<path d="M${x} 100h30l4 8h-38z" fill="${c}"/>` + R(x + 2, 108, 2, 12, '#05080a') + R(x + 26, 108, 2, 12, '#05080a') + R(x + 5, 110, 20, 4, '#3a2c1c'); });
      return o;
    },
    cais: () => {
      let o = R(0, 70, 360, 50, '#10242d');
      o += `<path d="M190 78h120l-10 16h-96z" fill="${FAR}"/>` + R(250, 62, 30, 16, FAR) + R(262, 50, 6, 12, FAR);
      for (let i = 0; i < 9; i++) o += R(i * 44, 96 + (i % 2) * 4, 26, 1.5, '#27485a');
      o += R(0, 92, 190, 28, INK);
      o += R(40, 18, 5, 76, INK) + R(20, 22, 92, 5, INK) + `<path d="M42 22 30 10h24zM100 27v26M45 27l40 0M42 50 100 27" stroke="${INK}" stroke-width="2" fill="${INK}"/>` + R(94, 52, 12, 9, '#a5532f');
      [[112, 78, '#a5532f'], [144, 78, '#2c6a6c'], [112, 64, '#c79a3d'], [128, 50, '#2e5f9e'], [144, 64, '#7d3b2b'], [6, 78, '#2c6a6c']].forEach(([x, y, c]) => { o += R(x, y, 30, 13, c) + R(x + 9, y, 1, 13, '#0007') + R(x + 19, y, 1, 13, '#0007'); });
      o += R(330, 30, 4, 62, INK) + R(300, 34, 46, 4, INK) + R(318, 92, 42, 28, INK);
      return o;
    },
    jardim: () => {
      let o = '';
      for (let i = 0; i < 8; i++) o += R(i * 48 - 6, 62 - (i % 3) * 8, 44, 60, FAR);
      const hs = [[6, 78, 44], [58, 70, 38], [104, 82, 50], [162, 72, 40], [210, 80, 46], [264, 68, 40], [310, 78, 50]];
      hs.forEach(([x, y, w], i) => {
        o += R(x, y, w, 120 - y, INK) + `<path d="M${x - 3} ${y}l${w / 2 + 3} -12l${w / 2 + 3} 12z" fill="${INK}"/>` + wins(x + 6, y + 8, Math.floor((w - 8) / 9), 2, i * 7 + 3, 9, 12);
        if (i % 2) o += R(x + w - 14, y - 16, 10, 8, '#2e5f9e') + R(x + w - 12, y - 8, 2, 6, INK) + R(x + w - 8, y - 8, 2, 6, INK);
      });
      [30, 150, 270].forEach(x => { o += R(x, 30, 3, 90, INK) + R(x - 8, 34, 19, 2, INK); });
      o += `<path d="M31 35q60 16 120 0M151 35q60 16 120 0M271 35q50 14 90 4M-10 42q20 4 41 -7" stroke="${INK}" stroke-width="1.2" fill="none"/>`;
      o += `<path d="M228 14l7 9-7 9-7-9z" fill="#c9503a"/><path d="M228 32q4 8 -2 14" stroke="#c9503a" stroke-width="1" fill="none"/>`;
      return o;
    },
    industrial: () => {
      let o = '';
      [[20, 30], [200, 22], [290, 36]].forEach(([x, y]) => { o += R(x, y, 12, 90, FAR) + `<ellipse cx="${x + 14}" cy="${y - 8}" rx="16" ry="7" fill="#3a4a50" opacity=".55"/><ellipse cx="${x + 30}" cy="${y - 18}" rx="20" ry="8" fill="#3a4a50" opacity=".35"/>`; });
      o += R(60, 56, 110, 64, FAR) + R(230, 60, 50, 60, FAR);
      let x = 0;
      for (let i = 0; i < 6; i++) { o += `<path d="M${x} 120V78l22 -14v14l22 -14v14l22 -14v56z" fill="${INK}"/>` + wins(x + 6, 90, 8, 2, i * 5 + 2, 7, 11); x += 66; }
      o += R(120, 26, 9, 60, INK) + R(118, 24, 13, 4, '#a5532f') + R(318, 34, 9, 50, INK) + R(316, 32, 13, 4, '#a5532f');
      o += `<ellipse cx="136" cy="14" rx="18" ry="7" fill="#4a5a60" opacity=".6"/><ellipse cx="336" cy="22" rx="16" ry="6" fill="#4a5a60" opacity=".6"/>`;
      o += R(248, 40, 24, 16, INK) + `<path d="M252 56l-4 30M268 56l4 30M260 56v30" stroke="${INK}" stroke-width="2.500"/>`.replace('.500', '.5');
      return o;
    },
    vila: () => {
      let o = '';
      for (let i = 0; i < 7; i++) o += R(i * 56 - 4, 66 - (i % 2) * 10, 50, 60, FAR);
      const palm = (x, h) => `<path d="M${x} 120q-4 -${h / 2} 2 -${h}" stroke="${INK}" stroke-width="4" fill="none"/>` + [[-26, -4], [-20, -16], [-4, -22], [14, -18], [24, -6], [18, 8], [-18, 8]].map(([dx, dy]) => `<path d="M${x + 2} ${120 - h}q${dx / 2} ${dy - 6} ${dx} ${dy + 4}" stroke="${INK}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`).join('');
      o += palm(40, 78) + palm(318, 88) + palm(286, 60);
      o += R(96, 62, 150, 58, INK) + R(90, 58, 162, 5, INK) + `<path d="M96 76h150l8 12H88z" fill="#b5482f"/>` + [0, 1, 2, 3, 4].map(i => `<path d="M${104 + i * 32} 76h16l2 12h-20z" fill="#e7d9b8"/>`).join('');
      o += R(140, 40, 62, 18, '#102a1e') + `<text x="171" y="54" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="13" fill="#f0c06e">BAR</text>`;
      o += wins(106, 96, 4, 1, 4, 9) + R(196, 94, 20, 26, '#2a1d12') + R(150, 100, 22, 3, '#3a2c1c') + R(158, 103, 3, 17, '#05080a');
      o += `<path d="M0 30q90 26 180 6t180 4" stroke="${INK}" stroke-width="1" fill="none"/>` + [20, 56, 92, 128, 168, 208, 248, 290, 330].map((x, i) => `<circle cx="${x}" cy="${[33, 38, 41, 40, 37, 33, 31, 31, 35][i]}" r="2.2" fill="${['#f0c06e', '#c9503a', '#7fc8a4'][i % 3]}"/>`).join('');
      return o;
    }
  };
  /** Silhueta distante que identifica a cidade (formas genéricas, sem reproduzir fotos ou marcas). */
  const LM = '#22363f';
  const LANDMARK = {
    rio: () => `<path d="M186 120Q204 66 226 62Q246 64 254 92Q270 34 300 30Q334 36 360 120z" fill="${LM}"/>`,
    sp: () => [[214, 44, 16], [234, 30, 20], [258, 50, 14], [276, 22, 18], [298, 40, 22], [324, 54, 16], [342, 36, 18]].map(([x, y, w]) => R(x, y, w, 120 - y, LM)).join('') + R(284, 4, 2, 18, LM) + R(243, 18, 2, 12, LM),
    bh: () => `<path d="M0 84L36 62L84 74L132 46L190 68L246 40L300 60L360 44V120H0z" fill="${LM}"/>`,
    salvador: () => R(236, 26, 11, 94, LM) + R(232, 22, 19, 5, LM) + R(247, 34, 44, 5, LM) + R(288, 38, 72, 82, LM) + R(300, 22, 9, 16, LM) + R(322, 22, 9, 16, LM) + `<path d="M300 22l4.500-8 4.500 8zM322 22l4.500-8 4.500 8z" fill="${LM}"/>`.replace(/\.500/g, '.5'),
    recife: () => R(0, 70, 360, 4, LM) + [0, 72, 144, 216, 288].map(x => `<path d="M${x} 74h72v46h-8q-28 -50 -56 0h-8z" fill="${LM}"/>`).join('') + R(318, 30, 7, 40, LM) + `<path d="M316 30l5.500-9 5.500 9z" fill="${LM}"/>`.replace(/\.500/g, '.5'),
    poa: () => R(296, 14, 9, 106, LM) + R(293, 12, 15, 4, LM) + R(262, 76, 84, 44, LM) + `<path d="M262 76l14 -10h56l14 10z" fill="${LM}"/>` + R(0, 100, 250, 2, '#2f4c59')
  };
  const SKY = { centro: ['#2b3a44', '#7a5a3c'], cais: ['#1c3340', '#4d6a70'], jardim: ['#2a3550', '#b0704a'], industrial: ['#2c2f36', '#6a5444'], vila: ['#23344a', '#c2824a'] };
  /** Cena do bairro; reage aos eventos ativos (festa, chuva, operação, greve, guerra). */
  function scene(id, withEvents = true, cityName) {
    const evs = withEvents && state ? SB.activeEvents(state) : [];
    const has = k => evs.some(e => e.id === k && (!e.district || e.district === id));
    const [a, b] = SKY[id] || SKY.centro;
    const art = window.SB_ART && window.SB_ART['bairro-' + id];
    let fx = '';
    let o = `<svg class="scene" viewBox="0 0 360 120" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><defs><linearGradient id="sky-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`;
    o += R(0, 0, 360, 120, `url(#sky-${id})`) + `<circle cx="${id === 'cais' ? 300 : 78}" cy="${id === 'industrial' ? 40 : 30}" r="13" fill="#f3d9a4" opacity="${has('temporal') ? .15 : .8}"/>`;
    o += (LANDMARK[SB.cityOf(cityName || (state && state.city)).id] || LANDMARK.rio)();
    o += (SCENES[id] || SCENES.centro)();
    const base = o.length;
    if (has('carnaval') || has('festival') || has('saojoao')) {
      const cols = ['#f0c06e', '#c9503a', '#7fc8a4', '#5c8fd6', '#e7d9b8'];
      let seed = 11; for (let i = 0; i < 46; i++) { seed = (seed * 37 + 11) % 359; o += `<rect class="cf" x="${seed}" y="${(seed * 7) % 96}" width="3" height="5" fill="${cols[i % 5]}" transform="rotate(${seed % 90} ${seed} ${(seed * 7) % 96})" style="animation-delay:-${i % 7 * .4}s"/>`; }
      o += `<path d="M0 8q90 22 180 4t180 6" stroke="#0a0f12" stroke-width="1" fill="none"/>` + Array.from({ length: 15 }, (_, i) => `<path d="M${8 + i * 24} ${10 + Math.sin(i / 2.3) * 5 + 4}l5 0-2.5 7z" fill="${cols[i % 5]}"/>`).join('');
    }
    if (has('temporal')) { o += R(0, 0, 360, 120, '#0b1420', 'opacity=".45"'); for (let i = 0; i < 40; i++) o += `<path class="rain" d="M${(i * 53) % 360} ${(i * 29) % 110}l-4 12" stroke="#9fc0d6" stroke-width="1" opacity=".55" style="animation-delay:-${i % 5 * .12}s"/>`; }
    if (has('operacao') || has('fiscalizacao')) o += `<g class="siren"><circle cx="300" cy="104" r="30" fill="#d0463a" opacity=".35"/><circle cx="330" cy="104" r="30" fill="#3f6fd0" opacity=".3"/></g>` + R(296, 104, 40, 9, '#05080a') + R(304, 99, 22, 6, '#05080a') + R(311, 96, 4, 3, '#e0564a') + R(316, 96, 4, 3, '#5c8fd6');
    if (has('guerra')) o += `<g class="siren"><circle cx="180" cy="96" r="44" fill="#d0463a" opacity=".22"/></g><path d="M150 60q8 -14 4 -26M172 54q10 -16 2 -34" stroke="#55606a" stroke-width="5" fill="none" opacity=".6" stroke-linecap="round"/>`;
    if (has('greve')) o += [120, 150, 180].map((x, i) => R(x, 96, 14, 9, '#e7d9b8') + R(x + 6, 105, 2, 12, '#05080a')).join('');
    if (has('crise')) o += R(0, 0, 360, 120, '#1a1410', 'opacity=".35"');
    if (art) { fx = o.slice(base); return `<span class="scene paintedScene"><img class="art painted" src="${art}" alt="" loading="lazy">${fx ? `<svg class="sceneFx" viewBox="0 0 360 120" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${fx}</svg>` : ''}</span>`; }
    return o + R(0, 118, 360, 2, '#05080a') + '</svg>';
  }
  /** Placa de rua esmaltada. */
  const plate = (name, sub = '') => `<span class="plate"><b>${esc(name)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span>`;
  /** Retrato do personagem: silhueta muda com a especialização. */
  /** Retrato escolhido (imagem pintada) ou a silhueta da classe. */
  const portrait = s => (s.avatar && window.SBArt.avatar(s.avatar)) || avatar(s.career);
  function avatar(career) {
    const bg = { operador: '#3a2f25', articulador: '#22343a', empreendedor: '#2c3327', traficante: '#22301f', barao: '#33202a' }[career] || '#262b2f';
    let o = `<svg viewBox="0 0 48 48" aria-hidden="true">${R(0, 0, 48, 48, bg)}<path d="M0 34l48 -20v34H0z" fill="#0003"/>`;
    o += `<path d="M6 48c1-11 8-15 18-15s17 4 18 15z" fill="#0b1013"/><ellipse cx="24" cy="21" rx="9" ry="10.500" fill="#0b1013"/>`.replace('.500', '.5');
    if (career === 'operador') o += `<path d="M14 17c1-8 19-8 20 0z" fill="#b5482f"/><path d="M13 17h26l1 3H13z" fill="#8a3421"/>`;
    else if (career === 'articulador') o += `<path d="M8 16h32l-2 3H10z" fill="#e7d9b8"/><path d="M15 16c0-9 18-9 18 0z" fill="#e7d9b8"/><path d="M15 14h18v2H15z" fill="#22343a"/>`;
    else if (career === 'empreendedor') o += `<path d="M15 16c2-9 16-9 18 0-5-3-13-3-18 0z" fill="#1b1410"/><path d="M19 34l5 5 5-5 2 14H17z" fill="#e7d9b8"/><path d="M23 38h2l1.500 9h-5z" fill="#c79a3d"/>`.replace('.500', '.5');
    else if (career === 'traficante') o += `<path d="M12 22c0-14 24-14 24 0v6H12z" fill="#2a3a2a"/><path d="M16 27h16v5H16z" fill="#1a241a"/>`;
    else if (career === 'barao') o += `<path d="M10 17h28l-2 3H12z" fill="#1b1410"/><path d="M16 17c0-10 16-10 16 0z" fill="#1b1410"/><path d="M16 15h16v2H16z" fill="#b8402f"/><path d="M20 36l4 4 4-4 1 12h-10z" fill="#b8402f"/>`;
    else o += `<path d="M12 24c-2-16 26-16 24 0-2-8-22-8-24 0z" fill="#3a4348"/>`;
    return o + '</svg>';
  }
  const EMBLEM = {
    esquina: `<circle cx="20" cy="20" r="18" fill="#3a2a1c" stroke="#d9a441" stroke-width="2"/><path d="M12 30V12h16M12 12l16 18" stroke="#e7d9b8" stroke-width="3" fill="none" stroke-linecap="square"/><circle cx="28" cy="12" r="3" fill="#d9a441"/>`,
    docas: `<path d="M20 2l16 9v18l-16 9-16-9V11z" fill="#1d2f3a" stroke="#7fa6bd" stroke-width="2"/><path d="M20 9v20M13 15h14M11 24c1 7 17 7 18 0" stroke="#e7d9b8" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="20" cy="9" r="2.500" fill="#7fa6bd"/>`.replace('.500', '.5'),
    aurora: `<path d="M3 20a17 17 0 0 1 34 0v14H3z" fill="#3a2540" stroke="#d98a6a" stroke-width="2"/><path d="M10 28a10 10 0 0 1 20 0z" fill="#f0c06e"/><path d="M20 8v6M9 13l4 5M31 13l-4 5M5 28h30" stroke="#f0c06e" stroke-width="2.500" stroke-linecap="round"/>`.replace('.500', '.5')
  };
  const emblem = id => `<svg class="emblem" viewBox="0 0 40 40" aria-hidden="true">${EMBLEM[id] || ''}</svg>`;
  const STAT_ICON = {
    astucia: `<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>`,
    forca: `<path d="M3 9v6M6 6v12M18 6v12M21 9v6M6 12h12"/>`,
    labia: `<path d="M4 5h16v11H11l-5 4v-4H4z"/><path d="M8 9h8M8 12h5"/>`,
    arsenal: `<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/><circle cx="12" cy="12" r="1.5"/>`,
    influencia: `<circle cx="12" cy="5" r="2.500"/><circle cx="5" cy="18" r="2.500"/><circle cx="19" cy="18" r="2.500"/><path d="M11 7 6 16M13 7l5 9M7.500 18h9"/>`.replace(/\.500/g, '.5')
  };
  const statIcon = id => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${STAT_ICON[id] || ''}</svg>`;
  /** Título de seção em estêncil. */
  const stencil = (title, small = '') => `<div class="section"><h2>${title}</h2>${small ? `<small>${small}</small>` : ''}</div>`;

  /* ---------- persistência ---------- */
  function save() {
    if (online) return; // no online, quem guarda é o servidor
    try { localStorage.setItem(KEY, JSON.stringify(state)); saveFailed = false; }
    catch (e) { if (!saveFailed) notify('Não foi possível salvar no navegador. Exporte uma cópia em Temporada.', true); saveFailed = true; }
  }
  function load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { notify('O navegador bloqueou o armazenamento local. O jogo funciona, mas não salvará.', true); return null; }
    if (!raw) return null;
    const r = SB.parseSave(raw);
    if (!r.ok) {
      // Nunca descartar silenciosamente: guarda o conteúdo original.
      try { localStorage.setItem(CORRUPT_KEY, raw); } catch (e) { /* sem espaço */ }
      corrupt = { raw, reason: r.error };
      return null;
    }
    try {
      const schema = JSON.parse(raw).schema;
      if (schema === 1 && !localStorage.getItem(V04_BACKUP_KEY)) localStorage.setItem(V04_BACKUP_KEY, raw);
    } catch (e) { /* backup é opcional */ }
    if (r.notes.length) result = { good: true, msg: 'Salvamento carregado e verificado.', lines: r.notes, deltas: [], fresh: true };
    return r.state;
  }
  function download(name, text) {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportSave() {
    download(`submundo-brasil-v1.5-t${state.season}-d${state.day}.json`, JSON.stringify(SB.exportPayload(state), null, 2));
    notify('Cópia da carreira preparada para download.');
  }
  async function importFile(file, fromWelcome) {
    if (!file) return;
    if (file.size > 2000000) return notify('Arquivo muito grande para ser um salvamento.', true);
    let text;
    try { text = await file.text(); } catch (e) { return notify('Não foi possível ler o arquivo.', true); }
    const r = SB.parseSave(text);
    if (!r.ok) return notify('Importação recusada: ' + r.error, true);
    let warn = '';
    try { const obj = JSON.parse(text); if (obj.checksum && obj.save && SB.checksum(JSON.stringify(obj.save)) !== obj.checksum) warn = '\n\nAtenção: o arquivo foi alterado depois de exportado. Os valores foram verificados e limitados.'; } catch (e) { /* já validado */ }
    const summary = `${r.state.name} · temporada ${r.state.season}, dia ${r.state.day} · ${fmt(r.state.cash + r.state.bank)}`;
    if (!confirm((fromWelcome ? 'Carregar' : 'Substituir sua carreira atual por') + ` este salvamento?\n\n${summary}${r.notes.length ? '\n\n' + r.notes.join('\n') : ''}${warn}`)) return;
    state = r.state; view = 'painel';
    result = { good: true, msg: 'Carreira importada.', lines: r.notes.concat(warn ? ['Arquivo alterado após a exportação: valores verificados.'] : []), deltas: [], fresh: true };
    $('#welcome').classList.add('hidden'); document.body.classList.remove('atCover');
    save(); render(); notify('Carreira importada com sucesso.');
  }

  /* ---------- feedback ---------- */
  function notify(msg, isError = false) {
    const node = $('#toast'); node.textContent = msg; node.className = 'toast' + (isError ? ' error' : ''); node.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { node.hidden = true; }, 3800);
  }
  const snap = () => state ? { health: state.health, cash: state.cash, bank: state.bank, energy: state.energy, heat: state.heat, vicio: state.vicio, respect: state.respect, inf: state.influence[state.district], morale: state.crewMorale, district: state.district } : null;
  function deltas(a, b) {
    if (!a || !b) return [];
    const out = [];
    const add = (label, v, goodUp = true, money = false) => { if (v) out.push({ label, text: (v > 0 ? '+' : '-') + (money ? fmt(Math.abs(v)) : num(Math.abs(v))), good: goodUp ? v > 0 : v < 0 }); };
    add('Caixa', b.cash - a.cash, true, true); add('Banco', b.bank - a.bank, true, true); add('Energia', b.energy - a.energy);
    add('Procurado', b.heat - a.heat, false); add('Vício', b.vicio - a.vicio, false); add('Saúde', b.health - a.health); add('Respeito', b.respect - a.respect);
    if (a.district === b.district) add('Influência', b.inf - a.inf);
    add('Ânimo', b.morale - a.morale);
    return out;
  }
  const STAMPED = ['mission', 'gangOp', 'clash', 'dispute', 'dialogue', 'exportGoods', 'duel', 'heistRun', 'bet'];
  /** Transição curta de amanhecer ao virar o dia (ignorada com movimento reduzido). */
  function dawn() {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = document.createElement('div'); el.className = 'dawn'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<b>Dia ${state.day}</b>`; document.body.appendChild(el); setTimeout(() => el.remove(), 1100);
  }
  let lastCash = null;
  function renderHud() {
    const s = state, lvl = Math.min(99, Math.floor(s.respect / 35) + 1), c = s.career ? SB.CAREERS.find(x => x.id === s.career).name : 'Sem especialização';
    const pk = s.career + '|' + s.avatar; if ($('#hudAvatar').dataset.pic !== pk) { $('#hudAvatar').innerHTML = portrait(s); $('#hudAvatar').dataset.pic = pk; }
    $('#hudName').textContent = s.name; $('#hudSub').innerHTML = `<span>${esc(SB.phase(s).name)}</span><span>${esc(c)}</span>`;
    $('#hudRespect').textContent = num(s.respect);
    $('#hudEnergy').style.width = s.energy + '%'; $('#hudEnergyTxt').textContent = `Energia ${s.energy}`;
    $('#hudHeat').style.width = s.heat + '%'; $('#hudHeatTxt').textContent = `Procurado ${s.heat}`;
    $('#hudEnergyBox').setAttribute('aria-label', `Energia ${s.energy} de 100`); $('#hudHeatBox').setAttribute('aria-label', `Procurado ${s.heat} de 100`);
    $('#hudVicio').style.width = s.vicio + '%'; $('#hudVicioTxt').textContent = `Vício ${s.vicio}`; $('#hudVicioBox').setAttribute('aria-label', `Vício ${s.vicio} de 100`); $('#hudVicioBox').classList.toggle('alert', s.vicio >= 70);
    $('#hudHeatBox').classList.toggle('alert', s.heat >= 60); $('#hudHeatBox').classList.toggle('warm', s.heat >= 30 && s.heat < 60); $('#hudVicioBox').classList.toggle('warm', s.vicio >= 40 && s.vicio < 70);
    $('#hudHealth').style.width = s.health + '%'; $('#hudHealthTxt').textContent = s.hospital ? 'Internado' : `Saúde ${s.health}`;
    $('#hudHealthBox').setAttribute('aria-label', `Saúde ${s.health} de 100`); $('#hudHealthBox').classList.toggle('alert', s.health < 25);
    const cash = $('#topCash'); cash.textContent = fmt(s.cash);
    if (lastCash !== null && lastCash !== s.cash) { cash.classList.remove('up', 'down'); void cash.offsetWidth; cash.classList.add(s.cash > lastCash ? 'up' : 'down'); }
    lastCash = s.cash;
    $('#topDay').textContent = `Dia ${s.day}/${MAXDAY}`;
    document.body.classList.toggle('jailed', s.jail > 0);
  }
  /** Executa uma ação do motor, registra o resultado e redesenha. */
  function run(name, ...args) {
    if (!state) return null;
    if (online) return runOnline(name, args);
    const before = snap();
    let r;
    try { r = SB.perform(state, name, ...args); }
    catch (e) { console.error(e); notify('Erro inesperado na ação. Seu progresso anterior foi mantido.', true); return null; }
    if (!r.ok) { notify(r.msg, true); return r; }
    return finish(name, r, before);
  }
  /** Monta o cartão de resultado e redesenha (vale para o jogo local e para o online). */
  function finish(name, r, before) {
    if (name === 'endSeason') {
      const rec = r.record;
      if (r.state) state = r.state;
      result = { good: true, msg: r.msg, lines: [`Respeito final: ${rec.score} · ${rec.title}.`, ...SB.CATEGORIES.filter(c => SB.FEAT_CATS.includes(c.id)).map(c => `${c.name}: ${SB.MEDALS[rec.medals[c.id]]}`)], deltas: [], fresh: true };
    } else result = { good: r.good, msg: r.msg, lines: r.lines || [], deltas: deltas(before, snap()), fresh: true, stamp: STAMPED.includes(name) };
    if (name === 'nextDay') dawn();
    save(); render();
    $('#toast').hidden = true; // o popup já informa
    return r;
  }

  /* ---------- componentes ---------- */
  function heading(label, desc, extra = '') {
    const up = PARENT[view];
    return `${up ? `<button type="button" class="backLink" data-view="${up}">← ${({ hub: 'Cidade', perfil: 'Perfil', gangue: 'Bando' })[up]}</button>` : ''}<div class="pagehead"><div><h1>${label}</h1><p>${desc}</p></div>${extra}</div>` + guideCard();
  }
  /** v1.5: o resultado saiu do topo da tela e pula num popup (renderPop); nas telas não sobra nada. */
  function resultCard() { return ''; }
  function renderPop() {
    const box = $('#resultPop');
    if (!result) { if (!box.hidden) { box.hidden = true; box.innerHTML = ''; } return; }
    if (!result.fresh) return; // já aberto: não refaz nem repete a animação
    result.fresh = false;
    box.className = 'resultPop' + (window.SB_POP_PASSTHROUGH ? ' pass' : '');
    box.innerHTML = `<div class="popBack" data-action="dismiss-result" aria-hidden="true"></div>${resultHtml(true)}`;
    box.hidden = false;
    const ok = box.querySelector('.popOk'); if (ok && !window.SB_POP_PASSTHROUGH) ok.focus({ preventScroll: true });
  }
  function resultHtml(fresh) {
    return `<section class="resultCard ${result.good ? '' : 'bad'} ${fresh ? 'fresh' : ''}" role="dialog" aria-modal="true" aria-label="Resultado" aria-live="polite"><div class="rhead"><strong>${esc(result.msg)}</strong><button type="button" class="close" data-action="dismiss-result" aria-label="Fechar resultado">×</button></div>
      ${result.stamp ? `<span class="stamp" aria-hidden="true">${result.good ? 'DEU BOM' : 'DEU RUIM'}</span>` : ''}
      ${result.deltas.length ? `<div class="chips">${result.deltas.map(d => `<span class="chip ${d.good ? 'up' : 'down'}">${d.label} ${d.text}</span>`).join('')}</div>` : ''}
      ${result.lines.length ? `<ul>${result.lines.slice(0, 10).map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
      <button type="button" class="btn primary block popOk" data-action="dismiss-result">OK</button></section>`;
  }
  function jailNotice() {
    if (SB.atHome(state)) return `<div class="notice tape homeNote"><strong>EM CASA · volta em ${dur(SB.clockInfo(state).home)}</strong> Descansando: sem roubos, noite ou viagens. Banco, compras e decisões do bando continuam. No fim: energia cheia e o corpo zerado.<div class="inlineBtns">${button('Sair de casa antes da hora', 'leave-home', '', false, 'small ghost')}</div></div>`;
    if (state.hospital > 0) return `<div class="notice error tape"><strong>${state.uti ? 'UTI' : 'INTERNADO'} · ${state.clock ? 'alta em ' + dur(SB.clockInfo(state).lock) : state.hospital + ' dia(s)'}</strong> Você não pode sair para serviços, treinos, viagens, duelos ou negócios. Banco, gangue (decisões) e notícias continuam. ${state.uti ? 'Na UTI a saúde não sobe: você sai com 40 de saúde e o vício zerado.' : 'A saúde volta +15 por dia.'}<div class="inlineBtns">${nextDayButton('small')}</div></div>`;
    if (state.jail <= 0) return '';
    const c = SB.bailCost(state);
    const bc = SB.bribeCost(state);
    const cel = window.SBArt.place('cadeia');
    return `${cel ? `<div class="screenArt cellArt">${cel}</div>` : ''}<div class="notice error tape"><strong>NA CADEIA · ${state.clock ? 'sai em ' + dur(SB.clockInfo(state).lock) : state.jail + ' dia(s)'}</strong> Missões, treinos, viagens e negócios ficam bloqueados; o banco continua disponível.
      <div class="inlineBtns">${button(`Advogado de porta de cadeia · ${fmt(c)}`, 'bail', '', state.cash < c, 'small danger')}${button(`Molhar a mão do carcereiro · ${fmt(bc)}`, 'bribe', '', state.cash < bc || state.today.bribe, 'small ghost')}${nextDayButton('small')}</div><p class="mini" style="margin:6px 0 0">O advogado é garantido. O carcereiro é mais barato, mas pode te dedurar (+1 dia).</p></div>`;
  }
  /** "2 h 13 min" a partir de milissegundos. */
  const dur = ms => { const m = Math.max(1, Math.ceil(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}` : `${m} min`; };
  function nextDayButton(cls = '') {
    if (state.clock) { // online: o dia vira sozinho; o descanso é ir pra casa
      const ci = SB.clockInfo(state);
      if (SB.atHome(state)) return button('Sair de casa', 'leave-home', '', false, 'ghost ' + cls);
      if (state.jail > 0 || state.hospital > 0) return '';
      const full = state.energy >= 100 && !state.today.doses;
      return button(ci.homesLeft ? 'Ir pra casa · 3 h' : 'Casa: 2 vezes por dia', 'go-home', '', !ci.homesLeft || full, (cls.includes('ghost') || cls.includes('primary') ? '' : 'primary ') + cls);
    }
    if (state.day >= MAXDAY) return button('Encerrar temporada', 'switch', 'data-target="temporada"', false, 'primary ' + cls);
    return button(armedNext ? `Dormir com ${state.energy} de energia?` : 'Dormir', 'next-day', '', false, (armedNext ? 'armed ' : 'primary ') + cls);
  }
  function eventChips() {
    return SB.activeEvents(state).map(e => `<li><strong>${esc(SB.eventTitle(e))}</strong>${e.until > state.day ? ` · até o dia ${e.until}` : ''}<br>${esc(SB.eventDesc(e))}</li>`).join('');
  }
  /** Faixa do local atual: cena do bairro, placa de rua e condições. */
  /** Explicação curta da faixa da placa (abre ao tocar). */
  function localeInfo() {
    if (!localeHelp || !state) return '';
    const s = state, d = D(), ds = s.dstate[d.id], l = SB.leader(s, d.id), f = F(l.id);
    return `<section class="card localeInfo"><p><b>Dono</b>: ${SB.controlled(s, d.id) ? 'você manda aqui: recebe tributo todo dia e a vantagem do bairro.' : `quem manda aqui: ${esc(f.name)}. Roubar no território dele gera atrito e retaliação; dá para conversar, firmar trégua ou tomar o bairro.`}</p>
      <p><b>Grana ${Math.round(ds.econ * 100)}%</b>: quanto dinheiro circula aqui hoje (de 60% a 140%). Multiplica o que você ganha nos roubos e nos negócios deste bairro.</p>
      <p><b>Polícia ${ds.vigil}</b>: a polícia de olho neste bairro (0 a 100), diferente do seu Procurado. Sobe a cada roubo aqui e derruba suas chances; cai um pouco por dia. Acima de 40, mude de bairro.</p>
      <div class="btnbar">${button('Ver bairros', 'switch', 'data-target="cidade"', false, 'small ghost')}${button('Entendi', 'locale-help', '', false, 'small')}</div></section>`;
  }
  function localeStrip(tall, flyers = true) {
    const s = state, d = D(), ds = s.dstate[d.id], l = SB.leader(s, d.id);
    const evs = SB.activeEvents(s).filter(e => e.id !== 'rotina');
    return `<section class="locale ${tall ? 'tall' : ''}" aria-label="Onde você está">${scene(d.id)}
      <div class="localeTop">${plate(d.name, s.city)}${(flyers ? evs : []).map(e => `<span class="flyer">${esc(SB.eventTitle(e))}</span>`).join('')}</div>
      <button type="button" class="localeBottom" data-action="locale-help" aria-expanded="${localeHelp}" aria-label="O que significam dono, grana e polícia"><span>${SB.controlled(s, d.id) ? 'Você é o dono' : 'Dono: ' + esc(F(l.id).short)}</span><span class="fix">Grana ${Math.round(ds.econ * 100)}%</span><span class="fix ${ds.vigil >= 40 ? 'hot' : ''}">Polícia ${ds.vigil}</span><i class="localeQ" aria-hidden="true">?</i></button></section>`;
  }
  const statName = id => SB.STATS.find(x => x.id === id).name;
  const chanceClass = p => p < 55 ? 'danger' : p < 75 ? 'risky' : '';
  /** Sugestão do painel: maior retorno esperado por energia com chance razoável. */
  function suggestion() {
    let best = null, bv = -Infinity;
    for (const m of SB.MISSIONS) {
      if (SB.missionLock(state, m)) continue;
      const p = SB.missionChance(state, m) / 100;
      const v = (p * (m.low + m.high) / 2 * SB.missionRewardMult(state, m) - (1 - p) * state.cash * SB.failLoss(state, m)) / m.cost;
      if (p >= .5 && v > bv) { bv = v; best = m; }
    }
    return best;
  }

  /* ---------- primeiros passos, rumo e ajuda ---------- */
  
  /** Cartão do passo atual: completo no Início, em faixa nas outras telas. */
  function guideCard() {
    const st = SB.tutorialStep(state); if (!st) return '';
    const n = state.tutorial.step + 1, total = SB.TUTORIAL.length, here = st.view === view;
    const dots = SB.TUTORIAL.map((_, i) => `<i class="${i < n - 1 ? 'ok' : i === n - 1 ? 'now' : ''}"></i>`).join('');
    const go = here ? `<span class="guideHere">É nesta tela ↓</span>` : button(`${esc(st.cta)} →`, 'switch', `data-target="${st.view}"`, false, 'small primary');
    if (view !== 'painel') return `<section class="guide slim" aria-label="Primeiros passos"><div><b>Passo ${n}/${total}</b> ${esc(st.title)}</div>${go}</section>`;
    return `<section class="guide" aria-label="Primeiros passos"><div class="guideHead"><span>Primeiros passos · ${n}/${total}</span><span class="guideDots" aria-hidden="true">${dots}</span></div>
      <h3>${esc(st.title)}</h3><p>${esc(st.text)}${st.reward ? ` <strong>Recompensa: ${fmt(st.reward)}.</strong>` : ''}</p>
      <div class="guideBtns">${go}${button('Como jogar', 'help', '', false, 'small ghost')}${button('Pular guia', 'skip-tutorial', '', false, 'small ghost')}</div></section>`;
  }
  const CAT_TIPS = {
    fortuna: 'junte dinheiro com serviços e negócios e guarde no banco',
    fama: 'conclua serviços mais difíceis, treine e compre negócios',
    territorio: 'crie contatos até 60 de influência e mantenha a liderança de um bairro',
    diplomacia: 'dialogue com os grupos, firme tréguas e uma aliança',
    gangue: 'faça a operação coletiva todo dia e vença confrontos',
    comercio: 'no Galpão, compre onde está barato, venda onde está caro e guarde o que o comprador de fora quer'
  };
  /** Rumo (antigo): substituído pelo cartão Sua temporada. */
  let helpPage = 0;
  function helpPages() {
    const c = state ? SB.cityOf(state.city) : SB.CITIES[0];
    return [
      ['O objetivo', `<p><b class="age18">18+</b> Ficção adulta: crime, violência, drogas e linguagem pesada.</p><p>Você chega a <strong>${esc(c.name)}</strong> com pouco dinheiro e nenhum nome. Tem <strong>30 dias</strong> (uma temporada) para virar alguém.</p>
        <p>O placar é um só: o <strong>respeito</strong>. Ele sobe nos roubos, duelos, assaltos e negócios, e também nos <strong>feitos do mês</strong> (bronze, prata e ouro em Fortuna, Território, Diplomacia, Gangue e Comércio), que pagam respeito na hora. Não precisa ser bom em tudo: escolha um ou dois caminhos e vá fundo.</p>
        <p>O respeito também dá a sua <strong>patente</strong>, de <em>Pé de chinelo</em> a <em>Dono do morro</em>, e é o que conta no ranking. O cartão <strong>Sua temporada</strong>, na Rua, mostra a próxima patente e o feito mais perto.</p>`],
      ['Seu dia', `<p>Tudo gasta <strong>energia</strong> (barra verde). Um dia típico:</p>
        <ol><li><strong>Serviços</strong> rendem dinheiro e respeito. Veja a chance antes.</li><li><strong>Treino</strong> melhora atributos e libera serviços maiores.</li><li><strong>Contatos</strong> nos bairros viram influência e tributo.</li><li>O ciclo fica nas abas: <strong>Roubar</strong>, <strong>Noite</strong> (recarrega energia) e <strong>Feira</strong> (arma abre roubo maior). Na <strong>Cidade</strong> ficam o bando, o banco e o resto, que vão se abrindo com o respeito: Galpão (comprar barato, vender caro, produzir e despachar), a noite (energia extra, com ressaca), os Duelos de rua e o Hospital.</li><li>Sem energia? <strong>Avance o dia</strong>: +70 de energia, a renda entra e os grupos se movem.</li></ol>
        <p>Respeito libera serviços, a gangue (30) e mais. Dinheiro compra treino, negócios e equipe.</p>`],
      ['Os riscos', `<p><strong>Procurado</strong> (barra vermelha) sobe a cada serviço e derruba suas chances. Ele cai sozinha ao virar o dia, ou com “Ficar na sua”.</p>
        <p><strong>Falhar</strong> tira parte do dinheiro <em>em mãos</em> e pode dar <strong>detenção</strong> (dias perdidos, ou fiança). O banco protege o dinheiro por uma taxa.</p>
        <p><strong>Assaltos do bando</strong> (Cidade → Bando): planeje, estude o terreno nos dias seguintes e execute dentro do prazo. Do arrastão no shopping ao cofre central; os maiores pedem bando grande e arma pesada.</p>
        <p><strong>Noite</strong>: entre numa casa (a entrada conta como saída) e peça doses no balcão, de cigarro (+2) a pó (+100). Quanto mais forte, mais vício. Cada dose repetida no dia rende 15% menos, e o corpo aguenta no máximo 150 de energia em doses por dia: depois, só dormindo.</p>
        <p><strong>Vício</strong> (barra roxa): cada dose sobe o vício; alto, a dose recarrega menos e loló, bala e pó podem dar overdose. O Hospital limpa.</p>
        <p><strong>Colete</strong>: roubo armado que dá errado vira trocação com a segurança. O colete decide se você sai ferido ou vai para a UPA. Ser preso custa respeito.</p>
        <p><strong>Saúde</strong> (barra azul) cai em confrontos, duelos e serviços de força que dão errado. Abaixo de 60 suas chances caem; a zero, você é internado. Cure no Hospital ou esperando.</p>
        <p>Toque no seu retrato, no topo, para abrir o <strong>Perfil</strong> e escolher outra foto.</p>
        <p><strong>Equipamento</strong>: arma, proteção e veículo somam chance em todo roubo (a arma pesa mais nos de Força e menos nos de Lábia), e os roubos grandes pedem arma e veículo de fuga. Proteção e veículo equipados também diminuem a chance de ser preso.</p>
        <p><strong>Resultado</strong>: depois de cada ação, o resultado pula na tela com o que mudou. Toque em OK (ou fora) para fechar.</p>
        <p><strong>Feira</strong>: o que você compra é seu. Para trocar de arma, proteção ou veículo, toque em <strong>Usar</strong>, de graça.</p>
        <p><strong>Trilha de compra</strong>: na Feira (armas, proteções e veículos) e nos negócios, o próximo só abre depois que você compra o anterior nesta temporada.</p>
        ${state && state.clock ? '<p><strong>Online</strong>: o dia vira sozinho à meia-noite de Brasília e a temporada é o mês do calendário. A energia volta +1 a cada 3 minutos. <strong>Ir pra casa</strong> (3 horas, até 2 vezes por dia) enche a energia e zera o corpo. Na cadeia e no hospital, 1 dia vale 2 horas.</p>' : ''}
        <p><strong>Roubos</strong> vêm em escada, do mais fácil ao mais difícil. A chance vem do seu poder contra a dificuldade (poder igual = 70%, 1,5 vez = 90%). O <strong>genérico</strong> soma os atributos e 3 por ponto de arsenal (arma + proteção + veículo); o <strong>golpe</strong> pesa 3 por ponto de um atributo; o <strong>assalto</strong> pesa o arsenal. Nos 3 primeiros degraus, falhar não dá cadeia.</p>
        <p><strong>Procurado</strong>: repetir o mesmo roubo é permitido, mas cada um sobe o Procurado e a polícia do bairro. Ele tira poder (com 50, −20%); com 60 a detenção sobe +10, e com 85 até o roubo que deu certo pode virar enquadro. Para esfriar: ficar na sua (energia), a propina (dinheiro; mais cara para quem faz roubo maior, +50% a cada vez no dia), trocar de bairro ou esperar.</p>
        <p><strong>Saúde</strong>: tirar o vício custa saúde (meio ponto por ponto de vício). Saúde zero = UTI: ${state && state.clock ? '24 horas' : 'o resto do dia e o seguinte'} sem jogar.</p>
        <p>Os <strong>grupos rivais</strong> reagem: agir no território deles gera atrito, retaliação e extorsão. Dá para conversar, firmar trégua ou aliança.</p>`],
      ['Sua cidade', `<p><strong>${esc(c.name)} — ${esc(c.trait)}.</strong> ${esc(c.traitDesc)}</p>
        <ul>${SB.DISTRICTS.map(d => `<li><strong>${esc(d.name)}</strong>: ${esc(d.advantage)}</li>`).join('')}</ul>
        <p>O mês tem quatro semanas com ritmo próprio. Dias de pagamento (5 e 20) engordam lotérica, caixa e assaltos; nas Noites de fluxo suas casas rendem o dobro; nos três últimos dias a polícia aperta e no dia 30 atraca o Último Navio. Fique de olho no calendário: <strong>${esc(SB.EVENTS.carnaval.title)}</strong> começa no dia 9 e o <strong>${esc(SB.EVENTS.classico.title)}</strong> é no dia 20.</p>`]
    ];
  }
  function renderHelp() {
    const pages = helpPages(), [title, body] = pages[helpPage], last = helpPage === pages.length - 1;
    $('#helpBox').innerHTML = `<div class="helpHead"><span>Como jogar · ${helpPage + 1}/${pages.length}</span><button type="button" class="close" data-action="close-help" aria-label="Fechar">×</button></div>
      <h2 id="helpTitle">${title}</h2><div class="helpBody">${body}</div>
      <div class="helpBtns">${helpPage ? button('Voltar', 'help-prev', '', false, 'small ghost') : '<span></span>'}${last ? button(state && SB.tutorialStep(state) ? 'Começar' : 'Fechar', 'close-help', '', false, 'primary') : button('Próximo', 'help-next', '', false, 'primary')}</div>`;
  }
  function openHelp(page = 0) { if (state) SB.applyCity(state.city); helpPage = page; renderHelp(); $('#help').classList.remove('hidden'); const b = $('#helpBox .btn.primary'); if (b) b.focus(); }
  function closeHelp() { $('#help').classList.add('hidden'); }

  /* ---------- telas ---------- */
  /** "E agora?": o próximo passo do ciclo (roubar → noite → feira → dormir), decidido pelo estado. */
  function nextMove() {
    const s = state;
    if (SB.blocked(s)) return null;
    const best = suggestion(), lowEnergy = s.energy < 16, canNight = (s.today.night < SB.NIGHT_LIMIT || !!s.today.venue) && s.energy < 100;
    const curPow = (SB.item(s.gear.arma) || { power: 0 }).power;
    const upgrade = SB.ITEMS.filter(i => i.slot === 'arma' && !i.trophy && !SB.owns(s, i.id) && i.power > curPow && s.respect >= i.unlock && !SB.chainLock(s, 'items', i.id) && s.cash >= i.cost * 1.5).pop();
    const lockedByGun = SB.MISSIONS.find(m => (SB.missionLock(s, m) || '').startsWith('Requer arma'));
    const lockedByCar = SB.MISSIONS.find(m => (SB.missionLock(s, m) || '').startsWith('Requer veículo'));
    const car = lockedByCar && SB.ITEMS.find(i => i.slot === 'veiculo' && i.escape >= lockedByCar.req.escape && !SB.owns(s, i.id) && s.respect >= i.unlock && !SB.chainLock(s, 'items', i.id) && s.cash >= i.cost * 1.3);
    if (s.health < 40) return { tag: 'Saúde baixa', title: 'Passe no Hospital', text: `Com ${s.health} de saúde suas chances caem em tudo.`, btn: button('Ir ao Hospital', 'switch', 'data-target="hospital"', false, 'primary') };
    if (s.vicio >= 70) return { tag: 'Vício alto', title: 'Hora de desintoxicar', text: `Vício ${s.vicio}/100: a noite recarrega menos e há ${SB.overdoseChance(s)}% de chance de overdose a cada saída.`, btn: button('Ir ao Hospital', 'switch', 'data-target="hospital"', false, 'primary') };
    if (s.heat >= 65 && s.energy >= 18) return { tag: 'Procurado alto', title: 'Fique na sua', text: 'A polícia está de olho: cada roubo agora tem mais chance de dar cadeia.', btn: button('Reduzir exposição · 18 energia', 'lay-low', '', false, 'primary') };
    if (car) return { tag: 'Dinheiro no bolso', title: `Dá para comprar: ${car.name}`, text: `Veículo de fuga abre roubo maior, como “${lockedByCar.name}”.`, btn: button('Ir à Feira do Rolo', 'switch', 'data-target="feira"', false, 'primary') };
    if (upgrade && (lockedByGun || !s.gear.arma)) return { tag: 'Dinheiro no bolso', title: `Dá para comprar: ${upgrade.name}`, text: lockedByGun ? `Arma melhor abre roubo maior, como “${lockedByGun.name}”.` : 'Arma é o que abre os roubos maiores.', btn: button('Ir à Feira do Rolo', 'switch', 'data-target="feira"', false, 'primary') };
    if (lowEnergy && canNight) { const n = SB.NIGHT.filter(x => (!x.unlock || s.respect >= x.unlock) && SB.nightCost(s, x) <= s.cash).pop(); if (n) return { tag: 'Sem energia', title: 'Hora da noitada', text: s.today.venue ? `Você ainda está na casa: peça uma dose e volte a roubar. Doses: ${s.today.doses}/${SB.DOSE_LIMIT}.` : `Entre numa casa e peça uma dose. Saídas: ${s.today.night}/${SB.NIGHT_LIMIT}.`, btn: button(s.today.venue ? 'Ir ao balcão' : 'Ir para a noite', 'switch', 'data-target="noite"', false, 'primary') }; }
    if (lowEnergy && s.clock) return SB.atHome(s) ? { tag: 'Em casa', title: `Descansando: volta em ${dur(SB.clockInfo(s).home)}`, text: 'No fim, energia cheia e o corpo zerado. Banco e compras continuam.', btn: nextDayButton('') } : { tag: 'Sem energia', title: SB.clockInfo(s).homesLeft ? 'Vá pra casa ou espere' : 'Espere a energia voltar', text: `A energia volta +1 a cada 3 minutos (próximo ponto em ${dur(SB.clockInfo(s).nextEnergy)}). Em casa, 3 horas enchem tudo.`, btn: nextDayButton('') };
    if (lowEnergy) return { tag: 'Sem energia', title: s.day >= MAXDAY ? 'Fim da temporada' : 'Durma e vire o dia', text: s.day >= MAXDAY ? 'Último dia: encerre a temporada.' : '+70 de energia, o Procurado cai e a renda entra.', btn: nextDayButton('') };
    if (best) { const p = SB.missionChance(s, best); return { tag: 'Roubo da vez', title: best.name, text: `${best.cost} energia · ${fmt(best.low * SB.missionRewardMult(s, best))}–${fmt(best.high * SB.missionRewardMult(s, best))} · ${p}% de chance`, btn: button('Executar', 'mission', `data-id="${best.id}"`, false, 'primary'), icon: best.stat }; }
    return { tag: 'Nada com boa chance', title: 'Treine ou mude de ares', text: 'Treine um atributo, baixe o Procurado ou vá a outro bairro.', btn: button('Ver roubos e treino', 'switch', 'data-target="acoes"', false, 'primary') };
  }
  function panel() {
    const s = state, mv = nextMove(), guide = guideCard();
    const evs = SB.activeEvents(s).filter(e => e.id !== 'rotina');
    const tired = s.energy < 16 || s.day >= MAXDAY;
    const sleep = s.clock ? nextDayButton('small ' + (tired ? 'primary' : 'ghost')) : s.day >= MAXDAY ? button('Encerrar temporada', 'switch', 'data-target="temporada"', false, 'primary small')
      : button(armedNext ? `Dormir com ${s.energy} de energia?` : 'Dormir', 'next-day', '', false, (armedNext ? 'armed' : tired ? 'primary' : 'ghost') + ' small');
    return jailNotice() + localeStrip(true, false) + localeInfo() + `
      ${resultCard()}
      ${guide}${s.career ? '' : careerCard()}
      ${mv && !guide ? `<section class="boardLead job nextMove"><div class="jobIcon">${statIcon(mv.icon || 'astucia')}</div><div class="jobMain"><div class="eyebrow">E agora? · ${esc(mv.tag)}</div><h3>${esc(mv.title)}</h3><p class="jobMeta">${esc(mv.text)}</p></div><div class="jobAct">${mv.btn}</div></section>` : ''}
      <section class="dayBar dayStrip"><div class="dayInfo"><b>Dia ${s.day}<small>/${MAXDAY}</small></b><span>${esc(SB.week(s).name)}</span>${s.clock ? `<span class="clockLine">O dia vira em ${dur(SB.clockInfo(s).midnight)}${s.energy < 100 ? ` · +1 de energia em ${dur(SB.clockInfo(s).nextEnergy)}` : ''}</span>` : ''}<div class="dayTrack" aria-hidden="true"><i style="width:${(s.day - 1) / (MAXDAY - 1) * 100}%"></i></div></div>${sleep}</section>
      ${evs.length ? `<section class="poster dayNews"><div class="posterHead">HOJE NA CIDADE</div><ul class="eventList">${evs.map(e => `<li><strong>${esc(SB.eventTitle(e))}</strong>${e.until > s.day ? ` · até o dia ${e.until}` : ''}<br>${esc(SB.eventDesc(e))}</li>`).join('')}</ul></section>` : ''}
      ${s.career || s.tutorial.done ? newsCard() : ''}
      ${fichaCard()}
      ${stencil('Diário', 'últimos registros')}<section class="diary">${journal(2)}</section>`;
  }
  /** Temporada em 4 blocos: patente, classe, mês e feitos, cada um com a sua barra. */
  function fichaCard() {
    const s = state, sc = SB.seasonScore(s), pi = SB.phaseIndex(s), ph = SB.PHASES[pi], nx = SB.PHASES[pi + 1];
    const tile = (label, main, side, fill, cls = '') => `<div class="fichaRow ${cls}"><span class="fichaLabel">${label}</span><b>${main}</b><em>${side}</em>${fill === null ? '' : `<div class="meter"><div style="width:${pct(fill)}%"></div></div>`}</div>`;
    let o = tile('Patente', esc(ph.name), nx ? `${esc(nx.name)} com ${nx.at}` : 'patente máxima', nx ? (s.respect - ph.at) / (nx.at - ph.at) * 100 : 100);
    const c = s.career ? SB.CAREERS.find(x => x.id === s.career) : null;
    if (c) { const lvl = SB.careerLevel(s), next = SB.CAREER_XP[lvl]; o += tile('Classe', `${c.name} ${lvl}/3`, next ? `${s.careerXP}/${next} XP` : 'completa', next ? s.careerXP / next * 100 : 100); }
    else o += tile('Classe', 'A escolher', 'decida acima', null);
    o += tile('Mês', `Dia ${s.day}/${MAXDAY}`, s.day < MAXDAY ? `faltam ${MAXDAY - s.day} dia(s)` : 'último dia', s.day / MAXDAY * 100);
    const fc = SB.CATEGORIES.filter(x => SB.FEAT_CATS.includes(x.id)), got = fc.reduce((a, x) => a + s.feats[x.id], 0);
    let near = null; for (const x of sc.cats) { if (!SB.FEAT_CATS.includes(x.id)) continue; const cat = SB.CATEGORIES.find(k => k.id === x.id), nt = cat.tiers[x.medal]; if (!nt) continue; const pv = x.medal ? cat.tiers[x.medal - 1] : 0, gap = (nt - x.value) / (nt - pv); if (!near || gap < near.gap) near = { x, cat, nt, gap, pv }; }
    o += tile('Feitos do mês', `${got}/${fc.length * 3}`, near ? `${esc(near.x.name)} ${SB.MEDALS[near.x.medal + 1]}: +${SB.FEAT_RESPECT[near.x.medal + 1]} ★` : 'todos feitos', near ? (near.x.value - near.pv) / (near.nt - near.pv) * 100 : 100);
    return `<section class="rumo ficha" aria-label="Sua temporada"><div class="rumoHead"><span>Sua temporada</span><b>★ ${num(s.respect)} respeito</b></div><div class="fichaGrid">${o}</div>
      <div class="btnbar fichaGo">${button('Feitos', 'switch', 'data-target="temporada"', false, 'small ghost')}${c ? button('Habilidades', 'switch', 'data-target="perfil"', false, 'small ghost') : ''}</div>
      ${s.day >= 25 && s.day < MAXDAY ? `<p class="warn">Reta final: faltam ${MAXDAY - s.day} dia(s).</p>` : ''}</section>`;
  }
  function journal(max) { return `<ul class="timeline">${state.log.slice(0, max).map(i => `<li><time>Dia ${num(i.day)}</time>${esc(i.msg)}</li>`).join('')}</ul>`; }

  function careerCard() {
    return `<section class="card choiceCard"><div class="eyebrow">Decisão permanente nesta temporada</div><h2>Escolha sua especialização</h2><p>Quatro caminhos para o topo do Respeito: cada um com vantagens, uma desvantagem e três habilidades desbloqueáveis com experiência.</p>
      <div class="choiceGrid">${SB.CAREERS.map(c => `<article><strong>${c.name}</strong> <span class="mini">· ${c.tag}</span><p>${esc(c.desc)}<br><em class="mini">${esc(c.xpDesc)}</em></p>${button('Escolher ' + c.name, 'career', `data-id="${c.id}"`, false, 'small primary block')}</article>`).join('')}</div></section>`;
  }
  function newsCard() {
    const n = SB.currentNews(state); if (!n) return '';
    const f = state.newsPending.faction ? F(state.newsPending.faction) : null;
    return `<section class="poster choiceCard"><div class="posterHead">EXTRA · DIA ${state.day}</div><h2>${esc(n.name)}${f ? ' · ' + esc(f.short) : ''}</h2><p>${esc(n.desc)}</p>
      <div class="choiceGrid">${n.choices.map((c, i) => { const block = SB.newsChoiceBlocked(state, c); const cost = SB.newsChoiceCost(state, c); return `<article><strong>${esc(c.label)}</strong><p>${esc(c.desc)}${c.cashPerMember ? ` (total ${fmt(cost)})` : ''}${block ? `<br><span class="negative">${esc(block)}</span>` : ''}</p>${button('Decidir', 'news', `data-id="${n.id}" data-choice="${i}"`, !!block, 'small block')}</article>`; }).join('')}</div>
      <div class="btnbar" style="margin-top:8px">${button('Ignorar', 'skip-news', '', false, 'ghost small')}</div></section>`;
  }
  /** Posição do roubo na trilha (os exclusivos de bairro vão para o fim, pela dificuldade). */
  function actions() {
    const s = state, ds = s.dstate[s.district];
    const list = SB.MISSIONS.filter(m => missionFilter === 'todas' ? true : missionFilter === 'bairro' ? m.district === s.district : ['', 'Energia insuficiente.', 'Você está detido.', 'Você está internado.'].includes(SB.missionLock(s, m))).sort((a, b) => a.n - b.n); // v1.5: escada do mais fácil ao mais difícil
    return heading('Roubar', 'Do mais fácil ao mais difícil. A chance vem do seu poder contra a dificuldade: o genérico soma atributos e arsenal, o golpe pesa um atributo e o assalto pesa o arsenal (arma + proteção + veículo). Repita quanto quiser: o freio é o Procurado.') + jailNotice() + resultCard() + heatCard() + `
      ${stencil('Roubos', 'você está em ' + esc(D().name))}
      <div class="filterbar" role="group" aria-label="Filtrar missões">${[['disponiveis', 'Disponíveis'], ['bairro', 'Deste bairro'], ['todas', 'Todas']].map(([id, l]) => `<button type="button" class="btn ghost ${missionFilter === id ? 'on' : ''}" data-action="filter" data-id="${id}" aria-pressed="${missionFilter === id}">${l}</button>`).join('')}</div>
      <div class="jobs">${list.length ? list.map(missionCard).join('') : '<div class="empty">Nenhum roubo neste filtro. Ganhe respeito, compre arma na Feira ou veja “Todas”.</div>'}</div>
      ${safeJobs()}
      ${stencil('Treino', `hoje: ${s.today.training}/3`)}
      <div class="jobs">${SB.STATS.map(st => { const lvl = s.stats[st.id], cost = SB.trainCost(s, st.id); return `<section class="job train"><div class="jobIcon">${statIcon(st.id)}<small>${num(lvl)}</small></div><div class="jobMain"><h3>${st.name}</h3><p class="jobDesc">${esc(st.desc)}</p><p class="jobMeta"><b>+${lvl < 25 ? 2 : 1}</b> · 22 energia · ${fmt(cost)}</p></div><div class="jobAct">${button('Treinar', 'train', `data-id="${st.id}"`, s.jail > 0 || s.energy < 22 || s.cash < cost || s.today.training >= 3, '')}</div></section>`; }).join('')}</div>`;
  }
  function missionCard(m) {
    const s = state, lock = SB.missionLock(s, m), p = SB.missionChance(s, m), mult = SB.missionRewardMult(s, m), k = SB.KINDS[m.kind];
    const parts = SB.scoreParts(s, m), odds = SB.missionOdds(s, m), drag = Math.round(SB.heatDrag(s) * 100), tag = m.stat ? `${k.name} · ${statName(m.stat)}` : m.kind === 'assalto' ? `${k.name} · arsenal` : `${k.name} · atributos e arsenal`;
    const hard = lock && !['Energia insuficiente.', 'Você está detido.', 'Você está internado.'].includes(lock);
    const pic = window.SBArt.roubo(m.id);
    return `<section class="job ${pic ? 'withPic' : ''} ${hard ? 'locked' : ''}"><div class="jobIcon" title="${esc(tag)}">${pic ? `<span class="jobPic" aria-hidden="true">${pic}</span>` : statIcon(m.stat || 'arsenal')}<small>${m.stat ? statName(m.stat) : m.kind === 'assalto' ? 'Arsenal' : 'Geral'}</small></div>
      <div class="jobMain"><h3><span class="jobN">${m.n}.</span> ${esc(m.name)}${m.district ? ` <span class="pill">só aqui</span>` : ''}</h3><p class="jobKind k-${m.kind}">${esc(tag)}</p><p class="jobDesc">${esc(m.desc)}</p>
      <p class="jobMeta"><b>${fmt(m.low * mult)}–${fmt(m.high * mult)}</b> · ${SB.missionCost(s, m)} energia · +${m.heat} Procurado · +${SB.respectGain(s, m)} respeito</p>
      <p class="jobGear ${odds.power >= odds.diff ? '' : 'none'}">Seu poder <b>${num(Math.round(odds.power))}</b> × dificuldade <b>${num(Math.round(odds.diff))}</b> · ${parts.filter(x => x[1] > 0).map(x => `${x[0].toLowerCase()} ${Math.round(x[1])}`).join(' + ')}${drag ? ` · Procurado −${drag}%` : ''}</p>
      <p class="jobRisk">${m.safe ? 'Se falhar: só perde a energia (sem cadeia e sem perder caixa).' : `Se falhar: −${Math.round(SB.failLoss(s, m) * 100)}% do caixa em mãos, detenção ${SB.arrestChance(s, m)}%`}</p>
      ${lock ? `<div class="lockline">${esc(lock)}</div>` : ''}</div>
      <div class="jobAct"><span class="seal ${chanceClass(p)}">${p}%</span>${button('Executar', 'mission', `data-id="${m.id}"`, !!lock, 'primary')}</div></section>`;
  }
  /** v1.5: termômetro do Procurado com as faixas (gatilhos) e as formas de esfriar. */
  function heatCard() {
    const s = state, ti = SB.heatTier(s), tier = SB.HEAT_TIERS[ti], cc = SB.cleanCost(s), uses = s.today.despachante || 0;
    const marks = SB.HEAT_TIERS.map((x, i) => `<span class="heatTier ${i === ti ? 'on' : ''} ${i < ti ? 'past' : ''}"><b>${x.at}+</b> ${esc(x.name)}</span>`).join('');
    return `<section class="card heatCard t${ti}" aria-label="Procurado">
      <div class="space"><h3>Procurado ${num(s.heat)} · ${esc(tier.name)}</h3><span class="mini">cai ${num(SB.heatDecayPerDay(s) * (s.clock ? SB.CLOCK.heatPace : 1))} por dia</span></div>
      <div class="heatMeter" aria-hidden="true"><i style="width:${pct(s.heat)}%"></i></div><div class="heatTiers">${marks}</div>
      <p class="mini">${esc(tier.desc)}${ti < SB.HEAT_TIERS.length - 1 ? ` Próxima faixa: ${esc(SB.HEAT_TIERS[ti + 1].name)} com ${SB.HEAT_TIERS[ti + 1].at}.` : ''}</p>
      <div class="heatActs">
        <div><span class="mini"><b>Ficar na sua</b> · 18 energia · −20 (e −10 da polícia do bairro)</span>${button('Esfriar', 'lay-low', '', s.energy < 18 || s.jail > 0 || s.heat === 0, 'small')}</div>
        <div><span class="mini"><b>Propina</b> · ${fmt(cc)} · −25${uses ? ` · ${uses + 1}ª hoje` : ''}. A polícia cobra pela sua ficha (maior roubo feito: ${num(Math.max(1, s.ladderMax || 0))}º degrau); cada nova no dia, +50%.</span>${button('Pagar', 'clean-record', '', s.heat <= 0 || s.cash < cc || s.jail > 0, 'small primary')}</div>
        <p class="mini">Também esfria: trocar de bairro (a polícia é de cada bairro, e ela pesa metade), fazer bico (−4)${s.clock ? ' e ir pra casa' : ' e dormir'}.</p>
      </div></section>`;
  }
  function safeJobs() {
    const s = state;
    return `<div class="section"><h2>Outras escolhas</h2><small>Menos risco, menor retorno</small></div><div class="grid two">
      <section class="card"><h3>Bico de ocasião</h3><p>Trabalho simples e garantido, sem reputação.</p><div class="space"><span class="mini">28 energia · ${fmt(110 * SB.eventMod(s, 'gigMult'))}–${fmt(170 * SB.eventMod(s, 'gigMult'))} · -4 de Procurado</span>${button('Fazer bico', 'gig', '', s.energy < 28 || s.jail > 0, 'small')}</div></section>
      <section class="card"><h3>Arsenal</h3><p>Arma ${num(SB.armPower(s, true))} + proteção ${num(SB.armDef(s))} + veículo ${num(SB.gearVal(s, 'escape'))} = <strong>${num(SB.arsenal(s))}</strong>. Cada ponto vale 3 de poder nos roubos genéricos e nos assaltos, e 1 nos golpes. Melhore na Feira.</p></section></div>
      <div class="notice" style="margin-top:9px">Falhas tiram parte do dinheiro <strong>em mãos</strong>. Depositar protege, mas custa ${SB.hasPerk(s, 'empreendedor', 1) ? '1%' : '3%'} de taxa.</div>`;
  }

  function city() {
    const s = state, d = D(), ds = s.dstate[d.id], l = SB.leader(s, d.id), lf = F(l.id), lr = s.factions[l.id];
    const agreed = SB.agreement(s, l.id), cc = SB.contactCost(s), used = s.today.contacts[d.id] || 0;
    const disputeBlock = s.jail > 0 || s.cash < 320 || s.energy < 33 || s.influence[d.id] < 20 || agreed || lr.lastActionDay === s.day;
    const special = SB.MISSIONS.find(m => m.district === d.id);
    return heading('Bairros', 'Cada bairro tem dono, grana e polícia próprios, que mudam a cada dia.') + jailNotice() + resultCard() + localeStrip(true) + `
      <section class="card"><div class="space factionHeader"><div><h2>Influência em ${esc(d.name)}</h2><p>Quem lidera: <strong>${SB.controlled(s, d.id) ? 'você' : esc(lf.name)}</strong>. ${esc(SB.factionStatus(s, l.id))}. Liderar exige 60 de influência e 10 acima da maior facção.</p></div>${SB.controlled(s, d.id) ? '<span class="pill">Você lidera</span>' : ''}</div>
        <div class="dualMeters"><div><div class="meterlabel"><span>Sua influência</span><strong>${s.influence[d.id]}</strong></div><div class="meter green"><div style="width:${s.influence[d.id]}%"></div></div></div>
        <div><div class="meterlabel"><span>${esc(lf.short)} (maior facção)</span><strong>${l.value}</strong></div><div class="meter red"><div style="width:${l.value}%"></div></div></div></div>
        <div class="chips">${SB.FACTIONS.map(f => `<span class="chip">${esc(f.short)} ${s.presence[d.id][f.id]}</span>`).join('')}</div>
        <div class="btnbar" style="margin-top:12px">${button(`Criar contatos · ${fmt(cc)}`, 'contact', '', s.jail > 0 || s.cash < cc || s.energy < 22 || used >= 2, 'small primary')}${button(`Disputar área · R$ 320 (${SB.disputeOdds(s, d.id)}%)`, 'dispute', '', disputeBlock, 'small')}</div>
        <p class="mini" style="margin-top:8px">Contatos: 22 energia, até 2 por bairro ao dia (o segundo rende metade). Disputa: 33 energia, exige 20 de influência; uma ação por facção ao dia; bloqueada por acordos.${agreed ? ` Você tem acordo com ${esc(lf.short)}.` : ''}</p></section>
      <section class="brandpanel" style="margin-top:13px"><p>${esc(d.desc)}</p>
        <div class="kv"><div><span>Grana</span><strong>${Math.round(ds.econ * 100)}%</strong></div><div><span>Polícia no bairro</span><strong>${ds.vigil}</strong></div><div><span>Recompensas</span><strong>${signed(d.bonus)}%</strong></div><div><span>Risco base</span><strong>${signed(d.risk)}</strong></div><div><span>Tributo se liderar</span><strong>${fmt(SB.tribute(s, d.id))}/dia</strong></div><div><span>Oportunidade</span><strong>${special ? esc(special.name) : '—'}</strong></div></div>
        <p class="mini" style="margin-top:9px">Vantagem de liderar: ${esc(d.advantage)} Cada bairro liderado também gera +2 de Procurado por dia e atrai as facções.</p></section>
      <div class="section"><h2>Mapa da cidade</h2><small>Viagem: ${fmt(SB.travelCost(s).cash)}${SB.travelCost(s).energy ? ' e ' + SB.travelCost(s).energy + ' energia' : ''}</small></div>
      <div class="grid two">${SB.DISTRICTS.map(x => districtCard(x)).join('')}</div>
      <div class="section"><h2>Domínio da cidade</h2><small>Sua influência nos bairros contra a das facções</small></div>
      <section class="card">${SB.seasonRanking(s).map((r, i) => `<div class="rankRow ${r.player ? 'me' : ''}"><strong>${i + 1}. ${esc(r.name)}</strong><span>${num(r.power)}</span></div>`).join('')}<p class="mini" style="margin-top:6px">Soma da influência/presença nos bairros, +30 por bairro liderado.</p></section>
      <p class="quiet" style="margin-top:15px">Bairros, grupos e personagens são inventados e não representam comunidades reais.</p>`;
  }
  function districtCard(x) {
    const s = state, l = SB.leader(s, x.id), here = x.id === s.district, ds = s.dstate[x.id];
    const evs = SB.activeEvents(s).filter(e => e.district === x.id);
    return `<section class="card district ${here ? 'selected' : ''}"><div class="miniScene">${scene(x.id)}${plate(x.name)}${here ? '<span class="pill here">Você está aqui</span>' : SB.controlled(s, x.id) ? '<span class="pill here">Você lidera</span>' : ''}</div>
      <div class="kv"><div><span>Líder</span><strong>${SB.controlled(s, x.id) ? 'Você' : esc(F(l.id).short) + ' ' + l.value}</strong></div><div><span>Sua influência</span><strong>${s.influence[x.id]}</strong></div><div><span>Grana</span><strong>${Math.round(ds.econ * 100)}%</strong></div><div><span>Polícia no bairro</span><strong>${ds.vigil}</strong></div></div>
      ${evs.length ? `<div class="chips">${evs.map(e => `<span class="chip warn">${esc(SB.eventTitle(e))}</span>`).join('')}</div>` : ''}
      <div class="statusbar"><span class="mini">${esc(x.advantage)}</span>${here ? '' : button('Viajar', 'travel', `data-id="${x.id}"`, s.cash < SB.travelCost(s).cash || s.energy < SB.travelCost(s).energy || s.jail > 0, 'small')}</div></section>`;
  }

  function management() {
    const s = state, fee = SB.hasPerk(s, 'empreendedor', 1) ? 1 : 3;
    return heading('Banco e negócios', 'Proteja seu dinheiro e monte renda diária. Cada negócio depende da economia e das facções do bairro.') + `<div class="screenArt">${window.SBArt.place('gestao')}</div>` + jailNotice() + resultCard() + `
      <div class="grid two" style="margin-top:13px"><section class="card"><h2>Banco</h2><p>Depósitos ficam protegidos de falhas e retaliações. Taxa de depósito: ${fee}%. Saques são gratuitos.</p>
        <div class="formfield"><label for="bankAmount">Valor em reais (R$)</label><input class="input" id="bankAmount" type="number" min="1" step="1" inputmode="numeric" placeholder="Ex.: 500"></div>
        <div class="btnbar" style="margin-top:10px">${button('Depositar', 'bank', 'data-mode="deposit"', false, 'primary small')}${button('Sacar', 'bank', 'data-mode="withdraw"', false, 'small')}${button(`Depositar tudo (${fmt(SB.maxDeposit(s))})`, 'bank-all', '', SB.maxDeposit(s) < 1, 'small ghost')}</div></section>
      <section class="card"><h2>Patrimônio</h2><table class="table"><tbody><tr><td>Dinheiro em mãos</td><td>${fmt(s.cash)}</td></tr><tr><td>Banco</td><td>${fmt(s.bank)}</td></tr><tr><td>Negócios (revenda 60%)</td><td>${fmt(SB.resaleValue(s))}</td></tr><tr><td><strong>Patrimônio total</strong></td><td><strong>${fmt(SB.patrimony(s))}</strong></td></tr></tbody></table>
        <div class="statusbar"><span>Negócios hoje</span><strong class="positive">${fmt(SB.income(s))}</strong></div>
        <div class="statusbar"><span>Manutenção da equipe</span><strong class="negative">${fmt(SB.groupUpkeep(s))}</strong></div>
        ${s.contracts.length ? `<div class="statusbar"><span>Sociedades ativas</span><strong>${s.contracts.map(c => `${fmt(c.daily)} × ${c.days} dia(s)`).join(', ')}</strong></div>` : ''}</section></div>
      <div class="section"><h2>Estabelecimentos</h2><small>Renda paga ao avançar o dia</small></div>
      <div class="grid two">${SB.BUSINESSES.map(b => businessCard(b)).join('')}</div>
      <p class="quiet" style="margin-top:13px">Renda = valor base × economia do bairro × eventos × especialização. Liderar o bairro dá +15%; uma facção hostil dominante cobra 15%; extorsões cortam a renda do dia.</p>`;
  }
  function businessCard(b) {
    const s = state, owned = s.businesses.includes(b.id), cost = SB.buyCost(s, b), today = SB.businessIncome(s, b), cl = owned ? '' : SB.chainLock(s, 'biz', b.id);
    return `<section class="card"><div class="space"><h3>${esc(b.name)}</h3>${owned ? '<span class="pill">Seu</span>' : ''}</div><p>${esc(b.desc)}</p>
      <table class="table"><tbody><tr><td>Bairro</td><td>${esc(D(b.district).name)}</td></tr><tr><td>Compra</td><td>${fmt(cost)}</td></tr><tr><td>Base / dia</td><td>${fmt(b.net)}</td></tr><tr><td>Renda estimada hoje</td><td class="positive">${fmt(today)}</td></tr><tr><td>Revenda</td><td>${fmt(b.cost * SB.RESALE)}</td></tr></tbody></table>
      ${s.extorted[b.id] === s.day ? '<p class="negative mini">Sob extorsão hoje: renda reduzida.</p>' : ''}
      ${owned ? button('Vender negócio', 'sell', `data-id="${b.id}"`, s.jail > 0, 'block ghost small') : (cl ? `<div class="lockline">${esc(cl)}</div>` : '') + button(`Comprar · +${b.respect} respeito`, 'buy', `data-id="${b.id}"`, !!cl || s.cash < cost || s.jail > 0, 'block primary')}</section>`;
  }

  function gang() {
    const s = state, created = !!s.gangName;
    let top;
    if (created) {
      const rc = SB.recruitCost(s), up = SB.upgradeCost(s), odds = SB.gangOdds(s);
      top = `<section class="brandpanel"><div class="eyebrow">Seu grupo</div><h2>${esc(s.gangName)}</h2><p>Integrantes evoluem com operações e confrontos. Ânimo baixo reduz chances e pode causar deserções para facções rivais.</p>
        <div class="flex"><span class="badge">Sede nível ${s.gangLevel}</span><span class="badge">${s.crew.length}/8 integrantes</span><span class="badge">Ânimo ${s.crewMorale}/100</span><span class="badge">Manutenção ${fmt(SB.groupUpkeep(s))}/dia</span></div></section>
      <div class="grid two" style="margin-top:13px"><section class="card"><h2>Equipe</h2>${s.crew.length ? `<div class="crewGrid">${s.crew.map(m => { const r = SB.ROLES.find(x => x.id === m.role); return `<div class="memberCard role-${m.role}" title="${esc(r.desc)}"><span class="lvl">${m.level}</span><strong>${esc(m.name)}</strong><em>${r.name}</em><div class="meter"><div style="width:${m.level >= 5 ? 100 : m.xp / (m.level * 4) * 100}%"></div></div><span class="mini">${fmt(SB.memberUpkeep(m))}/dia</span><button type="button" class="x" data-action="dismiss" data-id="${m.id}" aria-label="Dispensar ${esc(m.name)}">×</button></div>`; }).join('')}</div><p class="mini">${SB.ROLES.map(r => r.name + ': ' + r.desc).join(' ')}</p>` : '<div class="empty">Sem integrantes. Recrute para operar.</div>'}
        <div class="statusbar"><span>Recrutar (1 por dia)</span><strong>${fmt(rc)} · 18 energia</strong></div>
        <div class="roleBtns">${SB.ROLES.map(r => button(r.name, 'recruit', `data-id="${r.id}"`, s.crew.length >= 8 || s.crewLastRecruit === s.day || s.cash < rc || s.energy < 18 || s.jail > 0, 'small')).join('')}</div>
        <div class="statusbar"><span>Reunir equipe (+18 ânimo)</span><strong>${fmt(180)} · 12 energia</strong></div>${button('Reunir equipe', 'rally', '', s.crewLastRally === s.day || s.crewMorale >= 100 || s.cash < 180 || s.energy < 12 || s.jail > 0, 'block small')}</section>
      <section class="card"><h2>Operações do grupo</h2><p>Uma por dia, no bairro atual. Rende conforme a economia local e aumenta o Procurado. Chance depende de sede, integrantes, funções, ânimo e Procurado.</p>
        <div class="statusbar"><span>Operação coletiva · 35 energia</span><strong>${odds}% de sucesso</strong></div>${button(s.today.op ? 'Já realizada hoje' : 'Organizar operação', 'gang-op', '', s.jail > 0 || s.energy < 35 || s.today.op || s.crew.length < 2, 'primary block small')}
        <div class="statusbar"><span>Melhorar a sede (nível ${s.gangLevel + 1})</span><strong>${s.gangLevel >= 8 ? 'Máximo' : fmt(up)}</strong></div>${button('Melhorar sede', 'upgrade', '', s.cash < up || s.gangLevel >= 8 || s.jail > 0, 'block small')}</section></div>`;
    } else {
      top = `<section class="brandpanel"><div class="eyebrow">Comece sua história</div><h2>Nenhuma gangue fundada</h2><p>Com um grupo você opera em equipe, confronta facções, firma tréguas e alianças.</p></section>
      <section class="card" style="margin-top:13px"><h2>Fundar gangue</h2><p>Requisitos: 30 de respeito e ${fmt(1800)} em mãos. Você começa com um Músculo e um Olheiro.</p>
        <div class="formfield"><label for="gangName">Nome do grupo</label><input id="gangName" class="input" maxlength="25" placeholder="Nome fictício da sua gangue" autocomplete="off"></div>
        <div style="margin-top:12px">${button('Fundar grupo', 'found-gang', '', s.respect < 30 || s.cash < 1800 || s.jail > 0, 'primary')}</div></section>`;
    }
    const brief = `<section class="card"><div class="space"><h2>Disputa na cidade</h2><span class="pill">${s.gangStats.confrontWins} vitórias • ${s.gangStats.confrontLosses} derrotas</span></div>
      <p>As facções agem todos os dias segundo sua personalidade: expandem, se fortalecem, retaliam, guerreiam entre si ou propõem acordos.${s.nemesis ? ` <strong>Rival histórico:</strong> ${esc(F(s.nemesis).name)}.` : ''}</p>
      <div class="rivalMetrics"><div><span>Acordos</span><strong>${s.gangStats.pacts}</strong></div><div><span>Retaliações</span><strong>${s.gangStats.retaliations}</strong></div><div><span>Seus bairros</span><strong>${SB.controls(s).length}/${SB.DISTRICTS.length}</strong></div></div>${s.treachery ? `<p class="negative mini">Você rompeu ${s.treachery} acordo(s): diálogos com chance menor.</p>` : ''}</section>`;
    const hp = s.heist ? SB.heist(s.heist.id) : null;
    const heistLink = `<div class="places" style="grid-template-columns:1fr"><button type="button" class="place p-assaltos" data-view="assaltos"><span class="placeScene">${window.SBArt.place('assaltos')}</span><b>Assaltos do bando</b><small>${hp ? `Plano: ${esc(hp.name)} · informação ${s.heist.intel}/40` : s.day < s.heistReady ? `Esfriando até o dia ${s.heistReady}` : `${s.gangStats.heists} feito(s) · planeje o próximo`}</small>${hp ? '<i class="placeBadge">Em andamento</i>' : ''}</button></div>`;
    return heading('Gangue e facções', 'Negocie, fortaleça sua equipe ou enfrente os grupos rivais simulados.') + jailNotice() + resultCard() + (created ? heistLink : '') + top +
      `<div class="section"><h2>Grupos da cidade</h2><small>Uma interação por grupo ao dia</small></div>` + brief +
      `<div class="grid two" style="margin-top:13px">${SB.FACTIONS.map(factionCard).join('')}</div><div class="notice" style="margin-top:13px">Simulação individual: não há outros jogadores, chat ou guerra online nesta versão.</div>`;
  }
  function factionCard(f) {
    const s = state, r = s.factions[f.id], truce = SB.pactActive(s, f.id), used = r.lastActionDay === s.day, free = s.jail === 0 && !used;
    const lead = SB.DISTRICTS.filter(d => SB.leader(s, d.id).id === f.id && !SB.controlled(s, d.id)).map(d => d.name);
    const inLead = SB.leader(s, s.district).id === f.id;
    const pc = SB.pactCost(s, f.id), ac = SB.allianceCost(s);
    const btns = [button(`Dialogar · R$ 170 (${SB.dialogueOdds(s, f.id)}%)`, 'faction-dialogue', `data-id="${f.id}"`, !free || s.cash < 170 || s.energy < 18, 'small')];
    if (s.gangName) {
      if (!SB.agreement(s, f.id)) {
        btns.push(button(`Trégua · ${fmt(pc)}`, 'faction-pact', `data-id="${f.id}"`, !free || r.relation < 35 || s.cash < pc || s.energy < 24 || s.day >= MAXDAY || s.day <= r.cooldown, 'small'));
        btns.push(button(`Aliança · ${fmt(ac)}`, 'faction-alliance', `data-id="${f.id}"`, !free || r.relation < 60 || s.gangLevel < 2 || s.cash < ac || s.energy < 20 || SB.FACTIONS.some(x => s.factions[x.id].allied), 'small'));
        btns.push(button(`Confrontar · R$ 300${inLead ? ` (${SB.clashOdds(s, s.district)}%)` : ''}`, 'faction-clash', `data-id="${f.id}"`, !free || !inLead || s.influence[s.district] < 20 || s.cash < 300 || s.energy < 32, 'small danger'));
      } else btns.push(button(r.allied ? 'Romper aliança' : 'Romper trégua', 'faction-break', `data-id="${f.id}"`, false, 'small danger'));
    }
    const hint = used ? 'Interação diária já usada com este grupo.' : r.allied ? `Aliança: +10% nas missões no território dele, sem atrito, apoio contra ${F(SB.FACTION_ENEMY[f.id]).short}. Contribuição de ${fmt(SB.allianceFee(s))}/dia.` :
      truce ? `Trégua até o dia ${r.truceUntil}. Agir no território do grupo desgasta o acordo.` :
      `Trégua: relação +35${r.cooldown >= s.day ? ` (disponível após o dia ${r.cooldown})` : ''}. Aliança: relação +60 e sede nível 2. Confronto: ${f.short} deve liderar o bairro onde você está.`;
    return `<section class="card rivalCard dossier"><div class="dossierHead ${window.SBArt.grupo(SB.cityOf(s.city).id, f.id) ? 'withPic' : ''}">${window.SBArt.grupo(SB.cityOf(s.city).id, f.id) ? `<span class="grupoPic" aria-hidden="true">${window.SBArt.grupo(SB.cityOf(s.city).id, f.id)}</span>` : emblem(f.id)}<div><h3>${esc(f.name)}</h3><div class="eyebrow">${esc(f.persona.label)} • ${lead.length ? 'lidera ' + esc(lead.join(', ')) : 'sem bairro liderado'}</div></div><span class="pill">${esc(SB.factionStatus(s, f.id))}</span></div><p>${esc(f.desc)}</p>
      <div class="rivalMetrics"><div><span>Relação</span><strong>${signed(r.relation)}</strong></div><div><span>Tensão</span><strong>${r.tension}/100</strong></div><div><span>Força</span><strong>${r.power}</strong></div></div>
      ${r.lastMove ? `<p class="mini"><strong>Último movimento:</strong> ${esc(r.lastMove)}</p>` : ''}${r.grudge >= 3 ? `<p class="negative mini">Rancor alto (${r.grudge}): pode virar rival histórico.</p>` : ''}
      <div class="btnbar">${btns.join('')}</div><p class="mini">${esc(hint)}</p></section>`;
  }

  function seasons() {
    const s = state, sc = SB.seasonScore(s);
    return heading('Temporada', 'Trinta dias para subir no respeito: roubando, mandando nos bairros, negociando, com o bando ou no comércio.') + `<div class="screenArt">${window.SBArt.place('temporada')}</div>` + resultCard() + `
      <div class="grid two"><section class="card"><div class="eyebrow">Temporada atual</div><div class="seasonnumber">${String(s.season).padStart(2, '0')}</div><div class="meter"><div style="width:${s.day / MAXDAY * 100}%"></div></div>
        <div class="statusbar"><span>Dia ${s.day} de ${MAXDAY}</span><strong>${MAXDAY - s.day} dia(s) restante(s)</strong></div><p class="mini">Cada temporada tem 30 dias jogáveis (29 viradas). A renda entra ao virar o dia; o dia 30 é o último para agir.</p><div class="divider"></div>
        ${s.day === MAXDAY ? button('Encerrar temporada', 'end-season', '', false, 'primary block') : nextDayButton('block')}</section>
      <section class="card"><h2>Feitos do mês</h2><p>Respeito: <strong>★ ${num(s.respect)}</strong> · patente <strong>${esc(sc.title)}</strong>. Cada feito paga respeito na hora (bronze +${SB.FEAT_RESPECT[1]}, prata +${SB.FEAT_RESPECT[2]}, ouro +${SB.FEAT_RESPECT[3]}) e vale legado para a próxima temporada (até ${fmt(800)}).</p>
        ${sc.cats.filter(c => SB.FEAT_CATS.includes(c.id)).map(c => { const cat = SB.CATEGORIES.find(x => x.id === c.id); const next = cat.tiers[c.medal]; return `<div class="catRow"><div class="space"><span><strong>${c.name}</strong> <span class="mini" style="display:inline">${cat.unit === 'money' ? fmt(c.value) : num(c.value)}</span></span><span class="medal m${c.medal}">${SB.MEDALS[c.medal]}</span></div><div class="meter green"><div style="width:${pct(c.pct)}%"></div></div><span class="mini">${esc(cat.desc)}${next ? ` Próximo: ${cat.unit === 'money' ? fmt(next) : num(next)} (+${SB.FEAT_RESPECT[c.medal + 1]} de respeito).` : ''}</span></div>`; }).join('')}</section></div>
      <div class="section"><h2>Conquistas</h2><small>${Object.keys(s.achievements).length}/${SB.ACHIEVEMENTS.length} · permanentes</small></div>
      <section class="card"><div class="achGrid">${SB.ACHIEVEMENTS.map(a => `<div class="ach ${s.achievements[a.id] ? 'on' : ''}"><strong>${s.achievements[a.id] ? '✓ ' : ''}${esc(a.name)}</strong><span>${esc(a.desc)}${s.achievements[a.id] ? ` (T${s.achievements[a.id]})` : ''}</span></div>`).join('')}</div></section>
      <div class="section"><h2>Histórico</h2><small>prestígio ${s.prestige}</small></div>
      <section class="card">${s.seasonHistory.length ? `<table class="table"><thead><tr><th>Temp.</th><th>Resultado</th><th>Patrimônio</th></tr></thead><tbody>${s.seasonHistory.slice(-10).reverse().map(h => `<tr><td>${num(h.season)}</td><td>${num(h.respect)} respeito${h.title ? ' · ' + esc(h.title) : ''}${h.medals ? `<div class="mini">${SB.CATEGORIES.filter(c => h.medals[c.id]).map(c => c.name + ' ' + SB.MEDALS[h.medals[c.id]]).join(' · ') || 'Sem medalhas'}</div>` : ''}</td><td>${fmt(h.money)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Nenhuma temporada encerrada ainda.</div>'}
        ${Object.keys(s.records).length ? `<div class="divider"></div><h3>Recordes</h3><div class="kv">${SB.CATEGORIES.filter(c => s.records[c.id] !== undefined).map(c => `<div><span>${c.name}</span><strong>${c.unit === 'money' ? fmt(s.records[c.id]) : num(s.records[c.id])}</strong></div>`).join('')}</div>` : ''}</section>
      <div class="section"><h2>Salvamento e segurança</h2></div>
      <section class="card"><h2>Seu progresso</h2><p>Salvo automaticamente neste navegador. Exporte uma cópia para trocar de aparelho ou se proteger de limpezas do navegador.</p>
        <div class="btnbar">${button('Exportar carreira', 'export', '', false, 'small')}${button('Importar carreira', 'import', '', false, 'small ghost')}${button('Como jogar', 'help', '', false, 'small ghost')}${button('Recomeçar tudo', 'reset', '', false, 'small danger')}</div>
        <input type="file" id="importFile" accept=".json,application/json" class="hidden" aria-label="Selecionar salvamento JSON">
        ${hasKey(V04_BACKUP_KEY) ? `<div class="divider"></div><p class="mini">Há uma cópia do seu salvamento original da 0.4 guardada neste navegador.</p>${button('Baixar cópia da 0.4', 'download-backup', `data-id="${V04_BACKUP_KEY}"`, false, 'small ghost')}` : ''}
        ${hasKey(CORRUPT_KEY) ? `<div class="divider"></div><p class="mini">Há um salvamento ilegível guardado (não foi apagado).</p>${button('Baixar salvamento ilegível', 'download-backup', `data-id="${CORRUPT_KEY}"`, false, 'small ghost')}` : ''}
        <div class="divider"></div><div class="quiet">Salvar no navegador não sincroniza entre dispositivos. Não há servidor nem multiplayer nesta versão.</div></section>`;
  }
  function hasKey(k) { try { return !!localStorage.getItem(k); } catch (e) { return false; } }

  /* ---------- v0.7: Cidade, Feira do Rolo, Galpão, Vida noturna e Perfil ---------- */
  const PLACE_ICON = {
    cidade: `<path d="M4 20V9l5-3v14M9 20V4l6 3v13M15 20v-8l5 2v6M2 20h20"/>`,
    gestao: `<path d="M3 9l9-5 9 5M5 9v9M9 9v9M15 9v9M19 9v9M3 20h18"/>`,
    feira: `<path d="M3 9l2-5h14l2 5M4 9v11h16V9M3 9c0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0M9 20v-6h6v6"/>`,
    galpao: `<path d="M3 20V9l9-5 9 5v11M7 20v-7h10v7M7 16h10M10 13v7M14 13v7"/>`,
    noite: `<path d="M8 3h8l-1 7a3 3 0 0 1-6 0zM12 13v7M8 20h8M17 4l3-1M18 7h3"/>`,
    duelos: `<path d="M4 14c0-3 2-5 4-5h3v4H8v3M20 14c0-3-2-5-4-5h-3v4h3v3M4 14v5h4v-3M20 14v5h-4v-3"/>`,
    hospital: `<path d="M4 20V6h16v14M2 20h20M10 9h4M12 7v4M8 14h2v6M14 14h2v6"/>`,
    temporada: `<path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4c0 3 1.500 4.500 3.500 4.500M17 6h3c0 3-1.500 4.500-3.500 4.500M12 14v4M8 20h8"/>`.replace(/\.500/g, '.5')
  };
  const place = (v, name, info, badge = '', art = v) => `<button type="button" class="place p-${v}" data-view="${v}"><span class="placeScene">${window.SBArt.place(art)}</span><b>${name}</b><small>${info}</small>${badge ? `<i class="placeBadge">${badge}</i>` : ''}</button>`;
  /** Cartão de lugar; trancado até a fase certa (com o motivo à vista). */
  function gated(v, art, name, info, badge = '') {
    if (SB.placeOpen(state, v)) return place(v, name, info, badge, art);
    return `<div class="place locked p-${v}" aria-disabled="true"><span class="placeScene">${window.SBArt.place(art)}</span><b>${name}</b><small>Abre com ${SB.GATES[v]} de respeito (você tem ${num(state.respect)}).</small><i class="placeBadge lock">Trancado</i></div>`;
  }
  function hub() {
    const s = state, deal = s.exportDeal, ph = SB.phase(s);
    const hp = s.heist ? SB.heist(s.heist.id) : null;
    return heading('Cidade', `${esc(s.city)} · fase ${esc(ph.name)}. ${esc(ph.desc)}`) + jailNotice() + resultCard() + `<div class="places">
      ${gated('gangue', 'assaltos', 'Bando e assaltos', s.gangName ? `${esc(s.gangName)} · ${s.crew.length}/8 · ânimo ${s.crewMorale}` : 'Funde seu bando e planeje assaltos', hp ? 'Plano em andamento' : '')}
      ${place('gestao', 'Banco e negócios', `${fmt(s.bank)} guardados · ${s.businesses.length} negócio(s)`)}
      ${gated('galpao', 'galpao', 'Galpão', `Carga ${SB.cargoUsed(s)}/${SB.cargoCap(s)} · mercadoria e produção`, deal.day >= s.day ? (deal.day === s.day ? 'Comprador hoje' : `Comprador dia ${deal.day}`) : '')}
      ${gated('cidade', 'cidade', 'Bairros', `${SB.controls(s).length}/5 liderados · viajar, contatos e disputas`)}
      ${gated('apostas', 'apostas', 'Apostas', `Bicho, sinuca e roleta · hoje ${s.today.bets}/${SB.BET_LIMIT}`)}
      ${gated('duelos', 'duelos', 'Duelos de rua', `Hoje ${s.today.duels}/${SB.DUEL_LIMIT} · ${s.duelStats.wins} vitória(s)`)}
      ${place('hospital', 'Hospital', s.hospital ? `${s.uti ? 'UTI' : 'Internado'} · ${s.hospital} ${s.clock ? 'período(s)' : 'dia(s)'}` : `Saúde ${s.health}/100`, s.health < 50 ? 'Ferido' : '')}
      ${place('perfil', 'Perfil e temporada', `Dia ${s.day}/${MAXDAY} · ★ ${num(s.respect)} respeito`, '', 'temporada')}
    </div>`;
  }
  function itemEffect(it) {
    if (it.slot === 'arma') return `Poder ${it.power}: confrontos +${it.power}, operações +${Math.round(it.power * .6)}, serviços de Força +${Math.round(it.power * .5)}${it.power >= 7 ? ' · arma de fogo: +1 dia se for detido' : ''}${it.heavy ? ' · pesada: +3 de Procurado por dia' : ''}`;
    if (it.slot === 'protecao') return `Defesa ${it.def}: chance de detenção -${it.def}`;
    return `Carga +${it.cargo} · fuga ${it.escape} (detenção e blitz)${it.freeRide ? ' · viagem sem gastar energia' : ''}`;
  }
  function feira() {
    const s = state;
    return heading('Feira do Rolo', 'Arma abre roubo maior. O que você compra é seu: troque o que está usando quando quiser, de graça.') + `<div class="screenArt">${window.SBArt.place('feira')}</div>` + jailNotice() + resultCard() +
      SB.SLOTS.map(sl => { const cur = SB.item(s.gear[sl.id]);
        return stencil(sl.name, cur ? 'em uso: ' + esc(cur.name) : 'nada equipado') + `<div class="grid">` + SB.ITEMS.filter(i => i.slot === sl.id).map(it => { const mine = s.gear[sl.id] === it.id, have = SB.owns(s, it.id), cl = it.trophy || have ? '' : SB.chainLock(s, 'items', it.id), locked = !have && (!!cl || s.respect < it.unlock || (it.trophy && !s.achievements[it.trophy]));
          const pic = window.SBArt.item(it.id), small = it.slot === 'veiculo' && have && !mine && SB.cargoUsed(s) > SB.cargoWith(s, it);
          const act = mine ? '' : have ? button('Usar', 'equip', `data-id="${it.id}"`, s.jail > 0 || small, 'small') : button('Comprar', 'buy-item', `data-id="${it.id}"`, locked || s.cash < it.cost || s.jail > 0, 'small primary');
          return `<section class="card shopRow ${pic ? 'withPic' : ''} ${mine ? 'mine' : ''} ${locked ? 'locked' : ''}">${pic ? `<span class="itemPic" aria-hidden="true">${pic}</span>` : ''}<div><h3>${esc(it.name)}${mine ? ' <span class="pill">Em uso</span>' : have ? ' <span class="pill own">É seu</span>' : ''}</h3><p class="mini">${esc(itemEffect(it))}</p>${locked ? `<div class="lockline">${cl ? esc(cl) : it.trophy && !s.achievements[it.trophy] ? 'Troféu: só para quem venceu o Rei do Pedaço.' : `Requer ${it.unlock} de respeito.`}</div>` : ''}${small ? '<div class="lockline">Sua carga não cabe neste veículo.</div>' : ''}</div>
            <div class="shopAct">${have ? '' : `<strong>${fmt(it.cost)}</strong>`}${act}</div></section>`; }).join('') + `</div>`; }).join('');
  }
  function maxBuy(g) { const s = state; let q = Math.max(0, SB.cargoCap(s) - SB.cargoUsed(s)); while (q > 0 && SB.buyTotal(s, g, q) > s.cash) q = Math.floor(q * .9) - (q < 10 ? 1 : 0); return Math.max(0, q); }
  function galpao() {
    const s = state, deal = s.exportDeal, dg = SB.good(deal.good), used = SB.cargoUsed(s), cap = SB.cargoCap(s), open = SB.exportOpen(s), blitz = SB.blitzChance(s);
    const dealTxt = deal.day < s.day ? 'O próximo comprador ainda não deu notícia.' : `${deal.day === s.day ? 'Hoje' : (deal.day === MAXDAY ? 'Último Navio, no dia ' : 'No dia ') + deal.day}, em ${esc(D('cais').name)}: paga ${fmt(SB.exportPrice(dg, s))} por ${esc(dg.unit)} de ${esc(dg.name)} (até ${SB.exportLimit(s)}). Você tem ${s.goods[dg.id]}.`;
    return heading('Galpão', 'Compre barato num bairro, venda caro em outro, produza o seu e despache para fora.') + `<div class="screenArt">${window.SBArt.place('galpao')}</div>` + jailNotice() + resultCard() + `
      <section class="card"><div class="meterlabel"><span>Carga</span><strong>${used}/${cap}</strong></div><div class="meter"><div style="width:${pct(used / cap * 100)}%"></div></div>
        <p class="mini" style="margin-top:7px">Veículos e pontos de produção aumentam o espaço. ${blitz ? `<span class="negative">Viajar com esta carga: ${blitz}% de chance de blitz (perde metade).</span>` : 'Sem carga, sem blitz.'}</p></section>
      <section class="poster" style="margin-top:10px"><div class="posterHead">COMPRADOR DE FORA</div><p>${dealTxt}</p>${open ? button(`Entregar ${Math.min(SB.exportLimit(s), s.goods[dg.id])} × ${esc(dg.name)}`, 'export-goods', '', s.goods[dg.id] < 1 || s.exportDone === s.day || s.jail > 0, 'small block') : ''}</section>
      ${stencil('Mercadorias', 'preço em ' + esc(D().name))}<div class="grid">${SB.GOODS.slice().sort((a, b) => a.unlock - b.unlock).map(g => { const locked = s.respect < g.unlock, f = s.market[s.district][g.id], own = s.goods[g.id], mb = locked ? 0 : maxBuy(g);
        const best = SB.DISTRICTS.reduce((a, d) => SB.goodSellPrice(s, g, d.id) > SB.goodSellPrice(s, g, a.id) ? d : a, SB.DISTRICTS[0]);
        const off = s.jail > 0 || s.energy < 3;
        return `<section class="card goodRow ${locked ? 'locked' : ''}"><div class="space"><h3>${esc(g.name)} <span class="chip ${f <= 90 ? 'up' : f >= 112 ? 'down' : ''}">${f <= 90 ? 'barato' : f >= 112 ? 'caro' : 'normal'} ${f}%</span></h3><strong>${own} un.</strong></div>
          <p class="mini">Compra ${fmt(SB.goodPrice(s, g))} · venda ${fmt(SB.goodSellPrice(s, g))} por ${esc(g.unit)} · risco ${'●'.repeat(g.risk)}${'○'.repeat(4 - g.risk)} · melhor venda hoje: ${esc(best.name)} (${fmt(SB.goodSellPrice(s, g, best.id))})</p>
          ${locked ? `<div class="lockline">Requer ${g.unlock} de respeito.</div>` : `<div class="tradeBtns">${button(`+5 · ${fmt(SB.buyTotal(s, g, 5))}`, 'buy-good', `data-id="${g.id}" data-qty="5"`, off || mb < 5, 'small')}${button(`+${mb} (máx.)`, 'buy-good', `data-id="${g.id}" data-qty="${mb}"`, off || mb < 1, 'small')}${button(`−5 · ${fmt(SB.sellTotal(s, g, Math.min(5, Math.max(1, own))))}`, 'sell-good', `data-id="${g.id}" data-qty="${Math.min(5, own)}"`, off || own < 1, 'small primary')}${button(`Vender tudo${own ? ' · ' + fmt(SB.sellTotal(s, g, own)) : ''}`, 'sell-good', `data-id="${g.id}" data-qty="${own}"`, off || own < 1, 'small primary')}</div>`}</section>`; }).join('')}</div>
      <p class="mini" style="margin-top:6px">Cada negócio gasta 3 de energia. Comprar muito encarece e vender muito derruba o preço local. Vender na área de outro grupo gera atrito.</p>
      ${stencil('Esquemas', 'do gelo à refinaria')}<div class="grid">${SB.LABS.map((l, i) => { const lvl = s.labs[l.id], c = SB.labCost(s, l), cl = lvl ? '' : SB.chainLock(s, 'labs', l.id), locked = !!cl || s.respect < l.unlock, down = s.labDown[l.id] >= s.day, raid = SB.labRaid(s, l), sp = SB.SUPPLY.find(x => x.labs.includes(l.id));
        const makes = l.cash ? `${fmt(l.cash)} por dia no banco` : `${l.out} × ${esc(SB.good(l.good).name)}${l.good2 ? ` e ${l.out2} × ${esc(SB.good(l.good2).name)}` : ''} por dia`;
        const pic = window.SBArt.esquema(l.id);
        return `<section class="card shopRow ${pic ? 'withPic' : ''} ${locked ? 'locked' : ''}">${pic ? `<span class="itemPic" aria-hidden="true">${pic}</span>` : ''}<div><h3><span class="tier">${i + 1}</span> ${esc(l.name)} <span class="pill">Nível ${lvl}/3</span></h3><p class="mini">${esc(l.desc)}</p>
          <p class="mini">${lvl ? `Rende ${esc(SB.labYield(s, l))} por dia` : `Produz ${makes}`} · custo ${fmt(Math.max(1, lvl) * (30 + (l.bribe || 0)))}/dia${l.bribe ? ' com propina' : ''}${l.cash ? '' : ' · +40 de espaço'}${raid ? ` · <span class="negative">${raid}% de batida hoje</span>` : l.cash || SB.good(l.good).risk === 0 ? ' · sem batida' : ''}${sp ? ` · abastece ${esc(SB.business(sp.biz).name)} (+70% de renda)` : ''}${down ? ` · <span class="negative">fechado até o dia ${s.labDown[l.id]}</span>` : ''}</p>${locked ? `<div class="lockline">${cl ? esc(cl) : `Requer ${l.unlock} de respeito.`}</div>` : ''}</div>
          <div class="shopAct">${lvl >= 3 ? '<strong>Máximo</strong>' : `<strong>${fmt(c)}</strong>${button(lvl ? 'Ampliar' : 'Montar', 'build-lab', `data-id="${l.id}"`, locked || s.cash < c || s.jail > 0, 'small primary')}`}</div></section>`; }).join('')}</div>
      <p class="mini" style="margin-top:6px">Com Procurado acima de 40, a polícia pode estourar um ponto: perde o estoque daquela mercadoria e fica 2 dias fechado. A propina do Laboratório e da Refinaria corta esse risco pela metade. Dono de Inferninho ou de Termas com o esquema certo e estoque abastece a casa e ganha +70% da renda base do dia.</p>`;
  }
  function noite() {
    const s = state, here = SB.NIGHT.find(n => n.id === s.today.venue), blk = SB.blocked(s), full = s.energy >= SB.ENERGY_MAX;
    const why = blk || (full ? `Você está no máximo (${SB.ENERGY_MAX} de energia).` : '');
    const doseRow = d => { const c = SB.doseCost(s, d, here), own = d.good ? s.goods[d.good] : 0, off = !!why;
      return `<section class="card shopRow doseRow"><div><h3>${esc(d.name)}${d.strong && s.vicio >= 70 ? ' <span class="pill bad">risco de overdose</span>' : ''}</h3><p class="mini">${esc(d.desc)}</p>
        <p class="mini"><strong>+${Math.min(SB.nightEnergy(s, d), SB.ENERGY_MAX - s.energy)} de energia</strong> · R$ ${(c / Math.max(1, SB.nightEnergy(s, d))).toFixed(2).replace('.', ',')} por ponto${s.today.dose[d.id] ? ` <span class="negative">(rende ${Math.round(SB.doseTolerance(s, d) * 100)}%: tolerância)</span>` : ''} · vício +${SB.doseVicio(s, d)}${d.ressaca ? ` · ressaca −${d.ressaca}` : ''}</p></div>
        <div class="shopAct"><strong>${fmt(c)}</strong>${button('Pedir', 'dose', `data-id="${d.id}"`, off || s.cash < c, 'small primary')}${own ? button(`Do estoque (${own})`, 'dose', `data-id="${d.id}" data-stock="1"`, off, 'small') : ''}</div></section>`; };
    return heading('Noite', 'Acabou a energia? Entre numa casa e peça no balcão: dinheiro vira energia agora, a ressaca vem amanhã.') + `<div class="screenArt">${window.SBArt.place('noite')}</div>` + jailNotice() + resultCard() + `
      <section class="card"><div class="kv"><div><span>Saídas hoje</span><strong>${s.today.night}/${SB.NIGHT_LIMIT}</strong></div><div><span>Doses hoje</span><strong>${s.today.doses}</strong></div><div><span>Energia em doses hoje</span><strong>${s.today.chem}</strong></div><div><span>Ressaca amanhã</span><strong>−${s.ressaca} de energia</strong></div></div>
        <div class="meterlabel" style="margin-top:10px"><span>Vício</span><strong>${s.vicio}/100</strong></div><div class="meter red"><div style="width:${s.vicio}%"></div></div>
        <p class="mini" style="margin-top:6px">Quanto mais forte a dose, mais energia e mais vício. Sem limite de doses: o corpo se acostuma (cada dose do mesmo tipo no dia rende 15% menos; ${s.clock ? 'ir pra casa ou a virada do dia zera' : 'dormir zera'}) e o vício pesa (com vício 100, a dose dá metade). As doses levam a energia até ${SB.ENERGY_MAX}. As fracas são baratas por ponto; as fortes, caras, mas dão muito de uma vez. ${s.vicio >= 70 ? `<span class="negative">Acima de 70: loló, bala e pó têm ${SB.overdoseChance(s)}% de chance de overdose.</span>` : 'A partir de 70, loló, bala e pó podem dar overdose.'} Cai 3 por dia; o Hospital limpa, mas tirar o vício custa saúde.</p></section>
      ${here ? `${stencil('No balcão', esc(here.name))}${why ? `<p class="lockline">${esc(why)}</p>` : ''}<div class="grid">${here.menu.map(id => doseRow(SB.doseOf(id))).join('')}</div>` : ''}
      ${stencil('Casas da noite', 'a entrada conta como saída')}<div class="grid">${SB.NIGHT.map(n => { const c = SB.nightCost(s, n), own = SB.ownTermas(s, n), cl = own || s.businesses.includes(n.id) ? '' : SB.chainLock(s, 'night', n.id), lock = !!cl || (n.unlock && s.respect < n.unlock && !own), inside = here && here.id === n.id;
        const pic = window.SBArt.casa(n.id);
        return `<section class="card shopRow ${pic ? 'withPic' : ''} ${inside ? 'here' : ''} ${lock ? 'locked' : ''}">${pic ? `<span class="itemPic" aria-hidden="true">${pic}</span>` : ''}<div><h3>${esc(n.name)}${inside ? ' <span class="pill">Você está aqui</span>' : own ? ' <span class="pill">Sua casa</span>' : lock ? ` <span class="pill">${cl ? esc(cl.replace(/\.$/, '')) : `Requer ${n.unlock} de respeito`}</span>` : ''}</h3><p class="mini">${esc(n.desc)}</p>
          <p class="mini">Cardápio: ${n.menu.map(id => esc(SB.doseOf(id).name)).join(', ')}${own ? ' · <strong>na sua casa: energia cheia, sem vício</strong>' : ''}${n.raid && !SB.hasPerk(s, 'barao', 2) ? ` · ${Math.round(n.raid * SB.eventMod(s, 'nightRiskMult'))}% de batida` : ''}${n.morale ? ` · equipe +${n.morale} de ânimo` : ''}${n.heat ? ` · +${n.heat} de Procurado` : ''}${n.contact ? ` · ${n.contact}% de firmar contatos` : ''}${n.brawl ? (SB.nightSafe(s, n) ? ' · sem briga: a casa é sua' : ` · <span class="negative">${n.brawl}% de briga</span>`) : ''}${n.boss ? ' · relação +5 com quem manda no bairro' : ''}</p></div>
          <div class="shopAct"><strong>${c ? 'Entrada ' + fmt(c) : 'Entrada grátis'}</strong>${inside ? '' : button('Entrar', 'night', `data-id="${n.id}"`, s.cash < c || s.today.night >= SB.NIGHT_LIMIT || full || !!blk || lock, 'small primary')}</div></section>`; }).join('')}</div>
      <p class="mini" style="margin-top:6px">Cada saída a mais no dia encarece a entrada em 50%. Dono do Bar entra de graça e paga metade no Boteco; dono do Inferninho entra de graça no Inferninho; dono da Casa de Shows não briga no Baile. Mercadoria do seu Galpão também serve no balcão.</p>${s.energy < 16 && s.today.night >= SB.NIGHT_LIMIT && !here ? `<div class="btnbar" style="margin-top:10px">${nextDayButton('')}</div>` : ''}`;
  }


  function duelos() {
    const s = state, cr = SB.combatRating(s), w = SB.item(s.gear.arma), pr = SB.item(s.gear.protecao), hp = SB.healthPenalty(s);
    return heading('Duelos de rua', 'Encare nomes conhecidos da rua. Vencer dá dinheiro e fama; perder custa saúde.') + `<div class="screenArt">${window.SBArt.place('duelos')}</div>` + jailNotice() + resultCard() + `
      <section class="card"><div class="kv"><div><span>Sua luta</span><strong>${cr}</strong></div><div><span>Duelos hoje</span><strong>${s.today.duels}/${SB.DUEL_LIMIT}</strong></div><div><span>Arma</span><strong>${w ? esc(w.name) : 'Mãos nuas'}</strong></div><div><span>Proteção</span><strong>${pr ? esc(pr.name) : 'Nenhuma'}</strong></div></div>
        <p class="mini" style="margin-top:8px">Luta = Força, Astúcia, arma, proteção e sede (a conta está no Perfil). A proteção também reduz o dano. ${hp ? `<span class="negative">Saúde baixa: -${hp} de chance.</span>` : ''}${SB.injured(s) ? ' <span class="negative">Ferido demais para duelar: vá ao Hospital.</span>' : ''}${SB.gearVal(s, 'power') >= 7 ? ' Arma de fogo faz barulho: +4 de Procurado por duelo.' : ''}</p></section>
      <div class="grid" style="margin-top:10px">${SB.RIVALS.map(r => { const cl = SB.chainLock(s, 'rivals', r.id), locked = !!cl || s.respect < r.unlock, odds = SB.duelOdds(s, r), beat = s.beaten[r.id] || 0;
        const off = locked || !!SB.blocked(s) || SB.injured(s) || s.today.duels >= SB.DUEL_LIMIT || s.energy < SB.DUEL_ENERGY;
        return `<section class="card mission rivalRow ${locked ? 'locked' : ''}"><span class="rivalPic">${window.SBArt.rival(r.id)}</span><div><h3>${esc(r.name)} ${beat ? `<span class="pill">Vencido ${beat}×</span>` : ''}</h3><p>${esc(r.desc)}</p>
          <div class="details">Luta ${r.rating} · prêmio ${fmt(r.low)}–${fmt(r.high)} · +${beat ? r.respect : r.respect * 2} respeito${beat ? '' : ' (primeira vitória vale o dobro)'} · ${SB.DUEL_ENERGY} energia</div>
          <div class="details">Se perder: saúde e 5% do caixa em mãos</div>${locked ? `<div class="lockline">${cl ? esc(cl) : `Requer ${r.unlock} de respeito.`}</div>` : ''}</div>
          <div class="right"><span class="chance ${chanceClass(odds)}">${odds}% <small class="mini">vitória</small></span>${button('Encarar', 'duel', `data-id="${r.id}"`, off, 'primary small')}</div></section>`; }).join('')}</div>
      <p class="mini" style="margin-top:6px">Cada duelo seguido no mesmo dia tira 4 pontos de chance: o corpo cansa.</p>`;
  }
  function hospital() {
    const s = state, c = SB.clinicCost(s);
    return heading('Hospital', 'Saúde baixa derruba suas chances em tudo. Abaixo de 25 você não confronta, não lidera operações e não duela.') + `<div class="screenArt">${window.SBArt.place('hospital')}</div>` + jailNotice() + resultCard() + `
      <section class="card"><div class="meterlabel"><span>Saúde</span><strong>${s.health}/100</strong></div><div class="meter green"><div style="width:${s.health}%"></div></div>
        <p class="mini" style="margin-top:7px">Volta sozinha +10 por dia (+6 se detido). Se chegar a zero: <strong>UTI</strong>, ${s.clock ? '24 horas' : 'o resto de hoje e amanhã'} sem jogar, e você sai com 40 de saúde e o vício zerado.${SB.healthPenalty(s) ? ` <span class="negative">Agora: -${SB.healthPenalty(s)} de chance nas ações.</span>` : ''}</p></section>
      <div class="grid" style="margin-top:10px">
        <section class="card shopRow"><div><h3>UPA</h3><p class="mini">De graça, mas é horas no corredor. +25 de saúde, uma vez por dia.</p></div><div class="shopAct"><strong>20 energia</strong>${button('Encarar o corredor', 'clinic', 'data-id="posto"', s.health >= 100 || s.today.clinic || s.energy < 20 || !!SB.blocked(s), 'small primary')}</div></section>
        <section class="card shopRow"><div><h3>Propina pro plantonista</h3><p class="mini">Atestado, remédio e alta na hora. ${fmt(12)} por ponto de saúde que falta; cada nova vez no mesmo dia, +50%.</p></div><div class="shopAct"><strong>${fmt(c)}</strong>${button('Molhar a mão', 'clinic', 'data-id="clinica"', s.health >= 100 || s.cash < c || !!SB.blocked(s), 'small primary')}</div></section>
      </div>
      ${stencil('Desintoxicação', `vício ${s.vicio}/100`)}<div class="grid">
        <section class="card shopRow"><div><h3>Soro na veia</h3><p class="mini">Na UPA, de graça. −20 de vício, uma vez por dia. Custa ${Math.ceil(Math.min(20, s.vicio) * SB.DETOX_HEALTH)} de saúde.${s.health - Math.ceil(Math.min(20, s.vicio) * SB.DETOX_HEALTH) <= 0 && s.vicio > 0 ? ' <span class="negative">Você vai para a UTI.</span>' : ''}</p></div><div class="shopAct"><strong>25 energia</strong>${button('Tomar soro', 'detox', 'data-id="soro"', s.vicio <= 0 || s.today.detox || s.energy < 25 || s.jail > 0, 'small primary')}</div></section>
        <section class="card shopRow"><div><h3>Clínica de desintoxicação</h3><p class="mini">Zera o vício na hora. ${fmt(18)} por ponto e ${SB.DETOX_HEALTH.toString().replace('.', ',')} de saúde por ponto: agora −${Math.ceil(s.vicio * SB.DETOX_HEALTH)} de saúde.${s.vicio > 0 && s.health - Math.ceil(s.vicio * SB.DETOX_HEALTH) <= 0 ? ' <span class="negative">Sua saúde não aguenta: você vai para a UTI.</span>' : ''}</p></div><div class="shopAct"><strong>${fmt(SB.detoxCost(s))}</strong>${button('Internar e limpar', 'detox', 'data-id="clinica"', s.vicio <= 0 || s.cash < SB.detoxCost(s) || s.jail > 0, 'small primary')}</div></section>
      </div>`;
  }
  let betPick = 0, betStake = 100;
  function apostas() {
    const s = state, left = SB.BET_LIMIT - s.today.bets, off = !!SB.blocked(s) || left <= 0;
    const st = Math.max(10, Math.min(betStake, Math.max(10, s.cash)));
    const stakes = [50, 200, 1000, 5000].filter(v => v <= Math.max(50, s.cash));
    return heading('Apostas', 'Dobre o dinheiro da próxima arma ou perca tudo em dois toques. A banca sempre leva um pouco.') + `<div class="screenArt">${window.SBArt.place('apostas')}</div>` + jailNotice() + resultCard() + `
      <section class="card"><div class="kv"><div><span>Apostas hoje</span><strong>${s.today.bets}/${SB.BET_LIMIT}</strong></div><div><span>Na temporada</span><strong>+${fmt(s.betStats.won)} · -${fmt(s.betStats.lost)}</strong></div></div>
        <div class="formfield" style="margin-top:10px"><label for="betStake">Valor da aposta (R$)</label><input class="input" id="betStake" type="number" min="10" step="10" inputmode="numeric" value="${st}"></div>
        <div class="filterbar" style="margin-top:8px">${stakes.map(v => `<button type="button" class="btn ghost" data-action="bet-stake" data-id="${v}">${fmt(v)}</button>`).join('')}<button type="button" class="btn ghost" data-action="bet-stake" data-id="${Math.min(s.cash, SB.BET_MAX)}">Tudo</button></div></section>
      <div class="grid" style="margin-top:10px">
        <section class="card"><h3>Jogo do bicho</h3><p class="mini">Escolha um dos 25 bichos. Acertou, a banca paga <strong>${SB.bichoPays(s)}×</strong> (1 chance em 25).</p>
          <div class="formfield"><label for="betAnimal">Seu bicho</label><select class="input" id="betAnimal">${SB.ANIMALS.map((a, i) => `<option value="${i}" ${i === betPick ? 'selected' : ''}>${String(i + 1).padStart(2, '0')} · ${a}</option>`).join('')}</select></div>
          <div style="margin-top:8px">${button('Fazer a fezinha', 'bet', 'data-id="bicho"', off || s.cash < 10, 'small primary block')}</div></section>
        <section class="card shopRow"><div><h3>Sinuca valendo dinheiro</h3><p class="mini">No bar, contra o malandro da mesa. Dobra o valor; sua chance depende de Astúcia e Lábia. Teto de ${fmt(2000)}.</p></div><div class="shopAct"><strong>${SB.sinucaOdds(s)}%</strong>${button('Jogar', 'bet', 'data-id="sinuca"', off || s.cash < 10, 'small primary')}</div></section>
        <section class="card shopRow"><div><h3>Roleta clandestina</h3><p class="mini">Vermelho ou preto no cassino do fundo. Dobra o valor. Teto de ${fmt(SB.BET_MAX)}.</p></div><div class="shopAct"><strong>47%</strong>${button('Girar', 'bet', 'data-id="roleta"', off || s.cash < 10, 'small primary')}</div></section>
      </div><p class="mini" style="margin-top:6px">Até ${SB.BET_LIMIT} apostas por dia. Em todos os jogos a banca tem vantagem: aposta é adrenalina, não renda.</p>`;
  }

  function assaltos() {
    const s = state, cur = s.heist ? SB.heist(s.heist.id) : null;
    const steps = ['Planejar', 'Reconhecer', 'Executar', 'Dividir'];
    let plan = '';
    if (cur) {
      const odds = SB.heistOdds(s, cur), last = Math.min(SB.MAXDAY, s.heist.day + SB.HEIST_WINDOW), canRun = s.day > s.heist.day;
      const runBlock = SB.blocked(s) || (!canRun && 'Espere a noite: execute a partir de amanhã.') || (SB.injured(s) && 'Ferido demais.') || (s.crewMorale < 30 && 'Ânimo abaixo de 30.') || (s.energy < 40 && 'Energia abaixo de 40.') || (SB.gearVal(s, 'power') < cur.minPower && `Arma do líder abaixo de ${cur.minPower}.`) || (SB.crewSize(s) + s.heist.hires < cur.need && 'Falta gente no bando.') || '';
      const stage = canRun ? (s.heist.intel >= 40 ? 2 : 1) : 1;
      plan = `<section class="poster heistPlan"><span class="heistPic">${window.SBArt.heist(cur.id)}</span><div class="posterHead">PLANO EM ANDAMENTO</div><h2>${esc(cur.name)}</h2>
        <ol class="heistSteps">${steps.map((t, i) => `<li class="${i < stage ? 'ok' : i === stage ? 'now' : ''}">${t}</li>`).join('')}</ol>
        <div class="kv"><div><span>Chance agora</span><strong>${odds}%</strong></div><div><span>Prazo</span><strong>até o dia ${last}</strong></div><div><span>Informação</span><strong>${s.heist.intel}/40 (+${Math.round(s.heist.intel * .5)}%)</strong></div><div><span>Bando</span><strong>${SB.crewSize(s)} + ${s.heist.hires} avulso(s)</strong></div></div>
        <div class="inlineBtns" style="margin-top:10px">${button('Reconhecer o terreno · 15 energia', 'heist-scout', '', !!SB.blocked(s) || s.heist.scoutDay === s.day || s.heist.intel >= 40 || s.energy < 15, 'small')}${button(`Executar · 40 energia (${odds}%)`, 'heist-run', '', !!runBlock, 'small primary')}${button('Cancelar plano', 'heist-cancel', '', false, 'small ghost')}</div>
        ${runBlock ? `<p class="mini negative" style="margin:6px 0 0">${esc(runBlock)}</p>` : ''}</section>`;
    }
    const cool = !cur && s.day < s.heistReady ? `<div class="notice">O bando está esfriando depois do último assalto: novo plano a partir do dia ${s.heistReady}.</div>` : '';
    return heading('Assaltos do bando', 'Planeje, estude o terreno e execute. O bando leva 25%; o resto é seu.') + `<div class="screenArt">${window.SBArt.place('assaltos')}</div>` + jailNotice() + resultCard() + plan + cool + `
      <section class="card"><div class="kv"><div><span>Força do bando</span><strong>${SB.heistPower(s, 0)}</strong></div><div><span>Integrantes</span><strong>${SB.crewSize(s)}/8 · ânimo ${s.crewMorale}</strong></div><div><span>Arma do líder</span><strong>${SB.item(s.gear.arma) ? esc(SB.item(s.gear.arma).name) + ' (' + SB.gearVal(s, 'power') + ')' : 'nenhuma'}</strong></div><div><span>Feitos</span><strong>${s.gangStats.heists} certo(s) · ${s.gangStats.heistFails} errado(s)</strong></div></div>
        <p class="mini" style="margin-top:8px">Força do bando = sua luta, nível e número dos integrantes, Músculos e avulsos. Faltando gente, o plano contrata até ${SB.HEIST_MAX_HIRES} avulsos (mais fracos e pagos na hora). Olheiros rendem mais informação no reconhecimento.</p></section>
      <div class="grid" style="margin-top:10px">${SB.HEISTS.map(h => { const lock = SB.heistLock(s, h), hires = SB.heistHires(s, h), cost = SB.heistPlanCost(s, h), odds = SB.heistOdds(s, h);
        const off = !!lock || !!cur || s.day < s.heistReady || !!SB.blocked(s) || s.cash < cost || s.energy < 15 || s.day >= SB.MAXDAY;
        return `<section class="card mission heistRow ${lock ? 'locked' : ''}"><span class="heistPic">${window.SBArt.heist(h.id)}</span><div><h3>${esc(h.name)}</h3><p>${esc(h.desc)}</p>
          <div class="details">Bando ${h.need} · sede ${h.sede} · arma ${h.minPower}+ · ${h.unlock} de respeito</div>
          <div class="details">Rende ${fmt(h.low)}–${fmt(h.high)} (sua parte: 75%) · +${h.respect} respeito · +${h.heat} Procurado</div>
          <div class="details">Plano: ${fmt(cost)}${hires ? ` (inclui ${hires} avulso(s) a ${fmt(h.hire)})` : ''} · se der errado: 10% do caixa, saúde, prisão ${h.arrest}%+, um integrante pode rodar</div>
          ${lock ? `<div class="lockline">${esc(lock)}</div>` : ''}</div>
          <div class="right"><span class="chance ${chanceClass(odds)}">${odds}% <small class="mini">sem reconhecer</small></span>${button('Planejar', 'heist-plan', `data-id="${h.id}"`, off, 'primary small')}</div></section>`; }).join('')}</div>`;
  }
  function perfil() {
    const s = state, sc = SB.seasonScore(s), lvl = Math.min(99, Math.floor(s.respect / 35) + 1), c = s.career ? SB.CAREERS.find(x => x.id === s.career) : null;
    const top = Math.max(20, ...SB.STATS.map(st => s.stats[st.id]));
    return heading('Perfil', 'Sua ficha no submundo.') + resultCard() + `
      <section class="sheet"><span class="sheetAvatar">${portrait(s)}</span><div><h2>${esc(s.name)}</h2><p>${esc(sc.title)} · nível ${lvl}</p><p class="mini">${esc(s.city)}${c ? ' · ' + c.name + ' ' + SB.careerLevel(s) + '/3' : ''}${s.gangName ? ' · ' + esc(s.gangName) : ''}${s.prestige ? ' · prestígio ' + s.prestige : ''}</p></div></section>
      ${c ? `${stencil('Classe', esc(c.name) + ' · ' + esc(c.tag))}<section class="card"><p class="mini" style="margin:0">${esc(c.desc)} ${esc(c.xpDesc)}</p><ul class="perkList">${c.perks.map((p, i) => `<li class="${i < SB.careerLevel(s) ? 'on' : ''}">${i < SB.careerLevel(s) ? '✓' : '○'} Nível ${i + 1} (${SB.CAREER_XP[i]} XP): ${esc(p)}</li>`).join('')}</ul></section>` : ''}
      ${stencil('Luta', 'duelos e assaltos do bando')}<section class="card lutaCard"><div class="lutaHead"><strong>${num(SB.combatRating(s))}</strong><p class="mini">Sua força num duelo ou num assalto. Cada ponto acima do adversário vale +2,2% de chance no duelo.${s.gangName ? ` Força do bando: <b>${num(SB.heistPower(s, 0))}</b>.` : ''}</p></div>
        <details class="fichaMore"><summary>Como a conta é feita</summary><ul class="lutaParts">${SB.combatParts(s).map(([k, v]) => `<li><span>${k}</span><b>${v ? '+' + (Math.round(v * 10) / 10).toString().replace('.', ',') : '0'}</b></li>`).join('')}</ul>
        <p class="mini">Força conta 1,6 por ponto, Astúcia 0,6, o poder da arma 1,8, a defesa da proteção 1 e cada nível da sede 1,5.${s.career === 'operador' ? ' Como Assaltante, arma e proteção valem 15% a mais.' : ''} Também pesam na chance: saúde abaixo de 60, cansaço (cada duelo no dia tira 4%) e, nos assaltos, Procurado, ânimo e informação.</p></details></section>
      ${stencil('Atributos')}<section class="card">${SB.STATS.map(st => `<div class="statRow">${statIcon(st.id)}<span>${st.name}</span><div class="meter"><div style="width:${pct(s.stats[st.id] / top * 100)}%"></div></div><strong>${num(s.stats[st.id])}</strong></div>`).join('')}</section>
      ${stencil('Equipamento', 'troque na Feira do Rolo')}<div class="gearGrid">${SB.SLOTS.map(sl => { const it = SB.item(s.gear[sl.id]); const pic = it ? window.SBArt.item(it.id) : ''; return `<button type="button" class="gearSlot ${it ? 'on' : ''}" data-view="feira">${pic ? `<span class="gearPic" aria-hidden="true">${pic}</span>` : ''}<span>${sl.name}</span><b>${it ? esc(it.name) : '—'}</b><small>${it ? esc(it.slot === 'arma' ? 'poder ' + it.power : it.slot === 'protecao' ? 'defesa ' + it.def : 'carga +' + it.cargo) : 'vazio'}</small></button>`; }).join('')}</div>
      ${stencil('Nesta temporada')}<section class="card"><div class="kv"><div><span>Respeito</span><strong>${num(s.respect)}</strong></div><div><span>Patrimônio</span><strong>${fmt(SB.patrimony(s))}</strong></div><div><span>Serviços</span><strong>${num(s.successful)} certos · ${num(s.failed)} falhos</strong></div><div><span>Detenções</span><strong>${s.seasonStats.arrests}</strong></div><div><span>Saúde</span><strong>${s.health}/100${s.hospital ? ' · internado' : ''}</strong></div><div><span>Duelos</span><strong>${s.duelStats.wins} vitórias · ${s.duelStats.losses} derrotas</strong></div><div><span>Mercadoria vendida</span><strong>${fmt(s.trade.sold)}</strong></div><div><span>Remessas / blitze</span><strong>${num(s.trade.exported)} un. · ${s.trade.blitz}</strong></div><div><span>Bairros liderados</span><strong>${SB.controls(s).length}/5</strong></div><div><span>Conquistas</span><strong>${Object.keys(s.achievements).length}/${SB.ACHIEVEMENTS.length}</strong></div></div></section>
      ${onlineCard()}
      <div class="btnbar" style="margin-top:12px">${button('Temporada, medalhas e conquistas', 'switch', 'data-target="temporada"', false, 'primary')}${button('Como jogar', 'help', '', false, 'ghost')}</div>`;
  }

  /* ---------- renderização ---------- */
  function render() {
    if (!state) return;
    SB.applyCity(state.city);
    const pages = { painel: panel, acoes: actions, hub, cidade: city, gestao: management, feira, galpao, noite, duelos, apostas, hospital, gangue: gang, assaltos, perfil, temporada: seasons };
    try {
      $('#content').innerHTML = (pages[view] || panel)() + `<div class="footer">SUBMUNDO BRASIL • v${SB.VERSION} • 18+ • Cidades reais, bairros e grupos fictícios • Jogo local, sem multiplayer, pagamentos ou conexão externa.</div>`;
    } catch (e) {
      console.error(e);
      $('#content').innerHTML = `<div class="errorBox"><h2>Algo deu errado nesta tela.</h2><p>Seu progresso continua salvo. Exporte uma cópia por segurança e volte ao início.</p><div class="btnbar">${button('Exportar carreira', 'export', '', false, 'small')}${button('Voltar ao início', 'switch', 'data-target="painel"', false, 'small primary')}</div><p class="mini">${esc(e.message)}</p></div>`;
    }
    renderHud(); renderPop();
    if (state && !state.career && !setup) openSetup('season');
    $all('.nav button, .mobileNav button').forEach(b => { const on = b.dataset.view === tabOf(view); b.classList.toggle('active', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const st = SB.tutorialStep(state);
    $all('.nav button, .mobileNav button').forEach(b => b.classList.toggle('hint', !!st && tabOf(st.view) === b.dataset.view && st.view !== view && tabOf(view) !== b.dataset.view));
  }
  function switchView(target) {
    if (!VIEWS.includes(target)) return;
    if (target !== view) result = null;
    view = target; disarm(); $('#toast').hidden = true;
    $('#sidebar').classList.remove('open'); $('#menuToggle').setAttribute('aria-expanded', 'false');
    render(); window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function disarm() { armedNext = false; clearTimeout(armTimer); }
  function nextDayClick() {
    // Confirmação em dois toques quando ainda há bastante energia (evita perder o dia sem querer).
    if (!armedNext && state.energy >= 40 && state.jail === 0) {
      armedNext = true; render();
      armTimer = setTimeout(() => { armedNext = false; render(); }, 4000);
      return;
    }
    disarm(); run('nextDay');
  }

  /* ---------- eventos ---------- */
  document.addEventListener('click', e => {
    const nav = e.target.closest('[data-view]');
    if (nav) { switchView(nav.dataset.view); return; }
    const btn = e.target.closest('[data-action]');
    if (!btn || !state || btn.disabled) return;
    const a = btn.dataset.action, id = btn.dataset.id;
    if (a !== 'next-day') disarm();
    switch (a) {
      case 'switch': switchView(btn.dataset.target); break;
      case 'locale-help': localeHelp = !localeHelp; render(); break;
      case 'dismiss-result': result = null; render(); break;
      case 'buy-item': run('buyItem', id); break;
      case 'equip': run('equip', id); break;
      case 'buy-good': run('buyGood', id, Number(btn.dataset.qty)); break;
      case 'sell-good': run('sellGood', id, Number(btn.dataset.qty)); break;
      case 'export-goods': run('exportGoods'); break;
      case 'build-lab': run('buildLab', id); break;
      case 'night': run('night', id); break;
      case 'dose': run('dose', id, btn.dataset.stock === '1'); break;
      case 'duel': run('duel', id); break;
      case 'go-home': run('goHome'); break;
      case 'leave-home': run('leaveHome'); break;
      case 'avatar': run('avatar', id); break;
      case 'detox': run('detox', id); break;
      case 'clean-record': run('cleanRecord'); break;
      case 'bet-stake': betStake = Number(id) || 10; render(); break;
      case 'bet': { betStake = Math.floor(Number($('#betStake') && $('#betStake').value)) || 0; betPick = Number($('#betAnimal') && $('#betAnimal').value) || 0; run('bet', id, betStake, betPick); break; }
      case 'heist-plan': run('heistPlan', id); break;
      case 'heist-scout': run('heistScout'); break;
      case 'heist-run': run('heistRun'); break;
      case 'heist-cancel': if (confirm('Cancelar o plano? O dinheiro gasto não volta e o bando perde ânimo.')) run('heistCancel'); break;
      case 'clinic': run('clinic', id); break;
      case 'help': openHelp(0); break;
      case 'help-next': helpPage++; renderHelp(); break;
      case 'help-prev': helpPage--; renderHelp(); break;
      case 'close-help': closeHelp(); break;
      case 'skip-tutorial': if (confirm('Dispensar os primeiros passos? As recompensas restantes serão perdidas.')) run('skipTutorial'); break;
      case 'filter': missionFilter = id; render(); break;
      case 'mission': run('mission', id); break;
      case 'train': run('train', id); break;
      case 'travel': run('travel', id); break;
      case 'gig': run('gig'); break;
      case 'lay-low': run('layLow'); break;
      case 'bail': run('bail'); break;
      case 'bribe': run('bribe'); break;
      case 'career': if (confirm('A especialização vale para toda a temporada. Confirmar?')) run('career', id); break;
      case 'news': run('news', id, Number(btn.dataset.choice)); break;
      case 'skip-news': run('skipNews'); break;
      case 'contact': run('contact'); break;
      case 'dispute': run('dispute'); break;
      case 'bank': { const v = Number($('#bankAmount') && $('#bankAmount').value); run('bank', btn.dataset.mode, v); break; }
      case 'bank-all': run('bank', 'deposit', SB.maxDeposit(state)); break;
      case 'buy': run('buy', id); break;
      case 'sell': if (confirm(`Vender por ${fmt(SB.business(id).cost * SB.RESALE)} (60% do valor)?`)) run('sell', id); break;
      case 'next-day': nextDayClick(); break;
      case 'found-gang': run('foundGang', $('#gangName') && $('#gangName').value); break;
      case 'recruit': run('recruit', id); break;
      case 'dismiss': if (confirm('Dispensar este integrante? A equipe perde ânimo.')) run('dismiss', Number(id)); break;
      case 'rally': run('rally'); break;
      case 'upgrade': run('upgrade'); break;
      case 'gang-op': run('gangOp'); break;
      case 'faction-dialogue': run('dialogue', id); break;
      case 'faction-pact': run('pact', id); break;
      case 'faction-alliance': if (confirm(`Firmar aliança? Contribuição diária de ${fmt(SB.allianceFee(state))}. O inimigo do aliado ficará mais hostil.`)) run('alliance', id); break;
      case 'faction-break': if (confirm('Romper o acordo? Todas as facções confiarão menos em você.')) run('breakDeal', id); break;
      case 'faction-clash': run('clash', id); break;
      case 'end-season': { const sc = SB.seasonScore(state); if (confirm(`Encerrar a temporada ${state.season}?\n\nRespeito: ${sc.score} · ${sc.title}\n${sc.cats.filter(c => SB.FEAT_CATS.includes(c.id)).map(c => c.name + ': ' + SB.MEDALS[c.medal]).join('\n')}\n\nVocê começará uma nova carreira; conquistas, recordes e histórico são mantidos.`)) { run('endSeason'); view = 'temporada'; render(); } break; }
      case 'export': exportSave(); break;
      case 'import': $('#importFile') && $('#importFile').click(); break;
      case 'download-backup': try { const raw = localStorage.getItem(id); if (raw) download(id + '.json', raw); } catch (err) { notify('Não foi possível ler a cópia.', true); } break;
      case 'reset': reset(); break;
    }
  });
  document.addEventListener('change', e => { if (e.target.id === 'importFile') importFile(e.target.files && e.target.files[0], false); });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'bankAmount') { e.preventDefault(); run('bank', 'deposit', Number(e.target.value)); } });
  $('#menuToggle').addEventListener('click', () => { const open = $('#sidebar').classList.toggle('open'); $('#menuToggle').setAttribute('aria-expanded', String(open)); });
  $('#newGameForm').addEventListener('submit', e => {
    e.preventDefault();
    if (!$('#ageOk').checked) return notify('Confirme que tem 18 anos ou mais.', true);
    ageConfirm(); pendingOnline = false; openSetup('new');
  });
  /* ---------- ficha da temporada: retrato e vulgo → classe → salvar ---------- */
  let setup = null; // { mode: 'new' | 'season', online, step, avatar, name, city, career }
  function openSetup(mode) {
    const s = mode === 'season' ? state : null;
    setup = { mode, online: mode === 'new' ? pendingOnline : online, step: 1, avatar: s && s.avatar || null, name: s ? s.name : '', city: s ? s.city : SB.CITIES[0].name, career: null };
    $('#welcome').classList.add('hidden'); document.body.classList.add('atCover'); $('#setup').classList.remove('hidden'); renderSetup();
  }
  function closeSetup() { setup = null; $('#setup').classList.add('hidden'); document.body.classList.remove('atCover'); }
  function renderSetup() {
    const su = setup, c = SB.cityOf(su.city);
    const steps = `<div class="suSteps" aria-hidden="true"><i class="${su.step === 1 ? 'now' : 'ok'}">1 · Ficha</i><i class="${su.step === 2 ? 'now' : ''}">2 · Classe</i></div>`;
    $('#setupBox').innerHTML = su.step === 1 ? `${steps}<h2>Quem é você na rua?</h2><p class="mini">Escolha seu retrato e seu vulgo${su.mode === 'season' ? ' para a nova temporada' : ''}.</p>
      <div class="avatarGrid" role="group" aria-label="Retrato">${SB.AVATARS.map(a => `<button type="button" class="avatarPick ${su.avatar === a.id ? 'on' : ''}" data-action="su-avatar" data-id="${a.id}" aria-pressed="${su.avatar === a.id}">${window.SBArt.avatar(a.id) || avatar(null)}<small>${a.name}</small></button>`).join('')}</div>
      <div class="formfield"><label for="suName">Seu vulgo</label><input id="suName" class="input" maxlength="22" autocomplete="off" placeholder="Como vão te conhecer?" value="${esc(su.name)}"></div>
      ${su.mode === 'new' ? `<div class="formfield"><label for="suCity">Sua cidade</label><select id="suCity" class="input">${SB.CITIES.map(x => `<option ${x.name === su.city ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select><p class="cityTrait"><strong>${esc(c.trait)}:</strong> ${esc(c.traitDesc)}</p></div>` : `<p class="mini">Cidade: <b>${esc(su.city)}</b></p>`}
      <button type="button" class="btn primary block" data-action="su-next">Próximo</button>`
    : `${steps}<h2>Escolha sua classe</h2><p class="mini">Quatro caminhos para o topo do respeito. Toque em uma para escolher.</p>
      <div class="suClasses" role="group" aria-label="Classe">${SB.CAREERS.map(k => `<button type="button" class="suClass ${su.career === k.id ? 'on' : ''}" data-action="su-class" data-id="${k.id}" aria-pressed="${su.career === k.id}"><b>${k.name}</b><small>${esc(k.tag)}</small><span>${esc(k.desc)}</span></button>`).join('')}</div>
      ${su.career ? `<div class="notice suWarn"><strong>Atenção:</strong> retrato, vulgo e classe só poderão ser alterados na próxima temporada.</div><button type="button" class="btn primary block" data-action="su-save">Salvar</button>` : ''}
      <button type="button" class="btn ghost block" data-action="su-back" style="margin-top:8px">Voltar</button>`;
  }
  async function saveSetup() {
    const su = setup;
    if (su.mode === 'season') { const r = await run('setup', su.avatar, su.name, su.career); if (r && r.ok) { closeSetup(); view = 'painel'; render(); } return; }
    if (su.online) return createOnline(su);
    const s = SB.defaultState(su.name, su.city), r = SB.perform(s, 'setup', su.avatar, su.name, su.career);
    if (!r.ok) return notify(r.msg, true);
    state = s; view = 'painel'; result = null; closeSetup(); save(); render();
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-action^="su-"]'); if (!b || !setup) return;
    const a = b.dataset.action, su = setup;
    if (a === 'su-avatar') { su.avatar = b.dataset.id; renderSetup(); }
    else if (a === 'su-next') {
      su.name = ($('#suName').value || '').trim().replace(/\s+/g, ' ');
      if (!su.avatar) return notify('Escolha um retrato.', true);
      if (!SB.nameOk(su.name)) return notify('Escolha um vulgo entre 2 e 22 caracteres (letras, números e espaço).', true);
      su.step = 2; renderSetup(); $('#setup').scrollTop = 0;
    } else if (a === 'su-back') { su.step = 1; renderSetup(); }
    else if (a === 'su-class') { su.career = b.dataset.id; renderSetup(); const s2 = $('[data-action=su-save]'); if (s2 && s2.scrollIntoView) s2.scrollIntoView({ block: 'center' }); }
    else if (a === 'su-save') saveSetup();
  });
  document.addEventListener('input', e => { if (setup && e.target.id === 'suName') setup.name = e.target.value; });
  document.addEventListener('change', e => { if (setup && e.target.id === 'suCity') { setup.city = e.target.value; renderSetup(); } });
  // Outra aba alterou o save: recarrega para não sobrescrever progresso.
  window.addEventListener('storage', e => {
    if (e.key !== KEY || !e.newValue || !state) return;
    const r = SB.parseSave(e.newValue);
    if (r.ok) { state = r.state; render(); notify('Progresso atualizado a partir de outra aba.'); }
  });
  window.addEventListener('error', () => notify('Ocorreu um erro inesperado. Exporte seu progresso por segurança.', true));

  function reset() {
    if (!confirm('Apagar toda a carreira deste navegador? Esta ação não pode ser desfeita.')) return;
    if (!confirm('Confirme novamente: deseja realmente excluir o progresso? (Considere exportar antes.)')) return;
    try { localStorage.removeItem(KEY); } catch (e) { /* ignorado */ }
    state = null; result = null; showWelcome(); notify('Novo início disponível.');
  }
  function paintCover() { $('#coverArt').innerHTML = window.SBArt.capa() || scene('centro', false, SB.CITIES[0].name); }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#help').classList.contains('hidden')) closeHelp(); else if (e.key === 'Escape' && result) { result = null; render(); } });
  function showWelcome() {
    { const p = $('#resultPop'); p.hidden = true; p.innerHTML = ''; }
    const box = $('#welcomeNotice');
    box.innerHTML = corrupt ? `<div class="notice error"><strong>Não foi possível ler o salvamento encontrado.</strong> ${esc(corrupt.reason)} Uma cópia foi guardada e não será apagada. <button type="button" class="btn small ghost" id="dlCorrupt" style="margin-top:6px">Baixar cópia</button></div>` : '';
    const dl = $('#dlCorrupt'); if (dl) dl.addEventListener('click', () => download('submundo-salvamento-ilegivel.json', corrupt.raw));
    paintCover(); $('#playOffline').classList.toggle('primary', !ON);
    document.body.classList.add('atCover');
    $('#welcome').classList.remove('hidden');
  }

  /* Aviso 18+: confirmado uma vez por navegador. */
  const AGE_KEY = 'submundo_brasil_18';
  function ageConfirmed() { try { return localStorage.getItem(AGE_KEY) === '1'; } catch (e) { return false; } }
  function ageConfirm() { try { localStorage.setItem(AGE_KEY, '1'); } catch (e) { /* sem armazenamento */ } }
  function ageGate() {
    $('#helpBox').innerHTML = `<div class="helpHead"><span>Aviso</span></div><h2 id="helpTitle"><b class="age18">18+</b> Conteúdo adulto</h2><div class="helpBody" style="min-height:0"><p>Submundo Brasil é um jogo para maiores de 18 anos, com crime, violência, drogas, armas e linguagem pesada. Tudo é ficção: nenhum texto ensina a fazer nada no mundo real.</p></div><div class="helpBtns"><span></span>${button('Tenho 18 anos ou mais', 'age-ok', '', false, 'primary')}</div>`;
    $('#help').classList.remove('hidden');
  }
  document.addEventListener('click', e => { if (e.target.closest('[data-action="age-ok"]')) { ageConfirm(); closeHelp(); } });


  /* ---------- online (Supabase): conta, servidor do jogo e ranking ----------
   * Opcional: só aparece quando o build tem online.json. No online, cada ação vai para o servidor,
   * que aplica as regras com o mesmo motor e devolve o estado; o aparelho não decide nada. */
  const ON = window.SB_ONLINE || null, SESSION_KEY = 'submundo_brasil_sessao';
  let online = false, pendingOnline = false, busy = false, session = null, rankingRows = null, skew = 0, syncing = false;
  const serverNow = () => Date.now() + skew;
  function storeSession(v) { session = v; try { if (v) localStorage.setItem(SESSION_KEY, JSON.stringify(v)); else localStorage.removeItem(SESSION_KEY); } catch (e) { /* sem armazenamento */ } }
  function readSession() { try { const v = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); return v && typeof v.access === 'string' && typeof v.refresh === 'string' ? v : null; } catch (e) { return null; } }
  function authMsg(d) {
    const m = String(d.msg || d.error_description || d.message || d.error || '').toLowerCase();
    if (m.includes('invalid login')) return 'E-mail ou senha errados.';
    if (m.includes('not confirmed')) return 'Confirme o e-mail pelo link que enviamos e tente de novo.';
    if (m.includes('already') && m.includes('regist')) return 'Esse e-mail já tem conta. Use Entrar.';
    if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas agora. Espere um pouco e tente de novo.';
    if (m.includes('password')) return 'A senha precisa de pelo menos 6 caracteres.';
    if (m.includes('email')) return 'Confira o e-mail digitado.';
    return 'Não foi possível falar com o servidor agora.';
  }
  async function authReq(pathq, body) {
    const r = await fetch(ON.url + '/auth/v1/' + pathq, { method: 'POST', headers: { apikey: ON.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(authMsg(d));
    return d;
  }
  const keepSession = d => storeSession({ access: d.access_token, refresh: d.refresh_token, exp: Date.now() + (Number(d.expires_in) || 3600) * 1000 - 60000, email: d.user && d.user.email ? String(d.user.email).slice(0, 80) : '' });
  async function accessToken() {
    if (!session) return null;
    if (Date.now() > session.exp) { try { keepSession(await authReq('token?grant_type=refresh_token', { refresh_token: session.refresh })); } catch (e) { storeSession(null); return null; } }
    return session.access;
  }
  async function server(pedido) {
    const tk = await accessToken(); if (!tk) throw new Error('Sua sessão expirou. Entre de novo.');
    const r = await fetch(ON.url + '/functions/v1/jogar', { method: 'POST', headers: { apikey: ON.anonKey, Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }, body: JSON.stringify(pedido) });
    const d = await r.json().catch(() => ({ erro: 'Resposta inválida do servidor.' }));
    if (!r.ok) throw new Error(d.erro || 'Erro no servidor do jogo.');
    if (typeof d.agora === 'number') skew = d.agora - Date.now();
    return d;
  }
  /** Estado vindo do servidor: passa pela mesma verificação de qualquer save. */
  function fromServer(estado) { const p = SB.parseSave(JSON.stringify(estado)); if (!p.ok) throw new Error('O servidor mandou um save ilegível.'); return p.state; }
  function onlineStatus(html) { const el = $('#onlineStatus'); if (el) el.innerHTML = html; }
  /** O que aconteceu enquanto o jogador estava fora (viradas, alta, fim do mês). */
  const awayCard = avisos => { if (Array.isArray(avisos) && avisos.length) result = { good: true, msg: 'Enquanto você esteve fora', lines: avisos.map(String), deltas: [], fresh: true }; };
  function enterOnline(estado, avisos) {
    state = fromServer(estado); online = true; pendingOnline = false; view = 'painel'; result = null; awayCard(avisos);
    $('#welcome').classList.add('hidden'); if (!setup) document.body.classList.remove('atCover'); render();
    if (!ageConfirmed()) ageGate();
  }
  async function afterLogin() {
    const d = await server({ acao: 'estado' });
    if (d.estado) return enterOnline(d.estado, d.avisos);
    pendingOnline = true; openSetup('new');
  }
  async function createOnline(su) {
    try { const d = await server({ acao: 'novo', codinome: su.name, cidade: su.city, avatar: su.avatar, classe: su.career }); closeSetup(); enterOnline(d.estado); }
    catch (e) { notify(e.message, true); }
  }
  async function runOnline(name, args) {
    if (busy) return null;
    busy = true; document.body.classList.add('busy');
    const before = snap();
    try {
      const d = await server({ acao: 'agir', nome: name, args });
      const r = d.resultado || { ok: false, msg: 'Resposta inválida do servidor.' };
      if (d.estado) state = fromServer(d.estado); // o tempo andou no servidor mesmo quando a ação é recusada
      if (!r.ok) { if (Array.isArray(d.avisos) && d.avisos.length) awayCard(d.avisos); notify(r.msg, true); render(); return r; }
      if (Array.isArray(d.avisos) && d.avisos.length) r.lines = d.avisos.map(String).concat(r.lines || []);
      return finish(name, r, before);
    } catch (e) { notify(e.message, true); return null; }
    finally { busy = false; document.body.classList.remove('busy'); }
  }
  async function loadRanking() {
    try {
      const r = await fetch(ON.url + '/rest/v1/rpc/ranking', { method: 'POST', headers: { apikey: ON.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ limite: 50 }) });
      rankingRows = r.ok ? await r.json() : [];
    } catch (e) { rankingRows = []; notify('Não foi possível carregar o ranking.', true); }
    render();
  }
  /** Cartão da conta e do ranking (Perfil, só no online). */
  function onlineCard() {
    if (!online) return '';
    const rows = Array.isArray(rankingRows) ? rankingRows : null;
    return `${stencil('Online', 'save na nuvem')}<section class="card onlineCard"><p class="mini" style="margin:0 0 8px">Conta: <b>${esc(session && session.email)}</b>. As regras rodam no servidor do jogo.</p>
      ${rows ? (rows.length ? `<ol class="rankList">${rows.map(x => `<li class="${x.codinome === state.name ? 'me' : ''}"><span>${num(x.posicao)}º</span><b>${esc(x.codinome)}</b><small>${esc(x.cidade)}</small><strong>★ ${num(x.respeito)}</strong></li>`).join('')}</ol>` : '<p class="mini">Ninguém no ranking ainda.</p>') : ''}
      <div class="btnbar">${button(rows ? 'Atualizar ranking' : 'Ver ranking de respeito', 'on-ranking', '', false, 'small')}${button('Sair da conta', 'on-logout', '', false, 'small ghost')}</div></section>`;
  }
  document.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action^="on-"]'); if (!btn || !ON) return;
    const a = btn.dataset.action;
    if (a === 'on-ranking') return loadRanking();
    if (a === 'on-logout') { storeSession(null); online = false; pendingOnline = false; if (setup) closeSetup(); state = load(); rankingRows = null; if (state) render(); else showWelcome(); notify('Você saiu da conta online.'); return; }
    const email = $('#onEmail').value.trim(), pass = $('#onPass').value;
    if (!$('#ageOk').checked) return notify('Confirme que tem 18 anos ou mais.', true);
    if (!email || pass.length < 6) return notify('Digite o e-mail e uma senha com pelo menos 6 caracteres.', true);
    btn.disabled = true;
    try {
      if (a === 'on-signup') {
        const d = await authReq('signup', { email, password: pass });
        if (!d.access_token) { onlineStatus('<p class="notice">Conta criada. Enviamos um link de confirmação para o seu e-mail: confirme e depois toque em <b>Entrar</b>.</p>'); return; }
        keepSession(d);
      } else keepSession(await authReq('token?grant_type=password', { email, password: pass }));
      ageConfirm(); await afterLogin();
    } catch (err) { notify(err.message, true); }
    finally { btn.disabled = false; }
  });
  /** Entre um pedido e outro, o aparelho prevê o que o tempo faz (energia, Procurado, cadeia, casa).
   *  A virada do dia tem sorteio e renda: essa só o servidor faz. */
  async function clockBeat() {
    if (!online || !state || !state.clock || busy || syncing || document.hidden) return;
    const was = [state.jail, state.hospital, SB.atHome(state)].join();
    const r = SB.tick(state, serverNow(), { local: true });
    if (r.pending) {
      syncing = true;
      try { const d = await server({ acao: 'estado' }); if (d.estado) { state = fromServer(d.estado); awayCard(d.avisos); render(); } } catch (e) { /* tenta de novo na próxima batida */ }
      finally { syncing = false; }
      return;
    }
    if (was !== [state.jail, state.hospital, SB.atHome(state)].join() || view === 'painel' && !document.activeElement.matches('input,select,textarea')) render(); else renderHud();
  }
  setInterval(clockBeat, 20000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) clockBeat(); });
  async function bootOnline() {
    if (!ON) return;
    $('#onlineBox').hidden = false;
    session = readSession(); if (!session) return;
    try { await afterLogin(); } catch (e) { onlineStatus(`<p class="notice">${esc(e.message)}</p>`); }
  }

  state = load();
  if (state) { save(); render(); if (!ageConfirmed()) ageGate(); } else showWelcome();
  bootOnline();
  window.__SB_UI = { get state() { return state; }, go: switchView }; // apoio a testes automatizados
})();
