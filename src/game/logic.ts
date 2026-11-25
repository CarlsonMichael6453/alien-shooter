import { clampLaserAngle, laserAngleFromStick } from './laserAim';
import {
  AMMO_FIRST_DELAY,
  AMMO_INTERVAL_FAST,
  AMMO_INTERVAL_SLOW,
  AMMO_WEIGHT_100,
  AMMO_WEIGHT_200,
  BATTLESHIP_HP,
  BOMB_BLAST_TIME,
  BOMB_DAMAGE,
  BOMB_FUSE,
  BOMB_SPEED,
  BULLET_DAMAGE,
  BULLET_RADIUS,
  BULLET_SPEED,
  CARRIER_HP,
  FIRE_INTERVAL,
  INVULN_TIME,
  KEYBOARD_SPEED,
  STICK_SPEED,
  LASER_DPS,
  LASER_DURATION,
  MAX_BULLETS,
  MAX_INVENTORY,
  MISSILE_COUNT,
  MISSILE_DAMAGE,
  MISSILE_INTERVAL,
  MISSILE_SPEED,
  MISSILE_TURN,
  RAPID_CONE,
  RAPID_DURATION,
  RAPID_RATE,
  SECTOR_BANNER,
  SHIELD_DURATION,
  SHIP_HIT_RADIUS,
  SHIP_MARGIN,
  START_AMMO,
  START_LIVES,
  WARP_DURATION,
  WARP_SCALE,
  WINGMAN_DURATION,
  WINGMAN_INTERVAL,
} from './constants';
import { createRng } from './rng';
import { bossBulletSpeed, bossHealth, nextBossScore, sectorTheme } from './sectors';
import { clamp, easeOut, halfScreenRadius, hits, lerp, pointSegmentDistance } from './fieldMath';
import { chooseMissileTarget, tickMissiles } from './missiles';
import { burst, explode, pushParticle } from './particles';
import { driftStars, seedStars } from './stars';
import { DEFAULT_SHIP } from './ships';
import { WAVE_BREAK, bossSectorForWave, isBossWave, waveQuota } from './waves';
import type { Blast, Bomb, Boss, Enemy, EnemyBullet, GameState, Intent, Missile, Pickup, PickupKind, PowerKind, Rng } from './types';

export interface Difficulty {
  spawnInterval: number;
  speed: number;
  maxEnemies: number;
  wobble: number;
  cruiserChance: number;
  saucerChance: number;
}

export function idleIntent(partial: Partial<Intent> = {}): Intent {
  return {
    moveActive: false,
    targetX: 0,
    targetY: 0,
    firing: false,
    keyX: 0,
    keyY: 0,
    start: false,
    restart: false,
    activateSlot: null,
    fireDragX: 0,
    fireDragY: 0,
    stickX: 0,
    stickY: 0,
  hoverActive: false,
  hoverX: 0,
  hoverY: 0,
  laserAimActive: false,
  laserAimX: 0,
  laserAimY: 0,
  ...partial,
};
}

export function difficulty(time: number): Difficulty {
  const t = clamp(time / 80, 0, 1);
  const s = t * t * (3 - 2 * t);
  return {
    spawnInterval: lerp(1.28, 0.5, s),
    speed: lerp(92, 210, s),
    maxEnemies: Math.round(lerp(4, 7, s)),
    wobble: lerp(12, 36, s),
    cruiserChance: lerp(0.06, 0.18, s),
    saucerChance: lerp(0.24, 0.34, s),
  };
}

export { halfScreenRadius } from './fieldMath';

export function rollAmmoAmount(rng: Rng): 100 | 200 | 400 {
  const roll = rng.next();
  if (roll < AMMO_WEIGHT_100) return 100;
  if (roll < AMMO_WEIGHT_200) return 200;
  return 400;
}

