import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AMMO_INTERVAL_SLOW, KEYBOARD_SPEED, LASER_DPS, RAPID_CONE, SHIP_MARGIN, START_AMMO, STICK_SPEED } from './constants';
import { LASER_AIM_RADIUS, laserAngleFromStick } from './laserAim';
import { beamNose, chooseMissileTarget, createGame, difficulty, ensureTutorialDrop, halfScreenRadius, idleIntent, makeEnemy, rollAmmoAmount, step } from './logic';
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
    step(state, idleIntent({ firing: true }), 0.04);
    assert.equal(state.shotsFired, 1);
    step(state, idleIntent({ firing: true }), 0.05);
    assert.equal(state.shotsFired, 2);
    const fired = state.shotsFired;
    step(state, idleIntent({ firing: false }), 0.5);
    assert.equal(state.shotsFired, fired);
  });

  it('sends bullets upward and drops them off the top', () => {
    const state = playing();
    state.bullets.push({ id: 1, x: 40, y: 100, vx: 0, vy: -780, r: 6 });
    step(state, idleIntent(), 0.05);
    assert.ok(state.bullets[0].y < 100);
    state.bullets[0].y = -50;
    step(state, idleIntent(), 0.016);
    assert.equal(state.bullets.length, 0);
  });

  it('awards points when a bullet hits an alien or an asteroid', () => {
    const state = playing();
    state.enemies.push(makeEnemy({ id: 1, x: 120, y: 200, r: 20, score: 100, kind: 'alien' }));
    state.bullets.push({ id: 2, x: 120, y: 200, vx: 0, vy: -780, r: 6 });
    step(state, idleIntent(), 0.016);
    assert.equal(state.score, 100);
    assert.equal(state.enemies.length, 0);
    assert.equal(state.bullets.length, 0);

    state.enemies.push(makeEnemy({ id: 3, x: 80, y: 300, r: 24, score: 50, kind: 'asteroid', shape: 'rock' }));
    state.bullets.push({ id: 4, x: 80, y: 300, vx: 0, vy: -780, r: 6 });
    step(state, idleIntent(), 0.016);
    assert.equal(state.score, 150);
  });

  it('only scores an enemy once when two bullets overlap it', () => {
    const state = playing();
    state.enemies.push(makeEnemy({ id: 1, x: 100, y: 100, r: 20, score: 100 }));
    state.bullets.push({ id: 2, x: 100, y: 100, vx: 0, vy: -100, r: 6 });
    state.bullets.push({ id: 3, x: 102, y: 100, vx: 0, vy: -100, r: 6 });
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
    state.bullets.push({ id: 2, x: 200, y: 400, vx: 0, vy: -100, r: 6 });
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

    const stuck = state.shipX;
    step(state, idleIntent({ stickX: 1 }), 0.05);
    assert.ok(Math.abs(state.shipX - (stuck + STICK_SPEED * 0.05)) < 0.001);
  });

  it('spends one round per bullet and stops when the magazine is empty', () => {
    const state = playing();
    state.ammo = 1;
    step(state, idleIntent({ firing: true }), 0.016);
    assert.equal(state.shotsFired, 1);
    assert.equal(state.ammo, 0);
    step(state, idleIntent({ firing: true }), 0.2);
    assert.equal(state.shotsFired, 1);
    assert.equal(state.ammo, 0);
  });

  it('chips health instead of destroying a tough enemy in one hit', () => {
    const state = playing();
    state.enemies.push(makeEnemy({ id: 1, x: 80, y: 80, r: 20, hp: 10, maxHp: 10, score: 100 }));
    state.bullets.push({ id: 2, x: 80, y: 80, vx: 0, vy: -100, r: 6 });
    step(state, idleIntent(), 0.016);
    assert.equal(state.enemies.length, 1);
    assert.equal(state.enemies[0].hp, 9);
    assert.equal(state.score, 0);
    state.enemies[0].hp = 1;
    state.bullets.push({ id: 3, x: 80, y: state.enemies[0].y, vx: 0, vy: 0, r: 8 });
    step(state, idleIntent(), 0.016);
    assert.equal(state.enemies.length, 0);
    assert.equal(state.score, 100);
  });

  it('places a tutorial ammo box in the ship column and replaces it after a miss', () => {
    const state = playing();
    const cooldown = state.ammoCooldown;
    const id = ensureTutorialDrop(state, 'ammo', null);
    const box = state.pickups.find((pickup) => pickup.id === id)!;
    assert.equal(box.kind, 'ammo');
    assert.equal(box.amount, 100);
    assert.ok(box.y < 0);
    assert.ok(Math.abs(box.x - state.shipX) < 1);
    assert.equal(state.ammoCooldown, cooldown);
    assert.equal(ensureTutorialDrop(state, 'ammo', id), id);
    box.y = state.shipY + 8;
    const again = ensureTutorialDrop(state, 'ammo', id);
    assert.notEqual(again, id);
    const next = state.pickups.find((pickup) => pickup.id === again)!;
    assert.ok(next.y < 0);
    assert.ok(Math.abs(next.x - state.shipX) < 1);
  });

  it('places a tutorial power-up on screen above the ship and replaces a missed one', () => {
    const state = playing();
    const cooldown = state.powerCooldown;
    const id = ensureTutorialDrop(state, 'power', null);
    const drop = state.pickups.find((pickup) => pickup.id === id)!;
    assert.equal(drop.kind, 'rapid');
    assert.ok(drop.y > 0 && drop.y < state.height);
    assert.ok(state.shipY - drop.y >= 110);
    assert.ok(Math.abs(drop.x - state.shipX) < 1);
    assert.equal(state.powerCooldown, cooldown);
    assert.equal(ensureTutorialDrop(state, 'power', id), id);
    drop.y = state.height + 30;
    const again = ensureTutorialDrop(state, 'power', id);
    assert.notEqual(again, id);
    const next = state.pickups.find((pickup) => pickup.id === again)!;
    assert.ok(next.y > 0 && next.y < state.shipY - 100);
  });

  it('collects an ammo box by flying into it', () => {
    const state = playing();
    state.ammo = 10;
    state.pickups.push({
      id: 4,
      kind: 'ammo',
      amount: 200,
      x: state.shipX,
      y: state.shipY,
      vy: 0,
      r: 18,
      spin: 0,
    });
    step(state, idleIntent(), 0.016);
    assert.equal(state.ammo, 210);
    assert.equal(state.pickups.length, 0);
  });

  it('restocks ammo on a shorter timer', () => {
    const state = playing();
    state.time = 0;
    state.ammoCooldown = 0.01;
    state.pickups = [];
    step(state, idleIntent(), 0.02);
    assert.equal(state.pickups.some((pickup) => pickup.kind === 'ammo'), true);
    assert.ok(Math.abs(state.ammoCooldown - AMMO_INTERVAL_SLOW) < 0.001);
    assert.equal(START_AMMO, 200);
  });

  it('drops 100 most often and 400 least often', () => {
    const rng = createRng(4);
    const counts = { 100: 0, 200: 0, 400: 0 };
    for (let i = 0; i < 1000; i += 1) counts[rollAmmoAmount(rng)] += 1;
    assert.ok(counts[100] > counts[200]);
    assert.ok(counts[200] > counts[400]);
    assert.ok(counts[400] > 40);
  });

  it('sprays rapid fire inside a 30 degree cone without spending ammo', () => {
    const state = playing();
    state.rapidTimer = 6;
    state.ammo = START_AMMO;
    const before = state.ammo;
    for (let i = 0; i < 8; i += 1) step(state, idleIntent({ firing: true }), 0.05);
    assert.ok(state.shotsFired >= 8);
    assert.equal(state.ammo, before);
    assert.ok(state.bullets.length > 3);
    let tilted = 0;
    for (const bullet of state.bullets) {
      const angle = Math.atan2(bullet.vy, bullet.vx);
      const delta = Math.abs(normalizeAngle(angle - -Math.PI / 2));
      assert.ok(delta <= RAPID_CONE / 2 + 0.001);
      if (delta > 0.02) tilted += 1;
    }
    assert.ok(tilted > 0);
  });

  it('arms a bomb from the button and damages only enemies inside the blast', () => {
    const state = playing();
    state.inventory = ['bomb'];
    state.enemies.push(makeEnemy({ id: 1, x: state.shipX, y: state.shipY - 140, r: 16, hp: 15, maxHp: 15, score: 200, vy: 0 }));
    state.enemies.push(makeEnemy({ id: 2, x: 20, y: 30, r: 10, hp: 5, maxHp: 5, score: 50, vy: 0 }));
    step(state, idleIntent({ activateSlot: 0 }), 0.016);
    assert.deepEqual(state.inventory, []);
    assert.ok(state.bomb);
    const farHp = state.enemies.find((enemy) => enemy.id === 2)?.hp;
    for (let i = 0; i < 70; i += 1) step(state, idleIntent(), 0.05);
    assert.equal(state.bomb, null);
    assert.equal(state.enemies.find((enemy) => enemy.id === 1), undefined);
    assert.equal(state.score, 200);
    assert.equal(state.enemies.find((enemy) => enemy.id === 2)?.hp, farHp);
    assert.ok(Math.abs(halfScreenRadius(state.width, state.height) ** 2 * Math.PI - state.width * state.height / 2) < 1);
  });

  it('burns enemies the laser is touching and leaves the others alone', () => {
    const state = playing();
    state.laserTimer = 1;
    state.laserAngle = -Math.PI / 2;
    state.shipX = 200;
    state.shipY = 500;
    state.enemies.push(makeEnemy({ id: 1, x: 200, y: 300, r: 16, hp: 10, maxHp: 10 }));
    state.enemies.push(makeEnemy({ id: 2, x: 40, y: 300, r: 16, hp: 10, maxHp: 10 }));
    step(state, idleIntent({ firing: true }), 0.05);
    const above = state.enemies.find((enemy) => enemy.id === 1);
    const beside = state.enemies.find((enemy) => enemy.id === 2);
    assert.ok(above);
    assert.ok(beside);
    assert.ok(above.hp < 10 - LASER_DPS * 0.04);
    assert.equal(beside.hp, 10);
    assert.equal(state.ammo, START_AMMO);
    assert.equal(state.shotsFired, 0);
  });

  it('drops a missile that never leaves, then lets the next power start', () => {
    const state = playing();
    state.missiles = [{ x: state.shipX, y: state.shipY - 40, angle: 0, targetId: null, boss: false, smoke: 1, age: 6 }];
    state.missileLeft = 0;
    step(state, idleIntent(), 0.05);
    assert.equal(state.missiles.length, 0);
    state.inventory = ['rapid'];
    step(state, idleIntent({ activateSlot: 0 }), 0.016);
    assert.ok(state.rapidTimer > 1);
  });

  it('activates every power again across a long run', () => {
    const state = playing();
    state.spawnCooldown = 9999;
    state.invuln = 9999;
    const kinds = ['shield', 'rapid', 'laser', 'wingman', 'warp', 'missiles', 'bomb'] as const;
    const busy = () =>
      state.rapidTimer > 0 ||
      state.laserTimer > 0 ||
      state.shieldHits > 0 ||
      state.wingmanTimer > 0 ||
      state.warpTimer > 0 ||
      state.missileLeft > 0 ||
      state.missiles.length > 0 ||
      state.bomb != null ||
      state.blast != null;
    for (let minute = 0; minute < 10; minute += 1) {
      for (let t = 0; t < 60; t += 0.05) step(state, idleIntent(), 0.05);
      for (const kind of kinds) {
        for (let i = 0; i < 400 && busy(); i += 1) step(state, idleIntent(), 0.05);
        assert.equal(busy(), false, `${kind} still busy at minute ${minute}`);
        state.inventory = [kind];
        step(state, idleIntent({ activateSlot: 0 }), 0.016);
        if (kind === 'shield') assert.equal(state.shieldHits, 1);
        if (kind === 'rapid') assert.ok(state.rapidTimer > 0);
        if (kind === 'laser') assert.ok(state.laserTimer > 0);
        if (kind === 'wingman') assert.ok(state.wingmanTimer > 0);
        if (kind === 'warp') assert.ok(state.warpTimer > 0);
        if (kind === 'missiles') assert.ok(state.missileLeft > 0);
        if (kind === 'bomb') assert.ok(state.bomb);
        assert.equal(state.mode, 'playing');
      }
    }
  });

  it('arms a shield again after it expires, after it blocks a hit, and after a restart', () => {
    const state = playing();
    const arm = () => {
      state.inventory = ['shield'];
      state.invuln = 0;
      step(state, idleIntent({ activateSlot: 0 }), 0.016);
      assert.equal(state.shieldHits, 1);
      assert.ok(state.shieldTimer > 5);
      assert.deepEqual(state.inventory, []);
    };
    const block = () => {
      state.enemies.push(makeEnemy({ id: state.enemies.length + 1, x: state.shipX, y: state.shipY, r: 18, hp: 4, maxHp: 4, vy: 0 }));
      step(state, idleIntent(), 0.016);
      assert.equal(state.lives, 3);
      assert.equal(state.shieldHits, 0);
      assert.equal(state.shieldTimer, 0);
    };
    arm();
    block();
    arm();
    block();
    arm();
    for (let i = 0; i < 140; i += 1) step(state, idleIntent(), 0.05);
    assert.equal(state.shieldHits, 0);
    assert.equal(state.shieldTimer, 0);
    arm();
    block();
    state.lives = 0;
    state.mode = 'over';
    state.overTimer = 1;
    step(state, idleIntent({ restart: true }), 0.016);
    assert.equal(state.mode, 'playing');
    assert.equal(state.lives, 3);
    assert.equal(state.shieldHits, 0);
    arm();
    block();
  });

  it('follows the laser stick and keeps that angle after the stick is released', () => {
    const state = playing();
    state.laserTimer = 2;
    state.laserAngle = -Math.PI / 2;
    state.shipX = 200;
    state.shipY = 500;
    const aim = laserAngleFromStick(LASER_AIM_RADIUS, -8);
    assert.ok(aim != null);
    step(state, idleIntent({ laserAimActive: true, laserAimX: LASER_AIM_RADIUS, laserAimY: -8 }), 0.05);
    assert.ok(Math.abs(state.laserAngle - aim) < 0.001);
    const nose = beamNose(state);
    state.enemies.push(makeEnemy({ id: 1, x: nose.x + Math.cos(aim) * 180, y: nose.y + Math.sin(aim) * 180, r: 16, hp: 10, maxHp: 10 }));
    state.enemies.push(makeEnemy({ id: 2, x: nose.x, y: nose.y - 180, r: 16, hp: 10, maxHp: 10 }));
    step(state, idleIntent(), 0.05);
    assert.ok(Math.abs(state.laserAngle - aim) < 0.001);
    const onBeam = state.enemies.find((enemy) => enemy.id === 1);
    const above = state.enemies.find((enemy) => enemy.id === 2);
    assert.ok(onBeam && onBeam.hp < 10);
    assert.ok(above && above.hp === 10);
  });

  it('runs a shield or time warp beside another power', () => {
    const state = playing();
    state.inventory = ['shield', 'rapid'];
    step(state, idleIntent({ activateSlot: 0 }), 0.016);
    assert.equal(state.shieldHits, 1);
    step(state, idleIntent({ activateSlot: 0 }), 0.016);
    assert.ok(state.rapidTimer > 1);
    assert.equal(state.shieldHits, 1);

    const alongside = playing();
    alongside.rapidTimer = 4;
    alongside.inventory = ['warp'];
    step(alongside, idleIntent({ activateSlot: 0 }), 0.016);
    assert.ok(alongside.warpTimer > 4);
    assert.ok(alongside.rapidTimer > 3);
    assert.deepEqual(alongside.inventory, []);

    const blocked = playing();
    blocked.inventory = ['rapid', 'bomb'];
    step(blocked, idleIntent({ activateSlot: 0 }), 0.016);
    step(blocked, idleIntent({ activateSlot: 0 }), 0.016);
    assert.equal(blocked.bomb, null);
    assert.deepEqual(blocked.inventory, ['bomb']);
  });

  it('stores a power-up until its icon is tapped and ignores a fourth one', () => {
    const state = playing();
    state.pickups.push({ id: 1, kind: 'rapid', amount: 0, x: state.shipX, y: state.shipY, vy: 0, r: 16, spin: 0 });
    step(state, idleIntent(), 0.016);
    assert.deepEqual(state.inventory, ['rapid']);
    assert.equal(state.rapidTimer, 0);
    state.inventory = ['rapid', 'bomb', 'laser'];
    state.pickups.push({ id: 2, kind: 'bomb', amount: 0, x: state.shipX, y: state.shipY, vy: 0, r: 16, spin: 0 });
    step(state, idleIntent(), 0.016);
    assert.deepEqual(state.inventory, ['rapid', 'bomb', 'laser']);
    assert.equal(state.pickups.length, 1);
    state.pickups[0].y = -80;
    step(state, idleIntent({ activateSlot: 0 }), 0.016);
    assert.deepEqual(state.inventory, ['bomb', 'laser']);
    assert.ok(state.rapidTimer > 4);
    step(state, idleIntent({ activateSlot: 0 }), 0.016);
    assert.deepEqual(state.inventory, ['bomb', 'laser']);
    assert.equal(state.bomb, null);
  });

  it('runs the shield, wingman, and time warp on a timer', () => {
    const shield = playing();
    shield.inventory = ['shield'];
    step(shield, idleIntent({ activateSlot: 0 }), 0.016);
    assert.equal(shield.shieldHits, 1);
    assert.ok(shield.shieldTimer > 5.5);
    shield.enemies.push(makeEnemy({ id: 9, x: shield.shipX, y: shield.shipY, r: 20, vy: 0, hp: 5, maxHp: 5 }));
    step(shield, idleIntent(), 0.016);
    assert.equal(shield.lives, 3);
    assert.equal(shield.shieldHits, 0);
    shield.inventory = ['shield'];
    shield.invuln = 0;
    step(shield, idleIntent({ activateSlot: 0 }), 0.016);
    shield.enemyBullets.push({ id: 11, x: shield.shipX, y: shield.shipY, vx: 0, vy: 0, r: 5 });
    step(shield, idleIntent(), 0.016);
    assert.equal(shield.lives, 3);
    assert.equal(shield.shieldHits, 0);
    assert.equal(shield.enemyBullets.length, 0);

    const wing = playing();
    wing.inventory = ['wingman'];
    wing.ammo = 10;
    step(wing, idleIntent({ activateSlot: 0 }), 0.016);
    assert.ok(wing.wingmanTimer > 7);
    for (let i = 0; i < 6; i += 1) step(wing, idleIntent(), 0.05);
    assert.ok(wing.bullets.length >= 2);
    assert.equal(wing.ammo, 10);
    assert.equal(wing.shotsFired, 0);
    wing.wingmanTimer = 0.02;
    step(wing, idleIntent(), 0.05);
    assert.equal(wing.wingmanTimer, 0);

    const warp = playing();
    warp.inventory = ['warp'];
    warp.enemyBullets.push({ id: 3, x: 40, y: 100, vx: 0, vy: 200, r: 5 });
    step(warp, idleIntent({ activateSlot: 0 }), 0.016);
    assert.ok(warp.warpTimer > 4.5);
    const before = warp.enemyBullets[0].y;
    step(warp, idleIntent(), 0.05);
    const moved = warp.enemyBullets[0].y - before;
    assert.ok(moved > 4 && moved < 6, `warp moved the bullet ${moved}`);
  });

  it('starts a boss on every third wave and opens the next sector when it falls', () => {
    const state = playing();
    state.wave = 3;
    state.waveSpawned = 0;
    state.enemies = [];
    step(state, idleIntent(), 0.05);
    assert.ok(state.boss);
    assert.equal(state.boss?.maxHp, 50);
    assert.equal(state.sector, 0);
    const during = state.enemies.length;
    state.spawnCooldown = 0;
    step(state, idleIntent(), 0.05);
    assert.equal(state.enemies.length, during);
    state.boss!.hp = 1;
    state.bullets.push({ id: 8, x: state.boss!.x, y: state.boss!.y, vx: 0, vy: 0, r: 8 });
    step(state, idleIntent(), 0.05);
    assert.equal(state.boss, null);
    assert.equal(state.sector, 1);
    assert.equal(state.bossScore, 2000);
    assert.ok(state.sectorBanner > 1);
    assert.equal(state.pickups.length, 1);
    assert.notEqual(state.pickups[0].kind, 'ammo');
  });

  it('launches a homing missile swarm that prefers the closer threat and hits for 8', () => {
    const state = playing();
    const near = makeEnemy({ id: 1, x: state.shipX + 40, y: state.shipY - 220, r: 24, hp: 15, maxHp: 15, shape: 'cruiser', score: 200 });
    const far = makeEnemy({ id: 2, x: 24, y: 40, r: 14, hp: 5, maxHp: 5, shape: 'dart', score: 50 });
    state.enemies.push(near, far);
    assert.equal(chooseMissileTarget(state)?.id, near.id);
    state.inventory = ['missiles'];
    step(state, idleIntent({ activateSlot: 0 }), 0.016);
    assert.deepEqual(state.inventory, []);
    assert.equal(state.missileLeft, 19);
    assert.equal(state.missiles[0].targetId, near.id);
    state.missiles[0].angle = -Math.PI / 2;
    state.missileCooldown = 5;
    step(state, idleIntent(), 0.2);
    assert.ok(state.missiles[0].angle > -Math.PI / 2 + 0.05);
    state.missiles[0].x = near.x;
    state.missiles[0].y = near.y + 10;
    state.missiles[0].angle = -Math.PI / 2;
    step(state, idleIntent(), 0.05);
    assert.equal(state.enemies.find((enemy) => enemy.id === near.id)?.hp, 7);
    state.enemies = state.enemies.filter((enemy) => enemy.id === far.id);
    state.missiles = [{ x: far.x + 80, y: far.y, angle: -Math.PI / 2, targetId: 99, boss: false, smoke: 1, age: 0 }];
    step(state, idleIntent(), 0.05);
    assert.equal(state.missiles[0]?.targetId, far.id);
  });
});

function normalizeAngle(angle: number): number {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}
