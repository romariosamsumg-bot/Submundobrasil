/* =====================================================================
 * SUBMUNDO BRASIL — INTERFACE v0.5
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
  const VIEWS = ['painel', 'acoes', 'cidade', 'gestao', 'gangue', 'temporada'];
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
    download(`submundo-brasil-v0.5-t${state.season}-d${state.day}.json`, JSON.stringify(SB.exportPayload(state), null, 2));
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
    $('#welcome').classList.add('hidden');
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
    } else result = { good: r.good, msg: r.msg, lines: r.lines || [], deltas: deltas(before, snap()) };
    notify(r.msg, !r.good);
    save(); render();
    return r;
  }

  /* ---------- componentes ---------- */
  function heading(label, desc, extra = '') {
    return `<div class="pagehead"><div><div class="eyebrow">Temporada ${state.season} • Dia ${state.day} de ${MAXDAY}</div><h1>${label}</h1><p>${desc}</p></div>${extra}</div>`;
  }
  function resultCard() {
    if (!result) return '';
    return `<section class="resultCard ${result.good ? '' : 'bad'}" aria-live="polite"><div class="rhead"><strong>${esc(result.msg)}</strong><button type="button" class="close" data-action="dismiss-result" aria-label="Fechar resultado">×</button></div>
      ${result.deltas.length ? `<div class="chips">${result.deltas.map(d => `<span class="chip ${d.good ? 'up' : 'down'}">${d.label} ${d.text}</span>`).join('')}</div>` : ''}
      ${result.lines.length ? `<ul>${result.lines.slice(0, 10).map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}</section>`;
  }
  function jailNotice() {
    if (state.jail <= 0) return '';
    const c = SB.bailCost(state);
    return `<div class="notice error"><strong>Você está detido.</strong> Faltam ${state.jail} dia(s). Missões, treinos, viagens e negócios ficam bloqueados; o banco continua disponível.
      <div class="inlineBtns">${button(`Pagar fiança · ${fmt(c)}`, 'bail', '', state.cash < c, 'small danger')}${nextDayButton('small')}</div></div>`;
  }
  function nextDayButton(cls = '') {
    if (state.day >= MAXDAY) return button('Encerrar temporada', 'switch', 'data-target="temporada"', false, 'primary ' + cls);
    return button(armedNext ? `Confirmar? Restam ${state.energy} de energia` : 'Avançar dia', 'next-day', '', false, (armedNext ? 'armed ' : 'primary ') + cls);
  }
  function eventChips() {
    return SB.activeEvents(state).map(e => `<li><strong>${esc(SB.eventTitle(e))}</strong>${e.until > state.day ? ` · até o dia ${e.until}` : ''}<br>${esc(e.def.desc)}</li>`).join('');
  }
  const statName = id => SB.STATS.find(s => s.id === id).name;
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

  /* ---------- telas ---------- */
  function panel() {
    const s = state, level = Math.min(99, Math.floor(s.respect / 35) + 1);
    const standing = s.respect < 30 ? 'Desconhecido' : s.respect < 85 ? 'Nome em ascensão' : s.respect < 180 ? 'Figura conhecida' : 'Lenda da cidade';
    const m = suggestion();
    const l = SB.leader(s, s.district);
    return jailNotice() + `
      <section class="cityHero" aria-label="Personagem e reputação">
        <div><div class="heroLabel">Temporada ${s.season} · Dia ${s.day} de ${MAXDAY}</div>
          <h1>${esc(s.name)}</h1><p>${esc(s.city)} / ${esc(D().name)}</p>
          <div class="heroMeta"><span>${standing}</span><span>Nível ${level}</span>${s.career ? `<span>${SB.CAREERS.find(c => c.id === s.career).name} ${SB.careerLevel(s)}/3</span>` : ''}${s.prestige ? `<span>Prestígio ${s.prestige}</span>` : ''}</div>
        </div><div class="heroReputation"><strong>${num(s.respect)}</strong><small>Respeito</small></div>
      </section>
      <div class="commandHud">
        <div class="hudItem"><span>Em mãos</span><strong>${fmt(s.cash)}</strong><small>Banco ${fmt(s.bank)}</small></div>
        <div class="hudItem"><span>Energia</span><strong class="good">${s.energy}<small style="display:inline;font-size:12px">/100</small></strong><small>${s.jail > 0 ? 'Detido por ' + s.jail + ' dia(s)' : '+70 ao amanhecer'}</small></div>
        <div class="hudItem"><span>Vigilância</span><strong class="${s.heat > 50 ? 'heat' : ''}">${s.heat}<small style="display:inline;font-size:12px">/100</small></strong><small>Local ${s.dstate[s.district].vigil}</small></div>
      </div>
      <div class="statusStrip"><div class="statusBar"><div class="meterlabel"><span>Dia ${s.day}/${MAXDAY} · energia</span><strong>${s.energy}%</strong></div><div class="meter green"><div style="width:${s.energy}%"></div></div></div>${nextDayButton('small')}</div>
      ${resultCard()}${careerCard()}${goalSummary()}${newsCard()}
      <div class="boardGrid">
        <section class="boardLead"><div class="eyebrow">Sugestão para agora</div>
          <h2>${m ? esc(m.name) : 'Recupere-se ou mude de bairro'}</h2>
          <p>${m ? esc(m.desc) : 'Nenhuma missão com boa chance agora. Treine, reduza a vigilância, viaje ou avance o dia.'}</p>
          ${m ? `<div class="boardMetrics"><div class="metric"><span>Chance</span><strong>${SB.missionChance(s, m)}%</strong></div><div class="metric"><span>Ganhos</span><strong>${fmt(m.low * SB.missionRewardMult(s, m))}+</strong></div><div class="metric"><span>Energia</span><strong>${m.cost}</strong></div></div>
          ${button('Executar missão', 'mission', `data-id="${m.id}"`, false, 'primary')}` : button('Ver missões', 'switch', 'data-target="acoes"', false, 'primary')}
        </section>
        <section class="cityBulletin"><div class="eyebrow">Boletim da cidade</div><ul class="eventList">${eventChips()}</ul>
          <div class="bulletinFoot">Renda prevista amanhã<strong>${fmt(SB.income(s) + SB.controls(s).reduce((t, d) => t + SB.tribute(s, d.id), 0) - SB.groupUpkeep(s))} / dia</strong></div>
          <div class="bulletinFoot">${esc(D().name)}<strong>Você ${s.influence[s.district]} · ${esc(F(l.id).short)} ${l.value}${SB.controlled(s, s.district) ? ' · você lidera' : ''}</strong></div></section>
      </div>
      <div class="commandHeader"><h2>Escolha seu caminho</h2><small>Atalhos</small></div>
      <div class="commandGrid">
        <button class="commandLink" type="button" data-view="acoes"><div><span>Missões e treinos</span><small>${SB.MISSIONS.filter(x => !SB.missionLock(s, x)).length} disponíveis aqui</small></div><b aria-hidden="true">01</b></button>
        <button class="commandLink" type="button" data-view="cidade"><div><span>Bairros</span><small>${SB.controls(s).length} liderado(s)</small></div><b aria-hidden="true">02</b></button>
        <button class="commandLink" type="button" data-view="gestao"><div><span>Banco e negócios</span><small>${s.businesses.length} negócio(s)</small></div><b aria-hidden="true">03</b></button>
        <button class="commandLink" type="button" data-view="gangue"><div><span>Gangue e facções</span><small>${s.gangName ? esc(s.gangName) + ' · ânimo ' + s.crewMorale : 'Fundar com 30 de respeito'}</small></div><b aria-hidden="true">04</b></button>
      </div>
      <div class="recentFeed"><div class="commandHeader"><h2>Últimos acontecimentos</h2><small>Registro</small></div><section class="card">${journal(3)}</section></div>`;
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
    return `<section class="card choiceCard"><div class="eyebrow">Decisão da cidade · Dia ${state.day}</div><h2>${esc(n.name)}${f ? ' · ' + esc(f.short) : ''}</h2><p>${esc(n.desc)}</p>
      <div class="choiceGrid">${n.choices.map((c, i) => { const block = SB.newsChoiceBlocked(state, c); const cost = SB.newsChoiceCost(state, c); return `<article><strong>${esc(c.label)}</strong><p>${esc(c.desc)}${c.cashPerMember ? ` (total ${fmt(cost)})` : ''}${block ? `<br><span class="negative">${esc(block)}</span>` : ''}</p>${button('Tomar decisão', 'news', `data-id="${n.id}" data-choice="${i}"`, !!block, 'small block')}</article>`; }).join('')}</div>
      <div class="btnbar" style="margin-top:8px">${button('Ignorar notícia', 'skip-news', '', false, 'ghost small')}</div></section>`;
  }

  function actions() {
    const s = state, ds = s.dstate[s.district];
    const list = SB.MISSIONS.filter(m => missionFilter === 'todas' ? true : missionFilter === 'bairro' ? m.district === s.district : ['', 'Energia insuficiente.', 'Você está detido.'].includes(SB.missionLock(s, m)));
    return heading('Missões e treinamento', 'Cada missão usa um atributo. Repetir a mesma no dia e agir sempre no mesmo bairro aumenta o risco.') + jailNotice() + resultCard() + `
      <div class="grid two"><section class="card"><div class="meters"><div><div class="meterlabel"><span>Energia</span><strong>${s.energy}/100</strong></div><div class="meter green"><div style="width:${s.energy}%"></div></div></div>
        <div><div class="meterlabel"><span>Vigilância pessoal</span><strong>${s.heat}/100</strong></div><div class="meter red"><div style="width:${s.heat}%"></div></div></div>
        <div><div class="meterlabel"><span>Vigilância em ${esc(D().name)}</span><strong>${ds.vigil}/100</strong></div><div class="meter red"><div style="width:${ds.vigil}%"></div></div></div></div></section>
      <section class="card"><div class="space"><h2>Condições atuais</h2><span class="tag">${esc(D().name)}</span></div><ul class="eventList">${eventChips()}</ul>
        <div class="kv"><div><span>Economia local</span><strong>${Math.round(ds.econ * 100)}%</strong></div><div><span>Recompensa do bairro</span><strong>${signed(D().bonus)}%</strong></div></div></section></div>
      <div class="section"><h2>Missões</h2><small>Chance entre 8% e 95%</small></div>
      <div class="filterbar" role="group" aria-label="Filtrar missões">${[['disponiveis', 'Disponíveis'], ['bairro', 'Deste bairro'], ['todas', 'Todas']].map(([id, l]) => `<button type="button" class="btn ghost ${missionFilter === id ? 'on' : ''}" data-action="filter" data-id="${id}" aria-pressed="${missionFilter === id}">${l}</button>`).join('')}</div>
      <div class="grid">${list.length ? list.map(missionCard).join('') : '<div class="empty">Nenhuma missão neste filtro. Ganhe respeito, viaje ou veja “Todas”.</div>'}</div>
      ${safeJobs()}
      <div class="section"><h2>Centro de treinamento</h2><small>Treinos hoje: ${s.today.training}/3</small></div>
      <div class="grid two">${SB.STATS.map(st => { const lvl = s.stats[st.id], cost = SB.trainCost(s, st.id); return `<section class="card"><div class="space"><h3>${st.name}</h3><strong class="accent">${num(lvl)}</strong></div><p>${esc(st.desc)}</p><div class="space"><span class="mini">+${lvl < 25 ? 2 : 1} • 22 energia • ${fmt(cost)}</span>${button('Treinar', 'train', `data-id="${st.id}"`, s.jail > 0 || s.energy < 22 || s.cash < cost || s.today.training >= 3, 'small')}</div></section>`; }).join('')}</div>`;
  }
  function missionCard(m) {
    const s = state, lock = SB.missionLock(s, m), p = SB.missionChance(s, m), mult = SB.missionRewardMult(s, m), reps = s.today.missions[m.id] || 0;
    const hard = lock && lock !== 'Energia insuficiente.' && lock !== 'Você está detido.';
    return `<section class="card mission ${hard ? 'locked' : ''}"><div><h3>${esc(m.name)} <span class="pill">${statName(m.stat)}</span>${m.district ? ` <span class="pill">${esc(D(m.district).name)}</span>` : ''}</h3><p>${esc(m.desc)}</p>
      <div class="details">${m.cost} energia • ${fmt(m.low * mult)}–${fmt(m.high * mult)} • +${m.heat} vigilância • +${SB.respectGain(s, m)} respeito</div>
      <div class="details">Se falhar: -${Math.round(SB.failLoss(s, m) * 100)}% do caixa em mãos, detenção ${SB.arrestChance(s, m)}%</div>
      ${reps ? `<div class="lockline">Repetida ${reps}× hoje: chance e recompensa menores.</div>` : ''}${lock ? `<div class="lockline">${esc(lock)}</div>` : ''}</div>
      <div class="right"><span class="chance ${chanceClass(p)}">${p}% <small class="mini">sucesso</small></span>${button('Executar', 'mission', `data-id="${m.id}"`, !!lock, 'primary small')}</div></section>`;
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
    return heading('Bairros', 'Cada bairro tem economia, vigilância e facções próprias, que mudam a cada dia.') + jailNotice() + resultCard() + `
      <section class="card"><div class="space factionHeader"><div><h2>Influência em ${esc(d.name)}</h2><p>Quem lidera: <strong>${SB.controlled(s, d.id) ? 'você' : esc(lf.name)}</strong>. ${esc(SB.factionStatus(s, l.id))}. Liderar exige 60 de influência e 10 acima da maior facção.</p></div>${SB.controlled(s, d.id) ? '<span class="pill">Você lidera</span>' : ''}</div>
        <div class="dualMeters"><div><div class="meterlabel"><span>Sua influência</span><strong>${s.influence[d.id]}</strong></div><div class="meter green"><div style="width:${s.influence[d.id]}%"></div></div></div>
        <div><div class="meterlabel"><span>${esc(lf.short)} (maior facção)</span><strong>${l.value}</strong></div><div class="meter red"><div style="width:${l.value}%"></div></div></div></div>
        <div class="chips">${SB.FACTIONS.map(f => `<span class="chip">${esc(f.short)} ${s.presence[d.id][f.id]}</span>`).join('')}</div>
        <div class="btnbar" style="margin-top:12px">${button(`Criar contatos · ${fmt(cc)}`, 'contact', '', s.jail > 0 || s.cash < cc || s.energy < 22 || used >= 2, 'small primary')}${button(`Disputar área · R$ 320 (${SB.disputeOdds(s, d.id)}%)`, 'dispute', '', disputeBlock, 'small')}</div>
        <p class="mini" style="margin-top:8px">Contatos: 22 energia, até 2 por bairro ao dia (o segundo rende metade). Disputa: 33 energia, exige 20 de influência; uma ação por facção ao dia; bloqueada por acordos.${agreed ? ` Você tem acordo com ${esc(lf.short)}.` : ''}</p></section>
      <section class="brandpanel" style="margin-top:13px"><div class="eyebrow">Você está em</div><h2>${esc(d.name)}</h2><p>${esc(d.desc)}</p>
        <div class="kv"><div><span>Economia</span><strong>${Math.round(ds.econ * 100)}%</strong></div><div><span>Vigilância local</span><strong>${ds.vigil}</strong></div><div><span>Recompensas</span><strong>${signed(d.bonus)}%</strong></div><div><span>Risco base</span><strong>${signed(d.risk)}</strong></div><div><span>Tributo se liderar</span><strong>${fmt(SB.tribute(s, d.id))}/dia</strong></div><div><span>Oportunidade</span><strong>${special ? esc(special.name) : '—'}</strong></div></div>
        <p class="mini" style="margin-top:9px">Vantagem de liderar: ${esc(d.advantage)} Cada bairro liderado também gera +2 de vigilância por dia e atrai as facções.</p></section>
      <div class="section"><h2>Mapa da cidade</h2><small>Viagem: R$ 90 e 5 energia</small></div>
      <div class="grid two">${SB.DISTRICTS.map(x => districtCard(x)).join('')}</div>
      <div class="section"><h2>Poder na cidade</h2><small>Simulado: você contra as facções</small></div>
      <section class="card">${SB.seasonRanking(s).map((r, i) => `<div class="rankRow ${r.player ? 'me' : ''}"><strong>${i + 1}. ${esc(r.name)}</strong><span>${num(r.power)}</span></div>`).join('')}<p class="mini" style="margin-top:6px">Soma da influência/presença nos bairros, +30 por bairro liderado.</p></section>
      <p class="quiet" style="margin-top:15px">Bairros, grupos e personagens são inventados e não representam comunidades reais.</p>`;
  }
  function districtCard(x) {
    const s = state, l = SB.leader(s, x.id), here = x.id === s.district, ds = s.dstate[x.id];
    const evs = SB.activeEvents(s).filter(e => e.district === x.id);
    return `<section class="card district ${here ? 'selected' : ''}"><div class="space"><h3>${esc(x.name)}</h3>${here ? '<span class="pill">Você está aqui</span>' : SB.controlled(s, x.id) ? '<span class="pill">Você lidera</span>' : ''}</div>
      <div class="kv"><div><span>Líder</span><strong>${SB.controlled(s, x.id) ? 'Você' : esc(F(l.id).short) + ' ' + l.value}</strong></div><div><span>Sua influência</span><strong>${s.influence[x.id]}</strong></div><div><span>Economia</span><strong>${Math.round(ds.econ * 100)}%</strong></div><div><span>Vigilância</span><strong>${ds.vigil}</strong></div></div>
      ${evs.length ? `<div class="chips">${evs.map(e => `<span class="chip warn">${esc(SB.eventTitle(e))}</span>`).join('')}</div>` : ''}
      <div class="statusbar"><span class="mini">${esc(x.advantage)}</span>${here ? '' : button('Viajar', 'travel', `data-id="${x.id}"`, s.cash < 90 || s.energy < 5 || s.jail > 0, 'small')}</div></section>`;
  }

  function management() {
    const s = state, fee = SB.hasPerk(s, 'empreendedor', 1) ? 1 : 3;
    return heading('Banco e negócios', 'Proteja seu dinheiro e monte renda diária. Cada negócio depende da economia e das facções do bairro.') + jailNotice() + resultCard() + `
      <div class="statgrid"><div class="stat"><span>Em mãos</span><strong class="small">${fmt(s.cash)}</strong></div><div class="stat"><span>Banco</span><strong class="small">${fmt(s.bank)}</strong></div><div class="stat"><span>Respeito</span><strong>${num(s.respect)}</strong></div><div class="stat"><span>Poder total</span><strong>${num(SB.strength(s))}</strong></div></div>
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
      <div class="grid two" style="margin-top:13px"><section class="card"><h2>Equipe</h2>${s.crew.length ? s.crew.map(m => { const r = SB.ROLES.find(x => x.id === m.role); return `<div class="memberRow"><div><strong>${esc(m.name)}</strong> <span class="pill">${r.name}</span><span class="mini">Nível ${m.level}/5${m.level < 5 ? ` · XP ${m.xp}/${m.level * 4}` : ''} · ${fmt(SB.memberUpkeep(m))}/dia · ${esc(r.desc)}</span></div>${button('Dispensar', 'dismiss', `data-id="${m.id}"`, false, 'small ghost')}</div>`; }).join('') : '<div class="empty">Sem integrantes. Recrute para operar.</div>'}
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
    return `<section class="card rivalCard"><div class="space"><div><div class="eyebrow">${esc(f.persona.label)} • ${lead.length ? 'lidera ' + esc(lead.join(', ')) : 'sem bairro liderado'}</div><h3>${esc(f.name)}</h3></div><span class="pill">${esc(SB.factionStatus(s, f.id))}</span></div><p>${esc(f.desc)}</p>
      <div class="rivalMetrics"><div><span>Relação</span><strong>${signed(r.relation)}</strong></div><div><span>Tensão</span><strong>${r.tension}/100</strong></div><div><span>Força</span><strong>${r.power}</strong></div></div>
      ${r.lastMove ? `<p class="mini"><strong>Último movimento:</strong> ${esc(r.lastMove)}</p>` : ''}${r.grudge >= 3 ? `<p class="negative mini">Rancor alto (${r.grudge}): pode virar rival histórico.</p>` : ''}
      <div class="btnbar">${btns.join('')}</div><p class="mini">${esc(hint)}</p></section>`;
  }

  function seasons() {
    const s = state, sc = SB.seasonScore(s);
    return heading('Temporada', 'Trinta dias de decisões. Vença por fortuna, fama, território, diplomacia ou força da gangue.') + resultCard() + `<div class="seasonObjective">${goalCard()}</div>
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
        <div class="btnbar">${button('Exportar carreira', 'export', '', false, 'small')}${button('Importar carreira', 'import', '', false, 'small ghost')}${button('Recomeçar tudo', 'reset', '', false, 'small danger')}</div>
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

  /* ---------- renderização ---------- */
  function render() {
    if (!state) return;
    const pages = { painel: panel, acoes: actions, cidade: city, gestao: management, gangue: gang, temporada: seasons };
    try {
      $('#content').innerHTML = (pages[view] || panel)() + `<div class="footer">SUBMUNDO BRASIL • v${SB.VERSION} • Universo fictício • Jogo local, sem multiplayer, pagamentos ou conexão externa.</div>`;
    } catch (e) {
      console.error(e);
      $('#content').innerHTML = `<div class="errorBox"><h2>Algo deu errado nesta tela.</h2><p>Seu progresso continua salvo. Exporte uma cópia por segurança e volte ao início.</p><div class="btnbar">${button('Exportar carreira', 'export', '', false, 'small')}${button('Voltar ao início', 'switch', 'data-target="painel"', false, 'small primary')}</div><p class="mini">${esc(e.message)}</p></div>`;
    }
    $('#topCash').textContent = fmt(state.cash);
    $('#topDay').textContent = `Dia ${state.day}/${MAXDAY}`;
    $all('.nav button, .mobileNav button').forEach(b => { const on = b.dataset.view === view; b.classList.toggle('active', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  }
  function switchView(target) {
    if (!VIEWS.includes(target)) return;
    if (target !== view) result = null;
    view = target; disarm();
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
    $('#welcome').classList.add('hidden'); save(); render(); notify(`Bem-vindo à cidade, ${name}.`);
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
  function showWelcome() {
    const box = $('#welcomeNotice');
    box.innerHTML = corrupt ? `<div class="notice error"><strong>Não foi possível ler o salvamento encontrado.</strong> ${esc(corrupt.reason)} Uma cópia foi guardada e não será apagada. <button type="button" class="btn small ghost" id="dlCorrupt" style="margin-top:6px">Baixar cópia</button></div>` : '';
    const dl = $('#dlCorrupt'); if (dl) dl.addEventListener('click', () => download('submundo-salvamento-ilegivel.json', corrupt.raw));
    $('#welcome').classList.remove('hidden'); $('#playerName').focus();
  }

  state = load();
  if (state) { save(); render(); } else showWelcome();
  window.__SB_UI = { get state() { return state; } }; // apoio a testes automatizados
})();