export function createGame(
  width: number,
  height: number,
  rng: Rng = createRng((Math.random() * 0xffffffff) >>> 0),
): GameState {
  const state: GameState = {
    mode: 'ready',
    width,
    height,
    time: 0,
    score: 0,
    best: 0,
    lives: START_LIVES,
    shipX: width / 2,
    shipY: height - 118,
    firing: false,
    invuln: 0,
    hitFlash: 0,
    shake: 0,
    muzzle: 0,
    fireCooldown: 0,
    spawnCooldown: 0.55,
    shotsFired: 0,
    overTimer: 0,
    ammo: START_AMMO,
    inventory: [],
    rapidTimer: 0,
    laserTimer: 0,
    laserAngle: -Math.PI / 2,
    shieldTimer: 0,
    shieldHits: 0,
    wingmanTimer: 0,
    wingmanCooldown: 0,
    warpTimer: 0,
    missileLeft: 0,
    missileCooldown: 0,
    sector: 0,
    bossScore: nextBossScore(0),
    sectorBanner: 0,
    wave: 1,
    waveSpawned: 0,
    waveBreak: 0,
    shipId: DEFAULT_SHIP,
    spark: 0,
    hold: false,
    nextId: 1,
    bullets: [],
    missiles: [],
    enemyBullets: [],
    enemies: [],
    pickups: [],
    boss: null,
    bomb: null,
    blast: null,
    particles: [],
    stars: [],
    ammoCooldown: AMMO_FIRST_DELAY,
    powerCooldown: 8,
    rng,
  };
  seedStars(state);
  clampShip(state);
  return state;
}

export function makeEnemy(partial: Partial<Enemy> & Pick<Enemy, 'x' | 'y'>): Enemy {
  const hp = partial.hp ?? 1;
  return {
    id: partial.id ?? 1,
    kind: partial.kind ?? 'alien',
    shape: partial.shape ?? 'saucer',
    x: partial.x,
    y: partial.y,
    baseX: partial.baseX ?? partial.x,
    vx: partial.vx ?? 0,
    vy: partial.vy ?? 120,
    r: partial.r ?? 22,
    rot: partial.rot ?? 0,
    rotSpeed: partial.rotSpeed ?? 0,
    phase: partial.phase ?? 0,
    wobbleAmp: partial.wobbleAmp ?? 0,
    wobbleFreq: partial.wobbleFreq ?? 1,
    tint: partial.tint ?? 0.2,
    score: partial.score ?? 100,
    hp,
    maxHp: partial.maxHp ?? hp,
    gun: partial.gun ?? 999,
  };
}

export function resizeGame(state: GameState, width: number, height: number): void {
  if (width <= 0 || height <= 0) return;
  if (state.width === width && state.height === height) return;
  const sx = state.width > 0 ? width / state.width : 1;
  const sy = state.height > 0 ? height / state.height : 1;
  state.shipX *= sx;
  state.shipY *= sy;
  for (const enemy of state.enemies) {
    enemy.x *= sx;
    enemy.y *= sy;
    enemy.baseX *= sx;
  }
  for (const bullet of state.bullets) {
    bullet.x *= sx;
    bullet.y *= sy;
  }
  for (const missile of state.missiles) {
    missile.x *= sx;
    missile.y *= sy;
  }
  for (const pickup of state.pickups) {
    pickup.x *= sx;
    pickup.y *= sy;
  }
  for (const particle of state.particles) {
    particle.x *= sx;
    particle.y *= sy;
  }
  if (state.boss) {
    state.boss.x *= sx;
    state.boss.y *= sy;
  }
  for (const bullet of state.enemyBullets) {
    bullet.x *= sx;
    bullet.y *= sy;
  }
  if (state.bomb) {
    state.bomb.x *= sx;
    state.bomb.y *= sy;
  }
  if (state.blast) {
    state.blast.x *= sx;
    state.blast.y *= sy;
    state.blast.maxRadius = halfScreenRadius(width, height);
  }
  state.width = width;
  state.height = height;
  clampShip(state);
}

export function step(state: GameState, intent: Intent, dt: number): void {
  if (state.hold) return;
  const frame = clamp(dt, 0, 0.05);

  if (state.mode === 'over') {
    driftStars(state, frame);
    decayJuice(state, frame);
    moveParticles(state, frame);
    state.overTimer += frame;
    if (!intent.restart || state.overTimer < 0.45) return;
    restart(state);
  }

  if (state.mode === 'ready') {
    driftStars(state, frame);
    state.time += frame;
    if (!intent.start) return;
    state.mode = 'playing';
    state.time = 0;
    state.sectorBanner = SECTOR_BANNER;
    state.spawnCooldown = 0.55;
    state.ammoCooldown = AMMO_FIRST_DELAY;
    state.powerCooldown = 8;
  }

  state.time += frame;
  decayJuice(state, frame);
  moveShip(state, intent, frame);
  updateAim(state, intent);
  tickPowers(state, frame);
  activatePower(state, intent);
  tickBomb(state, frame);
  tickBlast(state, frame);
  fire(state, intent, frame);
  spawnEnemies(state, frame);
  spawnPickups(state, frame);
  moveBullets(state, frame);
  moveEnemies(state, frame);
  moveEnemyBullets(state, frame);
  tickHeavyGuns(state, frame);
  tickWingmen(state, frame);
  tickMissiles(state, frame);
  tickBoss(state, frame);
  movePickups(state, frame);
  moveParticles(state, frame);
  collide(state, frame);
  driftStars(state, frame);
}

