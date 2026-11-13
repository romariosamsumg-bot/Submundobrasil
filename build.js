/* Gera Submundo-Brasil-v1.5.html (arquivo único, offline) a partir de src/.
 * Uso: node build.js */
'use strict';
const fs = require('fs');
const path = require('path');
const src = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const engine = src('engine.js');
/* Imagens pintadas opcionais: art/<chave>.(webp|jpg|png) viram data URIs em window.SB_ART.
   Chaves válidas: place-<id>, rival-<id>, heist-<id> (lista em PROMPTS_ARTE.md). */
const artDir = path.join(__dirname, 'art');
const MIME = { '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
const art = {};
if (fs.existsSync(artDir)) for (const f of fs.readdirSync(artDir).sort()) {
  const ext = path.extname(f).toLowerCase(), key = path.basename(f, ext);
  if (!MIME[ext] || !/^(place|rival|heist|avatar|bairro|item)-[a-z0-9]+$/.test(key)) continue;
  const buf = fs.readFileSync(path.join(artDir, f));
  if (buf.length > 400 * 1024) { console.warn(`Aviso: ${f} tem ${Math.round(buf.length / 1024)} KB; comprima para menos de 400 KB.`); continue; }
  art[key] = `data:${MIME[ext]};base64,${buf.toString('base64')}`;
}
if (engine.includes('</script')) throw new Error('engine.js não pode conter </script');
// Modo online opcional: endereço do projeto e chave pública (anon), que é feita para ficar no cliente.
const onlineFile = path.join(__dirname, 'online.json');
const online = fs.existsSync(onlineFile) ? JSON.stringify((({ url, anonKey }) => ({ url, anonKey }))(JSON.parse(fs.readFileSync(onlineFile, 'utf8')))) : 'null';
const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#111b1e">
  <meta name="description" content="Submundo Brasil — RPG urbano brasileiro de estratégia por turnos para navegador.">
  <title>Submundo Brasil | Jogo de estratégia 1.5</title>
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
  <script id="sb-art">
window.SB_ART = ${JSON.stringify(art)};
${src('art.js')}
  </script>
  <script id="sb-online">
window.SB_ONLINE = ${online};
  </script>
  <script id="sb-ui">
${src('ui.js')}
  </script>
</body>
</html>
`;
fs.writeFileSync(path.join(__dirname, 'Submundo-Brasil-v1.5.html'), html);
// O servidor online usa exatamente o mesmo motor: copia a cada build.
fs.copyFileSync(path.join(__dirname, 'src', 'engine.js'), path.join(__dirname, 'supabase', 'functions', 'jogar', 'engine.js'));
console.log('Gerado Submundo-Brasil-v1.5.html (' + Math.round(html.length / 1024) + ' KB, ' + Object.keys(art).length + ' imagem(ns) pintada(s))');
