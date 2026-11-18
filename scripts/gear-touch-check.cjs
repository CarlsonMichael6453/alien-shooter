/**
 * Phone-sized touch check for the settings gear.
 * Uses Chrome touch events, not mouse clicks.
 *
 *   npm run export:web && npm run test:gear
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright-core');

const root = path.resolve('dist');
const prefix = '/alien-shooter';
const port = 4182;

function startServer() {
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
  };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === prefix) {
      res.writeHead(302, { Location: `${prefix}/` });
      res.end();
      return;
    }
    if (!pathname.startsWith(`${prefix}/`)) {
      res.writeHead(404);
      res.end('missing');
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
        res.end('missing');
        return;
      }
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function touch(client, type, points) {
  await client.send('Input.dispatchTouchEvent', {
    type,
    modifiers: 0,
    touchPoints: points.map((point) => ({
      x: point.x,
      y: point.y,
      id: point.id,
      radiusX: 2,
      radiusY: 2,
      force: 0.8,
    })),
  });
}

async function tap(client, x, y) {
  await touch(client, 'touchStart', [{ id: 7, x, y }]);
  await touch(client, 'touchEnd', []);
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ ...devices['iPhone 13'] });
  const client = await page.context().newCDPSession(page);
  const snap = () => page.evaluate(() => window.__ALIEN__.snapshot());
  try {
    await page.goto(`http://127.0.0.1:${port}${prefix}/?debug=1`, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__ALIEN__ && window.__ALIEN__.snapshot().width > 0);
    await page.waitForTimeout(250);

    const gear = await page.locator('[aria-label="Settings"]').boundingBox();
    assert(gear, 'settings gear is not on the title screen');
    await tap(client, gear.x + gear.width / 2, gear.y + gear.height / 2);
    await page.waitForTimeout(350);
    const ready = await snap();
    assert(ready.ui === 'settings', `touch on the title gear left ui=${ready.ui}`);
    assert(ready.mode === 'ready', `title gear started the game (${ready.mode})`);
    assert(ready.moveId == null && ready.fireId == null, 'title gear claimed a finger');
    assert(ready.shotsFired === 0, 'title gear fired');
    await page.screenshot({ path: '/tmp/gear-touch-settings.png' });

    const close = await page.getByRole('button', { name: 'Close' }).boundingBox();
    assert(close, 'close button missing');
    await tap(client, close.x + close.width / 2, close.y + close.height / 2);
    await page.waitForTimeout(300);
    assert((await snap()).ui === 'none', 'touch on Close left settings open');

    await tap(client, 180, 420);
    await page.waitForFunction(() => window.__ALIEN__.snapshot().mode === 'playing');
    await page.waitForTimeout(200);
    const playing = await snap();
    const gearPlay = await page.locator('[aria-label="Settings"]').boundingBox();
    assert(gearPlay, 'settings gear is missing during play');
    await tap(client, gearPlay.x + gearPlay.width / 2, gearPlay.y + gearPlay.height / 2);
    await page.waitForTimeout(350);
    const paused = await snap();
    assert(paused.ui === 'settings', `touch during play left ui=${paused.ui}`);
    assert(paused.mode === 'playing', `play gear changed mode to ${paused.mode}`);
    assert(paused.shotsFired === playing.shotsFired, 'play gear fired a shot');
    assert(Math.abs(paused.shipX - playing.shipX) < 8 && Math.abs(paused.shipY - playing.shipY) < 8, 'play gear moved the ship');
    assert(paused.moveId == null && paused.fireId == null, 'play gear claimed a finger');

    await page.evaluate(() => window.__ALIEN__.closeUi());
    await page.evaluate(() => {
      window.__ALIEN__.apply((state) => {
        state.mode = 'over';
        state.lives = 0;
        state.hold = true;
      });
    });
    await page.waitForTimeout(200);
    const gearOver = await page.locator('[aria-label="Settings"]').boundingBox();
    assert(gearOver, 'settings gear is missing on the game-over screen');
    await tap(client, gearOver.x + gearOver.width / 2, gearOver.y + gearOver.height / 2);
    await page.waitForTimeout(350);
    const over = await snap();
    assert(over.ui === 'settings', `touch after game over left ui=${over.ui}`);
    assert(over.mode === 'over', `game-over gear restarted the run (${over.mode})`);
    assert(over.shotsFired === paused.shotsFired, 'game-over gear fired');

    console.log(JSON.stringify({ ok: true, ready: ready.ui, paused: paused.ui, over: over.ui }, null, 2));
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