function restart(state: GameState): void {
  state.mode = 'playing';
  state.time = 0;
  state.score = 0;
  state.lives = START_LIVES;
  state.ammo = START_AMMO;
  state.inventory = [];
  state.rapidTimer = 0;
  state.laserTimer = 0;
  state.laserAngle = -Math.PI / 2;
  state.shieldTimer = 0;
  state.shieldHits = 0;
  state.wingmanTimer = 0;
  state.wingmanCooldown = 0;
  state.warpTimer = 0;
  state.missileLeft = 0;
  state.missileCooldown = 0;
  state.missiles = [];
  state.sector = 0;
  state.bossScore = nextBossScore(0);
  state.sectorBanner = SECTOR_BANNER;
  state.wave = 1;
  state.waveSpawned = 0;
  state.waveBreak = 0;
  state.boss = null;
  state.enemyBullets = [];
  state.shipX = state.width / 2;
  state.shipY = state.height - 118;
  state.firing = false;
  state.invuln = 0;
  state.hitFlash = 0;
  state.shake = 0;
  state.muzzle = 0;
  state.fireCooldown = 0;
  state.spawnCooldown = 0.55;
  state.ammoCooldown = AMMO_FIRST_DELAY;
  state.powerCooldown = 8;
  state.shotsFired = 0;
  state.overTimer = 0;
  state.spark = 0;
  state.hold = false;
  state.bullets = [];
  state.enemies = [];
  state.pickups = [];
  state.bomb = null;
  state.blast = null;
  state.particles = [];
  clampShip(state);
}

function decayJuice(state: GameState, dt: number): void {
  state.invuln = Math.max(0, state.invuln - dt);
  state.hitFlash = Math.max(0, state.hitFlash - dt);
  state.shake = Math.max(0, state.shake - dt * 2.4);
  state.muzzle = Math.max(0, state.muzzle - dt);
}

function moveShip(state: GameState, intent: Intent, dt: number): void {
  if (intent.moveActive) {
    state.shipX = intent.targetX;
    state.shipY = intent.targetY;
  } else {
    state.shipX += (intent.keyX * KEYBOARD_SPEED + intent.stickX * STICK_SPEED) * dt;
    state.shipY += (intent.keyY * KEYBOARD_SPEED + intent.stickY * STICK_SPEED) * dt;
  }
  clampShip(state);
}

function updateAim(state: GameState, intent: Intent): void {
  if (state.laserTimer <= 0) return;
  if (intent.laserAimActive) {
    const angle = laserAngleFromStick(intent.laserAimX, intent.laserAimY);
    if (angle != null) state.laserAngle = angle;
    return;
  }
  if (intent.hoverActive) {
    state.laserAngle = clampLaserAngle(Math.atan2(intent.hoverY - state.shipY, intent.hoverX - state.shipX));
  }
}

function normalizeShield(state: GameState): void {
  if (state.shieldHits <= 0 || state.shieldTimer <= 0) {
    state.shieldHits = 0;
    state.shieldTimer = 0;
  }
}

function tickPowers(state: GameState, dt: number): void {
  state.rapidTimer = Math.max(0, state.rapidTimer - dt);
  state.laserTimer = Math.max(0, state.laserTimer - dt);
  state.wingmanTimer = Math.max(0, state.wingmanTimer - dt);
  state.warpTimer = Math.max(0, state.warpTimer - dt);
  state.sectorBanner = Math.max(0, state.sectorBanner - dt);
  if (state.shieldTimer > 0) state.shieldTimer = Math.max(0, state.shieldTimer - dt);
  normalizeShield(state);
}

function warpPace(state: GameState): number {
  return state.warpTimer > 0 ? WARP_SCALE : 1;
}

/** Powers that still take the single active slot. Shield and warp are not in this list. */
function exclusivePowerActive(state: GameState): boolean {
  return (
    state.rapidTimer > 0 ||
    state.laserTimer > 0 ||
    state.wingmanTimer > 0 ||
    state.missileLeft > 0 ||
    state.missiles.length > 0 ||
    state.bomb != null ||
    state.blast != null
  );
}

