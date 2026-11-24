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

  it('keeps the fire button when an ability slot reaches into it', () => {
    const controls = new Controls();
    controls.setScheme('drag');
    const slot = { x: 334, y: 666, w: 46, h: 46 };
    const fire = { x: 300, y: slot.y + slot.h + 8, w: 80, h: 80 };
    controls.setInventoryRects([
      { x: 230, y: 666, w: 46, h: 46 },
      slot,
      { x: 386, y: 666, w: 46, h: 46 },
    ]);
    controls.setActionRects(null, fire);
    const onButton = controls.pointerDown(4, fire.x + fire.w / 2, fire.y + 4, 100, 400);
    assert.equal(onButton, 'play');
    assert.equal(controls.fireId, 4);
    assert.equal(controls.moveId, null);
    assert.equal(controls.consumePower(), null);
    assert.equal(controls.frame().firing, true);
    controls.pointerUp(4);

    const gap = controls.pointerDown(5, slot.x + slot.w / 2, slot.y + slot.h + 4, 100, 400);
    assert.equal(gap, 'power');
    assert.equal(controls.fireId, null);
    assert.equal(controls.moveId, null);
    assert.equal(controls.consumePower(), 1);

    const icon = controls.pointerDown(6, slot.x + 4, slot.y + 4, 100, 400);
    assert.equal(icon, 'power');
    assert.equal(controls.consumePower(), 1);
  });

  it('claims the fire hit zone even if that finger was first seen as a drag', () => {
    const controls = new Controls();
    controls.setScheme('drag');
    controls.setActionRects(null, { x: 300, y: 500, w: 80, h: 80 });
    controls.setInventoryRects([{ x: 334, y: 440, w: 46, h: 46 }]);
    assert.equal(controls.pointerDown(4, 20, 200, 100, 300), 'play');
    controls.claimFire(4, 340, 540, 100, 300);
    assert.equal(controls.fireId, 4);
    assert.equal(controls.moveId, null);
    assert.equal(controls.frame().firing, true);
    controls.pointerDown(5, 350, 450, 100, 300);
    assert.equal(controls.consumePower(), 0);
    assert.equal(controls.fireId, 4);
    assert.equal(controls.frame().firing, true);
  });

  it('fires while a finger drags, and a slot tap does not release the trigger', () => {
    const controls = new Controls();
    controls.setScheme('drag');
    const slot = { x: 334, y: 666, w: 46, h: 46 };
    const fire = { x: 300, y: 740, w: 80, h: 80 };
    controls.setInventoryRects([slot]);
    controls.setActionRects(null, fire);
    assert.equal(controls.pointerDown(1, 40, 500, 180, 600), 'play');
    controls.pointerMove(1, 70, 540);
    assert.equal(controls.pointerDown(2, fire.x + 20, fire.y + 20, 180, 600), 'play');
    const frame = controls.frame();
    assert.equal(frame.firing, true);
    assert.equal(frame.moveActive, true);
    assert.equal(controls.pointerDown(3, slot.x + 10, slot.y + 10, 180, 600), 'power');
    assert.equal(controls.consumePower(), 0);
    assert.equal(controls.fireId, 2);
    assert.equal(controls.moveId, 1);
    assert.equal(controls.frame().firing, true);
    controls.claimPower(2, 0);
    assert.equal(controls.fireId, 2);
    assert.equal(controls.frame().firing, true);
    assert.equal(controls.consumePower(), null);
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

  it('drops fingers the browser no longer lists so a later power tap still lands', () => {
    const controls = new Controls();
    controls.setScheme('drag');
    controls.setInventoryRects([{ x: 300, y: 400, w: 46, h: 46 }]);
    controls.setActionRects(null, { x: 40, y: 500, w: 80, h: 80 });
    controls.pointerDown(1, 20, 100, 100, 300);
    controls.pointerDown(2, 60, 540, 100, 300);
    assert.equal(controls.moveId, 1);
    assert.equal(controls.fireId, 2);
    controls.syncTouches([2]);
    assert.equal(controls.moveId, null);
    assert.equal(controls.fireId, 2);
    controls.syncTouches([]);
    assert.equal(controls.fireId, null);
    assert.equal(controls.pointerDown(1, 320, 420, 100, 300), 'power');
    assert.equal(controls.consumePower(), 0);
  });

  it('lets a repeated tap use a shield after a finger was never released', () => {
    const controls = new Controls();
    controls.setScheme('drag');
    controls.setInventoryRects([{ x: 300, y: 400, w: 46, h: 46 }]);
    controls.setActionRects(null, { x: 300, y: 520, w: 80, h: 80 });
    assert.equal(controls.pointerDown(1, 30, 200, 100, 300), 'play');
    assert.equal(controls.moveId, 1);
    assert.equal(controls.pointerDown(1, 320, 420, 100, 300), 'power');
    assert.equal(controls.moveId, null);
    assert.equal(controls.consumePower(), 0);
    assert.equal(controls.pointerDown(1, 320, 420, 100, 300), 'power');
    assert.equal(controls.consumePower(), 0);
  });

  it('aims the laser with its own finger while steering and firing', () => {
    const controls = new Controls();
    controls.setScheme('drag');
    const laser = { x: 16, y: 360, w: 92, h: 92 };
    const fire = { x: 300, y: 520, w: 80, h: 80 };
    controls.setLaserRect(laser);
    controls.setActionRects(null, fire);
    controls.setInventoryRects([{ x: 334, y: 466, w: 46, h: 46 }]);
    assert.equal(controls.pointerDown(1, 40, 200, 180, 400), 'play');
    assert.equal(controls.pointerDown(2, fire.x + 20, fire.y + 30, 180, 400), 'play');
    assert.equal(controls.pointerDown(3, laser.x + 70, laser.y + 30, 180, 400), 'play');
    controls.pointerMove(1, 80, 220);
    const frame = controls.frame();
    assert.equal(frame.moveActive, true);
    assert.equal(frame.firing, true);
    assert.equal(frame.laserAimActive, true);
    assert.ok(frame.laserAimX > 10);
    assert.equal(controls.fireId, 2);
    assert.equal(controls.moveId, 1);
    assert.equal(controls.laserId, 3);
    controls.pointerUp(3);
    const released = controls.frame();
    assert.equal(released.laserAimActive, false);
    assert.equal(released.firing, true);
    controls.claimLaser(2, fire.x + 10, fire.y + 10);
    assert.equal(controls.fireId, 2);
    assert.equal(controls.laserId, null);
    controls.setLaserRect(null);
    controls.claimLaser(8, 40, 200);
    assert.equal(controls.laserId, null);
    assert.equal(controls.fireId, 2);
    controls.pointerDown(4, 350, 480, 180, 400);
    assert.equal(controls.consumePower(), 0);
    assert.equal(controls.fireId, 2);
    assert.equal(controls.frame().firing, true);
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
