import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RAPID_CONE } from './constants';
import { RAPID_MUZZLE, rapidStreaks } from './abilityArt';

describe('rapid fire icon', () => {
  it('matches the live 30 degree cone with four equal flat streaks', () => {
    const radius = 20;
    const streaks = rapidStreaks(radius);
    const muzzleY = radius * RAPID_MUZZLE;
    assert.equal(streaks.length, 4);
    const length = Math.hypot(streaks[0].x1 - streaks[0].x0, streaks[0].y1 - streaks[0].y0);
    streaks.forEach((streak, index) => {
      assert.ok(Math.abs(streak.lean) <= RAPID_CONE / 2 + 1e-9);
      assert.equal(Math.sign(streak.lean), index % 2 === 0 ? -1 : 1);
      const streakLength = Math.hypot(streak.x1 - streak.x0, streak.y1 - streak.y0);
      assert.ok(Math.abs(streakLength - length) < 1e-6);
      const fromMuzzle = Math.hypot(streak.x0, streak.y0 - muzzleY);
      if (index > 0) {
        const previous = Math.hypot(streaks[index - 1].x0, streaks[index - 1].y0 - muzzleY);
        assert.ok(fromMuzzle > previous + 1);
      }
      assert.equal(streak.body.length, 4);
      assert.equal(streak.core.length, 4);
    });
    assert.ok(Math.abs(Math.abs(streaks[0].lean) - RAPID_CONE / 2) < 1e-9);
    assert.ok(Math.abs(Math.abs(streaks[1].lean) - RAPID_CONE / 2) < 1e-9);
  });
});