function activatePower(state: GameState, intent: Intent): void {
  if (intent.activateSlot == null) return;
  const kind = state.inventory[intent.activateSlot];
  if (!kind) return;
  const stacks = kind === 'shield' || kind === 'warp';
  if (!stacks && exclusivePowerActive(state)) return;
  state.inventory.splice(intent.activateSlot, 1);
  if (kind === 'rapid') {
    state.rapidTimer = RAPID_DURATION;
    return;
  }
  if (kind === 'laser') {
    state.laserTimer = LASER_DURATION;
    state.laserAngle = -Math.PI / 2;
    return;
  }
  if (kind === 'shield') {
    state.shieldTimer = SHIELD_DURATION;
    state.shieldHits = 1;
    return;
  }
  if (kind === 'wingman') {
    state.wingmanTimer = WINGMAN_DURATION;
    state.wingmanCooldown = 0;
    return;
  }
  if (kind === 'warp') {
    state.warpTimer = WARP_DURATION;
    return;
  }
  if (kind === 'missiles') {
    state.missileLeft = MISSILE_COUNT;
    state.missileCooldown = 0;
    return;
  }
  state.bomb = {
    x: state.shipX,
    y: state.shipY - 28,
    vy: -BOMB_SPEED,
    age: 0,
    pulse: 1,
  };
}

function tickBomb(state: GameState, dt: number): void {
  const bomb = state.bomb;
  if (!bomb) return;
  const previous = Math.floor(bomb.age);
  bomb.age += dt;
  bomb.y += bomb.vy * dt;
  bomb.pulse = Math.max(0, bomb.pulse - dt * 2.6);
  if (Math.floor(bomb.age) !== previous) bomb.pulse = 1;
  if (bomb.age >= BOMB_FUSE) {
    detonate(state, bomb);
  }
}

function detonate(state: GameState, bomb: Bomb): void {
  state.bomb = null;
  state.blast = {
    x: bomb.x,
    y: bomb.y,
    age: 0,
    maxRadius: halfScreenRadius(state.width, state.height),
    hit: [],
  };
  state.shake = 1;
  state.hitFlash = 0.28;
  burst(state, bomb.x, bomb.y, '#FFF4D2', 10);
  burst(state, bomb.x, bomb.y, '#FF7A1A', 12);
  for (let i = 0; i < 10; i += 1) {
    const angle = state.rng.next() * Math.PI * 2;
    const speed = 40 + state.rng.next() * 160;
    pushParticle(state, {
      x: bomb.x,
      y: bomb.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 30,
      life: 0.45 + state.rng.next() * 0.45,
      maxLife: 0.9,
      r: 1.4 + state.rng.next() * 2.2,
      color: state.rng.next() > 0.45 ? '#FFE08A' : '#FF5A1A',
    });
  }
}

function tickBlast(state: GameState, dt: number): void {
  const blast = state.blast;
  if (!blast) return;
  blast.age += dt;
  if (blast.age > 1.65) state.blast = null;
}

function fire(state: GameState, intent: Intent, dt: number): void {
  const rapid = state.rapidTimer > 0;
  const laserOn = state.laserTimer > 0;
  state.firing = intent.firing && !laserOn && (rapid || state.ammo > 0);
  if (laserOn) {
    state.spark += dt;
    if (state.spark >= 0.04) {
      state.spark = 0;
      const nose = beamNose(state);
      const along = 30 + state.rng.next() * 180;
      pushParticle(state, {
        x: nose.x + Math.cos(state.laserAngle) * along,
        y: nose.y + Math.sin(state.laserAngle) * along,
        vx: (state.rng.next() - 0.5) * 40,
        vy: (state.rng.next() - 0.5) * 40,
        life: 0.18,
        maxLife: 0.18,
        r: 2 + state.rng.next() * 2.4,
        color: state.rng.next() > 0.5 ? '#FFB020' : '#FF4A2A',
      });
    }
    return;
  }

  state.fireCooldown -= dt;
  if (!intent.firing || (!rapid && state.ammo <= 0)) {
    if (state.fireCooldown < 0) state.fireCooldown = 0;
    return;
  }

  const interval = FIRE_INTERVAL / (rapid ? RAPID_RATE : 1);
  let guard = 0;
  while (state.fireCooldown <= 0 && state.bullets.length < MAX_BULLETS && (rapid || state.ammo > 0) && guard < 6) {
    const spread = rapid ? (state.rng.next() - 0.5) * RAPID_CONE : 0;
    const angle = -Math.PI / 2 + spread;
    state.bullets.push({
      id: state.nextId++,
      x: state.shipX + Math.cos(angle) * 8,
      y: state.shipY - 24 + Math.sin(angle) * 8,
      vx: Math.cos(angle) * BULLET_SPEED,
      vy: Math.sin(angle) * BULLET_SPEED,
      r: BULLET_RADIUS,
    });
    if (!rapid) state.ammo -= 1;
    state.shotsFired += 1;
    state.muzzle = 0.07;
    state.fireCooldown += interval;
    guard += 1;
  }
}

