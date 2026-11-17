import {
  BULLET_RADIUS,
  BULLET_SPEED,
  FIRE_INTERVAL,
  INVULN_TIME,
  KEYBOARD_SPEED,
  MAX_BULLETS,
  MAX_PARTICLES,
  SHIP_HIT_RADIUS,
  SHIP_MARGIN,
  START_LIVES,
} from './constants';
import { createRng } from './rng';
import type { Enemy, GameState, Intent, Particle, Rng } from './types';

export interface Difficulty {
  spawnInterval: number;
  speed: number;
  asteroidChance: number;
  dartChance: number;
  maxEnemies: number;
  wobble: number;
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
    ...partial,
  };
}

export function difficulty(time: number): Difficulty {
  const t = clamp(time / 80, 0, 1);
  const s = t * t * (3 - 2 * t);
  return {
    spawnInterval: lerp(1.28, 0.46, s),
    speed: lerp(96, 236, s),
    asteroidChance: lerp(0.3, 0.48, s),
    dartChance: lerp(0.12, 0.34, s),
    maxEnemies: Math.round(lerp(5, 11, s)),
    wobble: lerp(14, 44, s),
  };
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
    nextId: 1,
    bullets: [],
    enemies: [],
    particles: [],
    stars: [],
    rng,
  };
  seedStars(state);
  clampShip(state);
  return state;
}

export function makeEnemy(partial: Partial<Enemy> & Pick<Enemy, 'x' | 'y'>): Enemy {
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
  for (const particle of state.particles) {
    particle.x *= sx;
    particle.y *= sy;
  }
  state.width = width;
  state.height = height;
  clampShip(state);
}

export function step(state: GameState, intent: Intent, dt: number): void {
  const frame = clamp(dt, 0, 0.05);

  if (state.mode === 'over') {
    driftStars(state, frame);
    decayJuice(state, frame);
    moveParticles(state, frame);
    state.overTimer += frame;
    // Ignore a tap that lands immediately so the card stays readable.
    if (!intent.restart || state.overTimer < 0.45) return;
    restart(state);
  }

  if (state.mode === 'ready') {
    driftStars(state, frame);
    state.time += frame;
    if (!intent.start) return;
    state.mode = 'playing';
    state.time = 0;
    state.spawnCooldown = 0.55;
  }

  state.time += frame;
  decayJuice(state, frame);
  moveShip(state, intent, frame);
  fire(state, intent, frame);
  spawn(state, frame);
  moveBullets(state, frame);
  moveEnemies(state, frame);
  moveParticles(state, frame);
  collide(state);
  driftStars(state, frame);
}

function restart(state: GameState): void {
  state.mode = 'playing';
  state.time = 0;
  state.score = 0;
  state.lives = START_LIVES;
  state.shipX = state.width / 2;
  state.shipY = state.height - 118;
  state.firing = false;
  state.invuln = 0;
  state.hitFlash = 0;
  state.shake = 0;
  state.muzzle = 0;
  state.fireCooldown = 0;
  state.spawnCooldown = 0.55;
  state.shotsFired = 0;
  state.overTimer = 0;
  state.bullets = [];
  state.enemies = [];
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
    state.shipX += intent.keyX * KEYBOARD_SPEED * dt;
    state.shipY += intent.keyY * KEYBOARD_SPEED * dt;
  }
  clampShip(state);
}

function fire(state: GameState, intent: Intent, dt: number): void {
  state.firing = intent.firing;
  state.fireCooldown -= dt;
  if (!intent.firing) {
    if (state.fireCooldown < 0) state.fireCooldown = 0;
    return;
  }
  let guard = 0;
  while (state.fireCooldown <= 0 && state.bullets.length < MAX_BULLETS && guard < 4) {
    state.bullets.push({
      id: state.nextId++,
      x: state.shipX,
      y: state.shipY - 30,
      vy: -BULLET_SPEED,
      r: BULLET_RADIUS,
    });
    state.shotsFired += 1;
    state.muzzle = 0.07;
    state.fireCooldown += FIRE_INTERVAL;
    guard += 1;
    pushParticle(state, {
      x: state.shipX,
      y: state.shipY - 26,
      vx: 0,
      vy: -30,
      life: 0.08,
      maxLife: 0.08,
      r: 6,
      color: '#E7FBFF',
    });
  }
}

function spawn(state: GameState, dt: number): void {
  state.spawnCooldown -= dt;
  if (state.spawnCooldown > 0) return;
  const diff = difficulty(state.time);
  state.spawnCooldown = diff.spawnInterval;
  if (state.enemies.length >= diff.maxEnemies) return;

  const roll = state.rng.next();
  const asteroid = roll < diff.asteroidChance;
  const dart = !asteroid && state.rng.next() < diff.dartChance;
  const radius = asteroid
    ? lerp(15, 34, state.rng.next())
    : dart
      ? lerp(12, 16, state.rng.next())
      : lerp(20, 28, state.rng.next());
  const speedJitter = 0.86 + state.rng.next() * 0.28;
  const speed =
    diff.speed * speedJitter * (dart ? 1.38 : asteroid ? 0.8 : 1);
  const wobble = asteroid ? 0 : diff.wobble * (dart ? 1.25 : 0.85) * (0.65 + state.rng.next() * 0.55);
  const pad = radius + wobble + 8;
  let x = pad + state.rng.next() * Math.max(8, state.width - pad * 2);
  if (state.time < 2.5 && Math.abs(x - state.shipX) < 70) {
    x = x < state.width / 2 ? Math.min(state.width - pad, x + 110) : Math.max(pad, x - 110);
  }

  state.enemies.push({
    id: state.nextId++,
    kind: asteroid ? 'asteroid' : 'alien',
    shape: asteroid ? 'rock' : dart ? 'dart' : 'saucer',
    x,
    y: -radius - 6,
    baseX: x,
    vx: asteroid ? (state.rng.next() - 0.5) * 46 : 0,
    vy: speed,
    r: radius,
    rot: state.rng.next() * Math.PI * 2,
    rotSpeed: (state.rng.next() - 0.5) * (asteroid ? 2.2 : 0.6),
    phase: state.rng.next() * Math.PI * 2,
    wobbleAmp: wobble,
    wobbleFreq: 1.1 + state.rng.next() * 1.3,
    tint: state.rng.next(),
    score: dart ? 150 : asteroid ? 50 : 100,
  });
}

