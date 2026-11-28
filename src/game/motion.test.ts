import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { menuShipBob, prefersReducedMotion } from './motion';

describe('menu ship motion', () => {
  it('bobs gently and stays still when motion is reduced', () => {
    assert.equal(menuShipBob(0, false), 0);
    assert.ok(menuShipBob(0.4, false) > 0);
    assert.ok(Math.abs(menuShipBob(1, false)) <= 4);
    assert.equal(menuShipBob(0.4, true), 0);
  });

  it('finds no reduced-motion preference when the browser has no matchMedia', () => {
    assert.equal(prefersReducedMotion(), false);
  });
});