export function quitToMenu(state: GameState): void {
  restart(state);
  state.mode = 'ready';
  state.sectorBanner = 0;
  state.time = 0;
}

function spawnEnemies(state: GameState, dt: number): void {
  if (state.waveBreak > 0) {
    state.waveBreak = Math.max(0, state.waveBreak - dt);
    if (state.waveBreak === 0) beginWave(state);
    return;
  }
  if (isBossWave(state.wave)) {
    if (!state.boss && state.waveSpawned === 0 && state.enemies.length === 0) startBoss(state);
    return;
  }
  if (state.boss) return;
  if (state.waveSpawned >= waveQuota(state.wave)) {
    if (state.enemies.length === 0) {
      state.waveBreak = WAVE_BREAK;
      state.sectorBanner = Math.max(state.sectorBanner, WAVE_BREAK);
    }
    return;
  }
  state.spawnCooldown -= dt;
  if (state.spawnCooldown > 0) return;
  const diff = difficulty(state.time);
  state.spawnCooldown = diff.spawnInterval;
  if (state.enemies.length >= diff.maxEnemies) return;

  const roll = state.rng.next();
  const theme = sectorTheme(state.sector);
  if (state.sector >= 1 && roll < 0.1 + theme.loop * 0.02) {
    spawnHeavy(state, diff.speed);
    state.waveSpawned += 1;
    return;
  }
  const tier: 5 | 10 | 15 =
    roll < diff.cruiserChance ? 15 : roll < diff.cruiserChance + diff.saucerChance ? 10 : 5;
  const radius = tier === 15 ? 36 : tier === 10 ? 24 : 15;
  const speedJitter = 0.88 + state.rng.next() * 0.22;
  const speed = diff.speed * speedJitter * (tier === 15 ? 0.55 : tier === 10 ? 0.9 : 1.28) * (1 + theme.loop * 0.12);
  const wobble = tier === 15 ? 0 : diff.wobble * (tier === 5 ? 1.15 : 0.7);
  const pad = radius + wobble + 10;
  let x = pad + state.rng.next() * Math.max(8, state.width - pad * 2);
  if (state.time < 2.5 && Math.abs(x - state.shipX) < 80) {
    x = x < state.width / 2 ? Math.min(state.width - pad, x + 120) : Math.max(pad, x - 120);
  }

  state.enemies.push({
    id: state.nextId++,
    kind: tier === 15 ? 'asteroid' : 'alien',
    shape: tier === 15 ? 'cruiser' : tier === 10 ? 'saucer' : 'dart',
    x,
    y: -radius - 8,
    baseX: x,
    vx: tier === 15 ? (state.rng.next() - 0.5) * 28 : 0,
    vy: speed,
    r: radius,
    rot: state.rng.next() * Math.PI * 2,
    rotSpeed: (state.rng.next() - 0.5) * (tier === 15 ? 0.8 : 0.7),
    phase: state.rng.next() * Math.PI * 2,
    wobbleAmp: wobble,
    wobbleFreq: 1.1 + state.rng.next() * 1.1,
    tint: state.rng.next(),
    score: tier === 15 ? 200 : tier === 10 ? 100 : 50,
    hp: tier,
    maxHp: tier,
    gun: tier === 5 ? 999 : 2.2,
  });
  state.waveSpawned += 1;
}

function beginWave(state: GameState): void {
  state.wave += 1;
  state.waveSpawned = 0;
  state.spawnCooldown = 0.45;
  state.sectorBanner = SECTOR_BANNER;
}

function spawnPickups(state: GameState, dt: number): void {
  const ramp = clamp(state.time / 80, 0, 1);
  state.ammoCooldown -= dt;
  if (state.ammoCooldown <= 0) {
    state.ammoCooldown = lerp(AMMO_INTERVAL_SLOW, AMMO_INTERVAL_FAST, ramp);
    spawnPickup(state, 'ammo', rollAmmoAmount(state.rng));
  }
  state.powerCooldown -= dt;
  if (state.powerCooldown <= 0) {
    state.powerCooldown = lerp(15, 11, ramp);
    const roll = state.rng.next();
    const kind = rollPower(roll);
    spawnPickup(state, kind, 0);
  }
}

