import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { KEYBOARD_SPEED, SHIP_MARGIN } from './constants';
import { createGame, difficulty, idleIntent, makeEnemy, step } from './logic';
import { createRng } from './rng';

function playing(width = 400, height = 800) {
  const state = createGame(width, height, createRng(7));
  state.mode = 'playing';
  state.spawnCooldown = 50;
  state.enemies = [];
  state.bullets = [];
  state.fireCooldown = 0;
  return state;
}

describe('simulation', () => {
  it('ramps spawn rate and speed gently', () => {
    const early = difficulty(0);
    const late = difficulty(80);
    assert.ok(early.spawnInterval > late.spawnInterval);
    assert.ok(early.speed < late.speed);
    assert.ok(late.maxEnemies > early.maxEnemies);
    assert.ok(early.spawnInterval < 1.5);
    assert.ok(late.spawnInterval > 0.3);
  });

  it('does not spawn until the run starts', () => {
    const state = createGame(400, 800, createRng(1));
    for (let i = 0; i < 20; i += 1) step(state, idleIntent(), 0.5);
    assert.equal(state.mode, 'ready');
    assert.equal(state.enemies.length, 0);
    assert.equal(state.shotsFired, 0);
  });

  it('starts spawning after the opening delay', () => {
    const state = createGame(400, 800, createRng(3));
    step(state, idleIntent({ start: true }), 0.016);
    assert.equal(state.mode, 'playing');
    assert.equal(state.enemies.length, 0);
    for (let i = 0; i < 16; i += 1) step(state, idleIntent(), 0.05);
    assert.ok(state.enemies.length >= 1);
    for (const enemy of state.enemies) {
      assert.ok(enemy.x > 0 && enemy.x < state.width);
    }
  });

  it('fires on a steady interval only while the trigger is held', () => {
    const state = playing();
    step(state, idleIntent({ firing: true }), 0.016);
    assert.equal(state.shotsFired, 1);
    step(state, idleIntent({ firing: true }), 0.05);
    step(state, idleIntent({ firing: true }), 0.05);
    assert.equal(state.shotsFired, 1);
    step(state, idleIntent({ firing: true }), 0.05);
    assert.equal(state.shotsFired, 2);
    const fired = state.shotsFired;
    step(state, idleIntent({ firing: false }), 0.5);
    assert.equal(state.shotsFired, fired);
  });

  it('sends bullets upward and drops them off the top', () => {
    const state = playing();
    state.bullets.push({ id: 1, x: 40, y: 100, vy: -780, r: 6 });
    step(state, idleIntent(), 0.05);
    assert.ok(state.bullets[0].y < 100);
    state.bullets[0].y = -50;
    step(state, idleIntent(), 0.016);
    assert.equal(state.bullets.length, 0);
  });

  it('awards points when a bullet hits an alien or an asteroid', () => {
    const state = playing();
    state.enemies.push(makeEnemy({ id: 1, x: 120, y: 200, r: 20, score: 100, kind: 'alien' }));
    state.bullets.push({ id: 2, x: 120, y: 200, vy: -780, r: 6 });
    step(state, idleIntent(), 0.016);
    assert.equal(state.score, 100);
    assert.equal(state.enemies.length, 0);
    assert.equal(state.bullets.length, 0);

    state.enemies.push(makeEnemy({ id: 3, x: 80, y: 300, r: 24, score: 50, kind: 'asteroid', shape: 'rock' }));
    state.bullets.push({ id: 4, x: 80, y: 300, vy: -780, r: 6 });
    step(state, idleIntent(), 0.016);
    assert.equal(state.score, 150);
  });

  it('only scores an enemy once when two bullets overlap it', () => {
    const state = playing();
    state.enemies.push(makeEnemy({ id: 1, x: 100, y: 100, r: 20, score: 100 }));
    state.bullets.push({ id: 2, x: 100, y: 100, vy: -100, r: 6 });
    state.bullets.push({ id: 3, x: 102, y: 100, vy: -100, r: 6 });
    step(state, idleIntent(), 0.016);
    assert.equal(state.score, 100);
  });

  it('costs a life when an enemy hits the ship and then grants a grace period', () => {
    const state = playing();
    state.shipX = 200;
    state.shipY = 400;
    state.enemies.push(makeEnemy({ id: 1, x: 200, y: 400, r: 18 }));
    step(state, idleIntent(), 0.016);
    assert.equal(state.lives, 2);
    assert.ok(state.invuln > 1);
    assert.equal(state.enemies.length, 0);

    state.enemies.push(makeEnemy({ id: 2, x: 200, y: 400, r: 18 }));
    step(state, idleIntent(), 0.016);
    assert.equal(state.lives, 2);
    assert.equal(state.enemies.length, 0);
  });

  it('lets a bullet save the ship when both would overlap on the same frame', () => {
    const state = playing();
    state.shipX = 200;
    state.shipY = 400;
    state.enemies.push(makeEnemy({ id: 1, x: 200, y: 400, r: 16, score: 100 }));
    state.bullets.push({ id: 2, x: 200, y: 400, vy: -100, r: 6 });
    step(state, idleIntent(), 0.016);
    assert.equal(state.lives, 3);
    assert.equal(state.score, 100);
  });

  it('ends the run at zero lives and restarts on tap without forgetting the best score', () => {
    const state = playing();
    state.lives = 1;
    state.score = 250;
    state.shipX = 200;
    state.shipY = 500;
    state.enemies.push(makeEnemy({ id: 1, x: 200, y: 500, r: 20 }));
    step(state, idleIntent(), 0.016);
    assert.equal(state.mode, 'over');
    assert.equal(state.best, 250);
    step(state, idleIntent({ restart: true }), 0.05);
    assert.equal(state.mode, 'over');
    assert.equal(state.score, 250);
    for (let i = 0; i < 10; i += 1) step(state, idleIntent({ restart: true }), 0.05);
    assert.equal(state.mode, 'playing');
    assert.equal(state.score, 0);
    assert.equal(state.lives, 3);
    assert.equal(state.best, 250);
    assert.equal(state.enemies.length, 0);
  });

  it('removes enemies that leave the bottom without scoring them', () => {
    const state = playing();
    state.enemies.push(makeEnemy({ id: 1, x: 40, y: state.height + 80, r: 12, vy: 40 }));
    step(state, idleIntent(), 0.016);
    assert.equal(state.enemies.length, 0);
    assert.equal(state.score, 0);
  });

  it('clamps the ship and ignores the keyboard while a finger is steering', () => {
    const state = playing();
    step(state, idleIntent({ moveActive: true, targetX: -200, targetY: 5 }), 0.016);
    assert.equal(state.shipX, SHIP_MARGIN);
    assert.equal(state.shipY, SHIP_MARGIN);

    state.shipX = 120;
    const before = state.shipX;
    step(
      state,
      idleIntent({ moveActive: true, targetX: before, targetY: state.shipY, keyX: 1 }),
      0.2,
    );
    assert.equal(state.shipX, before);

    step(state, idleIntent({ keyX: 1 }), 0.05);
    assert.ok(Math.abs(state.shipX - (before + KEYBOARD_SPEED * 0.05)) < 0.001);
  });
});
