/**
 * Real WebKit touch check for the iPhone fire button.
 * Serves dist/ at /alien-shooter/ and taps the button's on-screen coordinates
 * with Playwright's WebKit touchscreen (iPhone 14, hasTouch, isMobile).
 *
 *   npm run export:web && node scripts/preview-web.js
 *   npm run test:webkit
 */
const { webkit, devices } = require('playwright-core');

const port = Number(process.env.PORT || 4173);
const prefix = '/alien-shooter';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({
    ...devices['iPhone 14'],
    hasTouch: true,
    isMobile: true,
  });
  await context.addInitScript(() => {
    window.__TOUCH_LOG__ = [];
    const record = (event) => {
      const touch = event.changedTouches && event.changedTouches[0];
      const target = event.target;
      window.__TOUCH_LOG__.push({
        type: event.type,
        pointerType: event.pointerType || null,
        touches: event.touches ? event.touches.length : null,
        id: touch ? touch.identifier : event.pointerId ?? null,
        x: Math.round(touch ? touch.clientX : event.clientX),
        y: Math.round(touch ? touch.clientY : event.clientY),
        fire: !!(target && target.closest && target.closest('[data-alien-fire]')),
      });
    };
    for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'touchstart', 'touchend', 'touchcancel']) {
      window.addEventListener(type, record, { capture: true, passive: true });
    }
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error).slice(0, 200)));
  const snap = () => page.evaluate(() => window.__ALIEN__.snapshot());
  const firePoint = () =>
    page.evaluate(() => {
      const node = document.querySelector('[data-alien-fire]');
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
        bottom: window.innerHeight - rect.bottom,
        pointerEvents: style.pointerEvents,
        touchAction: style.touchAction,
      };
    });

  try {
    await page.goto(`http://127.0.0.1:${port}${prefix}/?debug=1&debugTouch=1`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__ALIEN__ && window.__ALIEN__.snapshot().width > 0);
    await page.getByRole('button', { name: 'Play' }).tap();
    await page.waitForFunction(() => window.__ALIEN__.snapshot().mode === 'playing');

    // First frame of play, tutorial still up. A real WebKit tap at the button.
    const button = await firePoint();
    const hit = await page.evaluate(() => {
      const node = document.querySelector('[data-alien-fire]');
      const rect = node.getBoundingClientRect();
      const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      const style = getComputedStyle(node);
      const alpha = Number(style.backgroundColor.match(/[\d.]+(?=\))/)?.[0] ?? 1);
      return {
        label: target && target.getAttribute('aria-label'),
        fire: !!(target && target.closest('[data-alien-fire]')),
        alpha,
        width: rect.width,
      };
    });
    assert(hit.fire, `elementFromPoint hit ${hit.label}`);
    assert(hit.label === 'Fire button', `elementFromPoint label ${hit.label}`);
    assert(hit.alpha > 0, 'fire button is fully transparent, so iOS can skip it');
    assert(hit.width >= 80 + 32, `hit target is only ${hit.width}px wide`);
    assert(button.bottom >= 47, `clearance ${button.bottom}`);
    assert(button.pointerEvents === 'auto', `pointer-events ${button.pointerEvents}`);
    assert(button.touchAction === 'none', `touch-action ${button.touchAction}`);
    await page.evaluate(() => {
      window.__TOUCH_LOG__.length = 0;
    });
    const beforeTap = await snap();
    await page.touchscreen.tap(button.x, button.y);
    await page.waitForTimeout(250);
    const afterTap = await snap();
    const tapLog = await page.evaluate(() => window.__TOUCH_LOG__.slice());
    assert(afterTap.shotsFired > beforeTap.shotsFired, `webkit tap shots ${beforeTap.shotsFired} -> ${afterTap.shotsFired}`);
    assert(afterTap.ammo < beforeTap.ammo, `webkit tap ammo ${beforeTap.ammo} -> ${afterTap.ammo}`);
    assert(tapLog.some((entry) => entry.fire && (entry.type === 'touchstart' || entry.type === 'pointerdown')), 'tap missed the fire button');
    const debugText = await page.locator('#alien-touch-debug').innerText();
    assert(debugText.includes('touch-hit-1'), `debug readout missing build: ${debugText}`);
    assert(/touchstart|pointerdown/.test(debugText), `debug readout had no touch: ${debugText}`);
    await page.screenshot({ path: '/opt/cursor/artifacts/webkit-tap-fires.png' });
    const missedPointer = await page.evaluate(async () => {
      const fire = document.querySelector('[data-alien-fire]');
      const rect = fire.getBoundingClientRect();
      const x = rect.x + rect.width / 2;
      const y = rect.y + rect.height / 2;
      const root = document.getElementById('alien-shooter-root');
      const before = window.__ALIEN__.snapshot().shotsFired;
      root.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true, pointerId: 2, pointerType: 'touch',
        clientX: 4, clientY: 4, button: 0, buttons: 1, isPrimary: true,
      }));
      const event = new Event('touchstart', { bubbles: true, cancelable: true });
      const touch = { identifier: 0, clientX: x, clientY: y, target: fire };
      Object.defineProperty(event, 'changedTouches', { value: [touch] });
      Object.defineProperty(event, 'touches', { value: [touch] });
      root.dispatchEvent(event);
      await new Promise((resolve) => setTimeout(resolve, 280));
      const snap = window.__ALIEN__.snapshot();
      return { before, shots: snap.shotsFired, firing: snap.firing, pressed: fire.getAttribute('data-pressed') };
    });
    assert(missedPointer.shots > missedPointer.before, `touch inside the button was ignored (${missedPointer.before} -> ${missedPointer.shots})`);
    assert(missedPointer.pressed === '1', `button did not show a press (${missedPointer.pressed})`);
    await page.screenshot({ path: '/opt/cursor/artifacts/webkit-fire-pressed.png' });

    // Sustained touch at the same coordinates. Bullets should keep coming about every 0.08s.
    const heldFrom = (await snap()).shotsFired;
    await page.evaluate(({ x, y }) => {
      const target = document.elementFromPoint(x, y);
      target.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          pointerId: 4,
          pointerType: 'touch',
          clientX: x,
          clientY: y,
          button: 0,
          buttons: 1,
          isPrimary: true,
        }),
      );
      window.__holdTarget = target;
    }, button);
    await page.waitForTimeout(420);
    const held = await snap();
    const gained = held.shotsFired - heldFrom;
    assert(held.firing === true, 'held touch was not still firing');
    assert(gained >= 4 && gained <= 8, `held shots in 420ms: ${gained} (expected about one every 0.08s)`);
    await page.screenshot({ path: '/opt/cursor/artifacts/webkit-hold-fires.png' });
    await page.evaluate(({ x, y }) => {
      window.__holdTarget.dispatchEvent(
        new PointerEvent('pointerup', {
          bubbles: true,
          cancelable: true,
          pointerId: 4,
          pointerType: 'touch',
          clientX: x,
          clientY: y,
          button: 0,
          buttons: 0,
          isPrimary: true,
        }),
      );
    }, button);
    await page.waitForTimeout(200);
    const released = await snap();
    assert(released.firing === false, 'fire stayed on after the finger lifted');
    const quiet = released.shotsFired;
    await page.waitForTimeout(250);
    assert((await snap()).shotsFired === quiet, 'shots continued after release');

    // Tutorial is on screen from the opening tap. Another real tap must still shoot.
    const tutorialButton = await firePoint();
    const tutorialBefore = (await snap()).shotsFired;
    const tutorialText = await page.evaluate(() => document.body.innerText);
    await page.touchscreen.tap(tutorialButton.x, tutorialButton.y);
    await page.waitForTimeout(200);
    const tutorialAfter = await snap();
    assert(tutorialAfter.shotsFired > tutorialBefore, 'tutorial tap did not fire');
    await page.screenshot({ path: '/opt/cursor/artifacts/webkit-tutorial-fires.png' });

    // Laser stick visible. The button must still accept the touch. Bullets wait until the beam ends.
    await page.evaluate(() => {
      window.__ALIEN__.setTutorial({ moved: true, fired: true, ammo: true, power: true });
      window.__ALIEN__.apply((state) => {
        state.laserTimer = 6;
        state.laserAngle = -Math.PI / 2;
      });
    });
    await page.waitForFunction(() => document.querySelector('[data-alien-laser]'));
    const laserButton = await firePoint();
    const overlap = await page.evaluate(() => {
      const fire = document.querySelector('[data-alien-fire]').getBoundingClientRect();
      const stick = document.querySelector('[data-alien-laser]').getBoundingClientRect();
      return fire.left < stick.right && fire.right > stick.left && fire.top < stick.bottom && fire.bottom > stick.top;
    });
    assert(overlap === false, 'laser stick overlaps the fire button');
    const duringLaser = (await snap()).shotsFired;
    await page.touchscreen.tap(laserButton.x, laserButton.y);
    await page.waitForTimeout(180);
    const laserSnap = await snap();
    assert(laserSnap.laserTimer > 0, 'laser was not active');
    assert(laserSnap.shotsFired === duringLaser, 'laser changed the bullet count');
    await page.screenshot({ path: '/opt/cursor/artifacts/webkit-laser-button.png' });
    await page.evaluate(() => {
      window.__ALIEN__.apply((state) => {
        state.laserTimer = 0;
      });
    });
    await page.waitForTimeout(80);
    const afterLaserBefore = (await snap()).shotsFired;
    await page.touchscreen.tap(laserButton.x, laserButton.y);
    await page.waitForTimeout(200);
    assert((await snap()).shotsFired > afterLaserBefore, 'fire stayed dead after the laser');

    // Second finger drags while the fire touch is held.
    const drag = await firePoint();
    const dragFrom = (await snap()).shotsFired;
    await page.evaluate(({ x, y }) => {
      const fire = document.elementFromPoint(x, y);
      const move = document.elementFromPoint(40, 400) || document.body;
      const down = (node, id, cx, cy) =>
        node.dispatchEvent(
          new PointerEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            pointerId: id,
            pointerType: 'touch',
            clientX: cx,
            clientY: cy,
            button: 0,
            buttons: 1,
            isPrimary: id === 7,
          }),
        );
      down(fire, 7, x, y);
      down(move, 8, 40, 400);
    }, drag);
    await page.waitForTimeout(250);
    const both = await snap();
    assert(both.firing === true && both.fireId != null, `drag+fire firing=${both.firing} fireId=${both.fireId}`);
    assert(both.moveId != null, 'drag finger was not steering');
    assert(both.shotsFired > dragFrom, 'no bullets while dragging and firing');
    await page.screenshot({ path: '/opt/cursor/artifacts/webkit-drag-and-fire.png' });

    const sw = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return { supported: false, registrations: 0 };
      const regs = await navigator.serviceWorker.getRegistrations();
      return { supported: true, registrations: regs.length };
    });
    assert(sw.registrations === 0, `service workers: ${sw.registrations}`);

    console.log(
      JSON.stringify(
        {
          ok: true,
          button,
          tap: { before: beforeTap.shotsFired, after: afterTap.shotsFired, ammo: afterTap.ammo, log: tapLog },
          hold: { gained },
          tutorial: { text: tutorialText.slice(0, 80), shots: tutorialAfter.shotsFired },
          drag: { fireId: both.fireId, moveId: both.moveId, shots: both.shotsFired },
          serviceWorker: sw,
          errors,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
