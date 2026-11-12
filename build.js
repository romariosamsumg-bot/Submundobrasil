/* Gera Submundo-Brasil-v0.9.html (arquivo único, offline) a partir de src/.
 * Uso: node build.js */
'use strict';
const fs = require('fs');
const path = require('path');
const src = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const engine = src('engine.js');
if (engine.includes('</script')) throw new Error('engine.js não pode conter </script');
const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#111b1e">
  <meta name="description" content="Submundo Brasil — RPG urbano brasileiro de estratégia por turnos para navegador.">
  <title>Submundo Brasil | Jogo de estratégia 0.9</title>
  <style>
${src('style.css')}
${src('extra.css')}
  </style>
</head>
<body>
${src('body.html')}
  <script id="sb-engine">
${engine}
  </script>
  <script id="sb-ui">
${src('ui.js')}
  </script>
</body>
</html>
`;
fs.writeFileSync(path.join(__dirname, 'Submundo-Brasil-v0.9.html'), html);
console.log('Gerado Submundo-Brasil-v0.9.html (' + Math.round(html.length / 1024) + ' KB)');
