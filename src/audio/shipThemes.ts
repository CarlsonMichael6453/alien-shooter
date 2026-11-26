/**
 * Original synth themes. Every regular ship shares one default theme and sound set.
 * SuperPink, Festive, and MegaDark each keep their own root, scale, and ability pitches.
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

/** Shared by Classic, Ember, Violet, Gold, and any ship without its own theme. */
const DEFAULT_THEME: ShipMusic = {
  id: 'default',
  root: 196,
  scale: [0, 2, 4, 7, 9],
  interval: 0.24,
  voice: 'triangle',
  shoot: 640,
  rapid: 880,
  laser: 740,
};

const PREMIUM_THEMES: Record<string, ShipMusic> = {
  superpink: { id: 'superpink', root: 329.6, scale: [0, 2, 5, 7, 11], interval: 0.18, voice: 'sine', shoot: 784, rapid: 1046, laser: 880 },
  festive: { id: 'festive', root: 261.6, scale: [0, 2, 4, 5, 7, 9], interval: 0.2, voice: 'triangle', shoot: 659, rapid: 880, laser: 784 },
  megadark: { id: 'megadark', root: 110, scale: [0, 1, 5, 6, 10], interval: 0.28, voice: 'sawtooth', shoot: 392, rapid: 523, laser: 311 },
};

export function shipMusic(id: string): ShipMusic {
  return PREMIUM_THEMES[id] ?? DEFAULT_THEME;
}

export function musicChangesWithShip(previous: string, next: string): boolean {
  return shipMusic(previous).id !== shipMusic(next).id;
}

/** Rapid fire is every 0.02s. A new shot closer than this stacks into a harsh buzz. */
export const PEW_GAP = 0.05;

export function pewAllowed(lastAt: number, now: number, gap = PEW_GAP): boolean {
  return now - lastAt >= gap;
}

/**
 * Notes to start on this tick. A clock left behind while the run was over
 * must jump to now. Replaying every missed beat schedules a burst that
 * throws and then keeps failing, so music and shots go silent on the next run.
 */
export function musicNotesDue(
  nextBeat: number,
  now: number,
  interval: number,
  lookahead = 0.35,
): { count: number; next: number } {
  let beat = Number.isFinite(nextBeat) && nextBeat >= now ? nextBeat : now;
  let count = 0;
  const horizon = now + lookahead;
  while (beat < horizon && count < 8) {
    beat += interval;
    count += 1;
  }
  return { count, next: beat };
}
