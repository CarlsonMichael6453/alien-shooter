import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { memoryStore } from './kv';
import { LASER_HINT_KEY, LASER_HINT_SECONDS, laserHintSeen, loadLaserHintSeen, saveLaserHintSeen } from './laserHint';

describe('laser aim hint', () => {
  it('shows until the flag is stored', async () => {
    assert.equal(laserHintSeen(null), false);
    assert.equal(laserHintSeen('nope'), false);
    const store = memoryStore();
    assert.equal(await loadLaserHintSeen(store), false);
    await saveLaserHintSeen(store);
    assert.equal(await store.getItem(LASER_HINT_KEY), 'seen');
    assert.equal(await loadLaserHintSeen(store), true);
    assert.ok(LASER_HINT_SECONDS >= 3 && LASER_HINT_SECONDS <= 6);
  });
});
