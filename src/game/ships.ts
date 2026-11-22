export interface ShipStyle {
  id: string;
  name: string;
  /** Unlocked when the saved best score or best wave reaches either mark. Wave 1 is the starter. */
  score: number;
  wave: number;
  wing: string;
  hull: string;
  core: string;
  accent: string;
}

export const SHIPS: readonly ShipStyle[] = [
  { id: 'classic', name: 'Classic', score: 0, wave: 1, wing: '#1B6CFF', hull: '#D9FBFF', core: '#7EF0FF', accent: '#7EF0FF' },
  { id: 'ember', name: 'Ember', score: 2500, wave: 4, wing: '#E25822', hull: '#FFE0A8', core: '#FF5A2A', accent: '#FFB089' },
  { id: 'violet', name: 'Violet', score: 8000, wave: 7, wing: '#7A32D0', hull: '#F0D8FF', core: '#FF3AD4', accent: '#E0B8FF' },
  { id: 'gold', name: 'Gold', score: 15000, wave: 10, wing: '#E0A424', hull: '#FFF6D8', core: '#D4143A', accent: '#FFE7A0' },
];

export const DEFAULT_SHIP = 'classic';

export function shipStyle(id: string): ShipStyle {
  return SHIPS.find((ship) => ship.id === id) ?? SHIPS[0];
}

export function shipUnlocked(ship: ShipStyle, bestScore: number, bestWave: number): boolean {
  return bestScore >= ship.score || bestWave >= ship.wave;
}
