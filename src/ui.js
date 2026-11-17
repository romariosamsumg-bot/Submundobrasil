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
  const VIEWS = ['painel', 'acoes', 'hub', 'cidade', 'gestao', 'negocios', 'feira', 'galpao', 'noite', 'duelos', 'apostas', 'hospital', 'gangue', 'assaltos', 'perfil', 'temporada', 'ranking', 'esquina'];
  /* Telas que ficam "dentro" de uma aba da navegação. */
  const PARENT = { cidade: 'hub', gestao: 'hub', negocios: 'hub', galpao: 'hub', duelos: 'hub', apostas: 'hub', hospital: 'hub', gangue: 'hub', assaltos: 'gangue', perfil: 'hub', temporada: 'perfil', ranking: 'hub', esquina: 'hub' };
  const tabOf = v => { while (PARENT[v]) v = PARENT[v]; return v; };
  const MAXDAY = SB.MAXDAY;

  let state = null, view = 'painel', result = null, toastTimer = null;
  let evoPick = 'roubos', localeHelp = false, armedNext = false, armTimer = null, missionFilter = 'disponiveis', corrupt = null, saveFailed = false;

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
  /** Cena da região; reage aos eventos ativos (festa, chuva, operação, greve, guerra). */
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
    $('#hudName').textContent = s.name; $('#hudSub').innerHTML = `<span class="hudClass">${esc(c)}</span><span class="hudPat">${esc(SB.phase(s).name)}</span>`;
    $('#hudSleep').innerHTML = hudSleep();
    $('#hudRespect').textContent = num(s.respect);
    $('#hudEnergy').style.width = Math.min(100, s.energy) + '%'; $('#hudEnergyOver').style.width = Math.max(0, Math.min(100, s.energy - 100)) + '%'; $('#hudEnergyTxt').textContent = `Energia ${s.energy}`; $('#hudEnergyBox').classList.toggle('boost', s.energy > 100);
    $('#hudHeat').style.width = s.heat + '%'; $('#hudHeatTxt').textContent = `Procurado ${s.heat}`;
    $('#hudEnergyBox').setAttribute('aria-label', `Energia ${s.energy}. Abrir a Noite`); $('#hudHeatBox').setAttribute('aria-label', `Procurado ${s.heat} de 100, ${SB.HEAT_TIERS[SB.heatTier(s)].name}. Abrir Roubar`);
    $('#hudVicio').style.width = s.vicio + '%'; $('#hudVicioTxt').textContent = `Vício ${s.vicio}`; $('#hudVicioBox').setAttribute('aria-label', `Vício ${s.vicio} de 100. Abrir o Hospital`); $('#hudVicioBox').classList.toggle('alert', s.vicio >= 70);
    $('#hudHeatBox').classList.toggle('alert', s.heat >= 60); $('#hudHeatBox').classList.toggle('warm', s.heat >= 30 && s.heat < 60); $('#hudVicioBox').classList.toggle('warm', s.vicio >= 40 && s.vicio < 70);
    $('#hudHealth').style.width = s.health + '%'; $('#hudHealthTxt').textContent = s.hospital ? 'Internado' : `Saúde ${s.health}`;
    $('#hudHealthBox').setAttribute('aria-label', `Saúde ${s.health} de 100. Abrir o Hospital`); $('#hudHealthBox').classList.toggle('alert', s.health < 25);
    const cash = $('#topCash'); cash.textContent = fmt(s.cash);
    if (lastCash !== null && lastCash !== s.cash) { cash.classList.remove('up', 'down'); void cash.offsetWidth; cash.classList.add(s.cash > lastCash ? 'up' : 'down'); }
    lastCash = s.cash;
    $('#topDay').textContent = `Dia ${s.day}/${MAXDAY}`;
    $('#hudPlace').textContent = D().name;
    { const ti = SB.heatTier(s), el = $('#hudTier'); el.hidden = ti === 0; el.textContent = SB.HEAT_TIERS[ti].name; el.className = 'hudTier t' + ti; }
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
    if (!r.ok) { notify(r.msg, true); sfx('deny'); return r; }
    return finish(name, r, before);
  }
  /* Sons (src/sound.js): cada ação toca o seu efeito; o botão do topo e o Perfil ligam, desligam e ajustam o volume. */
  const sfx = (...n) => { try { return window.SBSound && window.SBSound.play(...n); } catch (e) { return false; } };
  const MONEY_ACTIONS = ['buyItem', 'buy', 'buyGood', 'sellGood', 'bank', 'cleanRecord', 'bail', 'bribe', 'exportGoods', 'bet', 'gig'];
  /** Tremor de tela (screen shake): forte na prisão e na UTI, leve quando você se fere. Respeita "reduzir movimento". */
  function screenShake(kind) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (const el of [$('#hud'), $('#content')]) { if (!el) continue; el.classList.remove('shake-hard', 'shake-soft'); void el.offsetWidth; el.classList.add('shake-' + kind); setTimeout(() => el.classList.remove('shake-' + kind), 600); }
    if (navigator.vibrate) try { navigator.vibrate(kind === 'hard' ? [60, 40, 90] : 40); } catch (e) { /* sem vibração */ }
  }
  /** Decide o tremor de cada resultado. */
  function actionShake(name, r, hpBefore) {
    const s = state, all = [r.msg || '', ...(r.lines || [])].join(' ');
    if (!s) return;
    if ((s.uti && /UTI/.test(all)) || (s.jail > 0 && !r.good && ['mission', 'duel', 'bribe', 'story'].includes(name)) || /enquadrado|Enquadrado/.test(all)) return screenShake('hard');
    if (typeof hpBefore === 'number' && s.health < hpBefore) return screenShake('soft');
  }
  let lastTexture = null, lastFoto = null;
  function actionSound(name, r) {
    const s = state, all = [r.msg || '', ...(r.lines || [])].join(' ');
    const extra = /\+\d+ de respeito/.test((r.lines || []).join(' ')) && /(Feito do mês|você agora é|Primeiros passos|Conquista)/.test(all) ? [['fanfare', .55]] : [];
    if (s && s.uti && s.hospital > 0 && /UTI/.test(all)) return sfx('flatline');
    if (s && s.jail > 0 && ['mission', 'duel', 'bribe'].includes(name) && !r.good) return sfx('bad', ['siren', .25]);
    if (name === 'mission' || name === 'duel' || name === 'heistRun') return sfx(r.good ? 'ok' : 'bad', ['stamp', .12], ...extra);
    if (name === 'dose') return sfx('fizz', ...extra);
    if (name === 'night') return sfx('thump', ...extra);
    if (name === 'train') return sfx('punch', ...extra);
    if (name === 'detox' || name === 'clinic') return sfx('beep', ...extra);
    if (name === 'nextDay' || name === 'story') return sfx('chime', ...extra);
    if (MONEY_ACTIONS.includes(name)) return sfx(r.good ? 'coins' : 'bad', ...extra);
    return sfx(r.good ? 'tick' : 'bad', ...extra);
  }
  /** Botão de som do topo: alto-falante ligado ou riscado. */
  function soundIcon() {
    const on = window.SBSound ? window.SBSound.on : false, b = $('#soundToggle'); if (!b) return;
    b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', on ? 'Som ligado (tocar para desligar)' : 'Som desligado (tocar para ligar)');
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/>${on ? '<path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>' : '<path d="M16 9l6 6M22 9l-6 6"/>'}</svg>`;
  }
  /** Monta o cartão de resultado e redesenha (vale para o jogo local e para o online). */
  function finish(name, r, before) {
    if (name === 'endSeason') {
      const rec = r.record;
      if (r.state) state = r.state;
      result = { good: true, msg: r.msg, lines: [`Respeito final: ${rec.score} · ${rec.title}.`, ...SB.CATEGORIES.filter(c => SB.FEAT_CATS.includes(c.id)).map(c => `${c.name}: ${SB.MEDALS[rec.medals[c.id]]}`)], deltas: [], fresh: true };
    } else result = { good: r.good, msg: r.msg, lines: r.lines || [], deltas: deltas(before, snap()), fresh: true, stamp: STAMPED.includes(name) };
    if (name === 'nextDay') dawn();
    save(); render(); actionSound(name, r); actionShake(name, r, before && before.health);
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
  /** Dormir (ou ir pra casa, no online) fica no topo, ao lado do dia: dá para virar o dia de qualquer tela. */
  function hudSleep() {
    const s = state, moon = '<svg class="hudIco" viewBox="0 0 12 12" aria-hidden="true"><path d="M7.6.6a5.6 5.6 0 1 0 3.9 8.8A4.6 4.6 0 0 1 7.6.6z"/></svg>';
    const b = (label, action, extra, off, cls = '') => `<button type="button" class="hudSleepBtn ${cls}" data-action="${action}" ${extra} ${off ? 'disabled' : ''}>${moon}<b>${label}</b></button>`;
    if (s.clock) {
      if (SB.atHome(s)) return b('Sair de casa', 'leave-home', '', false);
      if (s.jail > 0 || s.hospital > 0) return '';
      const ci = SB.clockInfo(s), full = s.energy >= 100 && !s.today.doses;
      return b(ci.homesLeft ? 'Casa · 3 h' : 'Casa: 2×/dia', 'go-home', '', !ci.homesLeft || full, s.energy < 16 ? 'hot' : '');
    }
    if (s.day >= MAXDAY) return b('Encerrar', 'switch', 'data-target="temporada"', false, 'hot');
    return b(armedNext ? `Dormir com ${num(s.energy)}?` : 'Dormir', 'next-day', '', false, armedNext ? 'armed' : s.energy < 16 ? 'hot' : '');
  }
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
  /** Faixa do local atual: cena da região, placa de rua e condições. */
  /** Explicação curta da faixa da placa (abre ao tocar). */
  function localeInfo() {
    if (!localeHelp || !state) return '';
    const s = state, d = D(), ds = s.dstate[d.id], l = SB.leader(s, d.id), f = F(l.id);
    const inf = s.influence[d.id], mine = SB.controlled(s, d.id), need = Math.max(60, l.value + 10);
    const ti = SB.infTier(s, d.id);
    return `<section class="card localeInfo"><p><b>Sua influência: ${num(inf)} · ${esc(SB.INF_TIERS[ti].name)}</b>. Roubar e fazer contatos aqui aumenta; ficar longe diminui.</p>
      <ul class="infTiers">${SB.INF_TIERS.map((x, k) => `<li class="${k === ti ? 'on' : ''}"><b>${k === 3 ? '60' : x.at} · ${esc(x.name)}</b>${k ? ': ' + esc(x.desc) : ''}</li>`).join('')}</ul>
      <p>${mine ? '<b>Você manda aqui.</b>' : SB.turfReady(s, d.id) ? '<b>Falta patente para mandar aqui.</b> ' + turfSlotsText(s) : `Faltam ${num(Math.max(0, need - inf))} para ser o dono.`}</p>
      <p><b>Dono</b>: ${mine ? 'você' : esc(f.name)} · <b>Grana</b> ${Math.round(ds.econ * 100)}% (o quanto os roubos rendem aqui hoje) · <b>Polícia</b> ${ds.vigil} (alta, atrapalha os roubos daqui).</p>
      <div class="btnbar">${button('Ver regiões', 'switch', 'data-target="cidade"', false, 'small ghost')}${button('Entendi', 'locale-help', '', false, 'small')}</div></section>`;
  }
  function localeStrip(tall, flyers = true) {
    const s = state, d = D(), ds = s.dstate[d.id], l = SB.leader(s, d.id);
    const evs = SB.activeEvents(s).filter(e => e.id !== 'rotina');
    return `<section class="locale ${tall ? 'tall' : ''}" aria-label="Onde você está">${scene(d.id)}
      <div class="localeTop">${plate(d.name, s.city)}${(flyers ? evs : []).map(e => `<span class="flyer">${esc(SB.eventTitle(e))}</span>`).join('')}</div>
      <button type="button" class="localeBottom" data-action="locale-help" aria-expanded="${localeHelp}" aria-label="Sua influência nesta região; tocar explica"><span class="infTag ${SB.controlled(s, d.id) ? 'mine' : ''}">Sua influência ${num(s.influence[d.id])} · ${esc(SB.INF_TIERS[SB.infTier(s, d.id)].name)}</span><i class="localeQ" aria-hidden="true">?</i></button></section>`;
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
      <div class="guideBtns">${go}</div><div class="guideLinks"><button type="button" class="linkBtn" data-action="help">Como jogar</button><button type="button" class="linkBtn" data-action="skip-tutorial">Pular guia</button></div></section>`;
  }
  const CAT_TIPS = {
    fortuna: 'junte dinheiro com serviços e negócios e guarde no banco',
    fama: 'conclua serviços mais difíceis, treine e compre negócios',
    territorio: 'crie contatos até 60 de influência e mantenha a liderança de uma região',
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
        <p>O placar é um só: o <strong>respeito</strong>. Ele sobe nos roubos, duelos, assaltos e negócios, e também nos <strong>feitos do mês</strong> (bronze, prata e ouro em Fortuna, Diplomacia, Gangue e Comércio), que pagam respeito na hora. Não precisa ser bom em tudo: escolha um ou dois caminhos e vá fundo.</p>
        <p>O respeito também dá a sua <strong>patente</strong>, de <em>Pé de chinelo</em> a <em>Dono do morro</em>, e é o que conta no ranking. A faixa de progresso, na Rua, mostra quanto falta para a próxima patente.</p>`],
      ['Seu dia', `<p>Tudo gasta <strong>energia</strong> (barra verde). Um dia típico:</p>
        <ol><li><strong>Serviços</strong> rendem dinheiro e respeito. Veja a chance antes.</li><li><strong>Treino</strong> melhora atributos e libera serviços maiores.</li><li><strong>Contatos</strong> nas regiões viram influência e tributo.</li><li>O ciclo fica nas abas: <strong>Roubar</strong>, <strong>Noite</strong> (recarrega energia) e <strong>Feira</strong> (arma abre roubo maior). Na <strong>Cidade</strong> ficam o bando, o banco e o resto, que vão se abrindo com o respeito: Galpão (comprar barato, vender caro, produzir e despachar), a noite (energia extra, com ressaca), os Duelos de rua e o Hospital.</li><li>Sem energia? <strong>Avance o dia</strong>: +70 de energia, a renda entra e os grupos se movem.</li></ol>
        <p>Respeito libera serviços, a gangue (30) e mais. Dinheiro compra treino, negócios e equipe.</p>`],
      ['Os riscos', `<p><strong>Procurado</strong> (barra vermelha) sobe a cada serviço e derruba suas chances. Ele cai sozinha ao virar o dia, ou com “Ficar na sua”.</p>
        <p><strong>Falhar</strong> tira parte do dinheiro <em>em mãos</em> e pode dar <strong>detenção</strong> (dias perdidos, ou fiança). O banco protege o dinheiro por uma taxa.</p>
        <p><strong>Assaltos do bando</strong> (Cidade → Bando): planeje, estude o terreno nos dias seguintes e execute dentro do prazo. Do arrastão no shopping ao cofre central; os maiores pedem bando grande e arma pesada.</p>
        <p><strong>Noite</strong>: entre numa casa (a entrada é paga uma vez por dia; dá para sair e voltar) e peça doses no balcão, de cigarro (+3) a pó (+150). Quanto mais forte, mais vício. Cada dose repetida no dia rende 15% menos e o vício reduz o efeito; as doses levam a energia até 200.</p>
        <p><strong>Vício</strong> (barra roxa): cada dose sobe o vício; alto, a dose recarrega menos e loló, bala e pó podem dar overdose. O Hospital limpa.</p>
        <p><strong>Colete</strong>: roubo armado que dá errado vira trocação com a segurança. O colete decide se você sai ferido ou vai para a UPA. Ser preso custa respeito.</p>
        <p><strong>Saúde</strong> (barra azul) cai em confrontos, duelos e serviços de força que dão errado. Abaixo de 60 suas chances caem; a zero, você é internado. Cure no Hospital ou esperando.</p>
        <p>Toque no seu retrato, no topo, para abrir o <strong>Perfil</strong> e escolher outra foto.</p>
        <p><strong>Equipamento</strong>: arma, proteção e veículo somam chance em todo roubo (a arma pesa mais nos de Força e menos nos de Lábia), e os roubos grandes pedem arma e veículo de fuga. Proteção e veículo equipados também diminuem a chance de ser preso.</p>
        <p><strong>Resultado</strong>: depois de cada ação, o resultado pula na tela com o que mudou. Toque em OK (ou fora) para fechar.</p>
        <p><strong>Feira</strong>: o que você compra é seu. Para trocar de arma, proteção ou veículo, toque em <strong>Usar</strong>, de graça.</p>
        <p><strong>Trilha de compra</strong>: na Feira (armas, proteções e veículos) e nos negócios, o próximo só abre depois que você compra o anterior nesta temporada.</p>
        ${state && state.clock ? '<p><strong>Online</strong>: o dia vira sozinho à meia-noite de Brasília e a temporada é o mês do calendário. A energia volta +1 a cada 3 minutos. <strong>Ir pra casa</strong> (3 horas, até 2 vezes por dia) enche a energia e zera o corpo. Na cadeia e no hospital, 1 dia vale 2 horas.</p>' : ''}
        <p><strong>Roubos</strong> vêm em escada, do mais fácil ao mais difícil. A chance vem do seu poder contra a dificuldade (poder igual = 70%, 1,5 vez = 90%). O <strong>genérico</strong> soma os atributos e 3 por ponto de arsenal (arma + proteção + veículo); o <strong>golpe</strong> pesa 3 por ponto de um atributo; o <strong>assalto</strong> pesa o arsenal. Nos 3 primeiros degraus, falhar não dá cadeia. Cada degrau só dá respeito até um teto (o 1º até 25, o 2º até 60, o 3º até 105…): para subir no ranking, suba de degrau.</p>
        <p><strong>Procurado</strong>: repetir o mesmo roubo é permitido, mas cada um sobe o Procurado e a polícia da região. Ele tira poder (com 50, −20%); com 60 a detenção sobe +10, e com 85 até o roubo que deu certo pode virar enquadro. Para esfriar: ficar na sua (energia), a propina (dinheiro; mais cara para quem faz roubo maior, +50% a cada vez no dia), trocar de região ou esperar.</p>
        <p><strong>Influência</strong>: cada região tem a sua. Roubos do 4º degrau em diante somam influência onde você rouba. Faixas: Conhecido (20), Respeitado (40, libera o Leilão) e Dono do pedaço (60 e 10 acima do grupo que manda): +12% no saque, propina 25% mais barata e a polícia da região sobe pela metade. Cada faixa nova paga respeito (+3, +5, +10); perder o comando custa 5. A patente limita as regiões: Rato de pista 1, Linha de frente 2, Gerente do movimento 3, Dono do morro todos.</p>
        <p><strong>História</strong>: a Rua conta o seu momento e, a cada patente nova, traz um capítulo com uma decisão. Cada escolha tem preço e consequência, e não dá para voltar atrás.</p>
        <p><strong>Saúde</strong>: tirar o vício custa saúde (meio ponto por ponto de vício). Saúde zero = UTI: ${state && state.clock ? '24 horas' : 'o resto do dia e o seguinte'} sem jogar.</p>
        <p>Os <strong>grupos rivais</strong> reagem: agir no território deles gera atrito, retaliação e extorsão. Dá para conversar, firmar trégua ou aliança.</p>`],
      ['Sua cidade', `<p><strong>${esc(c.name)} — ${esc(c.trait)}.</strong> ${esc(c.traitDesc)}</p>
        <ul>${SB.DISTRICTS.map(d => `<li><strong>${esc(d.name)}</strong>: ${esc(d.advantage)}</li>`).join('')}</ul>
        <p>O mês tem quatro semanas com ritmo próprio. Dias de pagamento (5 e 20) engordam lotérica, caixa e assaltos; nas Noites de fluxo suas casas rendem o dobro; nos três últimos dias a polícia aperta e no dia 30 atraca o Último Navio. Fique de olho no calendário: <strong>${esc(SB.EVENTS.carnaval.title)}</strong> começa no dia 9 e o <strong>${esc(SB.EVENTS.classico.title)}</strong> é no dia 20.</p>`]
    ];
  }
  /** Apresentação curta para personagem novo: o que é o jogo e o objetivo, sem contas. Abre antes do guia. */
  let helpMode = 'help';
  function introPages() {
    const c = state ? SB.cityOf(state.city) : SB.CITIES[0];
    return [
      ['Você chegou', `<p>Você desce na rodoviária de <strong>${esc(c.name)}</strong> sem dinheiro, sem arma e sem nome.</p><p>Até o fim do mês, a cidade vai saber quem você é. O placar é o <strong>respeito</strong>: ele te leva de <em>Pé de chinelo</em> a <em>Dono do morro</em> e decide a sua posição no ranking.</p>`],
      ['A rua gira assim', `<p><strong>Roube</strong> do mais fácil ao mais difícil: cada roubo mostra a sua chance.</p><p>Acabou a energia? A <strong>noite</strong> vende energia no balcão.</p><p>Com o dinheiro, a <strong>Feira</strong> te arma, protege e leva mais longe, e os roubos maiores se abrem. Subir de degrau é o que traz respeito.</p><p>Quando sobrar dinheiro, compre <strong>negócios</strong>: bar, oficina, banca do bicho… Eles pagam todo dia, até enquanto você dorme.</p><p>Toda manhã, o <strong>Jornal do Submundo</strong> na Rua conta o que mudou: sua patente, o que o respeito abriu, polícia, gangues, preços do Galpão, o comprador de fora e o resultado do bicho, que corre de noite e sai no jornal do dia seguinte. Toque numa notícia para ir à tela dela.</p><p>No <strong>Perfil</strong>, a <strong>Evolução</strong> mostra em barras o seu nível em Roubos (maior degrau feito), Armas, Proteção, Veículo e Negócios (o que os negócios e a produção dos esquemas já faturaram).</p><p>No modo online, a <strong>Esquina</strong> (Cidade) junta os jogadores: papo da cidade e geral, desafios de combate com aposta (vencedor leva o pote menos 10%) e o mercado negro, onde você vende a produção dos seus esquemas pelo preço que escolher, dentro de uma faixa.</p>`],
      ['A rua cobra', `<p>Cada roubo chama a <strong>polícia</strong>. Esfrie antes que ela chegue, ou vai pra cadeia.</p><p>A noite cobra no <strong>vício</strong> e o corpo cobra na <strong>saúde</strong>.</p><p>Na <strong>Rua</strong>, a sua história acontece: gente que aparece, decisões sem volta e avisos do que pede atenção.</p><p>O guia te acompanha nos primeiros passos.</p>`]
    ];
  }
  function openIntro() { if (state) SB.applyCity(state.city); helpMode = 'intro'; helpPage = 0; renderHelp(); $('#help').classList.remove('hidden'); const b = $('#helpBox .btn.primary'); if (b) b.focus(); }
  function renderHelp() {
    const pages = helpMode === 'intro' ? introPages() : helpPages(), [title, body] = pages[helpPage], last = helpPage === pages.length - 1;
    $('#helpBox').innerHTML = `<div class="helpHead"><span>${helpMode === 'intro' ? 'Bem-vindo' : 'Como jogar'} · ${helpPage + 1}/${pages.length}</span><button type="button" class="close" data-action="close-help" aria-label="Fechar">×</button></div>
      <h2 id="helpTitle">${title}</h2><div class="helpBody">${body}</div>
      <div class="helpBtns">${helpPage ? button('Voltar', 'help-prev', '', false, 'small ghost') : '<span></span>'}${last ? button(helpMode === 'intro' || (state && SB.tutorialStep(state)) ? 'Começar' : 'Fechar', 'close-help', '', false, 'primary') : button('Próximo', 'help-next', '', false, 'primary')}</div>`;
  }
  function openHelp(page = 0) { if (state) SB.applyCity(state.city); helpMode = 'help'; helpPage = page; renderHelp(); $('#help').classList.remove('hidden'); const b = $('#helpBox .btn.primary'); if (b) b.focus(); }
  function closeHelp() { $('#help').classList.add('hidden'); }

  /* ---------- telas ---------- */
  function panel() {
    const s = state, guide = guideCard(), story = storyCard();
    if (online && !rank.at && !rank.loading) setTimeout(() => loadRank(), 0);
    return jailNotice() + `<div class="streetBlock">${localeStrip(true, false)}<section class="streetCap" aria-label="A rua agora"><span class="streetLbl">A rua agora</span><p>${esc(SB.streetScene(s))}</p></section></div>` + localeInfo() + `
      ${guide}${s.career ? '' : careerCard()}
      ${story}
      ${s.career || s.tutorial.done ? newsCard() : ''}
      ${recados()}
      ${jornalCard()}
      ${agenda()}`;
  }
  /* ------------------------------------------------------------------ */
  /* Jornal do Submundo (Rua): os fatos vêm de SB.jornal; aqui só se escreve a notícia.                     */
  /* ------------------------------------------------------------------ */
  const KIND_TXT = { arma: 'arma', protecao: 'proteção', veiculo: 'veículo', noite: 'casa da noite', mercadoria: 'mercadoria', esquema: 'esquema', assalto: 'assalto do bando', duelo: 'adversário de duelo', lugar: 'lugar', patente: 'patente' };
  const unlockList = us => { const a = us.slice(0, 3).map(u => `${esc(u.name)} <small>(${KIND_TXT[u.kind] || u.kind})</small>`); return a.join(', ') + (us.length > 3 ? ` e mais ${us.length - 3}` : ''); };
    /** Lista de notícias do dia, cada uma com prioridade (a maior vira manchete). O fato vem de SB.jornal; o texto vem da
   *  redação (src/redacao.js), numa variação escolhida pela semente do dia. Sem fato, sem notícia. */
  const RED = () => window.SBRedacao;
  const seedPick = (seed, key) => { let x = seed >>> 0; for (const ch of key) x = (Math.imul(x, 31) + ch.charCodeAt(0)) >>> 0; return x; };
  function jornalNews(s, j) {
    const N = [], R = RED(), pk = (arr, k) => arr[seedPick(j.seed, k) % arr.length];
    const put = (prio, kick, key, v, view = '', tone = '', sub = '') => { const p = R.P[key]; v = Object.assign({ nome: esc(s.name) }, v); N.push({ prio, kick, title: pk(p.t, key + 't' + sub)(v), text: pk(p.x, key + 'x' + sub)(v), view, tone, by: p.by }); };
    const dn = id => esc(D(id).name), fname = id => id === 'voce' ? esc(s.name) : esc(F(id).short), gal = SB.placeOpen(s, 'galpao');
    const nx = j.nextPhase, prox = nx ? `Próximo degrau: ${esc(nx.name)}, com ${num(nx.at)} de respeito (faltam ${num(Math.max(0, nx.at - s.respect))}).` : 'Acima disso, só o topo da cidade.';
    // Carreira
    const patNow = j.extra.find(u => u.kind === 'patente'), patOld = j.unlocked.find(u => u.kind === 'patente');
    if (patNow) put(99, 'Extra', 'patenteAgora', { patente: esc(patNow.name), prox }, 'perfil', 'extra');
    else if (patOld) put(98, 'Carreira', 'patenteOntem', { patente: esc(patOld.name), prox }, 'perfil');
    const novo = j.extra.filter(u => u.kind !== 'patente'), velho = j.unlocked.filter(u => u.kind !== 'patente');
    if (novo.length) put(94, 'Extra', 'extra', { lista: unlockList(novo) }, novo[0].view, 'extra');
    if (velho.length) put(86, 'Novidades', 'novidades', { lista: unlockList(velho), um: velho.length === 1, item: esc(velho[0].name) }, velho[0].view);
    const a = j.acts, y = j.yesterday;
    if (a && a.ladder && j.ladderMission) put(84, 'Carreira', 'degrau', { n: num(a.ladder), roubo: esc(SB.missionName(s, SB.mission(j.ladderMission))) }, 'acoes');
    // Ontem
    if (y && y.arrests > 0) put(90, 'Polícia', 'preso', { n: num(y.arrests) }, 'acoes', 'bad');
    if (y && y.ok) put(y.respect >= 20 ? 70 : 52, 'Ontem', 'ontemBom', { n: num(y.ok), falhas: y.fail ? `${num(y.fail)} deu errado. ` : '', resp: `${y.respect >= 0 ? '+' : ''}${num(y.respect)}`, patr: `${y.worth >= 0 ? '+' : '−'}${fmt(Math.abs(y.worth))}` }, 'acoes');
    else if (y && y.fail) put(60, 'Ontem', 'ontemRuim', { f: num(y.fail), patr: `${y.worth >= 0 ? '+' : '−'}${fmt(Math.abs(y.worth))}` }, 'acoes', 'bad');
    // Bicho com jogo seu
    const b = j.bicho;
    if (b && b.picks.length) put(b.won ? 97 : 66, 'Bicho', b.won ? 'bichoGanhou' : 'bichoPerdeu', { bicho: esc(SB.ANIMALS[b.animal]), valor: fmt(b.won || b.lost), jogo: b.picks.map(k => esc(SB.ANIMALS[k.pick])).join(', ') }, 'apostas', b.won ? 'good' : '');
    // Compras, duelos, bando, saúde, Galpão do dia de ontem
    if (a) {
      for (const id of a.biz) put(82, 'Negócios', 'comprouNegocio', { negocio: esc(SB.business(id).name) }, 'negocios', 'good', id);
      for (const id of a.gear) { const it = SB.item(id); if (it) put(64, 'Feira do Rolo', it.slot === 'arma' ? 'armaNova' : it.slot === 'protecao' ? 'protecaoNova' : 'veiculoNovo', { item: esc(it.name) }, 'feira', '', id); }
      if (a.duelW > 0) put(62, 'Duelo', 'dueloVenceu', { n: num(a.duelW) }, 'duelos', 'good');
      if (a.duelL > 0) put(57, 'Duelo', 'dueloPerdeu', { n: num(a.duelL) }, 'duelos', 'bad');
      if (a.gang) put(80, 'Gangues', 'bandoNovo', {}, 'gangue', 'good');
      else if (a.crew > 0) put(54, 'Gangues', 'bandoCresceu', { n: num(a.crew) }, 'gangue');
      if (a.overdoses > 0) put(87, 'Saúde', 'overdose', {}, 'hospital', 'bad');
      if (a.ach > 0) put(56, 'Feitos', 'conquista', {}, 'temporada', 'good');
      if (a.exported > 0) put(68, 'Porto', 'remessa', { n: num(a.exported) }, 'galpao', 'good');
      else if (a.sold >= 5) put(45, 'Galpão', 'vendeu', { n: num(a.sold) }, 'galpao');
      if (a.blitz > 0) put(61, 'Polícia', 'blitz', { n: num(a.blitz) }, 'galpao', 'bad');
      if (a.bank >= 1000) put(36, 'Negócios', 'banco', { valor: fmt(a.bank) }, 'gestao');
      if (a.story > 0) put(50, 'Crônica', 'historia', {}, 'painel');
    }
    if (s.vicio >= 70) put(74, 'Saúde', 'vicioAlto', { n: num(s.vicio) }, 'hospital', 'bad');
    else if (s.health < 40 && !s.hospital) put(72, 'Saúde', 'saudeBaixa', { n: num(s.health) }, 'hospital', 'bad');
    // Cidade
    for (const e of j.events) put(e.fresh ? 78 : 48, e.fresh ? 'Hoje' : 'Continua', e.fresh ? 'eventoNovo' : 'eventoSegue', { evento: esc(e.title), desc: esc(e.desc), ate: e.until > s.day ? `Até o dia ${num(e.until)}.` : 'Só hoje.' }, e.district ? 'cidade' : '', ['operacao', 'fechames', 'fiscalizacao', 'crise'].includes(e.id) ? 'bad' : '', e.id);
    if (j.tomorrow.length) put(46, 'Previsão', 'previsao', { evento: j.tomorrow.map(t => esc(t.title)).join(' e ') });
    // Gangues
    for (const t of j.turf) {
      if (t.to === 'voce') put(88, 'Gangues', 'voceTomou', { regiao: dn(t.district) }, 'cidade', 'good', t.district);
      else if (t.from === 'voce') put(88, 'Gangues', 'vocePerdeu', { regiao: dn(t.district), grupo: fname(t.to) }, 'cidade', 'bad', t.district);
      else put(74, 'Gangues', 'gangueToma', { regiao: dn(t.district), grupo: fname(t.to), grupo2: fname(t.from) }, 'cidade', '', t.district);
    }
    if (j.moves.length) put(34, 'Gangues', 'movimento', { lista: j.moves.slice(0, 3).map(m => esc(m.text)).join(' ') }, 'cidade');
    // Polícia (só quando há o que contar)
    const pol = j.police, hp = a ? a.heatPrev : pol.heat;
    if (pol.heat >= 85) put(80, 'Polícia', 'cacado', { heat: num(pol.heat), tier: esc(pol.tier) }, 'acoes', 'bad');
    else if (pol.heat >= 60) put(76, 'Polícia', 'naMira', { heat: num(pol.heat), tier: esc(pol.tier) }, 'acoes', 'bad');
    else if (hp >= 60 && pol.heat < 45) put(58, 'Polícia', 'esfriou', { heat: num(pol.heat), tier: esc(pol.tier) }, 'acoes', 'good');
    if (pol.hot.v >= 35) put(42, 'Polícia', 'policiaRegiao', { regiao: dn(pol.hot.id), regiao2: dn(pol.calm.id), n: num(pol.hot.v) }, 'cidade');
    // Galpão e porto
    if (gal) {
      const ex = j.export;
      if (ex.today) put(SB.cargoUsed(s) > 0 ? 80 : 56, 'Porto', 'portoHoje', { regiao: dn('cais') }, 'galpao', 'good');
      else if (ex.day > s.day && ex.day - s.day <= 2) put(44, 'Porto', 'portoPrevisto', { regiao: dn('cais'), dia: num(ex.day) }, 'galpao');
      for (const m of j.movers.filter((x, i, l) => l.findIndex(z => z.good === x.good) === i).slice(0, 2)) put(50 + Math.min(10, Math.abs(m.pct) / 3), 'Galpão', m.pct > 0 ? 'alta' : 'queda', { mercadoria: esc(SB.good(m.good).name), pct: num(Math.abs(m.pct)), regiao: dn(m.district), de: fmt(m.from), para: fmt(m.price), unid: esc(SB.good(m.good).unit) }, 'galpao', m.pct > 0 ? 'good' : 'bad', m.good);
      if (j.spread && j.spread.gain >= Math.max(2, j.spread.buyPrice * .15)) put(40, 'Galpão', 'rota', { mercadoria: esc(SB.good(j.spread.good).name), compra: dn(j.spread.buy), venda: dn(j.spread.sell), de: fmt(j.spread.buyPrice), para: fmt(j.spread.sellPrice) }, 'galpao');
    }
    // Negócios
    if (j.boom) put(58, 'Negócios', 'boom', { negocio: esc(SB.business(j.boom.id).name), pct: num(Math.round((j.boom.mult - 1) * 100)) }, 'negocios', 'good');
    if (j.business && j.business.cost <= s.cash + s.bank) { const bz = j.business; put(38, 'Classificados', 'negocioDaVez', { negocio: esc(SB.business(bz.id).name), custo: fmt(bz.cost), renda: fmt(bz.day), prazo: num(bz.payback) }, 'negocios'); }
    // Fofoca: só quando o próximo desbloqueio está perto
    if (j.next && j.next.at - s.respect <= 15) put(30, 'Fofoca', 'fofocaProximo', { n: num(j.next.at), item: esc(j.next.name), tipo: KIND_TXT[j.next.kind] || j.next.kind, falta: num(j.next.at - s.respect) }, j.next.view);
    // Crônica: a cidade vive mesmo quando você não faz nada (em 4 de cada 5 dias)
    if (seedPick(j.seed, 'cron?') % 5 !== 0) {
      const c = pk(R.CRONICAS, 'cron'), reg = SB.DISTRICTS[seedPick(j.seed, 'reg') % SB.DISTRICTS.length], fac = SB.FACTIONS[seedPick(j.seed, 'fac') % SB.FACTIONS.length];
      const v = { regiao: esc(reg.name), grupo: esc(F(fac.id).short), bar: esc(SB.business('bar').name), cidade: esc(s.city) };
      N.push({ prio: 28, kick: 'Crônica', title: c.t(v), text: c.x(v), view: '', tone: '', by: 'juca' });
    }
    return N.sort((p, q) => q.prio - p.prio);
  }
  function jornalCard() {
    const s = state, j = SB.jornal(s), c = SB.cityOf(s.city), R = RED(), news = jornalNews(s, j);
    const lead = news[0] && news[0].prio >= 60 ? news.shift() : news.find(n => n.kick === 'Crônica') ? news.splice(news.findIndex(n => n.kick === 'Crônica'), 1)[0]
      : { kick: 'Cidade', title: esc(j.week.name.split('·').pop().trim()), text: `${esc(j.week.desc)} ${s.day < MAXDAY ? `Faltam ${num(MAXDAY - s.day)} dias para o fim do mês.` : 'Último dia do mês.'}`, view: '', tone: '', by: 'kelly' };
    const go = v => v ? ` data-view="${v}"` : '', by = k => R.EQUIPE[k] ? `<span class="jBy">por ${esc(R.EQUIPE[k].nome)}</span>` : '';
    const item = n => `<article class="jItem ${n.tone}"${go(n.view)}${n.view ? ' role="button" tabindex="0"' : ''}><span class="jKick">${esc(n.kick)}</span><h4>${n.title}</h4>${by(n.by)}<p>${n.text}</p></article>`;
    const pi = SB.phaseIndex(s), ph = SB.PHASES[pi], nx = SB.PHASES[pi + 1];
    const ficha = `<section class="rumo ficha jFicha" aria-label="Seu progresso"><span class="jKick">Coluna do respeito</span>
        <div class="progHead"><b>${esc(ph.name)}</b><span>${nx ? `faltam ${num(nx.at - s.respect)} para ${esc(nx.name)}` : 'patente máxima'}</span></div><div class="meter"><div style="width:${pct(nx ? (s.respect - ph.at) / (nx.at - ph.at) * 100 : 100)}%"></div></div>
        <div class="progRank">${online ? (rank.me ? `<span>Ranking do mês: <b>${num(rank.me.posicao)}º de ${num(rank.me.total)}</b>${rank.me.acima_codinome && Number(rank.me.posicao) > 1 ? ` · ${num(Math.max(1, rank.me.acima_respeito - rank.me.respeito + 1))} para passar ${esc(rank.me.acima_codinome)}` : ''}</span>` : '<span>Ranking do mês</span>') : `<span>Temporada ${num(s.season)} · ★ ${num(s.respect)} de respeito</span>`}${button(online ? 'Ranking' : 'Temporada', 'switch', `data-target="${online ? 'ranking' : 'temporada'}"`, false, 'small ghost')}</div></section>`;
    const b = j.bicho, tk = j.tickets, apostas = SB.placeOpen(s, 'apostas');
    const bicho = b || tk.length ? `<section class="jBicho ${b && b.won ? 'paid' : ''}" aria-label="Resultado do bicho"${apostas ? ' data-view="apostas" role="button" tabindex="0"' : ''}><span class="jKick">Deu no bicho</span>
        ${b ? `<div class="jDraw"><b>${String(b.animal + 1).padStart(2, '0')}</b><span>${esc(SB.ANIMALS[b.animal])}<em>grupo ${String(b.animal + 1).padStart(2, '0')} · extração do dia ${num(b.day)}</em></span></div>` : ''}
        ${b && b.picks.length ? `<p class="${b.won ? 'win' : 'lose'}">${b.won ? `Você acertou: +${fmt(b.won)}` : `Seu jogo: ${b.picks.map(k => esc(SB.ANIMALS[k.pick])).join(', ')}. Não deu.`}</p>` : ''}
        ${tk.length ? `<p class="tick">Hoje à noite: ${tk.map(k => `${esc(SB.ANIMALS[k.pick])} ${fmt(k.stake)}`).join(' · ')}</p>` : ''}<span class="jBy">por ${esc(R.EQUIPE.bene.nome)}</span></section>` : '';
    const list = bicho ? news.filter(n => n.kick !== 'Bicho') : news; // o quadro do bicho já conta o resultado
    const shown = list.slice(0, 2), rest = list.slice(2);
    const frase = `${esc(R.FRASES[seedPick(j.seed, 'frase') % R.FRASES.length])}`, quem = esc(R.FRASE_QUEM[seedPick(j.seed, 'quem') % R.FRASE_QUEM.length]);
    const ads = [0, 1].map(k => R.CLASSIFICADOS[(seedPick(j.seed, 'ad') + k * 7) % R.CLASSIFICADOS.length]);
    const exp = ['kelly', 'tuca', 'ze', 'lourival', 'tiao', 'bene', 'neide', 'cida', 'marquinhos', 'juca', 'doutora', 'bia'].map(k => `${esc(R.EQUIPE[k].nome)} <small>(${esc(R.EQUIPE[k].cargo)})</small>`).join(' · ');
    return `<section class="jornal" aria-label="Jornal do Submundo">
      <header class="jMast"><div class="jEars"><span>Edição ${esc(c.name)}</span><span>Dia ${num(s.day)} de ${num(MAXDAY)}${s.clock ? ` · o dia vira em ${dur(SB.clockInfo(s).midnight)}` : ''}</span></div>
        <h2 class="jTitle">Jornal do Submundo</h2>
        <div class="jSub"><span>${esc(j.week.name)}</span><span>O que a polícia não lê</span></div></header>
      <article class="jLead ${lead.tone}"${go(lead.view)}${lead.view ? ' role="button" tabindex="0"' : ''}><figure class="jFig"><div class="jPhoto" aria-hidden="true"></div><figcaption>Foto: ${esc(R.EQUIPE.bia.nome)}</figcaption></figure><div class="jLeadText"><span class="jKick">${esc(lead.kick)}</span><h3>${lead.title}</h3>${by(lead.by)}<p>${lead.text}</p></div></article>
      <div class="jGrid">${ficha}${bicho}${shown.map(item).join('')}</div>
      <blockquote class="jQuote"><p>“${frase}”</p><cite>— ${quem}</cite></blockquote>
      <details class="jMore"><summary>Ler o jornal inteiro <small>${rest.length ? `${rest.length} notícia${rest.length > 1 ? 's' : ''} e classificados` : 'classificados e expediente'}</small></summary>
        ${rest.length ? `<div class="jGrid">${rest.map(item).join('')}</div>` : ''}
        <section class="jAds"><span class="jKick">Classificados</span>${ads.map(t => `<p>${esc(t)}</p>`).join('')}</section>
        <p class="jExp"><b>Expediente</b> ${exp}</p></details>
    </section>`;
  }
  /** Diário: agenda de folhas gastas, escrita à caneta. Cada fato vira uma linha; a virada do dia fica em "Madrugada"
   *  e as ações em "Durante o dia", em ordem de acontecimento. */
  const noteSplit = m => m.replace(/^Dia \d+\.\s*/, '').split(/(?<=[.!])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ+−-])/).map(x => x.trim()).filter(Boolean);
  const noteTone = m => /(perdeu|preso|não saiu|enquadr|overdose|apreendid|Batida|abandonou|−R\$|-R\$|sem resposta|falhou|deu errado|desfez|não pagou|Ressaca)/i.test(m) ? 'bad'
    : /(ganhou|acertou|\+R\$|lucro|subiu|venceu|\+\d+ de respeito|Conquista|Feito do mês|agora é)/i.test(m) ? 'good' : '';
  const noteLi = m => `<li class="${noteTone(m)}">${esc(m)}</li>`;
  /** O Diário é só o histórico do jogador: notícias da cidade (grupos se mexendo, eventos, navio no porto) ficam no jornal.
   *  Fala de grupo só entra se for com você (retaliação, aliança, cobrança). */
  const MINE = /\b(você|voce|sua|seu|suas|seus|te|contigo)\b/i;
  function myNote(m) {
    const mine = MINE.test(m.replace(/suas fileiras/gi, ''));
    if (/^Evento:|^O comprador de fora chegou|^Uma notícia passou sem resposta/i.test(m)) return false;
    if (/(ampliou presença|reorganizou suas fileiras|se preparou contra|entrou em choque|Agora lidera|perdeu o comando da região durante)/i.test(m) && !mine) return false;
    const groups = SB.FACTIONS.flatMap(f => [f.name, f.short]);
    if (groups.some(g => m.includes(g)) && !mine) return false;
    return true;
  }
  function agendaPage(d, msgs, today) {
    const turn = msgs.filter(m => /^Dia \d+\./.test(m)), acts = msgs.filter(m => !/^Dia \d+\./.test(m)).flatMap(m => myNote(m) ? [m] : []).reverse(); // o log vem do mais novo
    const night = turn.flatMap(noteSplit).filter(myNote), max = 6, hid = acts.length > max ? acts.slice(0, acts.length - max) : [], vis = acts.slice(-max);
    const rel = today ? 'hoje' : `${num(state.day - d)} dia${state.day - d > 1 ? 's' : ''} atrás`;
    return `<div class="agPage"><h4 class="agDay"><b>Dia ${num(d)}</b><span>${rel}</span></h4>
      ${night.length ? `<p class="agSec">Madrugada</p><ul class="agList">${night.map(noteLi).join('')}</ul>` : ''}
      ${acts.length ? `<p class="agSec">Durante o dia</p>${hid.length ? more(`<ul class="agList">${hid.map(noteLi).join('')}</ul>`, `${hid.length} anotaç${hid.length > 1 ? 'ões' : 'ão'} mais cedo`) : ''}<ul class="agList">${vis.map(noteLi).join('')}</ul>` : ''}
      ${!night.length && !acts.length ? '<ul class="agList"><li>Nada anotado ainda.</li></ul>' : ''}</div>`;
  }
  function agenda() {
    const s = state, byDay = new Map();
    for (const i of state.log) { if (!byDay.has(i.day)) byDay.set(i.day, []); byDay.get(i.day).push(i.msg); }
    const old = [...byDay.keys()].filter(d => d !== s.day).sort((a, b) => b - a), wk = SB.week(s).name.split('·')[0].trim();
    return `<section class="agenda" aria-label="Diário"><div class="agRings" aria-hidden="true"></div>
      <div class="agHead"><b>Diário</b><span>${esc(wk)} · ${esc(s.city)}</span></div>
      ${agendaPage(s.day, byDay.get(s.day) || [], true)}
      ${old.length ? `<details class="agBack"><summary>Folhear os dias anteriores</summary>${old.map(d => agendaPage(d, byDay.get(d), false)).join('')}</details>` : ''}</section>`;
  }
  /** Capítulo da história à espera de decisão: quem fala, o que diz e as duas saídas. */
  function storyCard() {
    const s = state, ch = SB.storyPending(s); if (!ch) return '';
    return `<section class="storyCard" aria-label="História"><div class="storyHead"><span>${esc(ch.who)}</span><b>Capítulo ${SB.STORY.indexOf(ch) + 1} de ${SB.STORY.length}</b></div>
      <h3>${esc(ch.title)}</h3><p>${esc(ch.text)}</p>
      <div class="storyChoices">${ch.choices.map((c, i) => { const cost = SB.storyCost(c), no = s.cash < cost; return `<button type="button" class="storyChoice" data-action="story" data-id="${ch.id}" data-i="${i}" ${no ? 'disabled' : ''}><b>${esc(c.label)}</b><small>${esc(c.desc)}${no ? ' · falta dinheiro' : ''}</small></button>`; }).join('')}</div></section>`;
  }
  /** Recados da rua: até 3 avisos do que pede atenção agora, cada um levando à tela certa. */
  function recados() {
    const s = state, out = [], add = (tone, txt, v) => out.push(`<button type="button" class="recado ${tone}" data-view="${v}"><i aria-hidden="true"></i><span>${txt}</span></button>`);
    if (s.jail > 0 || s.hospital > 0) return '';
    if (s.heat >= 85) add('bad', 'Você está sendo caçado. Esfrie antes do próximo roubo.', 'acoes');
    else if (s.heat >= 60) add('warn', 'A polícia está na sua cola.', 'acoes');
    if (s.health < 40) add('bad', 'Você está ferido. Passe no Hospital.', 'hospital');
    if (s.vicio >= 70) add('bad', 'O vício passou do ponto.', 'hospital');
    const deal = s.exportDeal; if (SB.placeOpen(s, 'galpao') && deal && deal.day === s.day && SB.cargoUsed(s) > 0 && s.exportDone !== s.day) add('good', 'O comprador de fora atracou no cais hoje.', 'galpao');
    if (s.heist) add('warn', `O plano do bando (${esc(SB.heist(s.heist.id).name)}) está de pé. Não deixe esfriar.`, 'assaltos');
    for (const d of SB.DISTRICTS) if ((s.turfOwned || []).includes(d.id)) { const l = SB.leader(s, d.id); if (s.influence[d.id] - l.value < 16) { add('warn', `${esc(F(l.id).short)} está crescendo na ${esc(d.name)}. Seu comando ali está em risco.`, 'cidade'); break; } }
    if (s.day >= 25 && s.day < MAXDAY) add('warn', `Reta final: faltam ${MAXDAY - s.day} dia(s) no mês.`, online ? 'ranking' : 'temporada');
    return out.length ? `<section class="recados" aria-label="Recados da rua">${out.slice(0, 3).join('')}</section>` : '';
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
  /** Posição do roubo na trilha (os exclusivos de região vão para o fim, pela dificuldade). */
  /* Ícones pequenos das fichas (energia, Procurado, respeito, cadeia). */
  const ST_ICO = {
    en: 'M7 0 1 7h4l-1 5 6-7H6z', heat: 'M3 9V6a3 3 0 0 1 6 0v3zM1 10h10v2H1zM5.4 0h1.2v2H5.4z',
    resp: 'M6 0l1.8 3.8 4.2.5-3.1 2.9.8 4.1L6 9.3 2.3 11.3l.8-4.1L0 4.3l4.2-.5z', jail: 'M1 1h10v10H1zM4 1v10M8 1v10', inf: 'M6 1a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM2 11c0-3 2-4 4-4s4 1 4 4z',
    money: 'M1 3h10v6H1zm5 1.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6z', chance: 'M2 1h8v10H2zm2 2v2h2V3zm2 4v2h2V7z', fight: 'M1 9l4-4 1 1-4 4zm10 0L7 5 6 6l4 4zM4 1h4v3H4z'
  };
  const stat = (k, txt, cls = '', label = '') => `<span class="st ${cls}"${label ? ` title="${label}" aria-label="${label}: ${txt}"` : ''}><svg class="stIco" viewBox="0 0 12 12" aria-hidden="true"><path d="${ST_ICO[k]}"/></svg>${txt}</span>`;
  /** Bloco "Detalhes": a conta e a explicação ficam a um toque, fora do caminho. */
  const more = (html, label = 'Detalhes') => `<details class="more"><summary>${label}</summary><div class="moreBody">${html}</div></details>`;
  function actions() {
    const s = state;
    const list = SB.MISSIONS.filter(m => missionFilter === 'todas' ? true : missionFilter === 'bairro' ? m.district === s.district : ['', 'Energia insuficiente.', 'Você está detido.', 'Você está internado.'].includes(SB.missionLock(s, m))).sort((a, b) => a.n - b.n);
    return heading('Roubar', 'Do mais fácil ao mais difícil.') + jailNotice() + resultCard() + heatCard() + `
      ${stencil('Roubos', esc(D().name))}<div class="robStats traits hereTraits">${SB.districtTraits(D()).map((tx, k) => `<span class="st trait t${k}">${esc(tx)}</span>`).join('')}</div>
      <div class="filterbar" role="group" aria-label="Filtrar missões">${[['disponiveis', 'Disponíveis'], ['bairro', 'Desta região'], ['todas', 'Todas']].map(([id, l]) => `<button type="button" class="btn ghost ${missionFilter === id ? 'on' : ''}" data-action="filter" data-id="${id}" aria-pressed="${missionFilter === id}">${l}</button>`).join('')}</div>
      <div class="jobs">${list.length ? list.map(missionCard).join('') : '<div class="empty">Nenhum roubo neste filtro. Veja “Todas”.</div>'}</div>
      ${stencil('Treino', `hoje ${s.today.training}/3`)}
      <div class="trainGrid">${SB.STATS.map(st => { const lvl = s.stats[st.id], cost = SB.trainCost(s, st.id); return `<section class="card trainCard"><div class="trainHead">${statIcon(st.id)}<b>${st.name}</b><strong>${num(lvl)}</strong></div>${button(`+${lvl < 25 ? 2 : 1} · ${fmt(cost)}`, 'train', `data-id="${st.id}"`, s.jail > 0 || s.energy < 22 || s.cash < cost || s.today.training >= 3, 'small block')}</section>`; }).join('')}</div>
      <p class="mini trainNote">Cada treino gasta 22 de energia.</p>
      ${safeJobs()}`;
  }
  function missionCard(m) {
    const s = state, lock = SB.missionLock(s, m), p = SB.missionChance(s, m), mult = SB.missionRewardMult(s, m), k = SB.KINDS[m.kind];
    const parts = SB.scoreParts(s, m), odds = SB.missionOdds(s, m), drag = Math.round(SB.heatDrag(s) * 100), rg = SB.respectGain(s, m), inf = SB.robberyInfluence(s, m) > 0;
    const tag = m.stat ? `${k.name} · ${statName(m.stat)}`  : m.kind === 'assalto' ? `${k.name} · arsenal` : '', loc = SB.localMission(s, m);
    const hard = lock && !['Energia insuficiente.', 'Você está detido.', 'Você está internado.'].includes(lock);
    const pic = window.SBArt.roubo(m.id), arrest = SB.arrestChance(s, m);
    return `<section class="rob ${hard ? 'locked' : ''}">
      <div class="robTop"><span class="robPic" aria-hidden="true">${pic || statIcon(m.stat || 'arsenal')}</span>
        <div class="robTitle"><h3><span class="jobN">${m.n}</span>${esc(loc.name)}</h3>${tag || m.district ? `<p class="jobKind k-${m.kind}">${esc([tag, m.district ? 'só aqui' : ''].filter(Boolean).join(' · '))}</p>` : ''}</div>
        <span class="seal ${chanceClass(p)}" aria-label="Chance ${p}%">${p}%</span>
      <div class="robSide"><div class="robStats">${stat('resp', fmt(m.low * mult) + '–' + fmt(m.high * mult).replace('R$ ', ''), 'money noIco')}${stat('en', SB.missionCost(s, m), '', 'Energia')}${stat('heat', '+' + m.heat, 'heat', 'Procurado')}${rg ? stat('resp', '+' + rg, 'resp', 'Respeito') : ''}${inf ? `<span class="st inf">influência +</span>` : ''}${m.safe ? '' : `<span class="st risk">cadeia ${arrest}%</span>`}</div>
      ${lock ? `<div class="lockline">${esc(lock)}</div>` : ''}</div></div>
      <div class="robAct">${button('Roubar', 'mission', `data-id="${m.id}"`, !!lock, 'primary')}${more(`<p>${esc(loc.desc)}</p>
        <p>Seu poder <b>${num(Math.round(odds.power))}</b> contra dificuldade <b>${num(Math.round(odds.diff))}</b>: ${parts.filter(x => x[1] > 0).map(x => `${x[0].toLowerCase()} ${Math.round(x[1])}`).join(' + ')}${drag ? `, Procurado −${drag}%` : ''}.</p>
        <p>${m.safe ? 'Se falhar, só perde a energia.' : `Se falhar: −${Math.round(SB.failLoss(s, m) * 100)}% do caixa em mãos e ${arrest}% de cadeia.`}${rg ? '' : s.respect >= SB.respectCap(m.n) ? ' Este roubo já não dá respeito para você: suba de degrau.' : ' Roubo pequeno demais para dar respeito.'}</p>`)}</div></section>`;
  }
  function turfSlotsText(s) {
    const pi = SB.phaseIndex(s), n = SB.turfSlots(s), own = SB.controls(s).length, k = SB.TURF_SLOTS.findIndex((v, i) => i > pi && v > n), nx = k > 0 ? SB.PHASES[k] : null;
    return `Sua patente (${esc(SB.PHASES[pi].name)}) segura ${n ? n + (n > 1 ? ' regiões' : ' região') : 'nenhuma região'}; você manda em ${own}.${nx ? ` Com ${esc(nx.name)} (${nx.at} de respeito), ${SB.TURF_SLOTS[k]}.` : ''}`;
  }
  /** Influência na região onde você rouba (o roubo do 4º degrau em diante soma influência aqui). */
  function turfLine() {
    const s = state, d = D(), ti = SB.infTier(s, d.id), mine = ti === 3, l = SB.leader(s, d.id);
    const capped = !mine && SB.turfReady(s, d.id);
    return `<p class="notice turfLine ${mine ? 'mine' : ''}">${mine ? `<strong>Você manda na ${esc(d.name)}:</strong> +12% no saque, propina 25% mais barata e a polícia da região sobe pela metade.` : capped ? `<strong>Influência na ${esc(d.name)}: ${num(s.influence[d.id])}.</strong> Dava para mandar aqui, mas falta patente. ${turfSlotsText(s)}` : `<strong>Influência na ${esc(d.name)}: ${num(s.influence[d.id])} · ${esc(SB.INF_TIERS[ti].name)}.</strong> Roubos do 4º degrau em diante somam influência aqui; com ${num(Math.max(60, l.value + 10))}, a região é seu.`}</p>`;
  }
  /** Termômetro do Procurado: faixa atual e os dois jeitos de esfriar. A explicação fica em Detalhes. */
  function heatCard() {
    const s = state, ti = SB.heatTier(s), tier = SB.HEAT_TIERS[ti], cc = SB.cleanCost(s);
    const marks = SB.HEAT_TIERS.map((x, i) => `<span class="heatTier ${i === ti ? 'on' : ''} ${i < ti ? 'past' : ''}"><b>${x.at}</b>${esc(x.name)}</span>`).join('');
    return `<section class="card heatCard t${ti}" aria-label="Procurado">
      <div class="space"><h3>Procurado ${num(s.heat)}</h3><span class="pill heatPill">${esc(tier.name)}</span></div>
      <div class="heatMeter" aria-hidden="true"><i style="width:${pct(s.heat)}%"></i></div><div class="heatTiers">${marks}</div>
      <div class="heatBtns">${button(`Ficar na sua · 18 energia`, 'lay-low', '', s.energy < 18 || s.jail > 0 || s.heat === 0, 'small')}${button(`Propina · ${fmt(cc)}`, 'clean-record', '', s.heat <= 0 || s.cash < cc || s.jail > 0, 'small primary')}</div>
      ${more(`<p>${esc(tier.desc)}</p><p>Ficar na sua tira 20. A propina tira 25: custa mais para quem faz roubo maior e sobe a cada vez no dia${SB.controlled(s, s.district) ? ' (na sua região, sai 25% mais barata)' : ''}. Trocar de região e o tempo também esfriam.</p>`, 'Como funciona')}</section>`;
  }
  function safeJobs() {
    const s = state, g = SB.eventMod(s, 'gigMult');
    return `${stencil('Bico', 'sem risco')}<section class="card shopRow"><div><h3>Bico de ocasião</h3><p class="mini">28 energia · ${fmt(SB.GIG_PAY[0] * g)}–${fmt(SB.GIG_PAY[1] * g).replace('R$ ', '')} · Procurado −4</p></div><div class="shopAct">${button('Fazer bico', 'gig', '', s.energy < 28 || s.jail > 0, 'small')}</div></section>`;
  }

  function city() {
    const s = state, d = D(), ds = s.dstate[d.id], l = SB.leader(s, d.id), lf = F(l.id), lr = s.factions[l.id];
    const agreed = SB.agreement(s, l.id), cc = SB.contactCost(s), used = s.today.contacts[d.id] || 0;
    const disputeBlock = s.jail > 0 || s.cash < 320 || s.energy < 33 || s.influence[d.id] < 20 || agreed || lr.lastActionDay === s.day;
    const special = SB.MISSIONS.find(m => m.district === d.id);
    return heading('Regiões', 'Cada região tem dono, grana e polícia próprios, que mudam a cada dia.') + jailNotice() + resultCard() + localeStrip(true) + localeInfo() + `
      <section class="card"><div class="space factionHeader"><div><h2>Influência na ${esc(d.name)}</h2><p>Quem lidera: <strong>${SB.controlled(s, d.id) ? 'você' : esc(lf.name)}</strong>. ${esc(SB.factionStatus(s, l.id))}. Liderar exige 60 de influência e 10 acima da maior facção.</p></div>${SB.controlled(s, d.id) ? '<span class="pill">Você lidera</span>' : ''}</div>
        <div class="dualMeters"><div><div class="meterlabel"><span>Sua influência</span><strong>${s.influence[d.id]}</strong></div><div class="meter green"><div style="width:${s.influence[d.id]}%"></div></div></div>
        <div><div class="meterlabel"><span>${esc(lf.short)} (maior facção)</span><strong>${l.value}</strong></div><div class="meter red"><div style="width:${l.value}%"></div></div></div></div>
        <div class="chips">${SB.FACTIONS.map(f => `<span class="chip">${esc(f.short)} ${s.presence[d.id][f.id]}</span>`).join('')}</div>
        <div class="btnbar" style="margin-top:12px">${button(`Criar contatos · ${fmt(cc)}`, 'contact', '', s.jail > 0 || s.cash < cc || s.energy < 22 || used >= 2, 'small primary')}${button(`Disputar área · R$ 320 (${SB.disputeOdds(s, d.id)}%)`, 'dispute', '', disputeBlock, 'small')}</div>
        <p class="mini" style="margin-top:8px">Contatos: 22 energia, até 2 por região ao dia (o segundo rende metade). Disputa: 33 energia, exige 20 de influência; uma ação por facção ao dia; bloqueada por acordos.${agreed ? ` Você tem acordo com ${esc(lf.short)}.` : ''}</p></section>
      <section class="brandpanel" style="margin-top:13px"><p>${esc(d.desc)}</p>
        <div class="kv"><div><span>Grana</span><strong>${Math.round(ds.econ * 100)}%</strong></div><div><span>Polícia na região</span><strong>${ds.vigil}</strong></div><div><span>Recompensas</span><strong>${signed(d.bonus)}%</strong></div><div><span>Risco base</span><strong>${signed(d.risk)}</strong></div><div><span>Tributo se liderar</span><strong>${fmt(SB.tribute(s, d.id))}/dia</strong></div><div><span>Oportunidade</span><strong>${special ? esc(special.name) : '—'}</strong></div></div>
        <p class="mini" style="margin-top:9px">Vantagem de liderar: ${esc(d.advantage)} Cada região liderada também gera +2 de Procurado por dia e atrai as facções.</p></section>
      <div class="section"><h2>Mapa da cidade</h2><small>Viagem: ${fmt(SB.travelCost(s).cash)}${SB.travelCost(s).energy ? ' e ' + SB.travelCost(s).energy + ' energia' : ''}</small></div>
      <div class="grid two">${SB.DISTRICTS.map(x => districtCard(x)).join('')}</div>
      <div class="section"><h2>Domínio da cidade</h2><small>Sua influência nas regiões contra a das facções</small></div>
      <section class="card">${SB.seasonRanking(s).map((r, i) => `<div class="rankRow ${r.player ? 'me' : ''}"><strong>${i + 1}. ${esc(r.name)}</strong><span>${num(r.power)}</span></div>`).join('')}<p class="mini" style="margin-top:6px">Soma da influência/presença nas regiões, +30 por região liderada.</p></section>
      <p class="quiet" style="margin-top:15px">Os pontos, grupos e personagens são inventados e não representam comunidades reais.</p>`;
  }
  function districtCard(x) {
    const s = state, l = SB.leader(s, x.id), here = x.id === s.district, ds = s.dstate[x.id];
    const evs = SB.activeEvents(s).filter(e => e.district === x.id);
    const traits = SB.districtTraits(x).map((tx, k) => `<span class="st trait t${k}">${esc(tx)}</span>`).join('');
    return `<section class="card district ${here ? 'selected' : ''}" style="--bc:${(SB.DISTRICT_VIBE[x.id] || {}).color || '#e0a040'}"><div class="miniScene">${scene(x.id)}${plate(x.name)}${here ? '<span class="pill here">Você está aqui</span>' : SB.controlled(s, x.id) ? '<span class="pill here">Você lidera</span>' : ''}</div>
      <div class="kv"><div><span>Líder</span><strong>${SB.controlled(s, x.id) ? 'Você' : esc(F(l.id).short) + ' ' + l.value}</strong></div><div><span>Sua influência</span><strong>${s.influence[x.id]}</strong></div><div><span>Grana</span><strong>${Math.round(ds.econ * 100)}%</strong></div><div><span>Polícia na região</span><strong>${ds.vigil}</strong></div></div>
      <div class="robStats traits">${traits}</div>
      ${evs.length ? `<div class="chips">${evs.map(e => `<span class="chip warn">${esc(SB.eventTitle(e))}</span>`).join('')}</div>` : ''}
      <div class="statusbar"><span class="mini">${esc(x.advantage)}</span>${here ? '<span class="pill">Você está aqui</span>' : (() => { const tc = SB.travelCost(s), price = tc.cash ? fmt(tc.cash) : 'grátis'; return button(`Comprar passagem e ir · ${price}${tc.energy ? ` · ${tc.energy} energia` : ''}`, 'travel', `data-id="${x.id}"`, s.cash < tc.cash || s.energy < tc.energy || s.jail > 0, 'small primary travelBtn'); })()}</div></section>`;
  }

  function management() {
    const s = state, fee = SB.hasPerk(s, 'empreendedor', 1) ? 1 : 3;
    return heading('Banco', 'Dinheiro guardado não se perde quando o roubo falha.') + `<div class="screenArt">${window.SBArt.place('gestao')}</div>` + jailNotice() + resultCard() + `
      <div class="grid two" style="margin-top:13px"><section class="card"><h2>Banco</h2><p>Depósitos ficam protegidos de falhas e retaliações. Taxa de depósito: ${fee}%. Saques são gratuitos.</p>
        <div class="formfield"><label for="bankAmount">Valor em reais (R$)</label><input class="input" id="bankAmount" type="number" min="1" step="1" inputmode="numeric" placeholder="Ex.: 500"></div>
        <div class="btnbar" style="margin-top:10px">${button('Depositar', 'bank', 'data-mode="deposit"', false, 'primary small')}${button('Sacar', 'bank', 'data-mode="withdraw"', false, 'small')}${button(`Depositar tudo (${fmt(SB.maxDeposit(s))})`, 'bank-all', '', SB.maxDeposit(s) < 1, 'small ghost')}</div></section>
      <section class="card"><h2>Patrimônio</h2><table class="table"><tbody><tr><td>Dinheiro em mãos</td><td>${fmt(s.cash)}</td></tr><tr><td>Banco</td><td>${fmt(s.bank)}</td></tr><tr><td>Negócios (revenda 60%)</td><td>${fmt(SB.resaleValue(s))}</td></tr><tr><td><strong>Patrimônio total</strong></td><td><strong>${fmt(SB.patrimony(s))}</strong></td></tr></tbody></table>
        <div class="statusbar"><span>Negócios hoje</span><strong class="positive">${fmt(SB.income(s))}</strong></div>
        <div class="statusbar"><span>Manutenção da equipe</span><strong class="negative">${fmt(SB.groupUpkeep(s))}</strong></div>
        ${s.contracts.length ? `<div class="statusbar"><span>Sociedades ativas</span><strong>${s.contracts.map(c => `${fmt(c.daily)} × ${c.days} dia(s)`).join(', ')}</strong></div>` : ''}</section></div>
      <div class="btnbar" style="margin-top:12px">${button('Ver negócios', 'switch', 'data-target="negocios"', false, 'small ghost')}</div>`;
  }
  function businessCard(b) {
    const s = state, owned = s.businesses.includes(b.id), cost = SB.buyCost(s, b), today = SB.businessIncome(s, b), cl = owned ? '' : SB.chainLock(s, 'biz', b.id);
    return `<section class="card bizCard ${owned ? 'mine' : ''}"><div class="space"><h3>${esc(b.name)}</h3>${owned ? '<span class="pill own">Seu</span>' : `<strong>${fmt(cost)}</strong>`}</div>
      <div class="robStats"><span class="st good">${fmt(today)} por dia</span><span class="st">${esc(D(b.district).name)}</span>${owned ? '' : stat('resp', '+' + b.respect, 'resp', 'Respeito')}</div>
      ${s.extorted[b.id] === s.day ? '<p class="negative mini">Sob extorsão hoje: renda reduzida.</p>' : ''}
      ${owned ? button('Vender negócio', 'sell', `data-id="${b.id}"`, s.jail > 0, 'block ghost small') : button('Comprar', 'buy', `data-id="${b.id}"`, !!cl || s.cash < cost || s.jail > 0, 'block primary')}</section>`;
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
      <section class="card"><h2>Operações do grupo</h2><p>Uma por dia, na região atual. Rende conforme a economia local e aumenta o Procurado. Chance depende de sede, integrantes, funções, ânimo e Procurado.</p>
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
      <div class="rivalMetrics"><div><span>Acordos</span><strong>${s.gangStats.pacts}</strong></div><div><span>Retaliações</span><strong>${s.gangStats.retaliations}</strong></div><div><span>Suas regiões</span><strong>${SB.controls(s).length}/${SB.DISTRICTS.length}</strong></div></div>${s.treachery ? `<p class="negative mini">Você rompeu ${s.treachery} acordo(s): diálogos com chance menor.</p>` : ''}</section>`;
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
      `Trégua: relação +35${r.cooldown >= s.day ? ` (disponível após o dia ${r.cooldown})` : ''}. Aliança: relação +60 e sede nível 2. Confronto: ${f.short} deve liderar a região onde você está.`;
    return `<section class="card rivalCard dossier"><div class="dossierHead ${window.SBArt.grupo(SB.cityOf(s.city).id, f.id) ? 'withPic' : ''}">${window.SBArt.grupo(SB.cityOf(s.city).id, f.id) ? `<span class="grupoPic" aria-hidden="true">${window.SBArt.grupo(SB.cityOf(s.city).id, f.id)}</span>` : emblem(f.id)}<div><h3>${esc(f.name)}</h3><div class="eyebrow">${esc(f.persona.label)} • ${lead.length ? 'lidera ' + esc(lead.join(', ')) : 'sem região liderada'}</div></div><span class="pill">${esc(SB.factionStatus(s, f.id))}</span></div><p>${esc(f.desc)}</p>
      <div class="rivalMetrics"><div><span>Relação</span><strong>${signed(r.relation)}</strong></div><div><span>Tensão</span><strong>${r.tension}/100</strong></div><div><span>Força</span><strong>${r.power}</strong></div></div>
      ${r.lastMove ? `<p class="mini"><strong>Último movimento:</strong> ${esc(r.lastMove)}</p>` : ''}${r.grudge >= 3 ? `<p class="negative mini">Rancor alto (${r.grudge}): pode virar rival histórico.</p>` : ''}
      <div class="btnbar">${btns.join('')}</div><p class="mini">${esc(hint)}</p></section>`;
  }

  function seasons() {
    const s = state, sc = SB.seasonScore(s);
    return heading('Temporada', 'Trinta dias para subir no respeito: roubando, mandando nas regiões, negociando, com o bando ou no comércio.') + `<div class="screenArt">${window.SBArt.place('temporada')}</div>` + resultCard() + `
      <div class="grid two"><section class="card"><div class="eyebrow">Temporada atual</div><div class="seasonnumber">${String(s.season).padStart(2, '0')}</div><div class="meter"><div style="width:${s.day / MAXDAY * 100}%"></div></div>
        <div class="statusbar"><span>Dia ${s.day} de ${MAXDAY}</span><strong>${MAXDAY - s.day} dia(s) restante(s)</strong></div><p class="mini">Cada temporada tem 30 dias jogáveis (29 viradas). A renda entra ao virar o dia; o dia 30 é o último para agir.</p><div class="divider"></div>
        ${s.day === MAXDAY ? button('Encerrar temporada', 'end-season', '', false, 'primary block') : nextDayButton('block')}</section>
      <section class="card"><h2>Feitos do mês</h2><p>Respeito: <strong>★ ${num(s.respect)}</strong> · patente <strong>${esc(sc.title)}</strong>. Cada feito paga respeito na hora (bronze +${SB.FEAT_RESPECT[1]}, prata +${SB.FEAT_RESPECT[2]}, ouro +${SB.FEAT_RESPECT[3]}) e vale legado para a próxima temporada (até ${fmt(800)}). O território paga à parte, pelas faixas de influência em cada região (+3, +5, +10).</p>
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
      ${place('gestao', 'Banco', `${fmt(s.bank)} guardados · taxa de depósito ${SB.hasPerk(s, 'empreendedor', 1) ? '0,75' : s.career === 'empreendedor' ? '1,5' : '3'}%`)}
      ${place('negocios', 'Negócios', `${s.businesses.length} estabelecimento(s) · ${SB.LABS.filter(l => s.labs[l.id] > 0).length} esquema(s) · ${fmt(SB.income(s))} por dia`)}
      ${gated('galpao', 'galpao', 'Galpão', `Carga ${SB.cargoUsed(s)}/${SB.cargoCap(s)} · mercadoria e remessas`, deal.day >= s.day ? (deal.day === s.day ? 'Comprador hoje' : `Comprador dia ${deal.day}`) : '')}
      ${gated('cidade', 'cidade', 'Regiões', `${SB.controls(s).length}/5 liderados · viajar, contatos e disputas`)}
      ${gated('apostas', 'apostas', 'Apostas', `Bicho, sinuca e roleta · hoje ${s.today.bets}/${SB.BET_LIMIT}`)}
      ${gated('duelos', 'duelos', 'Duelos de rua', `Hoje ${s.today.duels}/${SB.DUEL_LIMIT} · ${s.duelStats.wins} vitória(s)`)}
      ${place('hospital', 'Hospital', s.hospital ? `${s.uti ? 'UTI' : 'Internado'} · ${s.hospital} ${s.clock ? 'período(s)' : 'dia(s)'}` : `Saúde ${s.health}/100`, s.health < 50 ? 'Ferido' : '')}
      ${place('esquina', 'Esquina', online ? 'Papo, desafios e mercado negro entre jogadores' : 'Ponto de encontro dos jogadores (só no modo online)', online ? 'Ao vivo' : '', 'esquina')}
      ${place('ranking', 'Mural do respeito', online ? (rank.me ? `Você é o ${num(rank.me.posicao)}º de ${num(rank.me.total)} no mês` : 'Ranking do mês e Galeria da fama') : 'Ranking (só no modo online)', '', 'temporada')}
      ${place('perfil', 'Perfil e temporada', `Dia ${s.day}/${MAXDAY} · ★ ${num(s.respect)} respeito`, '', 'temporada')}
    </div>`;
  }
  function itemEffect(it) {
    if (it.slot === 'arma') return `Poder ${it.power}${it.heavy ? ' · pesada: chama a polícia' : ''}`;
    if (it.slot === 'protecao') return `Defesa ${it.def}`;
    return `Fuga ${it.escape} · carga +${it.cargo}${it.freeRide ? ' · viaja sem gastar energia' : ''}`;
  }
  let feiraTab = 'arma';
  function feira() {
    const s = state; if (!SB.SLOTS.some(x => x.id === feiraTab)) feiraTab = SB.SLOTS[0].id;
    return heading('Feira do Rolo', 'Comprou, é seu. Trocar é de graça.') + `<div class="screenArt">${window.SBArt.place('feira')}</div>` + jailNotice() + resultCard() +
      `<div class="filterbar feiraTabs" role="tablist" aria-label="Prateleiras da Feira">${SB.SLOTS.map(sl => `<button type="button" role="tab" class="btn ghost ${feiraTab === sl.id ? 'on' : ''}" data-action="feira-tab" data-id="${sl.id}" aria-selected="${feiraTab === sl.id}">${esc(sl.name)}</button>`).join('')}</div>` +
      SB.SLOTS.filter(sl => sl.id === feiraTab).map(sl => { const cur = SB.item(s.gear[sl.id]);
        return stencil(sl.name, cur ? 'em uso: ' + esc(cur.name) : 'nada equipado') + `<div class="grid">` + SB.ITEMS.filter(i => i.slot === sl.id).map(it => { const mine = s.gear[sl.id] === it.id, have = SB.owns(s, it.id), cl = it.trophy || have ? '' : SB.chainLock(s, 'items', it.id), locked = !have && (!!cl || s.respect < it.unlock || (it.trophy && !s.achievements[it.trophy]));
          const pic = window.SBArt.item(it.id), small = it.slot === 'veiculo' && have && !mine && SB.cargoUsed(s) > SB.cargoWith(s, it);
          const act = mine ? '' : have ? button('Usar', 'equip', `data-id="${it.id}"`, s.jail > 0 || small, 'small') : button('Comprar', 'buy-item', `data-id="${it.id}"`, locked || s.cash < it.cost || s.jail > 0, 'small primary');
          return `<section class="card shopRow feiraRow ${pic ? 'withPic' : ''} ${mine ? 'mine' : ''} ${locked ? 'locked' : ''}">${pic ? `<span class="itemPic" aria-hidden="true">${pic}</span>` : ''}<div><h3>${esc(it.name)}${mine ? ' <span class="pill">Em uso</span>' : have ? ' <span class="pill own">É seu</span>' : ''}</h3><p class="mini">${esc(itemEffect(it))}</p>${locked && !cl ? `<div class="lockline">${it.trophy && !s.achievements[it.trophy] ? 'Troféu: só para quem venceu o Rei do Pedaço.' : `Requer ${it.unlock} de respeito.`}</div>` : ''}${small ? '<div class="lockline">Sua carga não cabe neste veículo.</div>' : ''}</div>
            <div class="shopAct">${have ? '' : `<strong>${fmt(it.cost)}</strong>`}${act}</div></section>`; }).join('') + `</div>`; }).join('');
  }
  function maxBuy(g) { const s = state; let q = Math.max(0, SB.cargoCap(s) - SB.cargoUsed(s)); while (q > 0 && SB.buyTotal(s, g, q) > s.cash) q = Math.floor(q * .9) - (q < 10 ? 1 : 0); return Math.max(0, q); }
  /** Negócios: estabelecimentos (renda por dia) e esquemas de produção. O banco ficou na tela Banco. */
  function negocios() {
    const s = state;
    return heading('Negócios', 'Renda todo dia.') + `<div class="screenArt">${window.SBArt.place('negocios')}</div>` + jailNotice() + resultCard() + `
      <section class="card"><div class="kv"><div><span>Renda dos negócios hoje</span><strong class="positive">${fmt(SB.income(s))}</strong></div><div><span>Estabelecimentos</span><strong>${s.businesses.length}/${SB.BUSINESSES.length}</strong></div><div><span>Esquemas montados</span><strong>${SB.LABS.filter(l => s.labs[l.id] > 0).length}/${SB.LABS.length}</strong></div><div><span>Dinheiro em mãos</span><strong>${fmt(s.cash)}</strong></div></div></section>
      <div class="section"><h2>Estabelecimentos</h2><small>Renda paga ao avançar o dia</small></div>
      <div class="grid two">${SB.BUSINESSES.map(b => businessCard(b)).join('')}</div>

      ${stencil('Esquemas', 'do gelo à refinaria')}<div class="grid">${SB.LABS.map((l, i) => { const lvl = s.labs[l.id], c = SB.labCost(s, l), cl = lvl ? '' : SB.chainLock(s, 'labs', l.id), locked = !!cl || s.respect < l.unlock, down = s.labDown[l.id] >= s.day, raid = SB.labRaid(s, l), sp = SB.SUPPLY.find(x => x.labs.includes(l.id));
        const makes = l.cash ? `${fmt(l.cash)} por dia no banco` : `${l.out} × ${esc(SB.good(l.good).name)}${l.good2 ? ` e ${l.out2} × ${esc(SB.good(l.good2).name)}` : ''} por dia`;
        const pic = window.SBArt.esquema(l.id);
        return `<section class="card shopRow ${pic ? 'withPic' : ''} ${locked ? 'locked' : ''}">${pic ? `<span class="itemPic" aria-hidden="true">${pic}</span>` : ''}<div><h3><span class="tier">${i + 1}</span> ${esc(l.name)} <span class="pill">Nível ${lvl}/3</span></h3><p class="mini">${esc(l.desc)}</p>
          <p class="mini">${lvl ? `Rende ${esc(SB.labYield(s, l))} por dia` : `Produz ${makes}`}${l.cash ? '' : ' · +40 de espaço'}${raid ? ` · <span class="negative">${raid}% de batida hoje</span>` : l.cash || SB.good(l.good).risk === 0 ? ' · sem batida' : ''}${sp ? ` · abastece ${esc(SB.business(sp.biz).name)} (+70% de renda)` : ''}${down ? ` · <span class="negative">fechado até o dia ${s.labDown[l.id]}</span>` : ''}</p>${locked && !cl ? `<div class="lockline">Requer ${l.unlock} de respeito.</div>` : ''}</div>
          <div class="shopAct">${lvl >= 3 ? '<strong>Máximo</strong>' : `<strong>${fmt(c)}</strong>${button(lvl ? 'Ampliar' : 'Montar', 'build-lab', `data-id="${l.id}"`, locked || s.cash < c || s.jail > 0, 'small primary')}`}</div></section>`; }).join('')}</div>
      <p class="mini" style="margin-top:6px">Com o Procurado alto, a polícia pode estourar um ponto: você perde o estoque e ele fica 2 dias fechado.</p>`;
  }
  function galpao() {
    const s = state, deal = s.exportDeal, dg = SB.good(deal.good), used = SB.cargoUsed(s), cap = SB.cargoCap(s), open = SB.exportOpen(s), blitz = SB.blitzChance(s);
    const cais = esc(D('cais').name), today = deal.day === s.day;
    const dealTxt = deal.day < s.day ? 'Nenhum barco à vista. O próximo comprador ainda não deu notícia.'
      : open ? `Ele está aqui, de boné e sem pressa. Quer <b>${esc(dg.name)}</b> e paga <b>${fmt(SB.exportPrice(dg, s))}</b> por ${esc(dg.unit)} (leva até ${SB.exportLimit(s)}). Você tem ${s.goods[dg.id]}.`
      : today ? `O barco atracou hoje na ${cais}. Ele só fala de negócio pessoalmente: vá até lá para saber o que ele quer.`
      : `${deal.day === MAXDAY ? 'Dizem que o Último Navio atraca' : 'Dizem que um barco atraca'} na ${cais} no dia ${deal.day}. Ninguém sabe o que ele vem buscar nem quanto paga. Quem tiver estoque variado sai na frente.`;
    return heading('Galpão', 'Compre barato numa região, venda caro em outra e despache para fora. A produção fica em Negócios.') + `<div class="screenArt">${window.SBArt.place('galpao')}</div>` + jailNotice() + resultCard() + `
      <section class="card"><div class="meterlabel"><span>Carga</span><strong>${used}/${cap}</strong></div><div class="meter"><div style="width:${pct(used / cap * 100)}%"></div></div>
        <p class="mini" style="margin-top:7px">Veículos e pontos de produção aumentam o espaço. ${blitz ? `<span class="negative">Viajar com esta carga: ${blitz}% de chance de blitz (perde metade).</span>` : 'Sem carga, sem blitz.'}</p></section>
      <section class="poster" style="margin-top:10px"><div class="posterHead">COMPRADOR DE FORA</div><p>${dealTxt}</p>${open ? button(`Entregar ${Math.min(SB.exportLimit(s), s.goods[dg.id])} × ${esc(dg.name)}`, 'export-goods', '', s.goods[dg.id] < 1 || s.exportDone === s.day || s.jail > 0, 'small block') : ''}</section>
      ${stencil('Mercadorias', 'preço na ' + esc(D().name))}<div class="grid">${SB.GOODS.slice().sort((a, b) => a.unlock - b.unlock).map(g => { const locked = s.respect < g.unlock, f = s.market[s.district][g.id], own = s.goods[g.id], mb = locked ? 0 : maxBuy(g);
        const best = SB.DISTRICTS.reduce((a, d) => SB.goodSellPrice(s, g, d.id) > SB.goodSellPrice(s, g, a.id) ? d : a, SB.DISTRICTS[0]);
        const off = s.jail > 0 || s.energy < 3;
        return `<section class="card goodRow ${locked ? 'locked' : ''}"><div class="space"><h3>${esc(g.name)} <span class="chip ${f <= 90 ? 'up' : f >= 112 ? 'down' : ''}">${f}%</span></h3><strong>${own} un.</strong></div>
          <p class="mini">Compra ${fmt(SB.goodPrice(s, g))} · venda ${fmt(SB.goodSellPrice(s, g))} por ${esc(g.unit)} · risco ${'●'.repeat(g.risk)}${'○'.repeat(4 - g.risk)} · melhor venda hoje: ${esc(best.name)} (${fmt(SB.goodSellPrice(s, g, best.id))})</p>
          ${locked ? `<div class="lockline">Requer ${g.unlock} de respeito.</div>` : `<div class="tradeBtns">${button(`+5 · ${fmt(SB.buyTotal(s, g, 5))}`, 'buy-good', `data-id="${g.id}" data-qty="5"`, off || mb < 5, 'small')}${button(`+${mb} (máx.)`, 'buy-good', `data-id="${g.id}" data-qty="${mb}"`, off || mb < 1, 'small')}${button(`−5 · ${fmt(SB.sellTotal(s, g, Math.min(5, Math.max(1, own))))}`, 'sell-good', `data-id="${g.id}" data-qty="${Math.min(5, own)}"`, off || own < 1, 'small primary')}${button(`Vender tudo${own ? ' · ' + fmt(SB.sellTotal(s, g, own)) : ''}`, 'sell-good', `data-id="${g.id}" data-qty="${own}"`, off || own < 1, 'small primary')}</div>`}</section>`; }).join('')}</div>
      <p class="mini" style="margin-top:6px">Cada negócio gasta 3 de energia. Comprar muito encarece e vender muito derruba o preço local. Vender na área de outro grupo gera atrito.</p>
      <p class="mini" style="margin-top:6px">Os esquemas de produção (do gelo à refinaria) agora ficam em Negócios, na Cidade.</p><div class="btnbar">${button('Ver esquemas', 'switch', 'data-target="negocios"', false, 'small ghost')}</div>`;
  }
  function noite() {
    const s = state, here = SB.NIGHT.find(n => n.id === s.today.venue), blk = SB.blocked(s), full = s.energy >= SB.ENERGY_MAX;
    const why = blk || (full ? `Você está no máximo (${SB.ENERGY_MAX} de energia).` : '');
    const doseRow = d => { const c = SB.doseCost(s, d, here), own = d.good ? s.goods[d.good] : 0, off = !!why;
      return `<section class="card shopRow doseRow"><div><h3>${esc(d.name)}${d.strong && s.vicio >= 70 ? ' <span class="pill bad">risco de overdose</span>' : ''}</h3>
        <div class="robStats">${stat('en', '+' + Math.min(SB.nightEnergy(s, d), SB.ENERGY_MAX - s.energy), 'good', 'Energia')}${SB.doseVicio(s, d) ? `<span class="st vic">vício +${SB.doseVicio(s, d)}</span>` : ''}${s.today.dose[d.id] ? `<span class="st risk">rende ${Math.round(SB.doseTolerance(s, d) * 100)}%</span>` : ''}</div></div>
        <div class="shopAct"><strong>${fmt(c)}</strong>${button('Pedir', 'dose', `data-id="${d.id}"`, off || s.cash < c, 'small primary')}${own ? button(`Do estoque (${own})`, 'dose', `data-id="${d.id}" data-stock="1"`, off, 'small') : ''}</div></section>`; };
    const status = `<section class="card vicioCard">
        <div class="meterlabel"><span>Vício</span><strong>${s.vicio}/100</strong></div><div class="meter red"><div style="width:${s.vicio}%"></div></div>
        ${s.ressaca ? `<p class="mini" style="margin-top:6px">Ressaca amanhã: −${s.ressaca} de energia.</p>` : ''}${more(`<p>Dose forte dá mais energia e mais vício. A mesma dose rende menos a cada vez no dia, e o vício alto enfraquece todas. Acima de 70 de vício, loló, bala e pó podem dar overdose. O Hospital tira o vício, mas custa saúde.</p>`, 'Como funciona')}</section>`;
    // Dentro de uma casa: ambiente só dela, com o cardápio e o botão Sair.
    if (here) { const pic = window.SBArt.casa(here.id);
      return `<div class="venue v-${here.id}"><div class="screenArt venueArt">${pic || window.SBArt.place('noite')}<span class="venueTag">Você está no</span></div>` + heading(esc(here.name), esc(here.desc)) + jailNotice() + resultCard() + `
      <div class="btnbar venueBar">${button('Sair', 'leave-night', '', false, 'small')}<span class="mini">Entrada de hoje paga.</span></div>
      ${stencil('No balcão', 'peça uma dose')}${why ? `<p class="lockline">${esc(why)}</p>` : ''}<div class="grid">${here.menu.map(id => doseRow(SB.doseOf(id))).join('')}</div>
      ${status}
      </div>`; }
    return heading('Noite', 'Dinheiro vira energia no balcão.') + `<div class="screenArt">${window.SBArt.place('noite')}</div>` + jailNotice() + resultCard() + `
      ${status}
      ${stencil('Casas da noite', 'entrada paga uma vez por dia')}<div class="grid">${SB.NIGHT.map(n => { const c = SB.nightCost(s, n), own = SB.ownTermas(s, n), cl = own || s.businesses.includes(n.id) ? '' : SB.chainLock(s, 'night', n.id), lock = !!cl || (n.unlock && s.respect < n.unlock && !own), inside = false, paid = (s.today.paid || []).includes(n.id);
        const pic = window.SBArt.casa(n.id);
        return `<section class="card shopRow ${pic ? 'withPic' : ''} ${inside ? 'here' : ''} ${lock ? 'locked' : ''}">${pic ? `<span class="itemPic" aria-hidden="true">${pic}</span>` : ''}<div><h3>${esc(n.name)}${inside ? ' <span class="pill">Você está aqui</span>' : own ? ' <span class="pill">Sua casa</span>' : lock ? ` <span class="pill">${cl ? esc(cl.replace(/\.$/, '')) : `Requer ${n.unlock} de respeito`}</span>` : ''}</h3><p class="mini">${esc(n.desc)}</p>
          <p class="mini">${n.menu.map(id => esc(SB.doseOf(id).name)).join(' · ')}${own ? ' · <strong>sua casa: energia cheia</strong>' : ''}</p></div>
          <div class="shopAct"><strong>${paid ? 'Entrada paga hoje' : c ? 'Entrada ' + fmt(c) : 'Entrada grátis'}</strong>${button(paid ? 'Voltar' : 'Entrar', 'night', `data-id="${n.id}"`, s.cash < c || !!blk || lock, 'small primary')}</div></section>`; }).join('')}</div>
      <p class="mini" style="margin-top:6px">A entrada vale o dia todo: pode sair e voltar.</p>`;
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
    return heading('Hospital', 'Saúde baixa derruba as suas chances.') + `<div class="screenArt">${window.SBArt.place('hospital')}</div>` + jailNotice() + resultCard() + `
      <section class="card"><div class="meterlabel"><span>Saúde</span><strong>${s.health}/100</strong></div><div class="meter green"><div style="width:${s.health}%"></div></div>
        <p class="mini" style="margin-top:7px">Volta sozinha +10 por dia (+6 se detido). Se chegar a zero: <strong>UTI</strong>, ${s.clock ? '24 horas' : 'o resto de hoje e amanhã'} sem jogar, e você sai com 40 de saúde e o vício zerado.${SB.healthPenalty(s) ? ` <span class="negative">Agora: -${SB.healthPenalty(s)} de chance nas ações.</span>` : ''}</p></section>
      <div class="grid" style="margin-top:10px">
        <section class="card shopRow"><div><h3>UPA</h3><p class="mini">De graça, uma vez por dia. +25 de saúde.</p></div><div class="shopAct"><strong>Grátis</strong>${button('Ser atendido', 'clinic', 'data-id="posto"', s.health >= 100 || s.today.clinic || !!SB.blocked(s), 'small primary')}</div></section>
        <section class="card shopRow"><div><h3>Propina pro plantonista</h3><p class="mini">Atestado, remédio e alta na hora. ${fmt(12)} por ponto de saúde que falta; cada nova vez no mesmo dia, +50%.</p></div><div class="shopAct"><strong>${fmt(c)}</strong>${button('Molhar a mão', 'clinic', 'data-id="clinica"', s.health >= 100 || s.cash < c || !!SB.blocked(s), 'small primary')}</div></section>
      </div>
      ${stencil('Desintoxicação', `vício ${s.vicio}/100`)}<div class="grid">
        <section class="card shopRow"><div><h3>Soro na veia</h3><p class="mini">Na UPA, de graça, uma vez por dia. −${Math.min(SB.SORO_VICIO, s.vicio) || SB.SORO_VICIO} de vício · −${Math.ceil(Math.min(SB.SORO_VICIO, s.vicio || SB.SORO_VICIO) * SB.DETOX_HEALTH)} de saúde.${s.vicio > 0 && s.health - Math.ceil(Math.min(SB.SORO_VICIO, s.vicio) * SB.DETOX_HEALTH) <= 0 ? ' <span class="negative">Você vai para a UTI.</span>' : ''}</p></div><div class="shopAct"><strong>Grátis</strong>${button('Tomar soro', 'detox', 'data-id="soro"', s.vicio <= 0 || s.today.detox || s.jail > 0, 'small primary')}</div></section>
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
        <section class="card"><h3>Jogo do bicho</h3><p class="mini">Escolha um dos 25 bichos. Acertou, a banca paga <strong>${SB.bichoPays(s)}×</strong> (1 chance em 25). A extração é de noite: o resultado sai amanhã cedo, no jornal da Rua.</p>
          ${s.bicho.tickets.length ? `<p class="mini"><strong>Seus bilhetes para hoje:</strong> ${s.bicho.tickets.map(k => `${esc(SB.ANIMALS[k.pick])} ${fmt(k.stake)}`).join(' · ')}</p>` : ''}
          ${s.bicho.last && s.bicho.last.day === s.day - 1 ? `<p class="mini">Ontem deu <strong>${esc(SB.ANIMALS[s.bicho.last.animal])}</strong>${s.bicho.last.picks.length ? (s.bicho.last.won ? ` · você ganhou ${fmt(s.bicho.last.won)}` : ' · seu jogo não saiu') : ''}.</p>` : ''}
          <div class="formfield"><label for="betAnimal">Seu bicho</label><select class="input" id="betAnimal">${SB.ANIMALS.map((a, i) => `<option value="${i}" ${i === betPick ? 'selected' : ''}>${String(i + 1).padStart(2, '0')} · ${a}</option>`).join('')}</select></div>
          <div style="margin-top:8px">${button('Fazer a fezinha', 'bet', 'data-id="bicho"', off || s.cash < 10 || s.day >= MAXDAY, 'small primary block')}</div>${s.day >= MAXDAY ? '<p class="mini negative" style="margin:6px 0 0">Último dia do mês: não tem extração amanhã.</p>' : ''}</section>
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
  /* ------------------------------------------------------------------ */
  /* Evolução (Perfil): gráfico de barras verticais em escada, um degrau por nível. Os números vêm de SB.evolution. */
  /* ------------------------------------------------------------------ */
  const EVO_ICON = {
    roubos: '<path d="M3 9c0-3 4-5 9-5s9 2 9 5c0 3-2 4-4 4-1.5 0-2.5-1-5-1s-3.5 1-5 1c-2 0-4-1-4-4zm4 0a1.6 1.6 0 1 0 3.2 0A1.6 1.6 0 0 0 7 9zm6.8 0a1.6 1.6 0 1 0 3.2 0 1.6 1.6 0 0 0-3.2 0zM6 16h12l-1 4H7z"/>',
    armas: '<path d="M2 8h15l1-2h3v4h-4l-1 2h-3l-1 6H7l1-6H2z"/>',
    protecao: '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/>',
    veiculo: '<path d="M4 15l1.5-5A2 2 0 0 1 7.4 8.5h9.2a2 2 0 0 1 1.9 1.5L20 15v4h-2.5v-2h-11v2H4zm2.2-1h11.6l-1.1-3.5H7.3zM7 15.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zm10 0a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z"/>',
    negocios: '<path fill-rule="evenodd" d="M2 6h20v12H2zm2 2v8h16V8zm8 1.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6zM5 9.5h2v1.5H5zm12 3.5h2v1.5h-2z"/>'
  };
  const EVO_GO = { roubos: ['acoes', 'Ir roubar'], armas: ['feira', 'Ir à Feira do Rolo'], protecao: ['feira', 'Ir à Feira do Rolo'], veiculo: ['feira', 'Ir à Feira do Rolo'], negocios: ['negocios', 'Ver negócios'] };
  function evoCard() {
    const s = state, evo = SB.evolution(s), sel = evo.find(e => e.id === evoPick) || evo[0];
    const col = e => {
      const pctv = e.max ? e.level / e.max : 0;
      const blocks = Array.from({ length: e.max }, (_, k) => k + 1).reverse().map(i => `<i class="${i <= e.level ? 'f' : ''}${i === e.level ? ' top' : ''}"></i>`).join('');
      return `<button type="button" class="evoCol ${e.id === sel.id ? 'on' : ''} ${e.level >= e.max ? 'max' : ''}" data-action="evo-pick" data-id="${e.id}" aria-pressed="${e.id === sel.id}" aria-label="${esc(e.name)}: nível ${e.level} de ${e.max}">
        <span class="evoVal"><b>${num(e.level)}</b><small>/${num(e.max)}</small></span>
        <span class="evoBar" style="--n:${e.max}" aria-hidden="true">${blocks}</span>
        <span class="evoFoot"><svg class="evoIco" viewBox="0 0 24 24" aria-hidden="true">${EVO_ICON[e.id]}</svg><span class="evoName">${esc(e.name)}</span><span class="evoPct">${Math.round(pctv * 100)}%</span></span></button>`;
    };
    let det;
    if (sel.id === 'roubos') det = `<b>Degrau ${num(sel.level)} de ${num(sel.max)}</b> · maior roubo feito: ${esc(sel.label)}.${sel.next ? ` Próximo degrau: ${esc(sel.next.name)}.` : ' Você chegou ao topo da escada.'}`;
    else if (sel.id === 'negocios') det = `<b>Nível ${num(sel.level)} de ${num(sel.max)}</b> · ${fmt(sel.earned)} faturados na temporada (${fmt(sel.biz)} nas diárias dos negócios + ${fmt(sel.prod)} na venda da produção dos esquemas).${sel.next ? ` Próximo nível com ${fmt(sel.next.goal)}: faltam ${fmt(sel.next.left)}.` : ' Nível máximo.'}`;
    else det = `<b>Nível ${num(sel.level)} de ${num(sel.max)}</b> · ${sel.level ? `o melhor que você já teve: ${esc(sel.label)}` : 'você ainda não tem nenhum'}.${sel.next ? ` Próximo: ${esc(sel.next.name)} (${fmt(sel.next.cost)}${sel.next.respect ? ` · ${num(sel.next.respect)} de respeito` : ''}).` : ' Nível máximo.'}`;
    const [view, label] = EVO_GO[sel.id];
    return `${stencil('Evolução', 'sua escalada na temporada')}<section class="card evoCard" aria-label="Evolução">
      <div class="evoChart" role="group" aria-label="Nível em cada área">${evo.map(col).join('')}</div>
      <div class="evoDetail"><span class="evoTag"><svg class="evoIco" viewBox="0 0 24 24" aria-hidden="true">${EVO_ICON[sel.id]}</svg>${esc(sel.name)}</span><p>${det}</p>${button(label, 'switch', `data-target="${view}"`, false, 'small ghost')}</div>
      ${more(`<table class="evoTable"><thead><tr><th>Área</th><th>Nível</th><th>Agora</th></tr></thead><tbody>${evo.map(e => `<tr><td>${esc(e.name)}</td><td>${num(e.level)}/${num(e.max)}</td><td>${esc(e.label)}</td></tr>`).join('')}</tbody></table><p class="mini">Roubos: o maior degrau que você já fez com sucesso. Armas, Proteção e Veículo: o melhor item que você já comprou. Negócios: o que as diárias dos estabelecimentos e a venda do que os seus esquemas produziram já renderam na temporada.</p>`, 'Como cada nível é contado')}</section>`;
  }
  function perfil() {
    const s = state, sc = SB.seasonScore(s), lvl = Math.min(99, Math.floor(s.respect / 35) + 1), c = s.career ? SB.CAREERS.find(x => x.id === s.career) : null;
    const top = Math.max(20, ...SB.STATS.map(st => s.stats[st.id]));
    return heading('Perfil', 'Sua ficha no submundo.') + resultCard() + `
      <section class="sheet"><span class="sheetAvatar">${portrait(s)}</span><div><h2>${esc(s.name)}</h2><p>${esc(sc.title)} · nível ${lvl}</p><p class="mini">${esc(s.city)}${c ? ' · ' + c.name + ' ' + SB.careerLevel(s) + '/3' : ''}${s.gangName ? ' · ' + esc(s.gangName) : ''}${s.prestige ? ' · prestígio ' + s.prestige : ''}</p></div></section>
      ${evoCard()}
      ${c ? `${stencil('Classe', esc(c.name) + ' · ' + esc(c.tag))}<section class="card classCard"><p class="suPitch" style="padding:0">${esc(c.pitch)}</p><ul class="suPros" style="margin-left:0;margin-right:0">${c.pros.map(x => `<li>${esc(x)}</li>`).join('')}</ul><ul class="suCons" style="margin-left:0;margin-right:0">${c.cons.map(x => `<li>${esc(x)}</li>`).join('')}</ul><ul class="perkList">${c.perks.map((p, i) => `<li class="${i < SB.careerLevel(s) ? 'on' : ''}">${i < SB.careerLevel(s) ? '✓' : '○'} Nível ${i + 1} (${SB.CAREER_XP[i]} XP): ${esc(p)}</li>`).join('')}</ul></section>` : ''}
      ${stencil('Luta', 'duelos e assaltos do bando')}<section class="card lutaCard"><div class="lutaHead"><strong>${num(SB.combatRating(s))}</strong><p class="mini">Sua força em duelos e nos assaltos do bando.${s.gangName ? ` Força do bando: <b>${num(SB.heistPower(s, 0))}</b>.` : ''}</p></div>
        <details class="fichaMore"><summary>Como a conta é feita</summary><ul class="lutaParts">${SB.combatParts(s).map(([k, v]) => `<li><span>${k}</span><b>${v ? '+' + (Math.round(v * 10) / 10).toString().replace('.', ',') : '0'}</b></li>`).join('')}</ul>
</details></section>
      ${stencil('Atributos')}<section class="card">${SB.STATS.map(st => `<div class="statRow">${statIcon(st.id)}<span>${st.name}</span><div class="meter"><div style="width:${pct(s.stats[st.id] / top * 100)}%"></div></div><strong>${num(s.stats[st.id])}</strong></div>`).join('')}</section>
      ${stencil('Influência', 'nas regiões de ' + esc(s.city))}<section class="card infCard"><p class="mini infSlots">${turfSlotsText(s)}</p>${SB.DISTRICTS.map(x => { const v = s.influence[x.id], mine = SB.controlled(s, x.id), ld = SB.leader(s, x.id); return `<div class="statRow infRow ${x.id === s.district ? 'here' : ''}"><span>${esc(x.name)}${x.id === s.district ? ' · você está aqui' : ''}</span><div class="meter ${mine ? 'green' : ''}"><div style="width:${pct(v)}%"></div></div><strong>${num(v)}</strong><small class="mini"><b>${esc(SB.INF_TIERS[SB.infTier(s, x.id)].name)}</b>${mine ? ' · ' + esc(x.advantage) : SB.turfReady(s, x.id) ? ' · falta patente para mandar' : ` · dono com ${num(Math.max(60, ld.value + 10))}`}</small></div>`; }).join('')}
</section>
      ${stencil('Equipamento', 'troque na Feira do Rolo')}<div class="gearGrid">${SB.SLOTS.map(sl => { const it = SB.item(s.gear[sl.id]); const pic = it ? window.SBArt.item(it.id) : ''; return `<button type="button" class="gearSlot ${it ? 'on' : ''}" data-view="feira">${pic ? `<span class="gearPic" aria-hidden="true">${pic}</span>` : ''}<span>${sl.name}</span><b>${it ? esc(it.name) : '—'}</b><small>${it ? esc(it.slot === 'arma' ? 'poder ' + it.power : it.slot === 'protecao' ? 'defesa ' + it.def : 'carga +' + it.cargo) : 'vazio'}</small></button>`; }).join('')}</div>
      ${stencil('Nesta temporada')}<section class="card"><div class="kv"><div><span>Respeito</span><strong>${num(s.respect)}</strong></div><div><span>Patrimônio</span><strong>${fmt(SB.patrimony(s))}</strong></div><div><span>Serviços</span><strong>${num(s.successful)} certos · ${num(s.failed)} falhos</strong></div><div><span>Detenções</span><strong>${s.seasonStats.arrests}</strong></div><div><span>Saúde</span><strong>${s.health}/100${s.hospital ? ' · internado' : ''}</strong></div><div><span>Duelos</span><strong>${s.duelStats.wins} vitórias · ${s.duelStats.losses} derrotas</strong></div><div><span>Mercadoria vendida</span><strong>${fmt(s.trade.sold)}</strong></div><div><span>Remessas / blitze</span><strong>${num(s.trade.exported)} un. · ${s.trade.blitz}</strong></div><div><span>Regiões lideradas</span><strong>${SB.controls(s).length}/5</strong></div><div><span>Conquistas</span><strong>${Object.keys(s.achievements).length}/${SB.ACHIEVEMENTS.length}</strong></div></div></section>
      ${stencil('Som', 'efeitos do jogo')}<section class="card soundCard"><div class="space"><span class="mini">Efeitos sonoros do jogo.</span>${button(window.SBSound && window.SBSound.on ? 'Desligar som' : 'Ligar som', 'sound-toggle', '', !window.SBSound, 'small')}</div>
        <label class="soundVol" for="soundVol">Volume <input type="range" id="soundVol" min="0" max="100" step="5" value="${Math.round((window.SBSound ? window.SBSound.vol : .7) * 100)}"></label></section>
      ${onlineCard()}
      <div class="btnbar" style="margin-top:12px">${button('Temporada, medalhas e conquistas', 'switch', 'data-target="temporada"', false, 'primary')}${button('Como jogar', 'help', '', false, 'ghost')}</div>`;
  }

  /* ---------- renderização ---------- */
  function render() {
    if (!state) return;
    SB.applyCity(state.city);
    { const v = SB.DISTRICT_VIBE[state.district]; document.documentElement.style.setProperty('--bairro', v ? v.color : '#e0a040'); document.body.dataset.bairro = state.district;
      // Fundo com a textura da região (art/textura-<tipo>.webp); sem a imagem, fica o fundo escuro padrão.
      const tx = window.SB_ART && window.SB_ART['textura-' + state.district];
      if (tx !== lastTexture) { lastTexture = tx; document.documentElement.style.setProperty('--textura', tx ? `url("${tx}")` : 'none'); document.body.classList.toggle('textured', !!tx); }
      // Foto da manchete do jornal: a pintura da região, em preto e branco.
      const ft = window.SB_ART && window.SB_ART['bairro-' + state.district];
      if (ft !== lastFoto) { lastFoto = ft; document.documentElement.style.setProperty('--foto', ft ? `url("${ft}")` : 'none'); } }
    const pages = { painel: panel, acoes: actions, hub, cidade: city, gestao: management, negocios, feira, galpao, noite, duelos, apostas, hospital, gangue: gang, assaltos, perfil, temporada: seasons, ranking: rankingView, esquina };
    try {
      $('#content').innerHTML = (pages[view] || panel)() + (view !== 'perfil' ? '' : `<div class="footer">SUBMUNDO BRASIL • v${SB.VERSION} • 18+ • Cidades reais, pontos e grupos fictícios • Jogo local, sem multiplayer, pagamentos ou conexão externa.</div>`);
    } catch (e) {
      console.error(e);
      $('#content').innerHTML = `<div class="errorBox"><h2>Algo deu errado nesta tela.</h2><p>Seu progresso continua salvo. Exporte uma cópia por segurança e volte ao início.</p><div class="btnbar">${button('Exportar carreira', 'export', '', false, 'small')}${button('Voltar ao início', 'switch', 'data-target="painel"', false, 'small primary')}</div><p class="mini">${esc(e.message)}</p></div>`;
    }
    renderHud(); renderPop(); soundIcon();
    if (state && !state.career && !setup) openSetup('season');
    $all('.nav button, .mobileNav button').forEach(b => { const on = b.dataset.view === tabOf(view); b.classList.toggle('active', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const st = SB.tutorialStep(state);
    $all('.nav button, .mobileNav button').forEach(b => b.classList.toggle('hint', !!st && tabOf(st.view) === b.dataset.view && st.view !== view && tabOf(view) !== b.dataset.view));
  }
  function switchView(target) {
    if (!VIEWS.includes(target)) return;
    if (target !== view) result = null;
    view = target; disarm(); $('#toast').hidden = true;
    if (target === 'ranking') loadRank(true);
    if (target === 'esquina') loadEsq(true);
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
      case 'evo-pick': evoPick = id; render(); break;
      case 'esq-tab': if (esq.tab !== id) { esq.tab = id; render(); loadEsq(true); } break;
      case 'esq-sala': if (esq.sala !== id) { esq.sala = id; render(); loadEsq(true); } break;
      case 'esq-send': { const el = $('#esqMsg'); const t = el ? el.value.trim() : ''; if (t) esqAct({ acao: 'chat', sala: esqSala(), texto: t }, () => { if ($('#esqMsg')) $('#esqMsg').value = ''; }); break; }
      case 'esq-bloq': if (id && !bloq.includes(id)) { bloq.push(id); saveBloq(); notify(`${id} bloqueado: as mensagens dele somem para você.`); paintEsq(); } break;
      case 'esq-desbloq': bloq = bloq.filter(x => x !== id); saveBloq(); render(); break;
      case 'esq-denunciar': esqAct({ acao: 'denunciar', id: Number(id) }); break;
      case 'esq-alvo': { esq.tab = 'desafios'; esq.alvo = id; render(); loadEsq(true); const el = $('#esqAlvo'); if (el) { el.value = id; el.scrollIntoView({ block: 'center' }); } break; }
      case 'esq-desafiar': { const alvo = ($('#esqAlvo') || {}).value || '', ap = Math.round(Number(($('#esqAposta') || {}).value)); esqAct({ acao: 'desafiar', alvo: alvo.trim(), aposta: ap }); break; }
      case 'esq-aceitar': esqAct({ acao: 'responder', id: Number(id), aceitar: true }); break;
      case 'esq-recusar': esqAct({ acao: 'responder', id: Number(id), aceitar: false }); break;
      case 'esq-cancelar': esqAct({ acao: 'cancelar_desafio', id: Number(id) }); break;
      case 'esq-vender': { const g = ($('#esqGood') || {}).value, q = Math.round(Number(($('#esqQtd') || {}).value)), p = Math.round(Number(($('#esqPreco') || {}).value)); esqAct({ acao: 'vender', mercadoria: g, qtd: q, preco: p }); break; }
      case 'esq-comprar': esqAct({ acao: 'comprar', id: Number(id) }); break;
      case 'esq-recolher': esqAct({ acao: 'cancelar_venda', id: Number(id) }); break;
      case 'dismiss-result': result = null; render(); break;
      case 'rank-scope': if (rank.scope !== id) { rank.scope = id; rank.rows = null; rank.me = null; render(); loadRank(true); } break;
      case 'rank-reload': loadRank(true); break;
      case 'story': run('story', id, Number(btn.dataset.i)); break;
      case 'feira-tab': feiraTab = id; render(); break;
      case 'leave-night': run('leaveNight'); break;
      case 'sound-toggle': if (window.SBSound) window.SBSound.setOn(!window.SBSound.on); render(); break;
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
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'esqMsg') { e.preventDefault(); const b = $('[data-action=esq-send]'); if (b) b.click(); } });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'bankAmount') { e.preventDefault(); run('bank', 'deposit', Number(e.target.value)); } });
  // Notícias do jornal e o quadro do bicho são atalhos: Enter ou espaço abrem a tela da notícia.
  document.addEventListener('keydown', e => { const t = e.target; if ((e.key === 'Enter' || e.key === ' ') && t && t.matches && t.matches('[role=button][data-view]')) { e.preventDefault(); switchView(t.dataset.view); } });
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
    : `${steps}<h2>Escolha sua classe</h2><p class="mini">Quatro jeitos de chegar ao topo. Todas roubam; muda o que rende mais para você.</p>
      <div class="suClasses" role="group" aria-label="Classe">${SB.CAREERS.map(k => { const on = su.career === k.id; return `<button type="button" class="suClass ${on ? 'on' : ''}" data-action="su-class" data-id="${k.id}" aria-pressed="${on}">
        <span class="suBanner" aria-hidden="true">${window.SBArt.place(k.art)}</span>
        <span class="suHead"><b>${esc(k.name)}</b><small>${esc(k.tag)}</small>${on ? '<em class="suPicked">✓ Escolhida</em>' : ''}</span>
        <span class="suPitch">${esc(k.pitch)}</span>
        <ul class="suPros">${k.pros.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <ul class="suCons">${k.cons.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        ${on ? `<span class="suPerks"><b>Como sobe de nível: ${esc(k.xpDesc.charAt(0).toLowerCase() + k.xpDesc.slice(1))}</b>${k.perks.map((x, i) => `<span>Nível ${i + 1}: ${esc(x)}</span>`).join('')}</span>` : ''}</button>`; }).join('')}</div>
      ${su.career ? `<div class="notice suWarn"><strong>Atenção:</strong> retrato, vulgo e classe só poderão ser alterados na próxima temporada.</div><button type="button" class="btn primary block" data-action="su-save">Salvar</button>` : ''}
      <button type="button" class="btn ghost block" data-action="su-back" style="margin-top:8px">Voltar</button>`;
  }
  async function saveSetup() {
    const su = setup;
    if (su.mode === 'season') { const r = await run('setup', su.avatar, su.name, su.career); if (r && r.ok) { closeSetup(); view = 'painel'; render(); } return; }
    if (su.online) return createOnline(su);
    const s = SB.defaultState(su.name, su.city), r = SB.perform(s, 'setup', su.avatar, su.name, su.career);
    if (!r.ok) return notify(r.msg, true);
    state = s; view = 'painel'; result = null; closeSetup(); save(); render(); openIntro();
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
  document.addEventListener('input', e => { if (e.target.id === 'soundVol' && window.SBSound) window.SBSound.setVol(Number(e.target.value) / 100); });
  document.addEventListener('change', e => { if (e.target.id === 'soundVol') sfx('coins'); });
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
    try { const d = await server({ acao: 'novo', codinome: su.name, cidade: su.city, avatar: su.avatar, classe: su.career }); closeSetup(); enterOnline(d.estado); openIntro(); }
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
      if (!r.ok) { if (Array.isArray(d.avisos) && d.avisos.length) awayCard(d.avisos); notify(r.msg, true); sfx('deny'); render(); return r; }
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
  /* ---------- Ranking (Mural do respeito) ---------- */
  const rank = { scope: 'brasil', rows: null, me: null, fame: null, at: 0, loading: false, err: false };
  const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const monthName = m => { const [y, mm] = String(m).split('-').map(Number), n = MONTHS[(mm || 1) - 1] || ''; return n.charAt(0).toUpperCase() + n.slice(1) + ' de ' + y; };
  async function rpc(fn, body, auth) {
    const h = { apikey: ON.anonKey, 'Content-Type': 'application/json' };
    if (auth) { const tk = await accessToken(); if (tk) h.Authorization = 'Bearer ' + tk; }
    const r = await fetch(ON.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
    if (!r.ok) throw new Error(fn);
    return r.json();
  }
  /* ---------- Esquina (online): papo, desafios de combate e mercado negro ---------- */
  const esq = { tab: 'papo', sala: 'cidade', msgs: { cidade: null, geral: null }, pres: null, des: null, merc: null, loading: false, at: 0, err: '', alvo: '' };
  const BLOQ_KEY = 'sb_bloqueados';
  let bloq = (() => { try { const v = JSON.parse(localStorage.getItem(BLOQ_KEY) || '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, 200) : []; } catch (e) { return []; } })();
  const saveBloq = () => { try { localStorage.setItem(BLOQ_KEY, JSON.stringify(bloq.slice(0, 200))); } catch (e) { /* sem armazenamento */ } };
  const esqSala = () => esq.sala === 'geral' ? 'geral' : state.city;
  let esqTimer = null;
  async function loadEsq(force) {
    if (!online || !ON || !state || esq.loading || (!force && Date.now() - esq.at < 4000)) return;
    esq.loading = true;
    try {
      if (esq.tab === 'papo') { const rows = await rpc('chat_ler', { sala_f: esqSala(), depois: 0 }, true); esq.msgs[esq.sala] = Array.isArray(rows) ? rows.slice().reverse() : []; }
      else if (esq.tab === 'desafios') { const [p, d] = await Promise.all([rpc('esquina_presentes', { cidade_f: null }, true), rpc('meus_desafios', {}, true)]); esq.pres = Array.isArray(p) ? p : []; esq.des = Array.isArray(d) ? d : []; }
      else { const m = await rpc('mercado_listar', {}, true); esq.merc = Array.isArray(m) ? m : []; }
      esq.err = ''; esq.at = Date.now();
    } catch (e) { esq.err = 'Sem conexão com a Esquina agora. Tentando de novo…'; }
    esq.loading = false;
    if (view === 'esquina') paintEsq();
    if (!esqTimer) esqTimer = setInterval(() => { if (view === 'esquina' && !document.hidden && !busy) loadEsq(true); }, 6000);
  }
  /** Redesenha só a lista (mensagens, desafios ou banca), sem apagar o que o jogador está digitando. */
  function paintEsq() {
    const el = $('#esqList'); if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    el.innerHTML = esqList();
    if (esq.tab === 'papo' && (atBottom || !el.dataset.seen)) { el.scrollTop = el.scrollHeight; el.dataset.seen = '1'; }
  }
  /** Ação da Esquina no servidor: o resultado vem como qualquer ação (cartão ou aviso) e a lista se atualiza. */
  async function esqAct(body, onOk) {
    if (busy || !online) return;
    busy = true; document.body.classList.add('busy');
    const before = snap();
    try {
      const tk = await accessToken(); if (!tk) throw new Error('Sua sessão expirou. Entre de novo.');
      const r = await fetch(ON.url + '/functions/v1/jogar', { method: 'POST', headers: { apikey: ON.anonKey, Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({ erro: 'Resposta inválida do servidor.' }));
      if (typeof d.agora === 'number') skew = d.agora - Date.now();
      if (d.estado) state = fromServer(d.estado);
      const res = d.resultado || { ok: false, msg: d.erro || 'Erro no servidor do jogo.' };
      if (Array.isArray(d.avisos) && d.avisos.length) awayCard(d.avisos);
      if (!res.ok) { notify(res.msg, true); sfx('deny'); render(); }
      else {
        if (onOk) onOk();
        if (body.acao === 'chat') { sfx('tick'); render(); }
        else { const fin = { ok: true, good: res.good !== false && res.venceu !== false, msg: res.msg, lines: [] }; finish(body.acao === 'responder' ? 'duel' : 'esquina', fin, before); }
      }
    } catch (e) { notify(e.message, true); }
    finally { busy = false; document.body.classList.remove('busy'); }
    loadEsq(true);
  }
  const hhmm = t => { const d = new Date(t); return isNaN(d) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }); };
  function esqList() {
    const s = state;
    if (esq.err) return `<p class="esqErr">${esc(esq.err)}</p>`;
    if (esq.tab === 'papo') {
      const rows = esq.msgs[esq.sala];
      if (!rows) return '<p class="esqEmpty">Chegando na esquina…</p>';
      const vis = rows.filter(m => !bloq.includes(m.codinome));
      if (!vis.length) return `<p class="esqEmpty">Ninguém falou nada ${esq.sala === 'geral' ? 'na sala geral' : 'em ' + esc(s.city)} nos últimos dias. Puxa o assunto.</p>`;
      return `<ol class="esqWall">${vis.map(m => `<li class="esqMsg ${m.eu ? 'me' : ''}"><div class="esqHead"><b>${esc(m.codinome)}</b><time>${hhmm(m.criado_em)}</time></div><p>${esc(m.texto)}</p>${m.eu ? '' : `<div class="esqMsgAct"><button type="button" data-action="esq-alvo" data-id="${esc(m.codinome)}">Desafiar</button><button type="button" data-action="esq-bloq" data-id="${esc(m.codinome)}">Bloquear</button><button type="button" data-action="esq-denunciar" data-id="${Number(m.id)}">Denunciar</button></div>`}</li>`).join('')}</ol>`;
    }
    if (esq.tab === 'desafios') {
      if (!esq.des) return '<p class="esqEmpty">Chegando na esquina…</p>';
      const my = SB.combatRating(s), rec = esq.des.filter(d => !d.eu_desafiei && d.status === 'aberto'), meus = esq.des.filter(d => d.eu_desafiei), velhos = esq.des.filter(d => !d.eu_desafiei && d.status !== 'aberto');
      const statusTxt = d => d.status === 'aberto' ? 'esperando resposta' : d.status === 'aceito' ? ((d.venceu === 'desafiante') === d.eu_desafiei ? 'você venceu' : 'você perdeu') : d.status === 'recusado' ? 'recusado' : d.status === 'cancelado' ? 'cancelado' : 'ninguém respondeu';
      const tone = d => d.status === 'aceito' ? ((d.venceu === 'desafiante') === d.eu_desafiei ? 'good' : 'bad') : '';
      const recCards = rec.map(d => { const ch = 100 - SB.pvpOdds(d.poder_a, my), blk = SB.pvp.acceptBlock(s, d.aposta); return `<article class="esqFight"><span class="esqStamp">Desafio</span><h4>${esc(d.desafiante_nome)} te chamou pra trocação</h4><div class="robStats">${stat('money', fmt(d.aposta) + ' cada', 'money', 'Aposta')}${stat('chance', ch + '% sua chance', ch >= 50 ? 'good' : 'risky', 'Sua chance')}</div><div class="inlineBtns">${button(`Aceitar · ${fmt(d.aposta)}`, 'esq-aceitar', `data-id="${d.id}"`, !!blk, 'small primary')}${button('Recusar', 'esq-recusar', `data-id="${d.id}"`, false, 'small ghost')}</div>${blk ? `<p class="mini negative">${esc(blk)}</p>` : ''}</article>`; }).join('');
      const histo = [...meus, ...velhos].map(d => `<li class="${tone(d)}"><span>${d.eu_desafiei ? `Você → ${esc(d.alvo_nome)}` : `${esc(d.desafiante_nome)} → você`} · ${fmt(d.aposta)}</span><b>${statusTxt(d)}</b>${d.eu_desafiei && d.status === 'aberto' ? button('Cancelar', 'esq-cancelar', `data-id="${d.id}"`, false, 'small ghost') : ''}</li>`).join('');
      const pres = (esq.pres || []).filter(p => !bloq.includes(p.codinome));
      return `${rec.length ? `<h3 class="esqH">Chamaram você</h3>${recCards}` : ''}
        <h3 class="esqH">Na rua agora</h3>${pres.length ? `<ul class="esqPeople">${pres.map(p => `<li><span><b>${esc(p.codinome)}</b><small>${esc(p.cidade)} · ★ ${num(p.respeito)}</small></span>${button('Desafiar', 'esq-alvo', `data-id="${esc(p.codinome)}"`, false, 'small ghost')}</li>`).join('')}</ul>` : '<p class="esqEmpty">Ninguém passou pela rua nos últimos 20 minutos. Você ainda pode desafiar pelo vulgo.</p>'}
        ${histo ? `<h3 class="esqH">Seus desafios (3 dias)</h3><ul class="esqHist">${histo}</ul>` : ''}`;
    }
    if (!esq.merc) return '<p class="esqEmpty">Chegando na esquina…</p>';
    const vis = esq.merc.filter(m => m.meu || !bloq.includes(m.vendedor_nome));
    if (!vis.length) return '<p class="esqEmpty">Banca vazia. Seja o primeiro a vender a sua produção.</p>';
    return `<div class="esqBanca">${vis.map(m => { const g = SB.good(m.mercadoria); if (!g) return ''; const total = m.qtd * m.preco, blk = m.meu ? '' : SB.pvp.buyBlock(s, { good: m.mercadoria, qty: m.qtd, price: m.preco }), ref = SB.goodPrice(s, g), pc = Math.round((m.preco / ref - 1) * 100);
      return `<article class="esqOffer ${m.meu ? 'mine' : ''}"><div><h4>${num(m.qtd)} × ${esc(g.name)}</h4><p class="mini">${m.meu ? 'Sua oferta' : `de ${esc(m.vendedor_nome)} · ${esc(m.cidade)}`}</p></div>
        <div class="robStats">${stat('money', fmt(m.preco) + ' / ' + esc(g.unit), 'money', 'Preço')}${stat('chance', (pc > 0 ? '+' : '') + pc + '% do Galpão', pc <= 0 ? 'good' : pc > 40 ? 'risky' : '', 'Comparado ao Galpão daqui')}</div>
        ${m.meu ? button('Recolher', 'esq-recolher', `data-id="${m.id}"`, false, 'small ghost') : button(`Comprar · ${fmt(total)}`, 'esq-comprar', `data-id="${m.id}"`, !!blk, 'small primary')}${blk ? `<p class="mini negative">${esc(blk)}</p>` : ''}</article>`; }).join('')}</div>`;
  }
  function esquina() {
    const s = state;
    const head = heading('Esquina', 'Onde os jogadores se encontram: papo, desafio e mercado negro.') + `<div class="screenArt">${window.SBArt.place('esquina')}</div>` + jailNotice() + resultCard();
    if (!online) return head + `<section class="card"><p>A Esquina é o ponto de encontro dos jogadores e só funciona no <b>modo online</b>. Entre com a sua conta para conversar, desafiar e negociar.</p></section>`;
    if (!esq.at && !esq.loading) setTimeout(() => loadEsq(true), 0);
    const tabs = [['papo', 'Papo'], ['desafios', 'Desafios'], ['mercado', 'Mercado negro']];
    let top = '', foot = '';
    if (esq.tab === 'papo') {
      top = `<div class="filterbar esqSalas" role="tablist" aria-label="Salas">${[['cidade', esc(s.city)], ['geral', 'Geral']].map(([id, l]) => `<button type="button" role="tab" class="btn ghost ${esq.sala === id ? 'on' : ''}" data-action="esq-sala" data-id="${id}" aria-selected="${esq.sala === id}">${l}</button>`).join('')}</div>`;
      foot = `<div class="esqForm"><input class="input" id="esqMsg" aria-label="Mensagem" maxlength="200" autocomplete="off" placeholder="Manda a real (até 200 letras)">${button('Mandar', 'esq-send', '', false, 'primary')}</div>
        <p class="mini esqRules">Palavrão faz parte da rua. Ódio, preconceito, ameaça, link e telefone não passam. Toque em Denunciar ou Bloquear embaixo de qualquer mensagem.${bloq.length ? ` Bloqueados: ${bloq.map(b => `<button type="button" class="linkish" data-action="esq-desbloq" data-id="${esc(b)}">${esc(b)} ✕</button>`).join(' ')}` : ''}</p>`;
    } else if (esq.tab === 'desafios') {
      const mx = SB.stakeMax(s), blk = SB.pvp.acceptBlock(s, SB.PVP.STAKE_MIN);
      top = `<section class="card esqChallenge"><h3>Chamar pra trocação</h3><div class="esqRow"><input class="input" id="esqAlvo" maxlength="22" placeholder="Vulgo do rival" value="${esc(esq.alvo || '')}"><input class="input" id="esqAposta" type="number" inputmode="numeric" min="${SB.PVP.STAKE_MIN}" max="${mx}" step="10" value="${Math.min(mx, Math.max(SB.PVP.STAKE_MIN, 100))}" aria-label="Aposta"></div>
        <div class="robStats">${stat('money', `${fmt(SB.PVP.STAKE_MIN)}–${fmt(mx)}`, 'money', 'Aposta da sua patente')}${stat('fight', `Sua força ${num(SB.combatRating(s))}`, '', 'Força de luta')}${stat('resp', `+${SB.PVP.RESP_WIN} / −${SB.PVP.RESP_LOSS}`, 'resp', 'Respeito')}</div>
        ${button('Desafiar', 'esq-desafiar', '', !!blk, 'primary')}${blk ? `<p class="mini negative">${esc(blk)}</p>` : ''}
        ${more(`<p>Os dois põem o mesmo valor. A chance vem da força de luta de cada um (Força, Astúcia, arma, proteção e bando). Quem vence leva o pote menos 10% da banca e ganha ${SB.PVP.RESP_WIN} de respeito (até ${SB.PVP.RESP_DAY} por dia; nada de respeito batendo em quem tem menos da metade do seu). Quem perde fica sem a aposta, perde ${SB.PVP.RESP_LOSS} de respeito e leva um golpe na saúde (o colete ajuda). São ${SB.PVP.DAILY} desafios por dia, um por rival, e o desafio vence em ${SB.PVP.EXPIRE_H} horas: se ninguém responder, a aposta volta.</p>`, 'Como funciona')}</section>`;
    } else {
      const mine = SB.GOODS.filter(g => (s.made[g.id] || 0) > 0);
      const g0 = mine[0], band = g0 ? SB.priceBand(g0) : [0, 0];
      top = `<section class="card esqSell"><h3>Vender a sua produção</h3>${mine.length ? `<div class="esqRow"><select class="input" id="esqGood" aria-label="Mercadoria">${mine.map(g => { const b = SB.priceBand(g); return `<option value="${g.id}" data-lo="${b[0]}" data-hi="${b[1]}">${esc(g.name)} (${num(s.made[g.id])})</option>`; }).join('')}</select><input class="input" id="esqQtd" type="number" inputmode="numeric" min="1" max="${SB.PVP.QTY_MAX}" value="${Math.min(10, s.made[g0.id])}" aria-label="Quantidade"><input class="input" id="esqPreco" type="number" inputmode="numeric" min="${band[0]}" max="${band[1]}" value="${SB.goodPrice(s, g0)}" aria-label="Preço por unidade"></div>
        <div class="robStats">${stat('money', `${fmt(band[0])}–${fmt(band[1])} por ${esc(g0.unit)}`, 'money', 'Faixa de preço')}${stat('chance', `Taxa ${Math.round(SB.PVP.FEE * 100)}%`, '', 'Taxa da banca')}</div>${button('Pôr na banca', 'esq-vender', '', false, 'primary')}` : '<p class="mini">Só entra aqui o que os seus esquemas produziram. Monte um esquema em Negócios e volte com a produção.</p>'}
        ${more(`<p>Você escolhe o preço entre metade e o triplo do preço base de cada mercadoria (a faixa impede passar dinheiro entre contas). Quem compra paga na hora; o dinheiro cai no seu bolso, menos ${Math.round(SB.PVP.FEE * 100)}% da banca, da próxima vez que você entrar, e conta no seu faturamento de Negócios. Até ${SB.PVP.LISTINGS} ofertas por vez; recolher devolve a mercadoria.</p>`, 'Como funciona')}</section>`;
    }
    return head + `<div class="filterbar esqTabs" role="tablist" aria-label="Esquina">${tabs.map(([id, l]) => `<button type="button" role="tab" class="btn ghost ${esq.tab === id ? 'on' : ''}" data-action="esq-tab" data-id="${id}" aria-selected="${esq.tab === id}">${l}</button>`).join('')}</div>
      ${top}<div class="esqList ${esq.tab}" id="esqList" aria-live="polite">${esqList()}</div>${foot}`;
  }
  /** Carrega o ranking do mês, a sua posição e a Galeria da fama (no máximo a cada minuto, salvo se forçado). */
  async function loadRank(force) {
    if (!online || !ON || rank.loading || (!force && Date.now() - rank.at < 60000)) return;
    rank.loading = true; rank.err = false;
    const cid = rank.scope === 'cidade' && state ? state.city : null;
    try {
      const [rows, me, fame] = await Promise.all([rpc('ranking_mes', { limite: 50, cidade_f: cid }, true), rpc('minha_posicao', { cidade_f: cid }, true), rank.fame ? rank.fame : rpc('galeria', { meses: 6 })]);
      rank.rows = Array.isArray(rows) ? rows : []; rank.me = Array.isArray(me) && me[0] && me[0].posicao ? me[0] : null; rank.fame = Array.isArray(fame) ? fame : [];
      rank.at = Date.now();
    } catch (e) { rank.err = true; rank.rows = rank.rows || []; }
    rank.loading = false;
    if (state && (view === 'ranking' || view === 'painel' || view === 'hub')) render();
  }
  const patenteOf = r => { let p = SB.PHASES[0]; for (const x of SB.PHASES) if (r >= x.at) p = x; return p.name; };
  const careerName = id => { const c = SB.CAREERS.find(x => x.id === id); return c ? c.name : ''; };
  function monthLeft(s) {
    if (!s.clock) return '';
    const [y, m] = String(s.clock.month).split('-').map(Number), dim = new Date(y, m, 0).getDate(), left = dim - s.day;
    return left > 0 ? `O mês acaba em ${left} dia${left > 1 ? 's' : ''}` : 'Último dia do mês';
  }
  function chaseText(me) {
    if (!me) return '';
    if (Number(me.posicao) === 1) return 'Você está em 1º. Segure a ponta até o fim do mês.';
    return me.acima_codinome ? `Faltam ${num(Math.max(1, me.acima_respeito - me.respeito + 1))} de respeito para passar ${esc(me.acima_codinome)} (${num(me.posicao - 1)}º).` : '';
  }
  /** Cartão da Rua: sua posição no mês (online) ou o convite para o ranking (offline). */
  function rankCard() {
    const s = state;
    if (!online) return `<section class="card rankTeaser"><div class="space"><div><div class="eyebrow">Mural do respeito</div><p class="mini" style="margin:2px 0 0">O ranking do mês é do modo online. Aqui você joga para os seus recordes.</p></div>${button('Ver', 'switch', 'data-target="ranking"', false, 'small ghost')}</div></section>`;
    if (!rank.at && !rank.loading) setTimeout(() => loadRank(), 0);
    const me = rank.me;
    return `<section class="card rankTeaser"><div class="space"><div><div class="eyebrow">Ranking do mês${rank.scope === 'cidade' ? ' · ' + esc(s.city) : ''}</div>
      <h3 style="margin:2px 0">${me ? `Você é o ${num(me.posicao)}º de ${num(me.total)}` : rank.loading ? 'Carregando…' : 'Você ainda não entrou no ranking deste mês'}</h3>
      <p class="mini" style="margin:0">${me ? chaseText(me) + ' ' : ''}${esc(monthLeft(s))}</p></div>${button('Ranking', 'switch', 'data-target="ranking"', false, 'small')}</div></section>`;
  }
  function rankingView() {
    const s = state;
    const head = heading('Ranking', 'O placar é o respeito. O ranking zera todo mês, e os 3 primeiros entram para a Galeria da fama.');
    if (!online) {
      const hist = s.seasonHistory.slice(-6).reverse();
      return head + `<section class="card"><h2>Ranking só no modo online</h2><p>Para disputar com outros jogadores, jogue com conta: na tela inicial, toque em <b>Entrar</b> ou <b>Criar conta</b>. Aqui, offline, você joga contra a cidade e os seus recordes.</p></section>
        ${stencil('Seus recordes')}<section class="card"><div class="kv"><div><span>Respeito agora</span><strong>★ ${num(s.respect)}</strong></div><div><span>Patente</span><strong>${esc(patenteOf(s.respect))}</strong></div><div><span>Temporadas fechadas</span><strong>${num(s.seasonHistory.length)}</strong></div><div><span>Melhor temporada</span><strong>★ ${num(Math.max(0, ...s.seasonHistory.map(h => h.respect || 0)))}</strong></div></div>
        ${hist.length ? `<ol class="rankList">${hist.map(h => `<li><span>T${num(h.season)}</span><b>${num(h.respect)} de respeito</b><small>${esc(h.title || '')}</small><strong>★ ${num(h.respect)}</strong></li>`).join('')}</ol>` : '<p class="mini">Nenhuma temporada fechada ainda.</p>'}</section>`;
    }
    const me = rank.me, rows = rank.rows;
    const filt = `<div class="filterbar" role="group" aria-label="Filtrar ranking">${[['brasil', 'Brasil'], ['cidade', esc(s.city)]].map(([id, l]) => `<button type="button" class="btn ghost ${rank.scope === id ? 'on' : ''}" data-action="rank-scope" data-id="${id}" aria-pressed="${rank.scope === id}">${l}</button>`).join('')}</div>`;
    const meCard = `<section class="card rankMe"><div class="eyebrow">Você${rank.scope === 'cidade' ? ' em ' + esc(s.city) : ' no Brasil'}</div>
      <h2>${me ? `${num(me.posicao)}º de ${num(me.total)}` : rank.loading ? 'Carregando…' : 'Fora do ranking deste mês'}</h2>
      <p class="mini">${me ? `★ ${num(me.respeito)} de respeito. ${chaseText(me)}` : 'Jogue neste mês para aparecer.'} ${esc(monthLeft(s))}.</p></section>`;
    const row = x => `<li class="rankRow2 ${x.eu ? 'me' : ''}"><span class="rkPos ${x.posicao <= 3 ? 'top' + x.posicao : ''}">${num(x.posicao)}º</span><span class="rkPic" aria-hidden="true">${window.SBArt.avatar(x.avatar) || ''}</span>
      <span class="rkWho"><b>${esc(x.codinome)}${x.eu ? ' (você)' : ''}</b><small>${esc(x.cidade)}${x.classe ? ' · ' + esc(careerName(x.classe)) : ''} · ${esc(patenteOf(x.respeito))}${x.bairros ? ` · manda em ${num(x.bairros)} bairro${x.bairros > 1 ? 's' : ''}` : ''}</small></span><strong>★ ${num(x.respeito)}</strong></li>`;
    const list = rows === null || (rank.loading && !rows.length) ? '<div class="empty">Carregando o ranking…</div>' : rank.err && !rows.length ? `<div class="empty">Não foi possível carregar o ranking. ${button('Tentar de novo', 'rank-reload', '', false, 'small')}</div>` : rows.length ? `<ol class="rankBoard">${rows.map(row).join('')}</ol>` : '<div class="empty">Ninguém jogou neste mês ainda. Seja o primeiro.</div>';
    const byMonth = {}; for (const f of rank.fame || []) (byMonth[f.mes] = byMonth[f.mes] || []).push(f);
    const fame = Object.keys(byMonth).length ? Object.keys(byMonth).sort().reverse().map(m => `<section class="card fameCard"><h3>${esc(monthName(m))}</h3><ol class="fameList">${byMonth[m].map(f => `<li class="f${f.posicao}"><span class="rkPos top${f.posicao}">${num(f.posicao)}º</span><span class="rkPic" aria-hidden="true">${window.SBArt.avatar(f.avatar) || ''}</span><span class="rkWho"><b>${esc(f.codinome)}</b><small>${esc(f.cidade)}${f.classe ? ' · ' + esc(careerName(f.classe)) : ''}</small></span><strong>★ ${num(f.respeito)}</strong></li>`).join('')}</ol></section>`).join('') : '<p class="mini">A Galeria da fama começa quando o primeiro mês acabar: os 3 primeiros de cada mês ficam aqui para sempre.</p>';
    return head + filt + meCard + stencil('Top do mês', rank.scope === 'cidade' ? esc(s.city) : 'Brasil') + list + `<div class="btnbar" style="margin-top:8px">${button('Atualizar', 'rank-reload', '', rank.loading, 'small ghost')}</div>` + stencil('Galeria da fama', 'os 3 primeiros de cada mês') + fame;
  }
  /** Cartão da conta e do ranking (Perfil, só no online). */
  function onlineCard() {
    if (!online) return '';
    return `${stencil('Online', 'save na nuvem')}<section class="card onlineCard"><p class="mini" style="margin:0 0 8px">Conta: <b>${esc(session && session.email)}</b>. As regras rodam no servidor do jogo.</p>
      <p class="mini">O ranking do mês, com filtro por cidade e a Galeria da fama, fica no Mural do respeito.</p>
      <div class="btnbar">${button('Ver ranking', 'switch', 'data-target="ranking"', false, 'small')}${button('Sair da conta', 'on-logout', '', false, 'small ghost')}</div></section>`;
  }
  document.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action^="on-"]'); if (!btn || !ON) return;
    const a = btn.dataset.action;
    if (a === 'on-ranking') return loadRanking();
    if (a === 'on-logout') { storeSession(null); online = false; pendingOnline = false; if (setup) closeSetup(); state = load(); rankingRows = null; rank.rows = null; rank.me = null; rank.at = 0; if (state) render(); else showWelcome(); notify('Você saiu da conta online.'); return; }
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
  /* Abertura com sessão guardada: nada de abrir o save local e trocar depois. Mostra "Carregando seu perfil…"
   * até o servidor confirmar a sessão; se ela não valer mais, volta para a tela inicial com o aviso. */
  let bootCancelled = false;
  function showLoader(email) {
    let el = $('#bootLoader');
    if (!el) { el = document.createElement('div'); el.id = 'bootLoader'; el.className = 'bootLoader'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.innerHTML = `<div class="loaderBox"><b class="loaderLogo">SUBMUNDO <span>BRASIL</span></b><span class="loaderSpin" aria-hidden="true"></span><p>Carregando seu perfil…</p>${email ? `<small>${esc(email)}</small>` : ''}<button type="button" class="btn ghost small" id="loaderOther">Entrar com outra conta</button></div>`;
    el.hidden = false;
    $('#loaderOther').addEventListener('click', () => { bootCancelled = true; storeSession(null); hideLoader(); localStart(); });
  }
  function hideLoader() { const el = $('#bootLoader'); if (el) el.hidden = true; }
  function localStart() { state = load(); if (state) { save(); render(); if (!ageConfirmed()) ageGate(); } else showWelcome(); }
  async function bootOnline(withLoader) {
    if (!ON) return;
    $('#onlineBox').hidden = false;
    session = readSession(); if (!session) return;
    try { await afterLogin(); if (bootCancelled) return; hideLoader(); }
    catch (e) {
      if (bootCancelled) return;
      hideLoader();
      if (/expirou|Entre/.test(e.message)) storeSession(null);
      if (withLoader) { state = null; showWelcome(); }
      onlineStatus(`<p class="notice">${esc(e.message)}</p>`);
    }
  }

  const stored = ON ? readSession() : null;
  if (stored) { showLoader(stored.email); bootOnline(true); }
  else { localStart(); bootOnline(false); }
  window.__SB_UI = { get state() { return state; }, go: switchView }; // apoio a testes automatizados
})();
