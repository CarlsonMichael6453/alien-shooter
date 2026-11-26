import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { musicChangesWithShip, musicNotesDue, pewAllowed, shipMusic } from './shipThemes';

describe('ship music', () => {
  it('gives every regular ship the same default theme and sound set', () => {
    const regular = ['classic', 'ember', 'violet', 'gold', 'nope'];
    const shared = shipMusic('classic');
    assert.equal(shared.id, 'default');
    for (const id of regular) {
      const theme = shipMusic(id);
      assert.equal(theme.id, shared.id);
      assert.equal(theme.root, shared.root);
      assert.equal(theme.interval, shared.interval);
      assert.equal(theme.voice, shared.voice);
      assert.equal(theme.shoot, shared.shoot);
      assert.equal(theme.rapid, shared.rapid);
      assert.equal(theme.laser, shared.laser);
      assert.deepEqual(theme.scale, shared.scale);
    }
  });

  it('keeps a unique theme for each paid ship', () => {
    const paid = ['superpink', 'festive', 'megadark'];
    const roots = [shipMusic('classic').root, ...paid.map((id) => shipMusic(id).root)];
    assert.equal(new Set(roots).size, roots.length);
    assert.ok(shipMusic('superpink').root > shipMusic('megadark').root);
    for (const id of paid) {
      assert.equal(shipMusic(id).id, id);
      assert.notEqual(shipMusic(id).shoot, shipMusic('classic').shoot);
      assert.notEqual(shipMusic(id).laser, shipMusic('classic').laser);
    }
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

  it('switches the theme only when the sound set changes', () => {
    assert.equal(musicChangesWithShip('classic', 'classic'), false);
    assert.equal(musicChangesWithShip('classic', 'ember'), false);
    assert.equal(musicChangesWithShip('violet', 'gold'), false);
    assert.equal(musicChangesWithShip('gold', 'festive'), true);
    assert.equal(musicChangesWithShip('megadark', 'superpink'), true);
  });
});
