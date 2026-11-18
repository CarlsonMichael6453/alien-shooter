import {
  AMMO_WEIGHT_100,
  AMMO_WEIGHT_50,
  BOMB_BLAST_TIME,
  BOMB_DAMAGE,
  BOMB_FUSE,
  BOMB_SPEED,
  BULLET_DAMAGE,
  BULLET_RADIUS,
  BULLET_SPEED,
  FIRE_INTERVAL,
  INVULN_TIME,
  KEYBOARD_SPEED,
  LASER_AIM_DEADZONE,
  LASER_DPS,
  LASER_DURATION,
  MAX_BULLETS,
  MAX_INVENTORY,
  MAX_PARTICLES,
  RAPID_CONE,
  RAPID_DURATION,
  RAPID_RATE,
  SHIP_HIT_RADIUS,
  SHIP_MARGIN,
  START_AMMO,
  START_LIVES,
} from './constants';
import { createRng } from './rng';
import type { Blast, Bomb, Enemy, GameState, Intent, Particle, Pickup, PickupKind, Rng } from './types';

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
    hoverActive: false,
    hoverX: 0,
    hoverY: 0,
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

/** Circle whose area is half the playfield. */
export function halfScreenRadius(width: number, height: number): number {
  return Math.sqrt((width * height) / (2 * Math.PI));
}

export function rollAmmoAmount(rng: Rng): 50 | 100 | 200 {
  const roll = rng.next();
  if (roll < AMMO_WEIGHT_50) return 50;
  if (roll < AMMO_WEIGHT_100) return 100;
  return 200;
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
    spark: 0,
    hold: false,
    nextId: 1,
    bullets: [],
    enemies: [],
    pickups: [],
    bomb: null,
    blast: null,
    particles: [],
    stars: [],
    ammoCooldown: 5.5,
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
  for (const pickup of state.pickups) {
    pickup.x *= sx;
    pickup.y *= sy;
  }
  for (const particle of state.particles) {
    particle.x *= sx;
    particle.y *= sy;
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
    state.spawnCooldown = 0.55;
    state.ammoCooldown = 5.5;
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
  state.shipX = state.width / 2;
  state.shipY = state.height - 118;
  state.firing = false;
  state.invuln = 0;
  state.hitFlash = 0;
  state.shake = 0;
  state.muzzle = 0;
  state.fireCooldown = 0;
  state.spawnCooldown = 0.55;
  state.ammoCooldown = 5.5;
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
    state.shipX += intent.keyX * KEYBOARD_SPEED * dt;
    state.shipY += intent.keyY * KEYBOARD_SPEED * dt;
  }
  clampShip(state);
}

function updateAim(state: GameState, intent: Intent): void {
  if (state.laserTimer <= 0) return;
  const drag = Math.hypot(intent.fireDragX, intent.fireDragY);
  if (drag >= LASER_AIM_DEADZONE) {
    state.laserAngle = Math.atan2(intent.fireDragY, intent.fireDragX);
    return;
  }
  if (intent.hoverActive) {
    state.laserAngle = Math.atan2(intent.hoverY - state.shipY, intent.hoverX - state.shipX);
  }
}

function tickPowers(state: GameState, dt: number): void {
  state.rapidTimer = Math.max(0, state.rapidTimer - dt);
  state.laserTimer = Math.max(0, state.laserTimer - dt);
}

function powerActive(state: GameState): boolean {
  return state.rapidTimer > 0 || state.laserTimer > 0 || state.bomb != null || state.blast != null;
}

function activatePower(state: GameState, intent: Intent): void {
  if (intent.activateSlot == null || powerActive(state)) return;
  const kind = state.inventory[intent.activateSlot];
  if (!kind) return;
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

function spawnEnemies(state: GameState, dt: number): void {
  state.spawnCooldown -= dt;
  if (state.spawnCooldown > 0) return;
  const diff = difficulty(state.time);
  state.spawnCooldown = diff.spawnInterval;
  if (state.enemies.length >= diff.maxEnemies) return;

  const roll = state.rng.next();
  const tier: 5 | 10 | 15 =
    roll < diff.cruiserChance ? 15 : roll < diff.cruiserChance + diff.saucerChance ? 10 : 5;
  const radius = tier === 15 ? 36 : tier === 10 ? 24 : 15;
  const speedJitter = 0.88 + state.rng.next() * 0.22;
  const speed = diff.speed * speedJitter * (tier === 15 ? 0.55 : tier === 10 ? 0.9 : 1.28);
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
  });
}

function spawnPickups(state: GameState, dt: number): void {
  const ramp = clamp(state.time / 80, 0, 1);
  state.ammoCooldown -= dt;
  if (state.ammoCooldown <= 0) {
    state.ammoCooldown = lerp(9, 6.5, ramp);
    spawnPickup(state, 'ammo', rollAmmoAmount(state.rng));
  }
  state.powerCooldown -= dt;
  if (state.powerCooldown <= 0) {
    state.powerCooldown = lerp(15, 11, ramp);
    const roll = state.rng.next();
    const kind: PickupKind = roll < 0.4 ? 'rapid' : roll < 0.7 ? 'bomb' : 'laser';
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
  for (const enemy of state.enemies) {
    enemy.y += enemy.vy * dt;
    enemy.rot += enemy.rotSpeed * dt;
    if (enemy.shape === 'cruiser' || enemy.shape === 'rock') {
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
  }

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
  }

  for (const pickup of state.pickups) {
    if (!hits(pickup.x, pickup.y, pickup.r, state.shipX, state.shipY, SHIP_HIT_RADIUS + 6)) continue;
    if (!collect(state, pickup)) continue;
    pickup.y = state.height + 999;
  }
  state.pickups = state.pickups.filter((pickup) => pickup.y < state.height + 40);

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

function explode(state: GameState, x: number, y: number, color: string): void {
  burst(state, x, y, color, 14);
  burst(state, x, y, '#FFF6D8', 6);
  for (let i = 0; i < 7; i += 1) {
    const angle = state.rng.next() * Math.PI * 2;
    const speed = 30 + state.rng.next() * 90;
    pushParticle(state, {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.45 + state.rng.next() * 0.35,
      maxLife: 0.8,
      r: 2.2 + state.rng.next() * 2.2,
      color: state.rng.next() > 0.5 ? '#8A7564' : '#C4B4A4',
    });
  }
  pushParticle(state, {
    x,
    y,
    vx: 0,
    vy: 0,
    life: 0.14,
    maxLife: 0.14,
    r: 22,
    color: '#FFF8E8',
  });
}

export function beamNose(state: GameState): { x: number; y: number } {
  return { x: state.shipX, y: state.shipY - 24 };
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

function pointSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : clamp(((px - x1) * dx + (py - y1) * dy) / len, 0, 1);
  const x = x1 + dx * t;
  const y = y1 + dy * t;
  return Math.hypot(px - x, py - y);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
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
