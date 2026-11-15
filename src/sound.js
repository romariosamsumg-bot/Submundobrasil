/* Sons do Submundo Brasil: sintetizados pelo navegador (Web Audio), sem arquivos de áudio.
 * window.SBSound.play(nome) toca um efeito; a preferência (ligado e volume) fica no aparelho.
 * O navegador só libera áudio depois do primeiro toque do jogador: o contexto é criado nesse toque. */
(function () {
  'use strict';
  const KEY = 'sb_som';
  let ctx = null, master = null, prefs = { on: true, vol: .7 };
  try { const p = JSON.parse(localStorage.getItem(KEY) || 'null'); if (p && typeof p === 'object') prefs = { on: p.on !== false, vol: Math.min(1, Math.max(0, Number(p.vol) || 0)) }; } catch (e) { /* sem armazenamento: usa o padrão */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* ignora */ } };

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    try { ctx = new AC(); master = ctx.createGain(); master.gain.value = prefs.vol * .6; master.connect(ctx.destination); } catch (e) { ctx = null; }
    return ctx;
  }
  // Primeiro toque libera o áudio (regra dos navegadores no celular).
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { if (prefs.on) ensure(); }, { capture: true, passive: true }));

  /* Peças básicas */
  function tone(t0, freq, dur, { type = 'sine', gain = .3, to = null, attack = .005 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + .02);
  }
  let noiseBuf = null;
  function noise(t0, dur, { gain = .2, type = 'bandpass', freq = 2000, q = 1 } = {}) {
    if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t0); s.stop(t0 + dur + .02);
  }

  /* Efeitos */
  const FX = {
    ok(t) { noise(t, .06, { gain: .25, freq: 3500, q: 2 }); tone(t + .05, 1568, .35, { type: 'triangle', gain: .22 }); tone(t + .13, 2093, .45, { type: 'triangle', gain: .2 }); },
    bad(t) { tone(t, 233, .38, { type: 'sawtooth', gain: .12, to: 110 }); tone(t, 185, .38, { type: 'square', gain: .05, to: 92 }); },
    stamp(t) { tone(t, 120, .16, { gain: .5, to: 45 }); noise(t, .07, { gain: .25, type: 'lowpass', freq: 900 }); },
    siren(t) { for (let i = 0; i < 3; i++) { tone(t + i * .5, 640, .25, { type: 'triangle', gain: .16, to: 960, attack: .02 }); tone(t + i * .5 + .25, 960, .25, { type: 'triangle', gain: .16, to: 640, attack: .02 }); } },
    coins(t) { [2637, 3136, 2349, 2794].forEach((f, i) => tone(t + i * .06, f, .18, { type: 'triangle', gain: .14 })); },
    fizz(t) { tone(t, 700, .05, { gain: .2, to: 200 }); noise(t + .03, .45, { gain: .14, type: 'highpass', freq: 4500 }); },
    thump(t) { tone(t, 70, .22, { gain: .5, to: 40 }); noise(t, .05, { gain: .15, type: 'lowpass', freq: 600 }); },
    punch(t) { noise(t, .09, { gain: .35, type: 'lowpass', freq: 1200 }); tone(t, 160, .12, { gain: .35, to: 60 }); },
    beep(t) { tone(t, 1000, .1, { type: 'square', gain: .07 }); tone(t + .22, 1000, .1, { type: 'square', gain: .07 }); },
    flatline(t) { tone(t, 1000, .1, { type: 'square', gain: .07 }); tone(t + .3, 1000, 1.4, { type: 'square', gain: .07, attack: .01 }); },
    fanfare(t) { [523, 659, 784, 1047].forEach((f, i) => tone(t + i * .09, f, i === 3 ? .5 : .16, { type: 'triangle', gain: .18 })); },
    chime(t) { tone(t, 784, .9, { gain: .14 }); tone(t + .18, 1175, 1.1, { gain: .1 }); },
    deny(t) { tone(t, 330, .09, { type: 'square', gain: .06 }); tone(t + .1, 262, .12, { type: 'square', gain: .06 }); },
    tick(t) { tone(t, 1400, .03, { type: 'square', gain: .05 }); }
  };

  /** Toca um ou mais efeitos em sequência curta: play('ok', 'stamp') ou play(['ok', 0], ['stamp', .12]). */
  function play(...names) {
    if (!prefs.on || !prefs.vol || !ensure()) return false;
    try {
      const t = ctx.currentTime + .01;
      for (const n of names) { const [id, dt] = Array.isArray(n) ? n : [n, 0]; if (FX[id]) FX[id](t + (dt || 0)); }
      return true;
    } catch (e) { return false; }
  }
  window.SBSound = {
    play, names: Object.keys(FX),
    get on() { return prefs.on; }, get vol() { return prefs.vol; },
    setOn(v) { prefs.on = !!v; save(); if (prefs.on) { ensure(); play('tick'); } },
    setVol(v) { prefs.vol = Math.min(1, Math.max(0, Number(v) || 0)); save(); if (master) master.gain.value = prefs.vol * .6; }
  };
})();
