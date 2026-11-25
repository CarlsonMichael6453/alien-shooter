import type { GameState } from './types';

export function beamNose(state: GameState): { x: number; y: number } {
  const angle = state.laserTimer > 0 ? state.laserAngle : -Math.PI / 2;
  return { x: state.shipX + Math.cos(angle) * 24, y: state.shipY + Math.sin(angle) * 24 };
}
