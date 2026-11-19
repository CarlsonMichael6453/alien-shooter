import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { memoryStore } from '../ui/kv';
import {
  FRESH_RATING,
  RATING_COOLDOWN_MS,
  RATING_MIN_DEATHS,
  loadRatingMemory,
  parseRatingMemory,
  recordDeath,
  rememberRatingChoice,
  saveRatingMemory,
  shouldAskForRating,
} from './ratingPrompt';

const day = 24 * 60 * 60 * 1000;

function withDeaths(deaths: number) {
  let memory = { ...FRESH_RATING };
  for (let i = 0; i < deaths; i += 1) memory = recordDeath(memory);
  return memory;
}

describe('rating prompt cooldown', () => {
  it('asks only after five deaths, and not before', () => {
    const four = withDeaths(RATING_MIN_DEATHS - 1);
    const five = recordDeath(four);
    assert.equal(four.deaths, 4);
    assert.equal(shouldAskForRating(four, 1_000), false);
    assert.equal(shouldAskForRating(five, 1_000), true);
    assert.equal(shouldAskForRating(FRESH_RATING, 1_000), false);
  });

  it('waits 30 days after the prompt is shown, and stays quiet after Don\'t ask again', () => {
    const ready = withDeaths(RATING_MIN_DEATHS);
    const asked = rememberRatingChoice('later', 0, ready.deaths);
    assert.equal(shouldAskForRating(asked, RATING_COOLDOWN_MS - 1), false);
    assert.equal(shouldAskForRating(asked, RATING_COOLDOWN_MS), true);
    assert.equal(shouldAskForRating(rememberRatingChoice('rate', 0, ready.deaths), 10 * day), false);
    assert.equal(shouldAskForRating(rememberRatingChoice('rate', 0, ready.deaths), 30 * day), true);
    const silenced = rememberRatingChoice('never', 0, ready.deaths);
    assert.equal(shouldAskForRating(silenced, RATING_COOLDOWN_MS * 4), false);
    assert.equal(shouldAskForRating({ never: false, lastAskedAt: 5_000, deaths: 8 }, 1_000), false);
  });

  it('remembers the death count and the choice across a save', async () => {
    const store = memoryStore();
    await saveRatingMemory(store, rememberRatingChoice('never', 50, 6));
    assert.deepEqual(await loadRatingMemory(store), { never: true, lastAskedAt: 50, deaths: 6 });
    assert.deepEqual(parseRatingMemory('nope'), FRESH_RATING);
    assert.deepEqual(parseRatingMemory('{"lastAskedAt":12}'), { never: false, lastAskedAt: 12, deaths: 0 });
    assert.deepEqual(await loadRatingMemory(memoryStore()), FRESH_RATING);
  });
});