function moveBullets(state: GameState, dt: number): void {
  for (const bullet of state.bullets) bullet.y += bullet.vy * dt;
  state.bullets = state.bullets.filter((bullet) => bullet.y > -40);
}

function moveEnemies(state: GameState, dt: number): void {
  for (const enemy of state.enemies) {
    enemy.y += enemy.vy * dt;
    enemy.rot += enemy.rotSpeed * dt;
    if (enemy.shape === 'rock') {
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

function moveParticles(state: GameState, dt: number): void {
  for (const particle of state.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;
  }
  state.particles = state.particles.filter((particle) => particle.life > 0);
}

function collide(state: GameState): void {
  const deadEnemies = new Set<number>();
  const deadBullets = new Set<number>();

  for (const bullet of state.bullets) {
    if (deadBullets.has(bullet.id)) continue;
    for (const enemy of state.enemies) {
      if (deadEnemies.has(enemy.id)) continue;
      if (hits(bullet.x, bullet.y, bullet.r, enemy.x, enemy.y, enemy.r)) {
        deadBullets.add(bullet.id);
        deadEnemies.add(enemy.id);
        state.score += enemy.score;
        burst(state, enemy.x, enemy.y, enemy.kind === 'asteroid' ? '#E6D2A8' : '#FF8CC8', 12);
        break;
      }
    }
  }

  let hitPlayer = false;
  for (const enemy of state.enemies) {
    if (deadEnemies.has(enemy.id)) continue;
    if (!hits(enemy.x, enemy.y, enemy.r, state.shipX, state.shipY, SHIP_HIT_RADIUS)) continue;
    deadEnemies.add(enemy.id);
    burst(state, enemy.x, enemy.y, '#FFD0E4', 8);
    if (state.invuln > 0 || hitPlayer) continue;
    hitPlayer = true;
    state.lives -= 1;
    state.invuln = INVULN_TIME;
    state.hitFlash = 0.32;
    state.shake = 1;
    if (state.lives <= 0) {
      state.lives = 0;
      state.mode = 'over';
      state.firing = false;
      state.best = Math.max(state.best, state.score);
      break;
    }
  }

  if (deadBullets.size > 0) {
    state.bullets = state.bullets.filter((bullet) => !deadBullets.has(bullet.id));
  }
  if (deadEnemies.size > 0) {
    state.enemies = state.enemies.filter((enemy) => !deadEnemies.has(enemy.id));
  }
}

function burst(state: GameState, x: number, y: number, color: string, count: number): void {
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + state.rng.next() * 0.4;
    const speed = 50 + state.rng.next() * 160;
    pushParticle(state, {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.28 + state.rng.next() * 0.28,
      maxLife: 0.56,
      r: 1.8 + state.rng.next() * 2.4,
      color,
    });
  }
}

function pushParticle(state: GameState, particle: Particle): void {
  state.particles.push(particle);
  if (state.particles.length > MAX_PARTICLES) {
    state.particles.splice(0, state.particles.length - MAX_PARTICLES);
  }
}

function driftStars(state: GameState, dt: number): void {
  for (const star of state.stars) {
    star.y += star.speed * dt;
    if (star.y > 1) star.y -= 1;
  }
}

function seedStars(state: GameState): void {
  const count = 56;
  for (let i = 0; i < count; i += 1) {
    state.stars.push({
      x: state.rng.next(),
      y: state.rng.next(),
      speed: 0.015 + state.rng.next() * 0.07,
      size: state.rng.next() < 0.15 ? 1.8 : 0.8 + state.rng.next() * 0.7,
      alpha: 0.25 + state.rng.next() * 0.7,
      warm: state.rng.next() > 0.82,
    });
  }
}

function clampShip(state: GameState): void {
  const minX = Math.min(SHIP_MARGIN, state.width / 2);
  const maxX = Math.max(minX, state.width - SHIP_MARGIN);
  const minY = Math.min(SHIP_MARGIN, state.height / 2);
  const maxY = Math.max(minY, state.height - SHIP_MARGIN);
  state.shipX = clamp(state.shipX, minX, maxX);
  state.shipY = clamp(state.shipY, minY, maxY);
}

function hits(ax: number, ay: number, ar: number, bx: number, by: number, br: number): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  const reach = ar + br;
  return dx * dx + dy * dy <= reach * reach;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