function spawnPickup(state: GameState, kind: PickupKind, amount: number): void {
  const r = 22;
  const pad = r + 16;
  const x = pad + state.rng.next() * Math.max(8, state.width - pad * 2);
  state.pickups.push({
    id: state.nextId++,
    kind,
    amount,
    x,
    y: -r - 4,
    vy: 72,
    r,
    spin: state.rng.next() * Math.PI * 2,
  });
}

/**
 * Keeps one tutorial drop drifting toward the ship. An ammo box enters from above
 * the screen. A power-up is placed on screen, above the ship. A drop that falls
 * past the ship is replaced. Normal spawn timers are left alone.
 */
export function ensureTutorialDrop(state: GameState, kind: 'ammo' | 'power', previousId: number | null): number {
  const wanted: PickupKind = kind === 'ammo' ? 'ammo' : 'rapid';
  const previous = previousId == null ? undefined : state.pickups.find((pickup) => pickup.id === previousId);
  if (previous && previous.kind === wanted && previous.y < state.shipY - 28) return previous.id;
  spawnPickup(state, wanted, kind === 'ammo' ? 100 : 0);
  const drop = state.pickups[state.pickups.length - 1];
  const pad = drop.r + 16;
  drop.x = clamp(state.shipX, pad, Math.max(pad, state.width - pad));
  if (kind === 'power') {
    const ceiling = drop.r + 24;
    let y = state.shipY - 170;
    if (state.shipY - y < 110) y = state.shipY - 110;
    if (y < ceiling) y = ceiling;
    if (y > state.height - drop.r - 24) y = Math.max(ceiling, state.height * 0.35);
    drop.y = y;
  }
  return drop.id;
}

function moveBullets(state: GameState, dt: number): void {
  for (const bullet of state.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
  }
  state.bullets = state.bullets.filter(
    (bullet) => bullet.y > -40 && bullet.y < state.height + 40 && bullet.x > -40 && bullet.x < state.width + 40,
  );
}

function moveEnemies(state: GameState, dt: number): void {
  const pace = warpPace(state);
  for (const enemy of state.enemies) {
    enemy.y += enemy.vy * dt * pace;
    enemy.rot += enemy.rotSpeed * dt;
    if (enemy.shape === 'cruiser' || enemy.shape === 'rock' || enemy.shape === 'battleship' || enemy.shape === 'carrier') {
      enemy.x += enemy.vx * dt;
      if (enemy.x < enemy.r) {
        enemy.x = enemy.r;
        enemy.vx = Math.abs(enemy.vx);
      } else if (enemy.x > state.width - enemy.r) {
        enemy.x = state.width - enemy.r;
        enemy.vx = -Math.abs(enemy.vx);
      }
    } else {
      const sway = Math.sin(state.time * enemy.wobbleFreq + enemy.phase) * enemy.wobbleAmp;
      enemy.x = clamp(enemy.baseX + sway, enemy.r, Math.max(enemy.r, state.width - enemy.r));
    }
  }
  state.enemies = state.enemies.filter((enemy) => enemy.y < state.height + enemy.r + 36);
}

function movePickups(state: GameState, dt: number): void {
  for (const pickup of state.pickups) {
    pickup.y += pickup.vy * dt;
    pickup.spin += dt;
  }
  state.pickups = state.pickups.filter((pickup) => pickup.y < state.height + pickup.r + 20);
}

function moveParticles(state: GameState, dt: number): void {
  for (const particle of state.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;
  }
  state.particles = state.particles.filter((particle) => particle.life > 0);
}

