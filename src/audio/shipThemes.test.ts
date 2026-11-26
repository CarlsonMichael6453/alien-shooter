import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { musicChangesWithShip, musicNotesDue, pewAllowed, pewSweep, shipMusic } from './shipThemes';

describe('per-ship music', () => {
  it('gives every ship, including the premium ones, its own theme', () => {
    const ids = ['classic', 'ember', 'violet', 'gold', 'superpink', 'festive', 'megadark'];
    const roots = ids.map((id) => shipMusic(id).root);
    assert.equal(new Set(roots).size, ids.length);
    assert.ok(shipMusic('superpink').root > shipMusic('megadark').root);
    assert.equal(shipMusic('nope').id, 'classic');
  });

  it('shapes a pew as a short downward sweep, tinted by the ship', () => {
    const classic = pewSweep('classic');
    const dark = pewSweep('megadark');
    const pink = pewSweep('superpink');
    assert.ok(Math.abs(classic.from - 1200) < 1);
    assert.ok(Math.abs(classic.to - 200) < 1);
    assert.equal(classic.dur, 0.1);
    assert.ok(classic.from / classic.to > 5);
    assert.ok(dark.from < classic.from);
    assert.ok(pink.from > classic.from);
  });

  it('drops extra pews during rapid fire so they do not stack every 0.02s', () => {
    assert.equal(pewAllowed(1, 1.02), false);
    assert.equal(pewAllowed(1, 1.05), true);
  });

  it('does not replay the beats missed while the run was over', () => {
    const caughtUp = musicNotesDue(10, 40, 0.24);
    assert.ok(caughtUp.count <= 3, `scheduled ${caughtUp.count} notes after a long gap`);
    assert.ok(caughtUp.next >= 40);
    const steady = musicNotesDue(40, 40, 0.24);
    assert.ok(steady.count >= 1 && steady.count <= 3);
  });

  it('switches the theme only when the ship changes', () => {
    assert.equal(musicChangesWithShip('classic', 'classic'), false);
    assert.equal(musicChangesWithShip('classic', 'festive'), true);
    assert.equal(musicChangesWithShip('megadark', 'superpink'), true);
  });
});
