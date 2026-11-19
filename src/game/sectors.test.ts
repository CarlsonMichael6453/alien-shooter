import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SECTORS, SECTOR_SCORE, bossHealth, nextBossScore, sectorTheme } from './sectors';

describe('sectors', () => {
  it('names the five sectors and loops them with a higher pass', () => {
    assert.deepEqual(
      [0, 1, 2, 3, 4].map((index) => sectorTheme(index).name),
      ['Deep Space', 'Asteroid Belt', 'Nebula', 'Red Giant', 'Alien Homeworld'],
    );
    const again = sectorTheme(5);
    assert.equal(again.name, 'Deep Space');
    assert.equal(again.loop, 1);
    assert.equal(sectorTheme(9).name, SECTORS[4].name);
    assert.equal(sectorTheme(9).loop, 1);
  });

  it('triggers a boss every 1000 points and makes each one tougher', () => {
    assert.equal(SECTOR_SCORE, 1000);
    assert.equal(nextBossScore(0), 1000);
    assert.equal(nextBossScore(1), 2000);
    assert.equal(nextBossScore(5), 6000);
    assert.equal(bossHealth(0), 50);
    assert.equal(bossHealth(1), 70);
    assert.ok(bossHealth(4) > bossHealth(1));
    assert.ok(bossHealth(5) > bossHealth(4));
  });
});
