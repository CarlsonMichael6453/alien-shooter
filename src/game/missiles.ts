import { MISSILE_INTERVAL, MISSILE_SPEED, MISSILE_TURN } from './constants';
import { clamp } from './fieldMath';
import { pushParticle } from './particles';
import type { Enemy, GameState, Missile } from './types';

export interface MissileAim {
  boss: boolean;
  id: number | null;
  x: number;
  y: number;
  score: number;
}

function threatWeight(enemy: Enemy): number {
  const body =
    enemy.shape === 'battleship' ? 70 : enemy.shape === 'carrier' ? 55 : enemy.shape === 'cruiser' ? 28 : enemy.shape === 'saucer' ? 16 : enemy.shape === 'rock' ? 10 : 12;
  return body + (enemy.gun < 900 ? 14 : 0) + enemy.hp * 0.35;
}

function threatScore(state: GameState, x: number, y: number, weight: number): number {
  const dist = Math.max(28, Math.hypot(x - state.shipX, y - state.shipY));
  const low = clamp(y / Math.max(1, state.height), 0, 1);
  return (weight * (1 + 0.9 * low)) / dist;
}

export function chooseMissileTarget(state: GameState): MissileAim | null {
  let best: MissileAim | null = null;
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    const score = threatScore(state, enemy.x, enemy.y, threatWeight(enemy));
    if (!best || score > best.score) best = { boss: false, id: enemy.id, x: enemy.x, y: enemy.y, score };
  }
  if (state.boss && state.boss.hp > 0) {
    const score = threatScore(state, state.boss.x, state.boss.y, 240 + state.boss.hp * 0.4);
    if (!best || score > best.score) best = { boss: true, id: null, x: state.boss.x, y: state.boss.y, score };
  }
  return best;
}

function lockMissile(state: GameState, missile: Missile, aim: MissileAim | null): { x: number; y: number } | null {
  if (missile.boss && state.boss && state.boss.hp > 0) return { x: state.boss.x, y: state.boss.y };
  if (!missile.boss && missile.targetId != null) {
    const enemy = state.enemies.find((item) => item.id === missile.targetId && item.hp > 0);
    if (enemy) return { x: enemy.x, y: enemy.y };
  }
  missile.boss = false;
  missile.targetId = null;
  if (!aim) return null;
  missile.boss = aim.boss;
  missile.targetId = aim.id;
  return { x: aim.x, y: aim.y };
}

function turnToward(current: number, desired: number, maxStep: number): number {
  let delta = desired - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return current + clamp(delta, -maxStep, maxStep);
}

function launchMissile(state: GameState): void {
  const aim = chooseMissileTarget(state);
  const missile: Missile = {
    x: state.shipX,
    y: state.shipY - 18,
    angle: -Math.PI / 2 + (state.rng.next() - 0.5) * 0.55,
    targetId: aim && !aim.boss ? aim.id : null,
    boss: aim?.boss ?? false,
    smoke: 0,
    age: 0,
  };
  state.missiles.push(missile);
}

export function tickMissiles(state: GameState, dt: number): void {
  if (state.missileLeft > 0) {
    state.missileCooldown -= dt;
    let guard = 0;
    while (state.missileCooldown <= 0 && state.missileLeft > 0 && guard < 3) {
      launchMissile(state);
      state.missileLeft -= 1;
      state.missileCooldown += MISSILE_INTERVAL;
      guard += 1;
    }
  }
  const aim = chooseMissileTarget(state);
  for (const missile of state.missiles) {
    const target = lockMissile(state, missile, aim);
    if (target) {
      const desired = Math.atan2(target.y - missile.y, target.x - missile.x);
      missile.angle = turnToward(missile.angle, desired, MISSILE_TURN * dt);
    }
    missile.age += dt;
    missile.x += Math.cos(missile.angle) * MISSILE_SPEED * dt;
    missile.y += Math.sin(missile.angle) * MISSILE_SPEED * dt;
    missile.smoke -= dt;
    if (missile.smoke <= 0) {
      missile.smoke = 0.05;
      pushParticle(state, {
        x: missile.x - Math.cos(missile.angle) * 8,
        y: missile.y - Math.sin(missile.angle) * 8,
        vx: -Math.cos(missile.angle) * 18,
        vy: -Math.sin(missile.angle) * 18,
        life: 0.28,
        maxLife: 0.28,
        r: 2.2,
        color: '#C9D4E0',
      });
    }
  }
}

