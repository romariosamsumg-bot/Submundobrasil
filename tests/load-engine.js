/* Carrega o motor de regras DIRETAMENTE do HTML entregue (bloco
 * <script id="sb-engine">), para que testes e simulações validem
 * exatamente o código que o jogador executa. Se o HTML ainda não foi
 * gerado, usa src/engine.js. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const cache = {};
module.exports = function loadEngine(file) {
  const key = file || 'default';
  if (cache[key]) return cache[key];
  const htmlPath = file || path.join(__dirname, '..', 'Submundo-Brasil-v1.0.html');
  let code;
  if (fs.existsSync(htmlPath)) {
    const html = fs.readFileSync(htmlPath, 'utf8');
    const m = html.match(/<script id="sb-engine">([\s\S]*?)<\/script>/);
    if (!m) throw new Error('Bloco sb-engine não encontrado no HTML.');
    code = m[1];
  } else code = fs.readFileSync(path.join(__dirname, '..', 'src', 'engine.js'), 'utf8');
  const sandbox = { console, crypto: globalThis.crypto, Math, JSON, Date };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'sb-engine.js' });
  cache[key] = sandbox.SB;
  return sandbox.SB;
};