function collide(state: GameState, dt: number): void {
  if (state.boss && !state.blast) state.boss.burned = false;
  const deadEnemies = new Set<number>();
  const deadBullets = new Set<number>();

  for (const bullet of state.bullets) {
    if (deadBullets.has(bullet.id)) continue;
    for (const enemy of state.enemies) {
      if (deadEnemies.has(enemy.id)) continue;
      if (!hits(bullet.x, bullet.y, bullet.r, enemy.x, enemy.y, enemy.r)) continue;
      deadBullets.add(bullet.id);
      hurt(state, enemy, BULLET_DAMAGE, deadEnemies, true);
      break;
    }
    if (deadBullets.has(bullet.id) || !state.boss) continue;
    if (hits(bullet.x, bullet.y, bullet.r, state.boss.x, state.boss.y, 54)) {
      deadBullets.add(bullet.id);
      damageBoss(state, BULLET_DAMAGE);
    }
  }

  const flying: Missile[] = [];
  for (const missile of state.missiles) {
    let hit = false;
    for (const enemy of state.enemies) {
      if (deadEnemies.has(enemy.id)) continue;
      if (!hits(missile.x, missile.y, 7, enemy.x, enemy.y, enemy.r)) continue;
      hurt(state, enemy, MISSILE_DAMAGE, deadEnemies, false);
      hit = true;
      break;
    }
    if (!hit && state.boss && hits(missile.x, missile.y, 7, state.boss.x, state.boss.y, 54)) {
      damageBoss(state, MISSILE_DAMAGE);
      hit = true;
    }
    if (!hit) flying.push(missile);
  }
  state.missiles = flying.filter(
    (missile) =>
      missile.age < 5 &&
      missile.y > -50 &&
      missile.y < state.height + 50 &&
      missile.x > -50 &&
      missile.x < state.width + 50,
  );

  if (state.laserTimer > 0) {
    const nose = beamNose(state);
    const reach = 1600;
    const x2 = nose.x + Math.cos(state.laserAngle) * reach;
    const y2 = nose.y + Math.sin(state.laserAngle) * reach;
    for (const enemy of state.enemies) {
      if (deadEnemies.has(enemy.id)) continue;
      const distance = pointSegmentDistance(enemy.x, enemy.y, nose.x, nose.y, x2, y2);
      if (distance <= enemy.r + 8) {
        hurt(state, enemy, LASER_DPS * dt, deadEnemies, false);
        if (state.rng.next() < 0.22) {
          pushParticle(state, {
            x: enemy.x,
            y: enemy.y,
            vx: (state.rng.next() - 0.5) * 90,
            vy: (state.rng.next() - 0.5) * 90,
            life: 0.16 + state.rng.next() * 0.14,
            maxLife: 0.3,
            r: 1.2 + state.rng.next() * 1.6,
            color: state.rng.next() > 0.5 ? '#FFF6E4' : '#FF9A3A',
          });
        }
      }
    }
    if (state.boss && pointSegmentDistance(state.boss.x, state.boss.y, nose.x, nose.y, x2, y2) <= 62) {
      damageBoss(state, LASER_DPS * dt);
    }
  }

  const blast = state.blast;
  if (blast && blast.age <= BOMB_BLAST_TIME) {
    const radius = blast.maxRadius * easeOut(clamp(blast.age / BOMB_BLAST_TIME, 0, 1));
    for (const enemy of state.enemies) {
      if (deadEnemies.has(enemy.id) || blast.hit.includes(enemy.id)) continue;
      if (!hits(blast.x, blast.y, radius, enemy.x, enemy.y, enemy.r)) continue;
      blast.hit.push(enemy.id);
      hurt(state, enemy, BOMB_DAMAGE, deadEnemies, false);
    }
    if (state.boss && !state.boss.burned && hits(blast.x, blast.y, radius, state.boss.x, state.boss.y, 54)) {
      state.boss.burned = true;
      damageBoss(state, BOMB_DAMAGE);
    }
  }

  for (const pickup of state.pickups) {
    if (!hits(pickup.x, pickup.y, pickup.r, state.shipX, state.shipY, SHIP_HIT_RADIUS + 6)) continue;
    if (!collect(state, pickup)) continue;
    pickup.y = state.height + 999;
  }
  state.pickups = state.pickups.filter((pickup) => pickup.y < state.height + 40);

  let hitPlayer = false;
  const strike = () => {
    if (state.invuln > 0 || hitPlayer || state.mode !== 'playing') return;
    hitPlayer = true;
    if (state.shieldHits > 0) {
      state.shieldHits = 0;
      state.shieldTimer = 0;
      state.invuln = 0.6;
      state.hitFlash = 0.16;
      burst(state, state.shipX, state.shipY, '#9DEBFF', 12);
      return;
    }
    state.lives -= 1;
    state.invuln = INVULN_TIME;
    state.hitFlash = 0.32;
    state.shake = 1;
    if (state.lives <= 0) {
      state.lives = 0;
      state.mode = 'over';
      state.firing = false;
      state.best = Math.max(state.best, state.score);
    }
  };
  for (const enemy of state.enemies) {
    if (deadEnemies.has(enemy.id)) continue;
    if (!hits(enemy.x, enemy.y, enemy.r, state.shipX, state.shipY, SHIP_HIT_RADIUS)) continue;
    deadEnemies.add(enemy.id);
    burst(state, enemy.x, enemy.y, '#FFD0E4', 8);
    strike();
  }
  const deadEnemyBullets: number[] = [];
  for (const bullet of state.enemyBullets) {
    if (!hits(bullet.x, bullet.y, bullet.r, state.shipX, state.shipY, SHIP_HIT_RADIUS)) continue;
    deadEnemyBullets.push(bullet.id);
    strike();
  }
  if (deadEnemyBullets.length > 0) {
    const gone = new Set(deadEnemyBullets);
    state.enemyBullets = state.enemyBullets.filter((bullet) => !gone.has(bullet.id));
  }
  if (state.boss && state.boss.pattern === 1 && state.boss.beam > 0.25) {
    const nose = { x: state.boss.x, y: state.boss.y + 20 };
    const reach = 900;
    const angle = Math.PI / 2 + Math.sin(state.boss.beam) * 1.05;
    const x2 = nose.x + Math.cos(angle) * reach;
    const y2 = nose.y + Math.sin(angle) * reach;
    if (pointSegmentDistance(state.shipX, state.shipY, nose.x, nose.y, x2, y2) < SHIP_HIT_RADIUS + 14) strike();
  }

  if (deadBullets.size > 0) {
    state.bullets = state.bullets.filter((bullet) => !deadBullets.has(bullet.id));
  }
  if (deadEnemies.size > 0) {
    state.enemies = state.enemies.filter((enemy) => !deadEnemies.has(enemy.id));
  }
}

