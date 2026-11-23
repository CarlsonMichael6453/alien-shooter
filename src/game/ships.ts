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
  { id: 'superpink', name: 'SuperPink', score: 25000, wave: 13, wing: '#FF4FA3', hull: '#FFE4F4', core: '#C43BFF', accent: '#FFB3D9' },
  { id: 'festive', name: 'Festive', score: 40000, wave: 16, wing: '#C48A55', hull: '#F3D2A4', core: '#FFF8F0', accent: '#E23B3B' },
  { id: 'megadark', name: 'MegaDark', score: 60000, wave: 20, wing: '#1A1A1E', hull: '#2A2A32', core: '#E10600', accent: '#8E0000' },
];

export const DEFAULT_SHIP = 'classic';

export function shipStyle(id: string): ShipStyle {
  return SHIPS.find((ship) => ship.id === id) ?? SHIPS[0];
}

export function shipUnlocked(ship: ShipStyle, bestScore: number, bestWave: number): boolean {
  return bestScore >= ship.score || bestWave >= ship.wave;
}
