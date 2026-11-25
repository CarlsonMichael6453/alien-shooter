/**
 * Mobile-web multitouch check.
 * Serves dist/ at /alien-shooter/ and drives two real touch points in Chrome.
 *
 *   npx expo export --platform web && node scripts/patch-web-export.js
 *   node scripts/multitouch-check.mjs
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium, devices, webkit } = require('playwright-core');

const root = path.resolve('dist');
const prefix = '/alien-shooter';
const port = 4173;

function startServer() {
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.wasm': 'application/wasm',
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
      res.writeHead(200, {
        'Content-Type': types[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function viewportLock(page) {
  return page.evaluate(() => {
    const view = window.visualViewport;
    return {
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      scale: view ? view.scale : 1,
      offsetLeft: view ? view.offsetLeft : 0,
      offsetTop: view ? view.offsetTop : 0,
      width: view ? view.width : window.innerWidth,
      height: view ? view.height : window.innerHeight,
    };
  });
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

async function webkitFireTap() {
  const browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({
    ...devices['iPhone 13'],
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  try {
    await page.goto(`http://127.0.0.1:${port}${prefix}/?debug=1`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__ALIEN__ && window.__ALIEN__.snapshot().width > 0);
    const play = page.getByRole('button', { name: 'Play' });
    await play.waitFor({ state: 'visible' });
    const playBox = await play.boundingBox();
    assert(playBox, 'Play button has no on-screen box');
    await page.touchscreen.tap(playBox.x + playBox.width / 2, playBox.y + playBox.height / 2);
    await page.waitForFunction(() => window.__ALIEN__.snapshot().mode === 'playing', null, { timeout: 3000 });
    const fireButton = page.getByLabel('Fire button', { exact: true });
    await fireButton.waitFor({ state: 'visible' });
    const fireBox = await fireButton.boundingBox();
    assert(fireBox, 'Fire button has no on-screen box');
    const x = fireBox.x + fireBox.width / 2;
    const y = fireBox.y + fireBox.height / 2;
    const viewport = page.viewportSize();
    assert(viewport && x >= 0 && y >= 0 && x < viewport.width && y < viewport.height, `webkit fire tap (${x}, ${y}) is outside the viewport`);
    const before = await page.evaluate(() => window.__ALIEN__.snapshot());
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => window.__ALIEN__.snapshot());
    assert(after.shotsFired >= before.shotsFired + 1, `webkit tap shots ${before.shotsFired} -> ${after.shotsFired}`);
    assert(after.ammo < before.ammo, `webkit tap ammo ${before.ammo} -> ${after.ammo}`);
    return { ok: true, shots: after.shotsFired, ammo: after.ammo };
  } finally {
    await browser.close();
  }
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  try {
    await page.goto(`http://127.0.0.1:${port}${prefix}/?debug=1`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__ALIEN__ && window.__ALIEN__.snapshot().width > 0);
    await page.waitForTimeout(150);

    const gesture = await page.evaluate(() => {
      const html = getComputedStyle(document.documentElement);
      const body = getComputedStyle(document.body);
      const viewport = document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '';
      return {
        htmlTouch: html.touchAction,
        bodyTouch: body.touchAction,
        overflow: html.overflow,
        viewport,
      };
    });
    assert(gesture.htmlTouch === 'none', `html touch-action is ${gesture.htmlTouch}`);
    assert(gesture.bodyTouch === 'none', `body touch-action is ${gesture.bodyTouch}`);
    assert(gesture.overflow === 'hidden', `html overflow is ${gesture.overflow}`);
    assert(gesture.viewport.includes('user-scalable=no'), `viewport is ${gesture.viewport}`);
    assert(gesture.viewport.includes('viewport-fit=cover'), 'viewport is missing viewport-fit=cover');

    const client = await context.newCDPSession(page);
    const snap = () => page.evaluate(() => window.__ALIEN__.snapshot());

    const before = await snap();
    assert(before.mode === 'ready', `expected ready, got ${before.mode}`);
    assert(before.shotsFired === 0, 'title screen should not be firing');

    // The title screen is the Play menu. Start the way a player does: tap that button.
    const play = page.getByRole('button', { name: 'Play' });
    await play.waitFor({ state: 'visible' });
    const playBox = await play.boundingBox();
    assert(playBox, 'Play button has no on-screen box');
    const playX = playBox.x + playBox.width / 2;
    const playY = playBox.y + playBox.height / 2;
    await touch(client, 'touchStart', [{ id: 1, x: playX, y: playY }]);
    await touch(client, 'touchEnd', [{ id: 1, x: playX, y: playY }]);
    await page.waitForFunction(() => window.__ALIEN__.snapshot().mode === 'playing', null, { timeout: 3000 });
    const started = await snap();
    assert(started.mode === 'playing', 'Play button did not start the game');
    assert(started.shotsFired === 0, 'starting the game fired a shot');

    const viewport = page.viewportSize();
    assert(viewport, 'missing viewport');
    const pointInView = (x, y, label) => {
      assert(
        x >= 0 && y >= 0 && x < viewport.width && y < viewport.height,
        `${label} (${x}, ${y}) is outside the ${viewport.width}x${viewport.height} viewport`,
      );
    };

    // One finger steers and must not fire.
    const moveFrom = { x: 180, y: 640 };
    const moveTo = { x: 180, y: 520 };
    pointInView(moveFrom.x, moveFrom.y, 'move start');
    pointInView(moveTo.x, moveTo.y, 'move end');
    await touch(client, 'touchStart', [{ id: 1, ...moveFrom }]);
    await touch(client, 'touchMove', [{ id: 1, ...moveTo }]);
    await page.waitForTimeout(280);
    const steered = await snap();
    assert(steered.mode === 'playing', 'drag did not stay in play');
    assert(steered.firing === false, 'one finger should not fire');
    assert(steered.shotsFired === 0, `shots fired with one finger: ${steered.shotsFired}`);
    assert(steered.ammo === started.ammo, 'one finger spent ammo');
    assert(steered.shipY < started.shipY - 40, `ship did not follow the upward drag (${started.shipY} -> ${steered.shipY})`);

    // Second finger on the fire button, held, fires. Sliding it inside the button must not steer.
    const fireButton = page.getByLabel('Fire button', { exact: true });
    await fireButton.waitFor({ state: 'visible' });
    const fireBox = await fireButton.boundingBox();
    assert(fireBox, 'Fire button has no on-screen box');
    const fireX = fireBox.x + fireBox.width / 2;
    const fireY = fireBox.y + fireBox.height / 2;
    const fireNudge = {
      x: Math.min(fireBox.x + fireBox.width - 4, fireX + 10),
      y: Math.min(fireBox.y + fireBox.height - 4, fireY + 8),
    };
    pointInView(fireX, fireY, 'fire center');
    pointInView(fireNudge.x, fireNudge.y, 'fire nudge');
    const parked = await snap();
    const locked = await viewportLock(page);
    await touch(client, 'touchStart', [{ id: 2, x: fireX, y: fireY }]);
    await touch(client, 'touchMove', [
      { id: 1, ...moveTo },
      { id: 2, ...fireNudge },
    ]);
    await page.waitForTimeout(420);
    const firing = await snap();
    assert(firing.shotsFired >= 2, `expected a steady stream, got ${firing.shotsFired} shots`);
    assert(firing.ammo < parked.ammo, `ammo did not drop (${parked.ammo} -> ${firing.ammo})`);
    assert(Math.abs(firing.shipX - parked.shipX) < 8, 'dragging the fire finger moved the ship');
    assert(Math.abs(firing.shipY - parked.shipY) < 8, 'dragging the fire finger moved the ship vertically');
    const afterDrag = await viewportLock(page);
    assert(
      JSON.stringify(afterDrag) === JSON.stringify(locked),
      `the page scrolled or zoomed while dragging and firing (${JSON.stringify(locked)} -> ${JSON.stringify(afterDrag)})`,
    );

    // Lift the move finger. The remaining finger keeps firing and does not start steering.
    await touch(client, 'touchEnd', [{ id: 1, ...moveTo }]);
    const atLift = await snap();
    const fireAway = { x: 40, y: 500 };
    pointInView(fireAway.x, fireAway.y, 'fire drag');
    await touch(client, 'touchMove', [{ id: 2, ...fireAway }]);
    await page.waitForTimeout(300);
    const stillFiring = await snap();
    assert(stillFiring.shotsFired > atLift.shotsFired, 'firing stopped while the second finger was still down');
    assert(stillFiring.ammo < atLift.ammo, 'ammo stopped dropping while the fire finger was down');
    assert(Math.abs(stillFiring.shipX - firing.shipX) < 8, 'the fire finger started steering after the other finger lifted');

    // A new finger takes over steering while the original fire finger stays put.
    const nextFrom = { x: 200, y: 500 };
    const nextTo = { x: 250, y: 460 };
    pointInView(nextFrom.x, nextFrom.y, 'next move start');
    pointInView(nextTo.x, nextTo.y, 'next move end');
    await touch(client, 'touchStart', [{ id: 3, ...nextFrom }]);
    await touch(client, 'touchMove', [
      { id: 2, ...fireAway },
      { id: 3, ...nextTo },
    ]);
    await page.waitForTimeout(250);
    const swapped = await snap();
    assert(swapped.shipX > stillFiring.shipX + 20, 'the new move finger did not drag the ship');
    assert(swapped.shotsFired > stillFiring.shotsFired, 'firing stopped when a new finger started steering');
    assert(swapped.ammo < stillFiring.ammo, 'ammo stopped dropping when a new finger started steering');

    await touch(client, 'touchEnd', [
      { id: 2, ...fireAway },
      { id: 3, ...nextTo },
    ]);
    await page.waitForTimeout(200);
    const released = await snap();
    const shotsWhenQuiet = released.shotsFired;
    await page.waitForTimeout(320);
    const quiet = await snap();
    assert(quiet.firing === false, 'firing stayed on after both fingers lifted');
    assert(quiet.shotsFired === shotsWhenQuiet, 'shots kept coming after release');

    await page.screenshot({ path: '/tmp/alien-playing.png' });
    console.log(JSON.stringify({ chromium: { ok: true, gesture, quiet } }, null, 2));
    const webkitTap = await webkitFireTap();
    console.log(JSON.stringify({ webkitTap }, null, 2));
  } finally {
    if (errors.length) console.error('PAGE ERRORS\n' + errors.join('\n'));
    await browser.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
