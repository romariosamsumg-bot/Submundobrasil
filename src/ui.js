/* =====================================================================
 * SUBMUNDO BRASIL — INTERFACE v0.7
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
  const VIEWS = ['painel', 'acoes', 'hub', 'cidade', 'gestao', 'feira', 'galpao', 'noite', 'gangue', 'perfil', 'temporada'];
  /* Telas que ficam "dentro" de uma aba da navegação. */
  const PARENT = { cidade: 'hub', gestao: 'hub', feira: 'hub', galpao: 'hub', noite: 'hub', temporada: 'perfil' };
  const tabOf = v => PARENT[v] || v;
  const MAXDAY = SB.MAXDAY;

  let state = null, view = 'painel', result = null, toastTimer = null;
  let armedNext = false, armTimer = null, missionFilter = 'disponiveis', corrupt = null, saveFailed = false;

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
    let o = `<svg class="scene" viewBox="0 0 360 120" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><defs><linearGradient id="sky-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`;
    o += R(0, 0, 360, 120, `url(#sky-${id})`) + `<circle cx="${id === 'cais' ? 300 : 78}" cy="${id === 'industrial' ? 40 : 30}" r="13" fill="#f3d9a4" opacity="${has('temporal') ? .15 : .8}"/>`;
    o += (LANDMARK[SB.cityOf(cityName || (state && state.city)).id] || LANDMARK.rio)();
    o += (SCENES[id] || SCENES.centro)();
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
    return o + R(0, 118, 360, 2, '#05080a') + '</svg>';
  }
  /** Placa de rua esmaltada. */
  const plate = (name, sub = '') => `<span class="plate"><b>${esc(name)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span>`;
  /** Retrato do personagem: silhueta muda com a especialização. */
  function avatar(career) {
    const bg = { operador: '#3a2f25', articulador: '#22343a', empreendedor: '#2c3327' }[career] || '#262b2f';
    let o = `<svg viewBox="0 0 48 48" aria-hidden="true">${R(0, 0, 48, 48, bg)}<path d="M0 34l48 -20v34H0z" fill="#0003"/>`;
    o += `<path d="M6 48c1-11 8-15 18-15s17 4 18 15z" fill="#0b1013"/><ellipse cx="24" cy="21" rx="9" ry="10.500" fill="#0b1013"/>`.replace('.500', '.5');
    if (career === 'operador') o += `<path d="M14 17c1-8 19-8 20 0z" fill="#b5482f"/><path d="M13 17h26l1 3H13z" fill="#8a3421"/>`;
    else if (career === 'articulador') o += `<path d="M8 16h32l-2 3H10z" fill="#e7d9b8"/><path d="M15 16c0-9 18-9 18 0z" fill="#e7d9b8"/><path d="M15 14h18v2H15z" fill="#22343a"/>`;
    else if (career === 'empreendedor') o += `<path d="M15 16c2-9 16-9 18 0-5-3-13-3-18 0z" fill="#1b1410"/><path d="M19 34l5 5 5-5 2 14H17z" fill="#e7d9b8"/><path d="M23 38h2l1.500 9h-5z" fill="#c79a3d"/>`.replace('.500', '.5');
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
    influencia: `<circle cx="12" cy="5" r="2.500"/><circle cx="5" cy="18" r="2.500"/><circle cx="19" cy="18" r="2.500"/><path d="M11 7 6 16M13 7l5 9M7.500 18h9"/>`.replace(/\.500/g, '.5')
  };
  const statIcon = id => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${STAT_ICON[id] || ''}</svg>`;
  /** Título de seção em estêncil. */
  const stencil = (title, small = '') => `<div class="section"><h2>${title}</h2>${small ? `<small>${small}</small>` : ''}</div>`;

  /* ---------- persistência ---------- */
  function save() {
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
    if (r.notes.length) result = { good: true, msg: 'Salvamento carregado e verificado.', lines: r.notes, deltas: [] };
    return r.state;
  }
  function download(name, text) {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportSave() {
    download(`submundo-brasil-v0.7-t${state.season}-d${state.day}.json`, JSON.stringify(SB.exportPayload(state), null, 2));
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
    result = { good: true, msg: 'Carreira importada.', lines: r.notes.concat(warn ? ['Arquivo alterado após a exportação: valores verificados.'] : []), deltas: [] };
    $('#welcome').classList.add('hidden'); document.body.classList.remove('atCover');
    save(); render(); notify('Carreira importada com sucesso.');
  }

  /* ---------- feedback ---------- */
  function notify(msg, isError = false) {
    const node = $('#toast'); node.textContent = msg; node.className = 'toast' + (isError ? ' error' : ''); node.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { node.hidden = true; }, 3800);
  }
  const snap = () => state ? { cash: state.cash, bank: state.bank, energy: state.energy, heat: state.heat, respect: state.respect, inf: state.influence[state.district], morale: state.crewMorale, district: state.district } : null;
  function deltas(a, b) {
    if (!a || !b) return [];
    const out = [];
    const add = (label, v, goodUp = true, money = false) => { if (v) out.push({ label, text: (v > 0 ? '+' : '-') + (money ? fmt(Math.abs(v)) : num(Math.abs(v))), good: goodUp ? v > 0 : v < 0 }); };
    add('Caixa', b.cash - a.cash, true, true); add('Banco', b.bank - a.bank, true, true); add('Energia', b.energy - a.energy);
    add('Vigilância', b.heat - a.heat, false); add('Respeito', b.respect - a.respect);
    if (a.district === b.district) add('Influência', b.inf - a.inf);
    add('Ânimo', b.morale - a.morale);
    return out;
  }
  const STAMPED = ['mission', 'gangOp', 'clash', 'dispute', 'dialogue', 'exportGoods'];
  /** Transição curta de amanhecer ao virar o dia (ignorada com movimento reduzido). */
  function dawn() {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = document.createElement('div'); el.className = 'dawn'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<b>Dia ${state.day}</b>`; document.body.appendChild(el); setTimeout(() => el.remove(), 1100);
  }
  let lastCash = null;
  function renderHud() {
    const s = state, lvl = Math.min(99, Math.floor(s.respect / 35) + 1), c = s.career ? SB.CAREERS.find(x => x.id === s.career).name : 'Sem especialização';
    if ($('#hudAvatar').dataset.career !== String(s.career)) { $('#hudAvatar').innerHTML = avatar(s.career); $('#hudAvatar').dataset.career = String(s.career); }
    $('#hudName').textContent = s.name; $('#hudSub').textContent = `Nível ${lvl} · ${c}`;
    $('#hudRespect').textContent = num(s.respect);
    $('#hudEnergy').style.width = s.energy + '%'; $('#hudEnergyTxt').textContent = `Energia ${s.energy}`;
    $('#hudHeat').style.width = s.heat + '%'; $('#hudHeatTxt').textContent = `Vigilância ${s.heat}`;
    $('#hudEnergyBox').setAttribute('aria-label', `Energia ${s.energy} de 100`); $('#hudHeatBox').setAttribute('aria-label', `Vigilância ${s.heat} de 100`);
    $('#hudHeatBox').classList.toggle('alert', s.heat >= 60);
    const cash = $('#topCash'); cash.textContent = fmt(s.cash);
    if (lastCash !== null && lastCash !== s.cash) { cash.classList.remove('up', 'down'); void cash.offsetWidth; cash.classList.add(s.cash > lastCash ? 'up' : 'down'); }
    lastCash = s.cash;
    $('#topDay').textContent = `Dia ${s.day}/${MAXDAY}`;
    document.body.classList.toggle('jailed', s.jail > 0);
  }
  /** Executa uma ação do motor, registra o resultado e redesenha. */
  function run(name, ...args) {
    if (!state) return null;
    const before = snap();
    let r;
    try { r = SB.perform(state, name, ...args); }
    catch (e) { console.error(e); notify('Erro inesperado na ação. Seu progresso anterior foi mantido.', true); return null; }
    if (!r.ok) { notify(r.msg, true); return r; }
    if (name === 'endSeason') {
      const rec = r.record;
      state = r.state;
      result = { good: true, msg: r.msg, lines: [`Pontuação: ${rec.score}.`, ...SB.CATEGORIES.map(c => `${c.name}: ${SB.MEDALS[rec.medals[c.id]]}`), `Meta: ${rec.goal ? (rec.goalComplete ? 'cumprida' : 'não cumprida') : 'não escolhida'}.`], deltas: [] };
    } else result = { good: r.good, msg: r.msg, lines: r.lines || [], deltas: deltas(before, snap()), fresh: true, stamp: STAMPED.includes(name) };
    if (name === 'nextDay') dawn();
    save(); render();
    // O cupom de resultado já informa; o aviso flutuante só aparece se ele estiver fora da tela.
    const card = $('.resultCard'), box = card && card.getBoundingClientRect();
    if (!box || box.bottom < 70 || box.top > window.innerHeight - 70) notify(r.msg, !r.good); else $('#toast').hidden = true;
    return r;
  }

  /* ---------- componentes ---------- */
  function heading(label, desc, extra = '') {
    const up = PARENT[view];
    return `${up ? `<button type="button" class="backLink" data-view="${up}">← ${up === 'hub' ? 'Cidade' : 'Perfil'}</button>` : ''}<div class="pagehead"><div><h1>${label}</h1><p>${desc}</p></div>${extra}</div>` + guideCard();
  }
  function resultCard() {
    if (!result) return '';
    const fresh = result.fresh; result.fresh = false;
    return `<section class="resultCard ${result.good ? '' : 'bad'} ${fresh ? 'fresh' : ''}" aria-live="polite"><div class="rhead"><strong>${esc(result.msg)}</strong><button type="button" class="close" data-action="dismiss-result" aria-label="Fechar resultado">×</button></div>
      ${result.stamp ? `<span class="stamp" aria-hidden="true">${result.good ? 'DEU BOM' : 'DEU RUIM'}</span>` : ''}
      ${result.deltas.length ? `<div class="chips">${result.deltas.map(d => `<span class="chip ${d.good ? 'up' : 'down'}">${d.label} ${d.text}</span>`).join('')}</div>` : ''}
      ${result.lines.length ? `<ul>${result.lines.slice(0, 10).map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}</section>`;
  }
  function jailNotice() {
    if (state.jail <= 0) return '';
    const c = SB.bailCost(state);
    return `<div class="notice error tape"><strong>DETIDO · ${state.jail} dia(s)</strong> Missões, treinos, viagens e negócios ficam bloqueados; o banco continua disponível.
      <div class="inlineBtns">${button(`Pagar fiança · ${fmt(c)}`, 'bail', '', state.cash < c, 'small danger')}${nextDayButton('small')}</div></div>`;
  }
  function nextDayButton(cls = '') {
    if (state.day >= MAXDAY) return button('Encerrar temporada', 'switch', 'data-target="temporada"', false, 'primary ' + cls);
    return button(armedNext ? `Confirmar? Restam ${state.energy} de energia` : 'Avançar dia', 'next-day', '', false, (armedNext ? 'armed ' : 'primary ') + cls);
  }
  function eventChips() {
    return SB.activeEvents(state).map(e => `<li><strong>${esc(SB.eventTitle(e))}</strong>${e.until > state.day ? ` · até o dia ${e.until}` : ''}<br>${esc(SB.eventDesc(e))}</li>`).join('');
  }
  /** Faixa do local atual: cena do bairro, placa de rua e condições. */
  function localeStrip(tall) {
    const s = state, d = D(), ds = s.dstate[d.id], l = SB.leader(s, d.id);
    const evs = SB.activeEvents(s).filter(e => e.id !== 'rotina');
    return `<section class="locale ${tall ? 'tall' : ''}" aria-label="Onde você está">${scene(d.id)}
      <div class="localeTop">${plate(d.name, s.city)}${evs.map(e => `<span class="flyer">${esc(SB.eventTitle(e))}</span>`).join('')}</div>
      <div class="localeBottom"><span>${SB.controlled(s, d.id) ? 'Você lidera' : esc(F(l.id).short) + ' ' + l.value + ' × você ' + s.influence[d.id]}</span><span>Economia ${Math.round(ds.econ * 100)}%</span><span class="${ds.vigil >= 40 ? 'hot' : ''}">Vigia local ${ds.vigil}</span></div></section>`;
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
  /** Rumo: onde você está, o próximo título e a medalha mais próxima, com o caminho. */
  function rumoCard() {
    const s = state, sc = SB.seasonScore(s);
    let best = null;
    for (const c of sc.cats) { const cat = SB.CATEGORIES.find(x => x.id === c.id), next = cat.tiers[c.medal]; if (!next) continue; const prev = c.medal ? cat.tiers[c.medal - 1] : 0, gap = (next - c.value) / (next - prev); if (!best || gap < best.gap) best = { c, cat, next, gap }; }
    const span = sc.next ? pct((sc.score - (SB.TITLES.find(t => t[1] === sc.title) || [0])[0]) / (sc.next.at - (SB.TITLES.find(t => t[1] === sc.title) || [0])[0]) * 100) : 100;
    return `<section class="rumo" aria-label="Seu rumo na temporada"><div class="rumoHead"><span>Seu rumo</span><b>${num(sc.score)} pts</b></div>
      <div class="rumoTitles"><strong>${esc(sc.title)}</strong>${sc.next ? `<span>→ ${esc(sc.next.title)} com ${num(sc.next.at)}</span>` : '<span>título máximo</span>'}</div>
      <div class="meter"><div style="width:${span}%"></div></div>
      ${best ? `<p><b>Medalha mais próxima:</b> ${best.c.name} ${SB.MEDALS[best.c.medal + 1]} — faltam ${best.cat.unit === 'money' ? fmt(best.next - best.c.value) : num(best.next - best.c.value)}. Para chegar: ${CAT_TIPS[best.c.id]}.</p>` : '<p>Todas as medalhas de ouro conquistadas.</p>'}
      ${s.day >= 25 && s.day < MAXDAY ? `<p class="warn">Reta final: faltam ${MAXDAY - s.day} dia(s).</p>` : ''}</section>`;
  }
  let helpPage = 0;
  function helpPages() {
    const c = state ? SB.cityOf(state.city) : SB.CITIES[0];
    return [
      ['O objetivo', `<p>Você chega a <strong>${esc(c.name)}</strong> com pouco dinheiro e nenhum nome. Tem <strong>30 dias</strong> (uma temporada) para virar alguém.</p>
        <p>No fim, sua temporada recebe pontos e medalhas em <strong>seis caminhos</strong>: Fortuna, Fama, Território, Diplomacia, Gangue e Comércio. Não precisa ser bom em tudo: escolha um ou dois e vá fundo.</p>
        <p>Os títulos vão de <em>Aprendiz da rua</em> a <em>Lenda do Submundo</em>. O cartão <strong>Seu rumo</strong>, no Início, mostra sempre o próximo título e a medalha mais próxima.</p>`],
      ['Seu dia', `<p>Tudo gasta <strong>energia</strong> (barra verde). Um dia típico:</p>
        <ol><li><strong>Serviços</strong> rendem dinheiro e respeito. Veja a chance antes.</li><li><strong>Treino</strong> melhora atributos e libera serviços maiores.</li><li><strong>Contatos</strong> nos bairros viram influência e tributo.</li><li>Na aba <strong>Cidade</strong> ficam os lugares: Feira do Rolo (armas, proteção e veículo), Galpão (comprar barato, vender caro, produzir e despachar) e a noite (energia extra, com ressaca).</li><li>Sem energia? <strong>Avance o dia</strong>: +70 de energia, a renda entra e os grupos se movem.</li></ol>
        <p>Respeito libera serviços, a gangue (30) e mais. Dinheiro compra treino, negócios e equipe.</p>`],
      ['Os riscos', `<p><strong>Vigilância</strong> (barra vermelha) sobe a cada serviço e derruba suas chances. Ela cai sozinha ao virar o dia, ou com “Ficar na sua”.</p>
        <p><strong>Falhar</strong> tira parte do dinheiro <em>em mãos</em> e pode dar <strong>detenção</strong> (dias perdidos, ou fiança). O banco protege o dinheiro por uma taxa.</p>
        <p><strong>Repetir</strong> o mesmo serviço no dia ou insistir no mesmo bairro piora chance e pagamento. Varie.</p>
        <p>Os <strong>grupos rivais</strong> reagem: agir no território deles gera atrito, retaliação e extorsão. Dá para conversar, firmar trégua ou aliança.</p>`],
      ['Sua cidade', `<p><strong>${esc(c.name)} — ${esc(c.trait)}.</strong> ${esc(c.traitDesc)}</p>
        <ul>${SB.DISTRICTS.map(d => `<li><strong>${esc(d.name)}</strong>: ${esc(d.advantage)}</li>`).join('')}</ul>
        <p>Fique de olho no calendário: <strong>${esc(SB.EVENTS.carnaval.title)}</strong> começa no dia 9 e o <strong>${esc(SB.EVENTS.classico.title)}</strong> é no dia 20.</p>`]
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
  function panel() {
    const s = state;
    const standing = s.respect < 30 ? 'Desconhecido' : s.respect < 85 ? 'Nome em ascensão' : s.respect < 180 ? 'Figura conhecida' : 'Lenda da cidade';
    const m = suggestion();
    const net = SB.income(s) + SB.controls(s).reduce((t, d) => t + SB.tribute(s, d.id), 0) - SB.groupUpkeep(s);
    return jailNotice() + localeStrip(true) + `
      <div class="dayBar"><div class="dayInfo"><b>Dia ${s.day}<small>/${MAXDAY}</small></b><span>Temporada ${s.season} · ${standing}</span><div class="dayTrack" aria-hidden="true"><i style="width:${(s.day - 1) / (MAXDAY - 1) * 100}%"></i></div></div>${nextDayButton('')}</div>
      ${resultCard()}${guideCard()}${careerCard()}${s.career || s.tutorial.done ? goalSummary() + newsCard() : ''}
      <section class="boardLead job ${m ? '' : 'idle'}"><div class="jobIcon">${m ? statIcon(m.stat) : statIcon('astucia')}</div>
        <div class="jobMain"><div class="eyebrow">Serviço da vez</div><h3>${m ? esc(m.name) : 'Nada com boa chance agora'}</h3>
          <p class="jobMeta">${m ? `${m.cost} energia · ${fmt(m.low * SB.missionRewardMult(s, m))}–${fmt(m.high * SB.missionRewardMult(s, m))}` : 'Treine, baixe a vigilância, viaje ou vire o dia.'}</p></div>
        <div class="jobAct">${m ? `<span class="seal ${chanceClass(SB.missionChance(s, m))}">${SB.missionChance(s, m)}%</span>${button('Executar', 'mission', `data-id="${m.id}"`, false, 'primary')}` : button('Ver quadro', 'switch', 'data-target="acoes"', false, 'primary')}</div></section>
      <div class="tiles">
        <button class="tile" type="button" data-view="acoes"><b>${SB.MISSIONS.filter(x => !SB.missionLock(s, x)).length}</b><span>serviços aqui</span></button>
        <button class="tile" type="button" data-view="cidade"><b>${SB.controls(s).length}<small>/5</small></b><span>bairros seus</span></button>
        <button class="tile" type="button" data-view="gestao"><b class="${net < 0 ? 'neg' : ''}">${fmt(net)}</b><span>saldo por dia</span></button>
        <button class="tile" type="button" data-view="galpao"><b>${SB.cargoUsed(s)}<small>/${SB.cargoCap(s)}</small></b><span>carga no galpão</span></button>
        <button class="tile" type="button" data-view="gangue"><b>${s.gangName ? s.crew.length : '—'}</b><span>${s.gangName ? 'no bonde · ânimo ' + s.crewMorale : 'sem gangue'}</span></button>
      </div>
      ${SB.activeEvents(s).some(e => e.id !== 'rotina') ? stencil('Na cidade hoje') + `<section class="poster"><ul class="eventList">${SB.activeEvents(s).filter(e => e.id !== 'rotina').map(e => `<li><strong>${esc(SB.eventTitle(e))}</strong>${e.until > s.day ? ` · até o dia ${e.until}` : ''}<br>${esc(SB.eventDesc(e))}</li>`).join('')}</ul></section>` : ''}
      ${rumoCard()}
      ${stencil('Diário', 'últimos registros')}<section class="diary">${journal(3)}</section>`;
  }
  function journal(max) { return `<ul class="timeline">${state.log.slice(0, max).map(i => `<li><time>Dia ${num(i.day)}</time>${esc(i.msg)}</li>`).join('')}</ul>`; }

  function careerCard() {
    const s = state;
    if (s.career) {
      const c = SB.CAREERS.find(x => x.id === s.career), lvl = SB.careerLevel(s), next = SB.CAREER_XP[lvl];
      return `<details class="compactNote" style="display:block"><summary style="cursor:pointer"><strong>${c.name} · nível ${lvl}/3</strong> <span>${next ? `${s.careerXP}/${next} XP` : 'Especialização completa'}</span></summary>
        <p class="mini" style="margin:6px 0 0">${esc(c.desc)} ${esc(c.xpDesc)}</p><ul class="perkList">${c.perks.map((p, i) => `<li class="${i < lvl ? 'on' : ''}">${i < lvl ? '✓' : '○'} Nível ${i + 1} (${SB.CAREER_XP[i]} XP): ${esc(p)}</li>`).join('')}</ul></details>`;
    }
    return `<section class="card choiceCard"><div class="eyebrow">Decisão permanente nesta temporada</div><h2>Escolha sua especialização</h2><p>Cada caminho tem vantagens, desvantagens e três habilidades desbloqueáveis com experiência.</p>
      <div class="choiceGrid">${SB.CAREERS.map(c => `<article><strong>${c.name}</strong><p>${esc(c.desc)}<br><em class="mini">${esc(c.xpDesc)}</em></p>${button('Escolher ' + c.name, 'career', `data-id="${c.id}"`, false, 'small primary block')}</article>`).join('')}</div></section>`;
  }
  function goalSummary() {
    if (!state.goal) return state.day <= 5 ? `<div class="compactNote"><strong>Meta da temporada</strong><span>Escolha até o dia 5 em Temporada.</span>${button('Escolher', 'switch', 'data-target="temporada"', false, 'small ghost')}</div>` : '';
    const g = SB.GOALS.find(x => x.id === state.goal), p = SB.goalProgress(state, state.goal);
    return `<div class="compactNote"><strong>Meta: ${g.name}</strong><span>${state.goalDone ? 'Cumprida!' : p.unit === 'money' ? fmt(p.value) + ' / ' + fmt(p.max) : Math.round(p.value) + '% do objetivo'}</span></div>`;
  }
  function newsCard() {
    const n = SB.currentNews(state); if (!n) return '';
    const f = state.newsPending.faction ? F(state.newsPending.faction) : null;
    return `<section class="poster choiceCard"><div class="posterHead">EXTRA · DIA ${state.day}</div><h2>${esc(n.name)}${f ? ' · ' + esc(f.short) : ''}</h2><p>${esc(n.desc)}</p>
      <div class="choiceGrid">${n.choices.map((c, i) => { const block = SB.newsChoiceBlocked(state, c); const cost = SB.newsChoiceCost(state, c); return `<article><strong>${esc(c.label)}</strong><p>${esc(c.desc)}${c.cashPerMember ? ` (total ${fmt(cost)})` : ''}${block ? `<br><span class="negative">${esc(block)}</span>` : ''}</p>${button('Decidir', 'news', `data-id="${n.id}" data-choice="${i}"`, !!block, 'small block')}</article>`; }).join('')}</div>
      <div class="btnbar" style="margin-top:8px">${button('Ignorar', 'skip-news', '', false, 'ghost small')}</div></section>`;
  }
  function actions() {
    const s = state, ds = s.dstate[s.district];
    const list = SB.MISSIONS.filter(m => missionFilter === 'todas' ? true : missionFilter === 'bairro' ? m.district === s.district : ['', 'Energia insuficiente.', 'Você está detido.'].includes(SB.missionLock(s, m)));
    return heading('Quadro de serviços', 'Cada serviço usa um atributo. Repetir no mesmo dia ou no mesmo bairro aumenta o risco.') + jailNotice() + resultCard() + `
      ${localeStrip(false)}
      ${stencil('Serviços', 'chance entre 8% e 95%')}
      <div class="filterbar" role="group" aria-label="Filtrar missões">${[['disponiveis', 'Disponíveis'], ['bairro', 'Deste bairro'], ['todas', 'Todas']].map(([id, l]) => `<button type="button" class="btn ghost ${missionFilter === id ? 'on' : ''}" data-action="filter" data-id="${id}" aria-pressed="${missionFilter === id}">${l}</button>`).join('')}</div>
      <div class="jobs">${list.length ? list.map(missionCard).join('') : '<div class="empty">Nenhuma missão neste filtro. Ganhe respeito, viaje ou veja “Todas”.</div>'}</div>
      ${safeJobs()}
      ${stencil('Academia', `treinos hoje: ${s.today.training}/3`)}
      <div class="jobs">${SB.STATS.map(st => { const lvl = s.stats[st.id], cost = SB.trainCost(s, st.id); return `<section class="job train"><div class="jobIcon">${statIcon(st.id)}<small>${num(lvl)}</small></div><div class="jobMain"><h3>${st.name}</h3><p class="jobDesc">${esc(st.desc)}</p><p class="jobMeta"><b>+${lvl < 25 ? 2 : 1}</b> · 22 energia · ${fmt(cost)}</p></div><div class="jobAct">${button('Treinar', 'train', `data-id="${st.id}"`, s.jail > 0 || s.energy < 22 || s.cash < cost || s.today.training >= 3, '')}</div></section>`; }).join('')}</div>`;
  }
  function missionCard(m) {
    const s = state, lock = SB.missionLock(s, m), p = SB.missionChance(s, m), mult = SB.missionRewardMult(s, m), reps = s.today.missions[m.id] || 0;
    const hard = lock && lock !== 'Energia insuficiente.' && lock !== 'Você está detido.';
    return `<section class="job ${hard ? 'locked' : ''}"><div class="jobIcon" title="${statName(m.stat)}">${statIcon(m.stat)}<small>${statName(m.stat)}</small></div>
      <div class="jobMain"><h3>${esc(m.name)}${m.district ? ` <span class="pill">só aqui</span>` : ''}</h3><p class="jobDesc">${esc(m.desc)}</p>
      <p class="jobMeta"><b>${fmt(m.low * mult)}–${fmt(m.high * mult)}</b> · ${m.cost} energia · +${m.heat} vigilância · +${SB.respectGain(s, m)} respeito</p>
      <p class="jobRisk">Se falhar: -${Math.round(SB.failLoss(s, m) * 100)}% do caixa em mãos, detenção ${SB.arrestChance(s, m)}%</p>
      ${reps ? `<div class="lockline">Repetida ${reps}× hoje: chance e recompensa menores.</div>` : ''}${lock ? `<div class="lockline">${esc(lock)}</div>` : ''}</div>
      <div class="jobAct"><span class="seal ${chanceClass(p)}">${p}%</span>${button('Executar', 'mission', `data-id="${m.id}"`, !!lock, 'primary')}</div></section>`;
  }
  function safeJobs() {
    const s = state;
    return `<div class="section"><h2>Outras escolhas</h2><small>Menos risco, menor retorno</small></div><div class="grid two">
      <section class="card"><h3>Bico de ocasião</h3><p>Trabalho simples e garantido, sem reputação.</p><div class="space"><span class="mini">28 energia · ${fmt(110 * SB.eventMod(s, 'gigMult'))}–${fmt(170 * SB.eventMod(s, 'gigMult'))} · -4 vigilância</span>${button('Fazer bico', 'gig', '', s.energy < 28 || s.jail > 0, 'small')}</div></section>
      <section class="card"><h3>Ficar na sua</h3><p>Evitar movimento para baixar a atenção sobre você e sobre o bairro.</p><div class="space"><span class="mini">18 energia · -20 vigilância · -10 local</span>${button('Reduzir exposição', 'lay-low', '', s.energy < 18 || s.jail > 0 || s.heat === 0, 'small')}</div></section></div>
      <div class="notice" style="margin-top:9px">Falhas tiram parte do dinheiro <strong>em mãos</strong>. Depositar protege, mas custa ${SB.hasPerk(s, 'empreendedor', 1) ? '1%' : '3%'} de taxa.</div>`;
  }

  function city() {
    const s = state, d = D(), ds = s.dstate[d.id], l = SB.leader(s, d.id), lf = F(l.id), lr = s.factions[l.id];
    const agreed = SB.agreement(s, l.id), cc = SB.contactCost(s), used = s.today.contacts[d.id] || 0;
    const disputeBlock = s.jail > 0 || s.cash < 320 || s.energy < 33 || s.influence[d.id] < 20 || agreed || lr.lastActionDay === s.day;
    const special = SB.MISSIONS.find(m => m.district === d.id);
    return heading('Bairros', 'Cada bairro tem economia, vigilância e facções próprias, que mudam a cada dia.') + jailNotice() + resultCard() + localeStrip(true) + `
      <section class="card"><div class="space factionHeader"><div><h2>Influência em ${esc(d.name)}</h2><p>Quem lidera: <strong>${SB.controlled(s, d.id) ? 'você' : esc(lf.name)}</strong>. ${esc(SB.factionStatus(s, l.id))}. Liderar exige 60 de influência e 10 acima da maior facção.</p></div>${SB.controlled(s, d.id) ? '<span class="pill">Você lidera</span>' : ''}</div>
        <div class="dualMeters"><div><div class="meterlabel"><span>Sua influência</span><strong>${s.influence[d.id]}</strong></div><div class="meter green"><div style="width:${s.influence[d.id]}%"></div></div></div>
        <div><div class="meterlabel"><span>${esc(lf.short)} (maior facção)</span><strong>${l.value}</strong></div><div class="meter red"><div style="width:${l.value}%"></div></div></div></div>
        <div class="chips">${SB.FACTIONS.map(f => `<span class="chip">${esc(f.short)} ${s.presence[d.id][f.id]}</span>`).join('')}</div>
        <div class="btnbar" style="margin-top:12px">${button(`Criar contatos · ${fmt(cc)}`, 'contact', '', s.jail > 0 || s.cash < cc || s.energy < 22 || used >= 2, 'small primary')}${button(`Disputar área · R$ 320 (${SB.disputeOdds(s, d.id)}%)`, 'dispute', '', disputeBlock, 'small')}</div>
        <p class="mini" style="margin-top:8px">Contatos: 22 energia, até 2 por bairro ao dia (o segundo rende metade). Disputa: 33 energia, exige 20 de influência; uma ação por facção ao dia; bloqueada por acordos.${agreed ? ` Você tem acordo com ${esc(lf.short)}.` : ''}</p></section>
      <section class="brandpanel" style="margin-top:13px"><p>${esc(d.desc)}</p>
        <div class="kv"><div><span>Economia</span><strong>${Math.round(ds.econ * 100)}%</strong></div><div><span>Vigilância local</span><strong>${ds.vigil}</strong></div><div><span>Recompensas</span><strong>${signed(d.bonus)}%</strong></div><div><span>Risco base</span><strong>${signed(d.risk)}</strong></div><div><span>Tributo se liderar</span><strong>${fmt(SB.tribute(s, d.id))}/dia</strong></div><div><span>Oportunidade</span><strong>${special ? esc(special.name) : '—'}</strong></div></div>
        <p class="mini" style="margin-top:9px">Vantagem de liderar: ${esc(d.advantage)} Cada bairro liderado também gera +2 de vigilância por dia e atrai as facções.</p></section>
      <div class="section"><h2>Mapa da cidade</h2><small>Viagem: ${fmt(SB.travelCost(s).cash)}${SB.travelCost(s).energy ? ' e ' + SB.travelCost(s).energy + ' energia' : ''}</small></div>
      <div class="grid two">${SB.DISTRICTS.map(x => districtCard(x)).join('')}</div>
      <div class="section"><h2>Poder na cidade</h2><small>Simulado: você contra as facções</small></div>
      <section class="card">${SB.seasonRanking(s).map((r, i) => `<div class="rankRow ${r.player ? 'me' : ''}"><strong>${i + 1}. ${esc(r.name)}</strong><span>${num(r.power)}</span></div>`).join('')}<p class="mini" style="margin-top:6px">Soma da influência/presença nos bairros, +30 por bairro liderado.</p></section>
      <p class="quiet" style="margin-top:15px">Bairros, grupos e personagens são inventados e não representam comunidades reais.</p>`;
  }
  function districtCard(x) {
    const s = state, l = SB.leader(s, x.id), here = x.id === s.district, ds = s.dstate[x.id];
    const evs = SB.activeEvents(s).filter(e => e.district === x.id);
    return `<section class="card district ${here ? 'selected' : ''}"><div class="miniScene">${scene(x.id)}${plate(x.name)}${here ? '<span class="pill here">Você está aqui</span>' : SB.controlled(s, x.id) ? '<span class="pill here">Você lidera</span>' : ''}</div>
      <div class="kv"><div><span>Líder</span><strong>${SB.controlled(s, x.id) ? 'Você' : esc(F(l.id).short) + ' ' + l.value}</strong></div><div><span>Sua influência</span><strong>${s.influence[x.id]}</strong></div><div><span>Economia</span><strong>${Math.round(ds.econ * 100)}%</strong></div><div><span>Vigilância</span><strong>${ds.vigil}</strong></div></div>
      ${evs.length ? `<div class="chips">${evs.map(e => `<span class="chip warn">${esc(SB.eventTitle(e))}</span>`).join('')}</div>` : ''}
      <div class="statusbar"><span class="mini">${esc(x.advantage)}</span>${here ? '' : button('Viajar', 'travel', `data-id="${x.id}"`, s.cash < SB.travelCost(s).cash || s.energy < SB.travelCost(s).energy || s.jail > 0, 'small')}</div></section>`;
  }

  function management() {
    const s = state, fee = SB.hasPerk(s, 'empreendedor', 1) ? 1 : 3;
    return heading('Banco e negócios', 'Proteja seu dinheiro e monte renda diária. Cada negócio depende da economia e das facções do bairro.') + jailNotice() + resultCard() + `
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
    const s = state, owned = s.businesses.includes(b.id), cost = SB.buyCost(s, b), today = SB.businessIncome(s, b);
    return `<section class="card"><div class="space"><h3>${esc(b.name)}</h3>${owned ? '<span class="pill">Seu</span>' : ''}</div><p>${esc(b.desc)}</p>
      <table class="table"><tbody><tr><td>Bairro</td><td>${esc(D(b.district).name)}</td></tr><tr><td>Compra</td><td>${fmt(cost)}</td></tr><tr><td>Base / dia</td><td>${fmt(b.net)}</td></tr><tr><td>Renda estimada hoje</td><td class="positive">${fmt(today)}</td></tr><tr><td>Revenda</td><td>${fmt(b.cost * SB.RESALE)}</td></tr></tbody></table>
      ${s.extorted[b.id] === s.day ? '<p class="negative mini">Sob extorsão hoje: renda reduzida.</p>' : ''}
      ${owned ? button('Vender negócio', 'sell', `data-id="${b.id}"`, s.jail > 0, 'block ghost small') : button(`Comprar · +${b.respect} respeito`, 'buy', `data-id="${b.id}"`, s.cash < cost || s.jail > 0, 'block primary')}</section>`;
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
      <section class="card"><h2>Operações do grupo</h2><p>Uma por dia, no bairro atual. Rende conforme a economia local e atrai vigilância. Chance depende de sede, integrantes, funções, ânimo e vigilância.</p>
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
    return heading('Gangue e facções', 'Negocie, fortaleça sua equipe ou enfrente os grupos rivais simulados.') + jailNotice() + resultCard() + top +
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
    return `<section class="card rivalCard dossier"><div class="dossierHead">${emblem(f.id)}<div><h3>${esc(f.name)}</h3><div class="eyebrow">${esc(f.persona.label)} • ${lead.length ? 'lidera ' + esc(lead.join(', ')) : 'sem bairro liderado'}</div></div><span class="pill">${esc(SB.factionStatus(s, f.id))}</span></div><p>${esc(f.desc)}</p>
      <div class="rivalMetrics"><div><span>Relação</span><strong>${signed(r.relation)}</strong></div><div><span>Tensão</span><strong>${r.tension}/100</strong></div><div><span>Força</span><strong>${r.power}</strong></div></div>
      ${r.lastMove ? `<p class="mini"><strong>Último movimento:</strong> ${esc(r.lastMove)}</p>` : ''}${r.grudge >= 3 ? `<p class="negative mini">Rancor alto (${r.grudge}): pode virar rival histórico.</p>` : ''}
      <div class="btnbar">${btns.join('')}</div><p class="mini">${esc(hint)}</p></section>`;
  }

  function seasons() {
    const s = state, sc = SB.seasonScore(s);
    return heading('Temporada', 'Trinta dias de decisões. Vença por fortuna, fama, território, diplomacia, gangue ou comércio.') + resultCard() + `<div class="seasonObjective">${goalCard()}</div>
      <div class="grid two"><section class="card"><div class="eyebrow">Temporada atual</div><div class="seasonnumber">${String(s.season).padStart(2, '0')}</div><div class="meter"><div style="width:${s.day / MAXDAY * 100}%"></div></div>
        <div class="statusbar"><span>Dia ${s.day} de ${MAXDAY}</span><strong>${MAXDAY - s.day} dia(s) restante(s)</strong></div><p class="mini">Cada temporada tem 30 dias jogáveis (29 viradas). A renda entra ao virar o dia; o dia 30 é o último para agir.</p><div class="divider"></div>
        ${s.day === MAXDAY ? button('Encerrar temporada', 'end-season', '', false, 'primary block') : nextDayButton('block')}</section>
      <section class="card"><h2>Pontuação parcial: ${sc.score}</h2><p>Título atual: <strong>${esc(sc.title)}</strong>. Medalhas valem legado (até ${fmt(800)}) e prestígio.</p>
        ${sc.cats.map(c => { const cat = SB.CATEGORIES.find(x => x.id === c.id); const next = cat.tiers[c.medal]; return `<div class="catRow"><div class="space"><span><strong>${c.name}</strong> <span class="mini" style="display:inline">${cat.unit === 'money' ? fmt(c.value) : num(c.value)}</span></span><span class="medal m${c.medal}">${SB.MEDALS[c.medal]}</span></div><div class="meter green"><div style="width:${pct(c.pct)}%"></div></div><span class="mini">${esc(cat.desc)}${next ? ` Próxima: ${cat.unit === 'money' ? fmt(next) : num(next)}.` : ''}</span></div>`; }).join('')}</section></div>
      <div class="section"><h2>Conquistas</h2><small>${Object.keys(s.achievements).length}/${SB.ACHIEVEMENTS.length} · permanentes</small></div>
      <section class="card"><div class="achGrid">${SB.ACHIEVEMENTS.map(a => `<div class="ach ${s.achievements[a.id] ? 'on' : ''}"><strong>${s.achievements[a.id] ? '✓ ' : ''}${esc(a.name)}</strong><span>${esc(a.desc)}${s.achievements[a.id] ? ` (T${s.achievements[a.id]})` : ''}</span></div>`).join('')}</div></section>
      <div class="section"><h2>Histórico</h2><small>${s.goalWins} meta(s) cumprida(s) · prestígio ${s.prestige}</small></div>
      <section class="card">${s.seasonHistory.length ? `<table class="table"><thead><tr><th>Temp.</th><th>Resultado</th><th>Patrimônio</th></tr></thead><tbody>${s.seasonHistory.slice(-10).reverse().map(h => `<tr><td>${num(h.season)}</td><td>${h.title ? esc(h.title) + ' · ' + num(h.score) + ' pts' : num(h.respect) + ' respeito'}${h.medals ? `<div class="mini">${SB.CATEGORIES.filter(c => h.medals[c.id]).map(c => c.name + ' ' + SB.MEDALS[h.medals[c.id]]).join(' · ') || 'Sem medalhas'}</div>` : ''}</td><td>${fmt(h.money)}${h.goal ? `<div class="mini">${h.goalComplete ? 'Meta cumprida' : 'Meta não cumprida'}</div>` : ''}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Nenhuma temporada encerrada ainda.</div>'}
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
  function goalCard() {
    const s = state;
    if (!s.goal) {
      if (s.day > 5) return `<section class="card"><h2>Meta da temporada</h2><p>Você não escolheu uma meta nos primeiros cinco dias. Poderá escolher na próxima temporada.</p></section>`;
      return `<section class="card choiceCard"><h2>Escolha a meta da temporada</h2><p>Até o dia 5. Cumprir a meta garante ${fmt(600)} na próxima temporada e +40 pontos.</p><div class="choiceGrid">${SB.GOALS.map(g => `<article><strong>${g.name}</strong><p>${esc(g.desc)}</p>${button('Escolher meta', 'goal', `data-id="${g.id}"`, false, 'small block')}</article>`).join('')}</div></section>`;
    }
    const g = SB.GOALS.find(x => x.id === s.goal), p = SB.goalProgress(s, s.goal), value = p.unit === 'money' ? fmt(p.value) : `${Math.round(p.value)}%`;
    return `<section class="card"><div class="space"><div><div class="eyebrow">Sua meta</div><h2>${g.name}</h2></div><span class="pill">${s.goalDone ? 'Cumprida' : 'Em andamento'}</span></div><p>${esc(g.desc)}</p><div class="meter green"><div style="width:${s.goalDone ? 100 : pct(p.value / p.max * 100)}%"></div></div><div class="statusbar"><span>Progresso: ${s.goalDone ? 'concluído' : value}</span><strong>${s.goalDone ? 'Bônus garantido' : 'Bônus: ' + fmt(600)}</strong></div></section>`;
  }

  /* ---------- v0.7: Cidade, Feira do Rolo, Galpão, Vida noturna e Perfil ---------- */
  const PLACE_ICON = {
    cidade: `<path d="M4 20V9l5-3v14M9 20V4l6 3v13M15 20v-8l5 2v6M2 20h20"/>`,
    gestao: `<path d="M3 9l9-5 9 5M5 9v9M9 9v9M15 9v9M19 9v9M3 20h18"/>`,
    feira: `<path d="M3 9l2-5h14l2 5M4 9v11h16V9M3 9c0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0M9 20v-6h6v6"/>`,
    galpao: `<path d="M3 20V9l9-5 9 5v11M7 20v-7h10v7M7 16h10M10 13v7M14 13v7"/>`,
    noite: `<path d="M8 3h8l-1 7a3 3 0 0 1-6 0zM12 13v7M8 20h8M17 4l3-1M18 7h3"/>`,
    temporada: `<path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4c0 3 1.500 4.500 3.500 4.500M17 6h3c0 3-1.500 4.500-3.500 4.500M12 14v4M8 20h8"/>`.replace(/\.500/g, '.5')
  };
  const place = (v, name, info, badge = '') => `<button type="button" class="place p-${v}" data-view="${v}"><span class="placeArt"><svg viewBox="0 0 24 24" aria-hidden="true">${PLACE_ICON[v]}</svg></span><b>${name}</b><small>${info}</small>${badge ? `<i class="placeBadge">${badge}</i>` : ''}</button>`;
  function hub() {
    const s = state, deal = s.exportDeal, g = SB.good(deal.good), w = SB.item(s.gear.arma), v = SB.item(s.gear.veiculo);
    return heading('Cidade', `${esc(s.city)}. Escolha aonde ir; você está em ${esc(D().name)}.`) + jailNotice() + resultCard() + localeStrip(false) + `<div class="places">
      ${place('cidade', 'Bairros', `${SB.controls(s).length}/5 liderados · viajar, contatos e disputas`)}
      ${place('galpao', 'Galpão', `Carga ${SB.cargoUsed(s)}/${SB.cargoCap(s)} · mercadoria e produção`, deal.day >= s.day ? (deal.day === s.day ? 'Comprador hoje' : `Comprador dia ${deal.day}`) : '')}
      ${place('feira', 'Feira do Rolo', `${w ? esc(w.name) : 'Sem arma'} · ${v ? esc(v.name) : 'a pé'}`)}
      ${place('noite', 'Vida noturna', `Saídas hoje ${s.today.night}/2${s.ressaca ? ' · ressaca ' + s.ressaca : ''}`)}
      ${place('gestao', 'Banco e negócios', `${fmt(s.bank)} guardados · ${s.businesses.length} negócio(s)`)}
      ${place('temporada', 'Temporada', `Dia ${s.day}/${MAXDAY} · ${num(SB.seasonScore(s).score)} pts`)}
    </div><p class="quiet" style="margin-top:12px">Treinos e serviços ficam na aba Serviços. Sua ficha, na aba Perfil. ${esc(g.name)} é o que o comprador de fora quer no dia ${deal.day}.</p>`;
  }
  function itemEffect(it) {
    if (it.slot === 'arma') return `Poder ${it.power}: confrontos +${it.power}, operações +${Math.round(it.power * .6)}, serviços de Força +${Math.round(it.power * .5)}${it.power >= 7 ? ' · arma de fogo: +1 dia se for detido' : ''}`;
    if (it.slot === 'protecao') return `Defesa ${it.def}: chance de detenção -${it.def}`;
    return `Carga +${it.cargo} · fuga ${it.escape} (detenção e blitz)${it.freeRide ? ' · viagem sem gastar energia' : ''}`;
  }
  function feira() {
    const s = state;
    return heading('Feira do Rolo', 'Tudo tem dono novo aqui. Um item por espaço; o antigo volta por metade do preço.') + jailNotice() + resultCard() +
      SB.SLOTS.map(sl => { const cur = SB.item(s.gear[sl.id]), back = cur ? Math.round(cur.cost * SB.ITEM_RESALE) : 0;
        return stencil(sl.name, cur ? 'em uso: ' + esc(cur.name) : 'nada equipado') + `<div class="grid">` + SB.ITEMS.filter(i => i.slot === sl.id).map(it => { const mine = s.gear[sl.id] === it.id, net = it.cost - back, locked = s.respect < it.unlock;
          return `<section class="card shopRow ${mine ? 'mine' : ''} ${locked ? 'locked' : ''}"><div><h3>${esc(it.name)}${mine ? ' <span class="pill">Em uso</span>' : ''}</h3><p class="mini">${esc(itemEffect(it))}</p>${locked ? `<div class="lockline">Requer ${it.unlock} de respeito.</div>` : ''}</div>
            <div class="shopAct"><strong>${fmt(it.cost)}</strong>${cur && !mine ? `<span class="mini">na troca: ${fmt(Math.max(0, net))}</span>` : ''}${mine ? '' : button('Comprar', 'buy-item', `data-id="${it.id}"`, locked || s.cash < net || s.jail > 0, 'small primary')}</div></section>`; }).join('') + `</div>`; }).join('');
  }
  function maxBuy(g) { const s = state; let q = Math.max(0, SB.cargoCap(s) - SB.cargoUsed(s)); while (q > 0 && SB.buyTotal(s, g, q) > s.cash) q = Math.floor(q * .9) - (q < 10 ? 1 : 0); return Math.max(0, q); }
  function galpao() {
    const s = state, deal = s.exportDeal, dg = SB.good(deal.good), used = SB.cargoUsed(s), cap = SB.cargoCap(s), open = SB.exportOpen(s), blitz = SB.blitzChance(s);
    const dealTxt = deal.day < s.day ? 'O próximo comprador ainda não deu notícia.' : `${deal.day === s.day ? 'Hoje' : 'No dia ' + deal.day}, em ${esc(D('cais').name)}: paga ${fmt(SB.exportPrice(dg))} por ${esc(dg.unit)} de ${esc(dg.name)} (até ${SB.EXPORT_LIMIT}). Você tem ${s.goods[dg.id]}.`;
    return heading('Galpão', 'Compre barato num bairro, venda caro em outro, produza o seu e despache para fora.') + jailNotice() + resultCard() + `
      <section class="card"><div class="meterlabel"><span>Carga</span><strong>${used}/${cap}</strong></div><div class="meter"><div style="width:${pct(used / cap * 100)}%"></div></div>
        <p class="mini" style="margin-top:7px">Veículos e pontos de produção aumentam o espaço. ${blitz ? `<span class="negative">Viajar com esta carga: ${blitz}% de chance de blitz (perde metade).</span>` : 'Sem carga, sem blitz.'}</p></section>
      <section class="poster" style="margin-top:10px"><div class="posterHead">COMPRADOR DE FORA</div><p>${dealTxt}</p>${open ? button(`Entregar ${Math.min(SB.EXPORT_LIMIT, s.goods[dg.id])} × ${esc(dg.name)}`, 'export-goods', '', s.goods[dg.id] < 1 || s.exportDone === s.day || s.jail > 0, 'small block') : ''}</section>
      ${stencil('Mercadorias', 'preço em ' + esc(D().name))}<div class="grid">${SB.GOODS.map(g => { const locked = s.respect < g.unlock, f = s.market[s.district][g.id], own = s.goods[g.id], mb = locked ? 0 : maxBuy(g);
        const best = SB.DISTRICTS.reduce((a, d) => SB.goodSellPrice(s, g, d.id) > SB.goodSellPrice(s, g, a.id) ? d : a, SB.DISTRICTS[0]);
        const off = s.jail > 0 || s.energy < 3;
        return `<section class="card goodRow ${locked ? 'locked' : ''}"><div class="space"><h3>${esc(g.name)} <span class="chip ${f <= 90 ? 'up' : f >= 112 ? 'down' : ''}">${f <= 90 ? 'barato' : f >= 112 ? 'caro' : 'normal'} ${f}%</span></h3><strong>${own} un.</strong></div>
          <p class="mini">Compra ${fmt(SB.goodPrice(s, g))} · venda ${fmt(SB.goodSellPrice(s, g))} por ${esc(g.unit)} · risco ${'●'.repeat(g.risk)}${'○'.repeat(4 - g.risk)} · melhor venda hoje: ${esc(best.name)} (${fmt(SB.goodSellPrice(s, g, best.id))})</p>
          ${locked ? `<div class="lockline">Requer ${g.unlock} de respeito.</div>` : `<div class="tradeBtns">${button(`+5 · ${fmt(SB.buyTotal(s, g, 5))}`, 'buy-good', `data-id="${g.id}" data-qty="5"`, off || mb < 5, 'small')}${button(`+${mb} (máx.)`, 'buy-good', `data-id="${g.id}" data-qty="${mb}"`, off || mb < 1, 'small')}${button(`−5 · ${fmt(SB.sellTotal(s, g, Math.min(5, Math.max(1, own))))}`, 'sell-good', `data-id="${g.id}" data-qty="${Math.min(5, own)}"`, off || own < 1, 'small primary')}${button(`Vender tudo${own ? ' · ' + fmt(SB.sellTotal(s, g, own)) : ''}`, 'sell-good', `data-id="${g.id}" data-qty="${own}"`, off || own < 1, 'small primary')}</div>`}</section>`; }).join('')}</div>
      <p class="mini" style="margin-top:6px">Cada negócio gasta 3 de energia. Comprar muito encarece e vender muito derruba o preço local. Vender na área de outro grupo gera atrito.</p>
      ${stencil('Produção própria', `batida hoje: ${SB.raidChance(s)}% por ponto`)}<div class="grid">${SB.LABS.map(l => { const lvl = s.labs[l.id], c = SB.labCost(s, l), locked = s.respect < l.unlock, down = s.labDown[l.id] >= s.day, g = SB.good(l.good);
        return `<section class="card shopRow ${locked ? 'locked' : ''}"><div><h3>${esc(l.name)} <span class="pill">Nível ${lvl}/3</span></h3><p class="mini">${lvl ? `Rende ${SB.labOutput(s, l)} × ${esc(g.name)} por dia · custo ${fmt(lvl * 30)}/dia · +40 de espaço` : `Produz ${l.out} × ${esc(g.name)} por dia e dá +40 de espaço`}${down ? ` · <span class="negative">fechado até o dia ${s.labDown[l.id]}</span>` : ''}</p>${locked ? `<div class="lockline">Requer ${l.unlock} de respeito.</div>` : ''}</div>
          <div class="shopAct">${lvl >= 3 ? '<strong>Máximo</strong>' : `<strong>${fmt(c)}</strong>${button(lvl ? 'Ampliar' : 'Montar', 'build-lab', `data-id="${l.id}"`, locked || s.cash < c || s.jail > 0, 'small primary')}`}</div></section>`; }).join('')}</div>
      <p class="mini" style="margin-top:6px">Com vigilância acima de 40, a polícia pode estourar um ponto: perde o estoque daquela mercadoria e fica 2 dias fechado.</p>`;
  }
  function noite() {
    const s = state;
    return heading('Vida noturna', 'Dinheiro vira energia para agir mais hoje. A conta chega amanhã, na ressaca.') + jailNotice() + resultCard() + `
      <section class="card"><div class="kv"><div><span>Saídas hoje</span><strong>${s.today.night}/2</strong></div><div><span>Ressaca amanhã</span><strong>-${s.ressaca} de energia</strong></div></div></section>
      <div class="grid" style="margin-top:10px">${SB.NIGHT.map(n => { const c = SB.nightCost(s, n);
        return `<section class="card shopRow"><div><h3>${esc(n.id === 'baile' ? SB.mission('baile').name.replace('Bastidores d', 'Noite d') : n.name)}</h3><p class="mini">${esc(n.desc)}</p><p class="mini"><strong>+${n.energy} de energia</strong> · ressaca -${n.ressaca}${n.morale ? ` · equipe +${n.morale} de ânimo` : ''}${n.heat ? ` · +${n.heat} de vigilância` : ''}${n.mingle ? ' · chance de contatos ou de confusão' : ''}</p></div>
          <div class="shopAct"><strong>${fmt(c)}</strong>${button('Ir', 'night', `data-id="${n.id}"`, s.cash < c || s.today.night >= 2 || s.energy >= 100 || s.jail > 0, 'small primary')}</div></section>`; }).join('')}</div>
      <p class="mini" style="margin-top:6px">A segunda saída do dia custa 50% a mais.</p>`;
  }
  function perfil() {
    const s = state, sc = SB.seasonScore(s), lvl = Math.min(99, Math.floor(s.respect / 35) + 1), c = s.career ? SB.CAREERS.find(x => x.id === s.career) : null;
    const top = Math.max(20, ...SB.STATS.map(st => s.stats[st.id]));
    return heading('Perfil', 'Sua ficha no submundo.') + resultCard() + `
      <section class="sheet"><span class="sheetAvatar">${avatar(s.career)}</span><div><h2>${esc(s.name)}</h2><p>${esc(sc.title)} · nível ${lvl}</p><p class="mini">${esc(s.city)}${c ? ' · ' + c.name + ' ' + SB.careerLevel(s) + '/3' : ''}${s.gangName ? ' · ' + esc(s.gangName) : ''}${s.prestige ? ' · prestígio ' + s.prestige : ''}</p></div></section>
      ${stencil('Atributos')}<section class="card">${SB.STATS.map(st => `<div class="statRow">${statIcon(st.id)}<span>${st.name}</span><div class="meter"><div style="width:${pct(s.stats[st.id] / top * 100)}%"></div></div><strong>${num(s.stats[st.id])}</strong></div>`).join('')}</section>
      ${stencil('Equipamento', 'troque na Feira do Rolo')}<div class="gearGrid">${SB.SLOTS.map(sl => { const it = SB.item(s.gear[sl.id]); return `<button type="button" class="gearSlot ${it ? 'on' : ''}" data-view="feira"><span>${sl.name}</span><b>${it ? esc(it.name) : '—'}</b><small>${it ? esc(it.slot === 'arma' ? 'poder ' + it.power : it.slot === 'protecao' ? 'defesa ' + it.def : 'carga +' + it.cargo) : 'vazio'}</small></button>`; }).join('')}</div>
      ${stencil('Nesta temporada')}<section class="card"><div class="kv"><div><span>Respeito</span><strong>${num(s.respect)}</strong></div><div><span>Patrimônio</span><strong>${fmt(SB.patrimony(s))}</strong></div><div><span>Serviços</span><strong>${num(s.successful)} certos · ${num(s.failed)} falhos</strong></div><div><span>Detenções</span><strong>${s.seasonStats.arrests}</strong></div><div><span>Mercadoria vendida</span><strong>${fmt(s.trade.sold)}</strong></div><div><span>Remessas / blitze</span><strong>${num(s.trade.exported)} un. · ${s.trade.blitz}</strong></div><div><span>Bairros liderados</span><strong>${SB.controls(s).length}/5</strong></div><div><span>Conquistas</span><strong>${Object.keys(s.achievements).length}/${SB.ACHIEVEMENTS.length}</strong></div></div></section>
      <div class="btnbar" style="margin-top:12px">${button('Temporada, medalhas e conquistas', 'switch', 'data-target="temporada"', false, 'primary')}${button('Como jogar', 'help', '', false, 'ghost')}</div>`;
  }

  /* ---------- renderização ---------- */
  function render() {
    if (!state) return;
    SB.applyCity(state.city);
    const pages = { painel: panel, acoes: actions, hub, cidade: city, gestao: management, feira, galpao, noite, gangue: gang, perfil, temporada: seasons };
    try {
      $('#content').innerHTML = (pages[view] || panel)() + `<div class="footer">SUBMUNDO BRASIL • v${SB.VERSION} • Cidades reais, bairros e grupos fictícios • Jogo local, sem multiplayer, pagamentos ou conexão externa.</div>`;
    } catch (e) {
      console.error(e);
      $('#content').innerHTML = `<div class="errorBox"><h2>Algo deu errado nesta tela.</h2><p>Seu progresso continua salvo. Exporte uma cópia por segurança e volte ao início.</p><div class="btnbar">${button('Exportar carreira', 'export', '', false, 'small')}${button('Voltar ao início', 'switch', 'data-target="painel"', false, 'small primary')}</div><p class="mini">${esc(e.message)}</p></div>`;
    }
    renderHud();
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
      case 'dismiss-result': result = null; render(); break;
      case 'buy-item': run('buyItem', id); break;
      case 'buy-good': run('buyGood', id, Number(btn.dataset.qty)); break;
      case 'sell-good': run('sellGood', id, Number(btn.dataset.qty)); break;
      case 'export-goods': run('exportGoods'); break;
      case 'build-lab': run('buildLab', id); break;
      case 'night': run('night', id); break;
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
      case 'career': if (confirm('A especialização vale para toda a temporada. Confirmar?')) run('career', id); break;
      case 'goal': run('goal', id); break;
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
      case 'end-season': { const sc = SB.seasonScore(state); if (confirm(`Encerrar a temporada ${state.season}?\n\nTítulo: ${sc.title} (${sc.score} pts)\n${sc.cats.map(c => c.name + ': ' + SB.MEDALS[c.medal]).join('\n')}\n\nVocê começará uma nova carreira; conquistas, recordes e histórico são mantidos.`)) { run('endSeason'); view = 'temporada'; render(); } break; }
      case 'export': exportSave(); break;
      case 'import': $('#importFile') && $('#importFile').click(); break;
      case 'download-backup': try { const raw = localStorage.getItem(id); if (raw) download(id + '.json', raw); } catch (err) { notify('Não foi possível ler a cópia.', true); } break;
      case 'reset': reset(); break;
    }
  });
  document.addEventListener('change', e => { if (e.target.id === 'importFile') importFile(e.target.files && e.target.files[0], false); if (e.target.id === 'welcomeImportFile') importFile(e.target.files && e.target.files[0], true); });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'bankAmount') { e.preventDefault(); run('bank', 'deposit', Number(e.target.value)); } });
  $('#menuToggle').addEventListener('click', () => { const open = $('#sidebar').classList.toggle('open'); $('#menuToggle').setAttribute('aria-expanded', String(open)); });
  $('#welcomeImport').addEventListener('click', () => $('#welcomeImportFile').click());
  $('#newGameForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#playerName').value.trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 22) return notify('Escolha um codinome entre 2 e 22 caracteres.', true);
    state = SB.defaultState(name, $('#homeCity').value); view = 'painel'; result = null;
    $('#welcome').classList.add('hidden'); document.body.classList.remove('atCover'); save(); render(); openHelp(0);
  });
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
  function paintCover() {
    const c = SB.cityOf($('#homeCity').value);
    $('#coverArt').innerHTML = scene('centro', false, c.name);
    $('#cityTrait').innerHTML = `<strong>${esc(c.trait)}:</strong> ${esc(c.traitDesc)}`;
  }
  $('#homeCity').addEventListener('change', paintCover);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#help').classList.contains('hidden')) closeHelp(); });
  function showWelcome() {
    const box = $('#welcomeNotice');
    box.innerHTML = corrupt ? `<div class="notice error"><strong>Não foi possível ler o salvamento encontrado.</strong> ${esc(corrupt.reason)} Uma cópia foi guardada e não será apagada. <button type="button" class="btn small ghost" id="dlCorrupt" style="margin-top:6px">Baixar cópia</button></div>` : '';
    const dl = $('#dlCorrupt'); if (dl) dl.addEventListener('click', () => download('submundo-salvamento-ilegivel.json', corrupt.raw));
    paintCover();
    document.body.classList.add('atCover');
    $('#welcome').classList.remove('hidden'); $('#playerName').focus();
  }

  state = load();
  if (state) { save(); render(); } else showWelcome();
  window.__SB_UI = { get state() { return state; }, go: switchView }; // apoio a testes automatizados
})();
