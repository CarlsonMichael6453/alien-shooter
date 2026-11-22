import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DRAG_FOLLOW } from './constants';
import { Controls, STICK_DEAD_ZONE, stickResponse } from './controls';

describe('two-finger controls', () => {
  it('treats the first touch as move and the second as fire', () => {
    const controls = new Controls();
    controls.setScheme('drag');
    controls.pointerDown(4, 10, 20, 100, 200);
    controls.pointerDown(9, 40, 80, 100, 200);
    const frame = controls.frame();
    assert.equal(controls.moveId, 4);
    assert.equal(controls.fireId, 9);
    assert.equal(frame.firing, true);
    assert.equal(frame.moveActive, true);
    assert.equal(frame.targetX, 100);
    assert.equal(frame.targetY, 200);
  });

  it('lets either contact arrive first and still assigns roles in order', () => {
    const controls = new Controls();
    controls.setScheme('drag');
    controls.pointerDown(2, 0, 0, 50, 60);
    assert.equal(controls.moveId, 2);
    assert.equal(controls.fireId, null);
    assert.equal(controls.frame().firing, false);
    controls.pointerDown(1, 5, 5, 50, 60);
    assert.equal(controls.fireId, 1);
    assert.equal(controls.frame().firing, true);
  });

  it('moves the ship by the drag delta instead of jumping under the finger', () => {
    const controls = new Controls();
    controls.setScheme('drag');
    controls.pointerDown(1, 30, 400, 180, 640);
    controls.pointerMove(1, 70, 360);
    const frame = controls.frame();
    assert.equal(frame.targetX, 180 + 40 * DRAG_FOLLOW);
    assert.equal(frame.targetY, 640 - 40 * DRAG_FOLLOW);
  });

  it('keeps the fire finger firing after the move finger lifts', () => {
    const controls = new Controls();
    controls.setScheme('drag');
    controls.pointerDown(1, 0, 0, 10, 10);
    controls.pointerDown(2, 20, 20, 10, 10);
    controls.pointerUp(1);
    assert.equal(controls.moveId, null);
    assert.equal(controls.fireId, 2);
    assert.equal(controls.frame().firing, true);
    assert.equal(controls.frame().moveActive, false);
    controls.pointerMove(2, 200, 200);
    assert.equal(controls.frame().moveActive, false);
    controls.pointerDown(3, 15, 15, 80, 90);
    assert.equal(controls.moveId, 3);
    assert.equal(controls.fireId, 2);
    assert.equal(controls.frame().targetX, 80);
    assert.equal(controls.frame().targetY, 90);
  });

  it('ignores a third finger', () => {
    const controls = new Controls();
    controls.setScheme('drag');
    controls.pointerDown(1, 0, 0, 0, 0);
    controls.pointerDown(2, 0, 0, 0, 0);
    controls.pointerDown(3, 50, 50, 0, 0);
    controls.pointerMove(3, 80, 80);
    assert.equal(controls.moveId, 1);
    assert.equal(controls.fireId, 2);
    assert.equal(controls.frame().targetX, 0);
    assert.equal(controls.frame().targetY, 0);
  });

  it('stops firing when the fire finger lifts', () => {
    const controls = new Controls();
    controls.setScheme('drag');
    controls.pointerDown(1, 0, 0, 0, 0);
    controls.pointerDown(2, 0, 0, 0, 0);
    controls.pointerUp(2);
    assert.equal(controls.frame().firing, false);
    assert.equal(controls.moveId, 1);
  });

  it('reanchors so a restart does not throw the ship back to the old spot', () => {
    const controls = new Controls();
    controls.setScheme('drag');
    controls.pointerDown(1, 10, 10, 100, 100);
    controls.pointerMove(1, 40, 25);
    assert.equal(controls.frame().targetX, 100 + 30 * DRAG_FOLLOW);
    controls.reanchor(200, 500);
    const frame = controls.frame();
    assert.equal(frame.targetX, 200);
    assert.equal(frame.targetY, 500);
  });

  it('normalizes diagonal keys and fires from Space without a touch', () => {
    const controls = new Controls();
    controls.setScheme('drag');
    controls.keyDown('KeyA');
    controls.keyDown('KeyW');
    controls.keyDown('Space');
    const frame = controls.frame();
    assert.ok(Math.abs(Math.hypot(frame.keyX, frame.keyY) - 1) < 1e-6);
    assert.equal(frame.firing, true);
    assert.equal(frame.moveActive, false);
  });

  it('lets the right mouse button fire while the left button steers', () => {
    const controls = new Controls();
    controls.setScheme('drag');
    controls.mouseDown(2, 0, 0, 10, 10);
    assert.equal(controls.frame().firing, true);
    assert.equal(controls.moveId, null);
    controls.mouseDown(0, 5, 5, 40, 50);
    controls.mouseMove(15, 25);
    const frame = controls.frame();
    assert.equal(frame.moveActive, true);
    assert.equal(frame.targetX, 40 + 10 * DRAG_FOLLOW);
    assert.equal(frame.targetY, 50 + 20 * DRAG_FOLLOW);
    assert.equal(frame.firing, true);
    controls.mouseUp(2);
    assert.equal(controls.frame().firing, false);
  });

  it('treats a tap on the bomb button as a bomb, not a steering finger', () => {
    const controls = new Controls();
    controls.setScheme('drag');
    controls.setInventoryRects([{ x: 14, y: 700, w: 56, h: 56 }]);
    controls.pointerDown(1, 30, 720, 100, 100);
    assert.equal(controls.moveId, null);
    assert.equal(controls.consumePower(), 0);
    assert.equal(controls.consumePower(), null);
    controls.pointerDown(2, 40, 40, 100, 100);
    assert.equal(controls.moveId, 2);
  });

  it('lets the settings gear swallow a touch without steering or firing', () => {
    const controls = new Controls();
    controls.setScheme('drag');
    controls.setChromeRects([{ x: 300, y: 20, w: 44, h: 44 }]);
    assert.equal(controls.pointerDown(1, 320, 40, 100, 500), 'chrome');
    assert.equal(controls.moveId, null);
    assert.equal(controls.fireId, null);
    assert.equal(controls.consumeChrome(), true);
    assert.equal(controls.consumeChrome(), false);
    controls.pointerDown(2, 20, 400, 100, 500);
    assert.equal(controls.moveId, 2);
    assert.equal(controls.fireId, null);
  });

  it('prefers a power-up slot when it overlaps the settings gear', () => {
    const controls = new Controls();
    controls.setScheme('drag');
    controls.setInventoryRects([{ x: 300, y: 20, w: 56, h: 56 }]);
    controls.setChromeRects([{ x: 300, y: 20, w: 44, h: 44 }]);
    assert.equal(controls.pointerDown(1, 320, 40, 0, 0), 'power');
    assert.equal(controls.consumePower(), 0);
    assert.equal(controls.consumeChrome(), false);
    assert.equal(controls.moveId, null);
  });

  it('reports how far the firing finger has dragged', () => {
    const controls = new Controls();
    controls.setScheme('drag');
    controls.pointerDown(1, 10, 10, 0, 0);
    controls.pointerDown(2, 80, 200, 0, 0);
    controls.pointerMove(2, 40, 120);
    const frame = controls.frame();
    assert.equal(frame.fireDragX, -40);
    assert.equal(frame.fireDragY, -80);
  });
});

