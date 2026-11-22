/**
 * Store screenshot capture. Serves nothing by itself: export the web build,
 * then `PORT=4173 node scripts/preview-web.js` and `npm run store:shots`.
 * STORE_WIDTH / STORE_HEIGHT override the phone size (defaults to iPhone 13).
 */
const { chromium, devices } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const base = process.env.STORE_URL || 'http://127.0.0.1:4173/alien-shooter/?debug=1';
const out = path.resolve(process.env.STORE_OUT || 'store-shots');
const width = Number(process.env.STORE_WIDTH || devices['iPhone 13'].viewport.width);
const height = Number(process.env.STORE_HEIGHT || devices['iPhone 13'].viewport.height);

async function main() {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome',
    headless: true,
    args: ['--use-gl=angle', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__ALIEN__);
  await page.evaluate(() => {
    const board = {
      scores: [
        { score: 12840, wave: 9, at: 1 },
        { score: 6420, wave: 6, at: 2 },
        { score: 3100, wave: 4, at: 3 },
      ],
      bestScore: 12840,
      bestWave: 9,
      shipId: 'classic',
    };
    localStorage.setItem('alien-shooter:profile', JSON.stringify(board));
    localStorage.setItem('alien-shooter:tutorial', JSON.stringify({ moved: false, fired: false, power: false }));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__ALIEN__);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, 'menu.png') });
  await page.evaluate(() => window.__ALIEN__.openShips());
  await page.waitForFunction(() => document.body.innerText.includes('Unlocked'));
  await page.screenshot({ path: path.join(out, 'ships.png') });
  await page.evaluate(() => window.__ALIEN__.closeUi());
  await page.evaluate(() => window.__ALIEN__.openScores());
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(out, 'scores.png') });
  await page.evaluate(() => {
    window.__ALIEN__.closeUi();
    window.__ALIEN__.apply((state) => {
      state.mode = 'playing';
      state.wave = 2;
    });
    window.__ALIEN__.setTutorial({ moved: false, fired: false, power: false });
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(out, 'tutorial.png') });
  await page.evaluate(() => window.__ALIEN__.openPause());
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(out, 'pause.png') });
  await browser.close();
  console.log(out);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
