/**
 * Original synth themes. Each ship has its own root, scale, and a few ability pitches.
 * Nothing here is a recording.
 */

export type MusicVoice = 'square' | 'sawtooth' | 'triangle' | 'sine';

export interface ShipMusic {
  id: string;
  root: number;
  scale: readonly number[];
  interval: number;
  voice: MusicVoice;
  shoot: number;
  rapid: number;
  laser: number;
}

const THEMES: Record<string, ShipMusic> = {
  classic: { id: 'classic', root: 196, scale: [0, 2, 4, 7, 9], interval: 0.24, voice: 'triangle', shoot: 640, rapid: 880, laser: 740 },
  ember: { id: 'ember', root: 220, scale: [0, 3, 5, 7, 10], interval: 0.22, voice: 'square', shoot: 520, rapid: 760, laser: 620 },
  violet: { id: 'violet', root: 247, scale: [0, 2, 3, 7, 8], interval: 0.26, voice: 'sine', shoot: 700, rapid: 990, laser: 830 },
  gold: { id: 'gold', root: 174.6, scale: [0, 4, 7, 11, 12], interval: 0.2, voice: 'triangle', shoot: 587, rapid: 830, laser: 698 },
  superpink: { id: 'superpink', root: 329.6, scale: [0, 2, 5, 7, 11], interval: 0.18, voice: 'sine', shoot: 784, rapid: 1046, laser: 880 },
  festive: { id: 'festive', root: 261.6, scale: [0, 2, 4, 5, 7, 9], interval: 0.2, voice: 'triangle', shoot: 659, rapid: 880, laser: 784 },
  megadark: { id: 'megadark', root: 110, scale: [0, 1, 5, 6, 10], interval: 0.28, voice: 'sawtooth', shoot: 392, rapid: 523, laser: 311 },
};

export function shipMusic(id: string): ShipMusic {
  return THEMES[id] ?? THEMES.classic;
}

export function musicChangesWithShip(previous: string, next: string): boolean {
  return shipMusic(previous).id !== shipMusic(next).id;
}
