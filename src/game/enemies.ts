import { BATTLESHIP_HP, BULLET_SPEED, CARRIER_HP, MAX_BULLETS, SECTOR_BANNER, WINGMAN_INTERVAL } from './constants';
import { explode } from './particles';
import { warpPace } from './pace';
import { bossBulletSpeed, bossHealth, nextBossScore } from './sectors';
import type { Enemy, GameState, PowerKind } from './types';
import { WAVE_BREAK, bossSectorForWave } from './waves';

export function rollPower(roll: number): PowerKind {
  if (roll < 0.18) return 'rapid';
  if (roll < 0.33) return 'bomb';
  if (roll < 0.48) return 'laser';
  if (roll < 0.62) return 'shield';
  if (roll < 0.74) return 'wingman';
  if (roll < 0.88) return 'missiles';
  return 'warp';
}

export function spawnHeavy(state: GameState, speed: number): void {
  const carrier = state.rng.next() < 0.5;
  const hp = carrier ? CARRIER_HP : BATTLESHIP_HP;
  const radius = carrier ? 40 : 46;
  const pad = radius + 12;
  const x = pad + state.rng.next() * Math.max(8, state.width - pad * 2);
  state.enemies.push({
    id: state.nextId++,
    kind: 'alien',
    shape: carrier ? 'carrier' : 'battleship',
    x,
    y: -radius - 10,
    baseX: x,
    vx: (state.rng.next() - 0.5) * 22,
    vy: speed * (carrier ? 0.42 : 0.34),
    r: radius,
    rot: 0,
    rotSpeed: 0,
    phase: state.rng.next() * Math.PI * 2,
    wobbleAmp: 0,
    wobbleFreq: 1,
    tint: state.rng.next(),
    score: hp * 10,
    hp,
    maxHp: hp,
    gun: 1.6,
  });
}

function launchScout(state: GameState, mother: Enemy): void {
  state.enemies.push({
    id: state.nextId++,
    kind: 'alien',
    shape: 'dart',
    x: mother.x + (state.rng.next() - 0.5) * 30,
    y: mother.y + mother.r * 0.4,
    baseX: mother.x,
    vx: 0,
    vy: Math.max(140, mother.vy * 2.1),
    r: 13,
    rot: 0,
    rotSpeed: 0.4,
    phase: state.rng.next() * Math.PI * 2,
    wobbleAmp: 18,
    wobbleFreq: 1.6,
    tint: mother.tint,
    score: 50,
    hp: 5,
    maxHp: 5,
    gun: 999,
  });
}

function fireEnemyBullet(state: GameState, x: number, y: number, vx: number, vy: number): void {
  if (state.enemyBullets.length > 48) return;
  state.enemyBullets.push({ id: state.nextId++, x, y, vx, vy, r: 5 });
}

function fireSpread(state: GameState, x: number, y: number, count: number, width: number, speed: number): void {
  const start = -width / 2;
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const angle = Math.PI / 2 + start + t * width;
    fireEnemyBullet(state, x, y, Math.cos(angle) * speed, Math.sin(angle) * speed);
  }
}

export function tickHeavyGuns(state: GameState, dt: number): void {
  const pace = warpPace(state);
  for (const enemy of state.enemies) {
    if (enemy.gun >= 900 || enemy.y < -enemy.r) continue;
    enemy.gun -= dt * pace;
    if (enemy.gun > 0) continue;
    if (enemy.shape === 'carrier') {
      enemy.gun = 2.4;
      launchScout(state, enemy);
    } else if (enemy.shape === 'battleship') {
      enemy.gun = 2.6;
      fireSpread(state, enemy.x, enemy.y + enemy.r * 0.6, 3, 0.55, 150);
    } else if (enemy.shape === 'saucer') {
      enemy.gun = 3.4;
      fireEnemyBullet(state, enemy.x, enemy.y + enemy.r, 0, 165);
    } else if (enemy.shape === 'cruiser') {
      enemy.gun = 2.8;
      fireEnemyBullet(state, enemy.x, enemy.y + enemy.r, (state.rng.next() - 0.5) * 40, 145);
    } else {
      enemy.gun = 999;
    }
  }
}