function hurt(state: GameState, enemy: Enemy, amount: number, dead: Set<number>, chip: boolean): void {
  enemy.hp -= amount;
  if (enemy.hp > 0) {
    if (chip) burst(state, enemy.x, enemy.y, '#FFFFFF', 2);
    return;
  }
  dead.add(enemy.id);
  state.score += enemy.score;
  explode(state, enemy.x, enemy.y, enemy.shape === 'cruiser' ? '#FFD36A' : '#FF8CC8');
}

function collect(state: GameState, pickup: Pickup): boolean {
  if (pickup.kind === 'ammo') {
    state.ammo += pickup.amount;
    burst(state, pickup.x, pickup.y, '#7EF0FF', 10);
    return true;
  }
  if (state.inventory.length >= MAX_INVENTORY) return false;
  state.inventory.push(pickup.kind);
  burst(state, pickup.x, pickup.y, pickup.kind === 'laser' ? '#FF4A2A' : '#FFE7B0', 8);
  return true;
}

export function beamNose(state: GameState): { x: number; y: number } {
  const angle = state.laserTimer > 0 ? state.laserAngle : -Math.PI / 2;
  return { x: state.shipX + Math.cos(angle) * 24, y: state.shipY + Math.sin(angle) * 24 };
}

function clampShip(state: GameState): void {
  const minX = Math.min(SHIP_MARGIN, state.width / 2);
  const maxX = Math.max(minX, state.width - SHIP_MARGIN);
  const minY = Math.min(SHIP_MARGIN, state.height / 2);
  const maxY = Math.max(minY, state.height - SHIP_MARGIN);
  state.shipX = clamp(state.shipX, minX, maxX);
  state.shipY = clamp(state.shipY, minY, maxY);
}

function rollPower(roll: number): PowerKind {
  if (roll < 0.18) return 'rapid';
  if (roll < 0.33) return 'bomb';
  if (roll < 0.48) return 'laser';
  if (roll < 0.62) return 'shield';
  if (roll < 0.74) return 'wingman';
  if (roll < 0.88) return 'missiles';
  return 'warp';
}

function spawnHeavy(state: GameState, speed: number): void {
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

function tickHeavyGuns(state: GameState, dt: number): void {
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

function moveEnemyBullets(state: GameState, dt: number): void {
  const pace = warpPace(state);
  for (const bullet of state.enemyBullets) {
    bullet.x += bullet.vx * dt * pace;
    bullet.y += bullet.vy * dt * pace;
  }
  state.enemyBullets = state.enemyBullets.filter(
    (bullet) => bullet.y < state.height + 30 && bullet.y > -40 && bullet.x > -40 && bullet.x < state.width + 40,
  );
}

export type { MissileAim } from './missiles';
export { chooseMissileTarget };

function tickWingmen(state: GameState, dt: number): void {
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

function startBoss(state: GameState): void {
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

function tickBoss(state: GameState, dt: number): void {
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

function damageBoss(state: GameState, amount: number): void {
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

export function inventorySlots(
  _width: number,
  height: number,
  bottomInset: number,
  count: number,
): Array<{ x: number; y: number; w: number; h: number }> {
  const size = 56;
  const gap = 8;
  const y = height - bottomInset - 18 - size;
  return Array.from({ length: count }, (_, index) => ({
    x: 14 + index * (size + gap),
    y,
    w: size,
    h: size,
  }));
}
