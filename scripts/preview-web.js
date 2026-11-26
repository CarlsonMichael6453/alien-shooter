const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve('dist');
const prefix = '/alien-shooter';
const port = Number(process.env.PORT || 4173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === prefix) {
    res.writeHead(302, { Location: `${prefix}/` });
    res.end();
    return;
  }
  if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  let relative = pathname.slice(prefix.length);
  if (relative === '' || relative === '/') relative = '/index.html';
  const file = path.normalize(path.join(root, relative));
  if (!file.startsWith(root)) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Preview at http://127.0.0.1:${port}${prefix}/`);
});