export function moveEnemyBullets(state: GameState, dt: number): void {
  const pace = warpPace(state);
  for (const bullet of state.enemyBullets) {
    bullet.x += bullet.vx * dt * pace;
    bullet.y += bullet.vy * dt * pace;
  }
  state.enemyBullets = state.enemyBullets.filter(
    (bullet) => bullet.y < state.height + 30 && bullet.y > -40 && bullet.x > -40 && bullet.x < state.width + 40,
  );
}

export function tickWingmen(state: GameState, dt: number): void {
  if (state.wingmanTimer <= 0) return;
  state.wingmanCooldown -= dt;
  if (state.wingmanCooldown > 0 || state.bullets.length > MAX_BULLETS - 2) return;
  state.wingmanCooldown = WINGMAN_INTERVAL;
  for (const side of [-1, 1]) {
    state.bullets.push({
      id: state.nextId++,
      x: state.shipX + side * 36,
      y: state.shipY - 6,
      vx: 0,
      vy: -BULLET_SPEED * 0.92,
      r: 4,
    });
  }
}

export function startBoss(state: GameState): void {
  if (state.mode !== 'playing' || state.boss) return;
  state.sector = bossSectorForWave(state.wave);
  state.bossScore = nextBossScore(state.sector);
  const hp = bossHealth(state.sector);
  state.waveSpawned = 1;
  state.enemies = [];
  state.boss = {
    hp,
    maxHp: hp,
    x: state.width / 2,
    y: 132,
    dir: 1,
    age: 0,
    pattern: 0,
    patternTime: 0,
    cooldown: 0.35,
    beam: 0,
    beamDir: 1,
    burned: false,
  };
}

export function tickBoss(state: GameState, dt: number): void {
  const boss = state.boss;
  if (!boss || state.mode !== 'playing') return;
  const pace = warpPace(state);
  const stepDt = dt * pace;
  boss.age += stepDt;
  boss.patternTime += stepDt;
  const speed = 36 + state.sector * 7;
  boss.x += boss.dir * speed * stepDt;
  if (boss.x < 70) {
    boss.x = 70;
    boss.dir = 1;
  } else if (boss.x > state.width - 70) {
    boss.x = state.width - 70;
    boss.dir = -1;
  }
  if (boss.patternTime > 3.6) {
    boss.pattern = (boss.pattern + 1) % 3;
    boss.patternTime = 0;
    boss.cooldown = 0.3;
    boss.beam = 0;
  }
  boss.cooldown -= stepDt;
  const bulletSpeed = bossBulletSpeed(state.sector);
  if (boss.pattern === 0 && boss.cooldown <= 0) {
    boss.cooldown = 0.62;
    fireSpread(state, boss.x, boss.y + 36, 5 + Math.min(state.sector, 3), 0.9, bulletSpeed);
  } else if (boss.pattern === 1) {
    boss.beam += stepDt * (0.9 + state.sector * 0.05);
  } else if (boss.pattern === 2 && boss.cooldown <= 0) {
    boss.cooldown = 1.35;
    const darts = state.enemies.filter((enemy) => enemy.shape === 'dart').length;
    if (darts < 4) {
      launchScout(state, {
        x: boss.x,
        y: boss.y + 24,
        r: 28,
        vy: 70,
        tint: 0.4,
      } as Enemy);
    }
  }
}

export function damageBoss(state: GameState, amount: number): void {
  const boss = state.boss;
  if (!boss) return;
  boss.hp -= amount;
  if (boss.hp > 0) return;
  const x = boss.x;
  const y = boss.y;
  state.boss = null;
  state.enemyBullets = [];
  state.sector += 1;
  state.bossScore = nextBossScore(state.sector);
  state.sectorBanner = SECTOR_BANNER;
  state.waveBreak = WAVE_BREAK;
  explode(state, x, y, '#F4FBFF');
  const kind = rollPower(state.rng.next());
  state.pickups.push({
    id: state.nextId++,
    kind,
    amount: 0,
    x,
    y: y + 40,
    vy: 70,
    r: 22,
    spin: 0,
  });
}
