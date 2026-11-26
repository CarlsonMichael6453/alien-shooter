import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { musicChangesWithShip, shipMusic } from './shipThemes';

describe('per-ship music', () => {
  it('gives every ship, including the premium ones, its own theme', () => {
    const ids = ['classic', 'ember', 'violet', 'gold', 'superpink', 'festive', 'megadark'];
    const roots = ids.map((id) => shipMusic(id).root);
    assert.equal(new Set(roots).size, ids.length);
    assert.ok(shipMusic('superpink').root > shipMusic('megadark').root);
    assert.equal(shipMusic('nope').id, 'classic');
  });

  it('switches the theme only when the ship changes', () => {
    assert.equal(musicChangesWithShip('classic', 'classic'), false);
    assert.equal(musicChangesWithShip('classic', 'festive'), true);
    assert.equal(musicChangesWithShip('megadark', 'superpink'), true);
  });
});
