import { audio } from '../audio/arcade';
import type { GameState } from '../game/types';

export function syncAudio(
  state: GameState,
  prev: { shots: number; score: number; lives: number; blast: boolean; boss: boolean; pickups: number; shield: number; wing: number; warp: number; rapid: number; laser: number; enemyShots: number; missileLeft: number; primed: boolean },
  paused: boolean,
): void {
  const beam = state.mode === 'playing' && state.laserTimer > 0;
  audio.syncLaser(beam, paused);
  if (prev.primed) {
    if (state.shotsFired > prev.shots) audio.shoot(state.shipId);
    if (state.score > prev.score) audio.hit();
    if (state.lives < prev.lives) audio.explosion();
    if (state.blast && !prev.blast) audio.explosion();
    if (state.boss && !prev.boss) audio.bossIntro();
    if (!state.boss && prev.boss) audio.bossWin();
    if (state.enemyBullets.length > prev.enemyShots + 2) audio.bossAttack();
    if (state.pickups.length < prev.pickups) audio.pickup();
    if (state.shieldTimer > 0 && prev.shield === 0) audio.power('shield', state.shipId);
    if (state.wingmanTimer > 0 && prev.wing === 0) audio.power('wingman', state.shipId);
    if (state.warpTimer > 0 && prev.warp === 0) audio.power('warp', state.shipId);
    if (state.rapidTimer > 0 && prev.rapid === 0) audio.power('rapid', state.shipId);
    if (state.laserTimer > 0 && prev.laser === 0) audio.power('laser', state.shipId);
    if (state.missileLeft > 0 && prev.missileLeft === 0) audio.power('missiles', state.shipId);
  }
  prev.primed = true;
  prev.shots = state.shotsFired;
  prev.score = state.score;
  prev.lives = state.lives;
  prev.blast = state.blast != null;
  prev.boss = state.boss != null;
  prev.pickups = state.pickups.length;
  prev.shield = state.shieldTimer;
  prev.wing = state.wingmanTimer;
  prev.warp = state.warpTimer;
  prev.rapid = state.rapidTimer;
  prev.laser = state.laserTimer;
  prev.enemyShots = state.enemyBullets.length;
  prev.missileLeft = state.missileLeft;
  if (state.mode === 'playing') audio.tickMusic(state.shipId, state.boss != null);
}
