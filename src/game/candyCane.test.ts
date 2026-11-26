import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CANDY_RED,
  CANDY_SKEW,
  CANDY_SPEED,
  CANDY_STRIPE,
  CANDY_WHITE,
  LASER_BODY_HALF,
  LASER_LENGTH_SCALE,
  beamHalfAt,
  candyGlowQuad,
  candyQuads,
  candyScroll,
  laserLength,
} from './candyCane';

describe('festive candy-cane laser', () => {
  it('uses the same straight reach as the other beams', () => {
    assert.equal(laserLength(390, 844), 844 * LASER_LENGTH_SCALE);
    assert.equal(laserLength(900, 400), 900 * LASER_LENGTH_SCALE);
    const glow = candyGlowQuad(500);
    assert.deepEqual(
      glow.map(([along]) => along),
      [0, 0, 500, 500],
    );
    assert.ok(glow.every(([, side]) => Math.abs(side) > 0));
    assert.equal(glow[0][1], -glow[1][1]);
    assert.equal(glow[2][1], -glow[3][1]);
  });

  it('fills a straight tapered beam with diagonal red and white stripes', () => {
    const length = 480;
    const quads = candyQuads(length, 0);
    assert.ok(quads.length > 4);
    const colors = new Set(quads.map((quad) => quad.color));
    assert.deepEqual(colors, new Set([CANDY_RED, CANDY_WHITE]));
    for (const quad of quads) {
      assert.ok(quad.corners.length >= 3);
      let minAlong = Infinity;
      let maxAlong = -Infinity;
      for (const [along, side] of quad.corners) {
        assert.ok(along >= -1e-6 && along <= length + 1e-6);
        assert.ok(Math.abs(Math.abs(side) - beamHalfAt(along, length, LASER_BODY_HALF)) < 1e-6);
        minAlong = Math.min(minAlong, along);
        maxAlong = Math.max(maxAlong, along);
      }
      const full = quad.corners.length === 4 && minAlong > 1 && maxAlong < length - 1;
      if (!full) continue;
      const meanAlong = (pts: ReadonlyArray<readonly [number, number]>) => pts.reduce((sum, [along]) => sum + along, 0) / pts.length;
      const positive = quad.corners.filter(([, side]) => side > 0);
      const negative = quad.corners.filter(([, side]) => side < 0);
      assert.equal(positive.length, 2);
      assert.equal(negative.length, 2);
      assert.ok(Math.abs(meanAlong(positive) - meanAlong(negative) - 2 * CANDY_SKEW) < 1e-6);
      assert.ok(maxAlong - minAlong > CANDY_SKEW, 'stripe runs diagonally, not as a perpendicular band');
    }
    const order = quads.map((quad) => quad.color);
    assert.ok(order.includes(CANDY_RED) && order.includes(CANDY_WHITE));
    assert.notEqual(order[0], order[1]);
  });

  it('scrolls the stripes outward from the ship toward the tip', () => {
    const length = 480;
    const before = candyQuads(length, 0);
    const after = candyQuads(length, 0.01);
    assert.equal(before.length, after.length);
    const stripe = before[6];
    const moved = after[6];
    assert.equal(stripe.color, moved.color);
    assert.ok(moved.corners[0][0] > stripe.corners[0][0]);
    assert.ok(moved.corners[0][0] - stripe.corners[0][0] < CANDY_STRIPE);
    assert.equal(candyScroll(0), 0);
    assert.ok(candyScroll(0.05) > 0);
    assert.ok(candyScroll((CANDY_STRIPE * 2) / CANDY_SPEED) < 1e-6);
  });
});
