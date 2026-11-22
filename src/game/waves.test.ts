import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BOSS_EVERY, bossSectorForWave, isBossWave, waveQuota } from './waves';

describe('endless waves', () => {
  it('sends a boss every third wave and makes the quota climb', () => {
    assert.equal(BOSS_EVERY, 3);
    assert.equal(isBossWave(1), false);
    assert.equal(isBossWave(2), false);
    assert.equal(isBossWave(3), true);
    assert.equal(isBossWave(6), true);
    assert.ok(waveQuota(2) > waveQuota(1));
    assert.ok(waveQuota(8) > waveQuota(3));
    assert.ok(waveQuota(40) <= 16);
    assert.equal(bossSectorForWave(3), 0);
    assert.equal(bossSectorForWave(6), 1);
  });
});
