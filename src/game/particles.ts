import { MAX_PARTICLES } from './constants';
import type { GameState, Particle } from './types';

export function burst(state: GameState, x: number, y: number, color: string, count: number): void {
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

export function pushParticle(state: GameState, particle: Particle): void {
  state.particles.push(particle);
  if (state.particles.length > MAX_PARTICLES) {
    state.particles.splice(0, state.particles.length - MAX_PARTICLES);
  }
}

export function explode(state: GameState, x: number, y: number, color: string): void {
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
