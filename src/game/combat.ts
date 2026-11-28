import { BOMB_BLAST_TIME, BOMB_DAMAGE, BULLET_DAMAGE, INVULN_TIME, LASER_DPS, MAX_INVENTORY, MISSILE_DAMAGE, SHIP_HIT_RADIUS } from './constants';
import { beamNose } from './beam';
import { damageBoss } from './enemies';
import { clamp, easeOut, hits, pointSegmentDistance } from './fieldMath';
import { burst, explode, pushParticle } from './particles';
import type { Enemy, GameState, Missile, Pickup } from './types';

export function collide(state: GameState, dt: number): void {
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

