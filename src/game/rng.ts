import type { Rng } from './types';

/** Small deterministic generator so spawns can be tested and still vary in play. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return {
    next() {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    },
  };
}
