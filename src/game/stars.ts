import type { GameState } from './types';

export function driftStars(state: GameState, dt: number): void {
  for (const star of state.stars) {
    star.y += star.speed * dt;
    if (star.y > 1) star.y -= 1;
  }
}

export function seedStars(state: GameState): void {
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
