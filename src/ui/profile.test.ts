import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shipUnlocked, SHIPS } from '../game/ships';
import { memoryStore } from './kv';
import { FRESH_PROFILE, loadProfile, parseProfile, recordRun, saveProfile, selectShip } from './profile';

describe('local high scores and ships', () => {
  it('keeps the top 10 and unlocks a ship from either score or wave', () => {
    let profile = FRESH_PROFILE;
    for (let i = 0; i < 12; i += 1) profile = recordRun(profile, i * 100, i + 1, i);
    assert.equal(profile.scores.length, 10);
    assert.equal(profile.scores[0].score, 1100);
    assert.equal(profile.scores[9].score, 200);
    assert.equal(profile.bestWave, 12);
    assert.equal(shipUnlocked(SHIPS[0], 0, 1), true);
    assert.equal(shipUnlocked(SHIPS[1], 0, 3), false);
    assert.equal(shipUnlocked(SHIPS[1], 0, 4), true);
    assert.equal(shipUnlocked(SHIPS[1], 2500, 1), true);
    const picked = selectShip(profile, 'ember');
    assert.equal(picked.shipId, 'ember');
    assert.equal(selectShip(FRESH_PROFILE, 'gold').shipId, 'classic');
    const pink = SHIPS.find((ship) => ship.id === 'superpink')!;
    assert.equal(pink.premium, true);
    assert.equal(shipUnlocked(pink, 999999, 99), false);
    assert.equal(selectShip(recordRun(FRESH_PROFILE, 60000, 20, 1), 'megadark').shipId, 'classic');
    assert.equal(selectShip(FRESH_PROFILE, 'megadark', { owned: [], unlockAll: true }).shipId, 'megadark');
  });

  it('round-trips a saved profile and drops a bad ship id', async () => {
    const store = memoryStore();
    await saveProfile(store, recordRun({ ...FRESH_PROFILE, shipId: 'violet' }, 9000, 8, 4));
    const loaded = await loadProfile(store);
    assert.equal(loaded.bestScore, 9000);
    assert.equal(loaded.shipId, 'violet');
    assert.equal(parseProfile('{"shipId":"nope","scores":[{"score":10,"wave":2}]}').shipId, 'classic');
    assert.deepEqual(await loadProfile(memoryStore()), { ...FRESH_PROFILE, scores: [] });
  });
});
