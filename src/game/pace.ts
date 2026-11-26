import { WARP_SCALE } from './constants';
import type { GameState } from './types';

export function warpPace(state: GameState): number {
  return state.warpTimer > 0 ? WARP_SCALE : 1;
}
