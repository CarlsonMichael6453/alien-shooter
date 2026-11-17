const fs = require('fs');
const path = require('path');

const dist = path.join(process.cwd(), 'dist');
const htmlPath = path.join(dist, 'index.html');
if (!fs.existsSync(htmlPath)) {
  console.error('dist/index.html is missing. Run expo export before patching.');
  process.exit(1);
}

let html = fs.readFileSync(htmlPath, 'utf8');
const viewport =
  '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />';
if (/<meta[^>]*name="viewport"[^>]*>/i.test(html)) {
  html = html.replace(/<meta[^>]*name="viewport"[^>]*>/i, viewport);
} else {
  html = html.replace('</head>', `${viewport}</head>`);
}

const style = `<style>
  html, body, #root {
    height: 100%;
    width: 100%;
    margin: 0;
    background: #070B14;
    touch-action: none;
    overflow: hidden;
    overscroll-behavior: none;
    position: fixed;
    inset: 0;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
  }
</style>`;
html = html.replace('</head>', `${style}</head>`);
html = html.replace(/<title>[^<]*<\/title>/i, '<title>Alien Shooter</title>');
fs.writeFileSync(htmlPath, html);
fs.writeFileSync(path.join(dist, '.nojekyll'), '');

if (!html.includes('/alien-shooter/')) {
  console.error('Exported HTML is missing the /alien-shooter/ base path.');
  process.exit(1);
}

console.log('Patched dist/index.html for GitHub Pages and touch locking.');
