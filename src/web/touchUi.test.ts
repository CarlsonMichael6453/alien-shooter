import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Controls } from '../game/controls';
import { classifyTouch, resolveTouchSurface } from './touchUi';

describe('touch controls over buttons', () => {
  it('keeps a settings tap from steering and from cancelling the button click', () => {
    assert.deepEqual(classifyTouch(true, 'chrome'), { play: false, cancel: false, dropPlayPointer: false });
    assert.deepEqual(classifyTouch(true, 'play'), { play: false, cancel: false, dropPlayPointer: true });
  });

  it('still cancels ordinary play touches so the page cannot scroll', () => {
    assert.deepEqual(classifyTouch(false, 'play'), { play: true, cancel: true, dropPlayPointer: false });
  });

  it('lets a power-up slot consume the touch without firing a click', () => {
    assert.deepEqual(classifyTouch(false, 'power'), { play: false, cancel: true, dropPlayPointer: false });
  });

  it('keeps an ability slot when iOS reports the icon as a menu control', () => {
    assert.deepEqual(classifyTouch(true, 'play', false, true), { play: false, cancel: true, dropPlayPointer: false });
    assert.deepEqual(classifyTouch(true, 'power'), { play: false, cancel: true, dropPlayPointer: false });
    assert.equal(classifyTouch(true, 'play').dropPlayPointer, true);
  });

  it('keeps a finger that landed on the fire button graphic', () => {
    assert.deepEqual(classifyTouch(true, 'play', true), { play: true, cancel: true, dropPlayPointer: false });
    assert.deepEqual(classifyTouch(true, 'power', true, true), { play: true, cancel: true, dropPlayPointer: false });
    assert.equal(classifyTouch(true, 'play').dropPlayPointer, true);
  });
});

describe('fire button with the laser stick present', () => {
  const fire = { x: 302, y: 536, w: 80, h: 80 };
  const laser = { x: 290, y: 378, w: 92, h: 92 };

  function route(
    controls: Controls,
    id: number,
    x: number,
    y: number,
    target: 'fire' | 'laser' | 'other',
    shipX = 180,
    shipY = 500,
  ): void {
    const surface = resolveTouchSurface({
      target,
      onFireButton: controls.onFireButton(x, y),
      laserArmed: controls.laserArmed(),
      onLaserStick: controls.onLaserStick(x, y),
    });
    if (surface === 'fire') {
      controls.claimFire(id, x, y, shipX, shipY);
      return;
    }
    if (surface === 'laser') {
      controls.claimLaser(id, x, y);
      if (controls.laserId === id) return;
    }
    controls.pointerDown(id, x, y, shipX, shipY);
  }

  it('fires when Safari assigns the fire-button touch to the stick, including while dragging and on a repeat press', () => {
    const controls = new Controls();
    controls.setScheme('drag');
    controls.setActionRects(null, fire);
    controls.setLaserRect(laser);
    route(controls, 1, 40, 420, 'other');
    controls.pointerMove(1, 90, 400);
    const shotX = fire.x + 24;
    const shotY = fire.y + 36;
    assert.equal(
      resolveTouchSurface({
        target: 'laser',
        onFireButton: controls.onFireButton(shotX, shotY),
        laserArmed: true,
        onLaserStick: controls.onLaserStick(shotX, shotY),
      }),
      'fire',
    );
    route(controls, 2, shotX, shotY, 'laser');
    controls.claimLaser(2, shotX, shotY);
    const frame = controls.frame();
    assert.equal(frame.firing, true);
    assert.equal(frame.moveActive, true);
    assert.equal(controls.fireId, 2);
    assert.equal(controls.laserId, null);
    assert.equal(controls.moveId, 1);

    controls.pointerUp(2);
    assert.equal(controls.frame().firing, false);
    route(controls, 3, shotX, shotY, 'laser');
    assert.equal(controls.frame().firing, true);
    assert.equal(controls.fireId, 3);
    assert.equal(controls.moveId, 1);
    assert.equal(controls.laserId, null);
  });

  it('does not let the stick take a touch while the laser is off', () => {
    const controls = new Controls();
    controls.setScheme('drag');
    controls.setActionRects(null, fire);
    controls.setLaserRect(null);
    assert.equal(controls.laserArmed(), false);
    assert.equal(
      resolveTouchSurface({ target: 'laser', onFireButton: false, laserArmed: false, onLaserStick: false }),
      'other',
    );
    route(controls, 4, laser.x + 20, laser.y + 20, 'laser');
    assert.equal(controls.laserId, null);
    assert.equal(controls.moveId, 4);
    route(controls, 5, fire.x + 12, fire.y + 12, 'laser');
    assert.equal(controls.fireId, 5);
    assert.equal(controls.frame().firing, true);
    assert.equal(controls.laserId, null);
  });

  it('still aims from the stick while the laser is armed and the finger misses the fire button', () => {
    const controls = new Controls();
    controls.setScheme('drag');
    controls.setActionRects(null, fire);
    controls.setLaserRect(laser);
    route(controls, 6, laser.x + 70, laser.y + 30, 'laser');
    const frame = controls.frame();
    assert.equal(controls.laserId, 6);
    assert.equal(frame.firing, false);
    assert.equal(frame.laserAimActive, true);
    assert.equal(
      resolveTouchSurface({ target: 'laser', onFireButton: false, laserArmed: true, onLaserStick: true }),
      'laser',
    );
    assert.equal(resolveTouchSurface({ target: 'fire', onFireButton: false, laserArmed: true, onLaserStick: false }), 'fire');
  });
});
