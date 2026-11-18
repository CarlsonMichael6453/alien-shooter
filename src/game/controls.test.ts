import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Controls } from './controls';

describe('two-finger controls', () => {
  it('treats the first touch as move and the second as fire', () => {
    const controls = new Controls();
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
    controls.pointerDown(1, 30, 400, 180, 640);
    controls.pointerMove(1, 70, 360);
    const frame = controls.frame();
    assert.equal(frame.targetX, 220);
    assert.equal(frame.targetY, 600);
  });

  it('keeps the fire finger firing after the move finger lifts', () => {
    const controls = new Controls();
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
    controls.pointerDown(1, 0, 0, 0, 0);
    controls.pointerDown(2, 0, 0, 0, 0);
    controls.pointerUp(2);
    assert.equal(controls.frame().firing, false);
    assert.equal(controls.moveId, 1);
  });

  it('reanchors so a restart does not throw the ship back to the old spot', () => {
    const controls = new Controls();
    controls.pointerDown(1, 10, 10, 100, 100);
    controls.pointerMove(1, 40, 25);
    assert.equal(controls.frame().targetX, 130);
    controls.reanchor(200, 500);
    const frame = controls.frame();
    assert.equal(frame.targetX, 200);
    assert.equal(frame.targetY, 500);
  });

  it('normalizes diagonal keys and fires from Space without a touch', () => {
    const controls = new Controls();
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
    controls.mouseDown(2, 0, 0, 10, 10);
    assert.equal(controls.frame().firing, true);
    assert.equal(controls.moveId, null);
    controls.mouseDown(0, 5, 5, 40, 50);
    controls.mouseMove(15, 25);
    const frame = controls.frame();
    assert.equal(frame.moveActive, true);
    assert.equal(frame.targetX, 50);
    assert.equal(frame.targetY, 70);
    assert.equal(frame.firing, true);
    controls.mouseUp(2);
    assert.equal(controls.frame().firing, false);
  });

  it('treats a tap on the bomb button as a bomb, not a steering finger', () => {
    const controls = new Controls();
    controls.setInventoryRects([{ x: 14, y: 700, w: 56, h: 56 }]);
    controls.pointerDown(1, 30, 720, 100, 100);
    assert.equal(controls.moveId, null);
    assert.equal(controls.consumePower(), 0);
    assert.equal(controls.consumePower(), null);
    controls.pointerDown(2, 40, 40, 100, 100);
    assert.equal(controls.moveId, 2);
  });

  it('reports how far the firing finger has dragged', () => {
    const controls = new Controls();
    controls.pointerDown(1, 10, 10, 0, 0);
    controls.pointerDown(2, 80, 200, 0, 0);
    controls.pointerMove(2, 40, 120);
    const frame = controls.frame();
    assert.equal(frame.fireDragX, -40);
    assert.equal(frame.fireDragY, -80);
  });
});