describe('joystick controls', () => {
  const stick = { x: 20, y: 500, w: 120, h: 120 };
  const fire = { x: 250, y: 520, w: 96, h: 96 };

  it('steers from the stick and fires from the button at the same time', () => {
    const controls = new Controls();
    controls.setScheme('joystick');
    controls.setActionRects(stick, fire);
    controls.pointerDown(1, 110, 600, 180, 640);
    controls.pointerDown(2, 280, 560, 180, 640);
    const frame = controls.frame();
    assert.equal(frame.moveActive, false);
    assert.equal(frame.firing, true);
    assert.ok(frame.stickX > 0);
    assert.ok(frame.stickY > 0);
    controls.pointerUp(2);
    assert.equal(controls.frame().firing, false);
    assert.ok(controls.frame().stickX > 0);
  });

  it('ignores a touch that misses both pads', () => {
    const controls = new Controls();
    controls.setScheme('joystick');
    controls.setActionRects(stick, fire);
    controls.pointerDown(3, 180, 200, 100, 100);
    const frame = controls.frame();
    assert.equal(controls.moveId, null);
    assert.equal(controls.fireId, null);
    assert.equal(frame.stickX, 0);
    assert.equal(frame.firing, false);
  });

  it('still lets the mouse drag while the pads are the touch controls', () => {
    const controls = new Controls();
    controls.setScheme('joystick');
    controls.setActionRects(stick, fire);
    controls.mouseDown(0, 10, 10, 40, 50);
    controls.mouseMove(30, 20);
    const frame = controls.frame();
    assert.equal(frame.moveActive, true);
    assert.equal(frame.targetX, 40 + 20 * DRAG_FOLLOW);
    assert.equal(frame.targetY, 50 + 10 * DRAG_FOLLOW);
  });

  it('lets a left-side drag steer while the fire button fires', () => {
    const controls = new Controls();
    controls.setActionRects(stick, fire);
    controls.pointerDown(1, 40, 200, 180, 640);
    controls.pointerDown(2, 280, 560, 180, 640);
    controls.pointerMove(1, 70, 180);
    const frame = controls.frame();
    assert.equal(frame.moveActive, true);
    assert.equal(frame.firing, true);
    assert.equal(frame.targetX, 180 + 30 * DRAG_FOLLOW);
    assert.equal(frame.targetY, 640 - 20 * DRAG_FOLLOW);
    controls.pointerDown(3, 90, 220, 180, 640);
    assert.equal(controls.fireId, 2);
    assert.equal(controls.moveId, 1);
  });

  it('crawls just outside the dead zone and reaches full speed only at the rim', () => {
    const radius = 100;
    assert.deepEqual(stickResponse(STICK_DEAD_ZONE * radius, 0, radius), { x: 0, y: 0 });
    const gentle = stickResponse(0.2 * radius, 0, radius);
    const halfway = stickResponse(0.5 * radius, 0, radius);
    const rim = stickResponse(radius, 0, radius);
    const past = stickResponse(radius * 3, 0, radius);
    const t = (raw: number) => (raw - STICK_DEAD_ZONE) / (1 - STICK_DEAD_ZONE);
    assert.ok(Math.abs(gentle.x - t(0.2) ** 1.5) < 1e-9);
    assert.ok(gentle.x < 0.2);
    assert.ok(Math.abs(halfway.x - t(0.5) ** 1.5) < 1e-9);
    assert.ok(halfway.x < 0.5);
    assert.ok(Math.abs(rim.x - 1) < 1e-9);
    assert.ok(Math.abs(past.x - 1) < 1e-9);
    const diagonal = stickResponse(radius, radius, radius);
    assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-9);
    assert.ok(Math.abs(diagonal.x - diagonal.y) < 1e-9);
  });
});
