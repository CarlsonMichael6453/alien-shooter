import type { GameState } from '../game/types';

export interface GameCanvasHandle {
  draw(state: GameState): void;
}
