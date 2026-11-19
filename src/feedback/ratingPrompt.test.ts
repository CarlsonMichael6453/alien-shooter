import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { memoryStore } from '../ui/kv';
import {
  FRESH_RATING,
  RATING_COOLDOWN_MS,
  isNewHighScore,
  loadRatingMemory,
  parseRatingMemory,
  rememberRatingChoice,
  saveRatingMemory,
  shouldAskForRating,
} from './ratingPrompt';

const day = 24 * 60 * 60 * 1000;

describe('rating prompt cooldown', () => {
  it('asks only for a new high score, and not for a zero or a tie', () => {
    assert.equal(isNewHighScore(40, 0), true);
    assert.equal(isNewHighScore(40, 40), false);
    assert.equal(isNewHighScore(10, 25), false);
    assert.equal(isNewHighScore(0, 0), false);
    assert.equal(shouldAskForRating(FRESH_RATING, 1_000, false), false);
    assert.equal(shouldAskForRating(FRESH_RATING, 1_000, true), true);
  });

  it('waits 90 days after Not now or Rate it, and stays quiet after Don\'t ask again', () => {
    const asked = rememberRatingChoice('later', 0);
    assert.equal(shouldAskForRating(asked, RATING_COOLDOWN_MS - 1, true), false);
    assert.equal(shouldAskForRating(asked, RATING_COOLDOWN_MS, true), true);
    assert.equal(shouldAskForRating(rememberRatingChoice('rate', 0), 10 * day, true), false);
    const silenced = rememberRatingChoice('never', 0);
    assert.equal(shouldAskForRating(silenced, RATING_COOLDOWN_MS * 4, true), false);
    assert.equal(shouldAskForRating({ never: false, lastAskedAt: 5_000 }, 1_000, true), false);
  });

  it('remembers the choice across a save', async () => {
    const store = memoryStore();
    await saveRatingMemory(store, rememberRatingChoice('never', 50));
    assert.deepEqual(await loadRatingMemory(store), { never: true, lastAskedAt: 50 });
    assert.deepEqual(parseRatingMemory('nope'), FRESH_RATING);
    assert.deepEqual(parseRatingMemory('{"lastAskedAt":12}'), { never: false, lastAskedAt: 12 });
    assert.deepEqual(await loadRatingMemory(memoryStore()), FRESH_RATING);
  });
});
