/** Straight festive laser: a tapered beam with diagonal stripes that scroll toward the tip. */

export const LASER_LENGTH_SCALE = 1.4;
export const LASER_BODY_HALF = 9;
export const LASER_GLOW_HALF = 15;
export const LASER_PINCH = 0.65;
export const CANDY_STRIPE = 22;
export const CANDY_SKEW = 11;
export const CANDY_SPEED = 280;
export const CANDY_RED = '#E23B3B';
export const CANDY_WHITE = '#FFF8F2';

export function laserLength(width: number, height: number): number {
  return Math.max(width, height) * LASER_LENGTH_SCALE;
}

/** Half-width of the straight beam. Nose is full width; the tip pinches in. */
export function beamHalfAt(along: number, length: number, half: number, pinch = LASER_PINCH): number {
  if (length <= 0) return half;
  const t = Math.min(1, Math.max(0, along / length));
  return half * (1 - (1 - pinch) * t);
}

export function candyScroll(time: number): number {
  const period = CANDY_STRIPE * 2;
  const raw = time * CANDY_SPEED;
  if (!Number.isFinite(raw)) return 0;
  return ((raw % period) + period) % period;
}

export interface CandyQuad {
  color: string;
  /** Beam-local corners: [along, side]. Side 0 is the straight center line. */
  corners: ReadonlyArray<readonly [number, number]>;
}

export function candyQuads(length: number, time: number, red = CANDY_RED, white = CANDY_WHITE): CandyQuad[] {
  if (!(length > 0)) return [];
  const scroll = candyScroll(time);
  const first = Math.floor((-CANDY_SKEW - scroll) / CANDY_STRIPE) - 1;
  const last = Math.ceil((length + CANDY_SKEW - scroll) / CANDY_STRIPE) + 1;
  const quads: CandyQuad[] = [];
  for (let i = first; i <= last; i += 1) {
    const start = i * CANDY_STRIPE + scroll;
    const end = start + CANDY_STRIPE;
    const clipped = clipBeam(
      [
        [start + CANDY_SKEW, LASER_BODY_HALF],
        [end + CANDY_SKEW, LASER_BODY_HALF],
        [end - CANDY_SKEW, -LASER_BODY_HALF],
        [start - CANDY_SKEW, -LASER_BODY_HALF],
      ],
      length,
    );
    if (clipped.length < 3) continue;
    quads.push({
      color: mod(i, 2) === 0 ? red : white,
      corners: clipped.map(([along, side]) => {
        const sign = side >= 0 ? 1 : -1;
        return [along, sign * beamHalfAt(along, length, LASER_BODY_HALF)] as const;
      }),
    });
  }
  return quads;
}

/** Glow quad for the same straight, tapered center line the other lasers use. */
export function candyGlowQuad(length: number): Array<[number, number]> {
  const tip = LASER_GLOW_HALF * LASER_PINCH;
  return [
    [0, LASER_GLOW_HALF],
    [0, -LASER_GLOW_HALF],
    [length, -tip],
    [length, tip],
  ];
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

function clipBeam(poly: Array<[number, number]>, length: number): Array<[number, number]> {
  return clipHalfPlane(clipHalfPlane(poly, 0, true), length, false);
}

function clipHalfPlane(poly: Array<[number, number]>, limit: number, keepAbove: boolean): Array<[number, number]> {
  if (poly.length === 0) return [];
  const inside = (along: number) => (keepAbove ? along >= limit - 1e-6 : along <= limit + 1e-6);
  const output: Array<[number, number]> = [];
  for (let i = 0; i < poly.length; i += 1) {
    const cur = poly[i];
    const prev = poly[(i + poly.length - 1) % poly.length];
    const curIn = inside(cur[0]);
    const prevIn = inside(prev[0]);
    if (curIn) {
      if (!prevIn) output.push(cross(prev, cur, limit));
      output.push(cur);
    } else if (prevIn) output.push(cross(prev, cur, limit));
  }
  return output;
}

function cross(a: [number, number], b: [number, number], along: number): [number, number] {
  const span = b[0] - a[0];
  const t = span === 0 ? 0 : (along - a[0]) / span;
  return [along, a[1] + (b[1] - a[1]) * t];
}
