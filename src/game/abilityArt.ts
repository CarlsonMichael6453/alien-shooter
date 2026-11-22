import { RAPID_CONE } from './constants';
import type { PowerKind } from './types';

export interface BadgeTheme {
  highlight: string;
  mid: string;
  edge: string;
  rim: string;
}

/** Glossy badge fills. Highlight sits toward the top of the radial blend. */
export const ABILITY_THEMES: Record<PowerKind, BadgeTheme> = {
  rapid: { highlight: '#9ECAFF', mid: '#1A56D6', edge: '#061433', rim: '#E5F2FF' },
  bomb: { highlight: '#FFE0A0', mid: '#E08A28', edge: '#5C2808', rim: '#FFF0D2' },
  laser: { highlight: '#8B939E', mid: '#323840', edge: '#101216', rim: '#E4E8EE' },
  shield: { highlight: '#5EE88A', mid: '#157A3C', edge: '#042214', rim: '#E5FFEE' },
  wingman: { highlight: '#E0B8FF', mid: '#7A32D0', edge: '#240848', rim: '#F6E8FF' },
  warp: { highlight: '#B7C0FF', mid: '#3C3ED6', edge: '#14103A', rim: '#EEF0FF' },
  missiles: { highlight: '#FFE7A8', mid: '#E0A424', edge: '#5C3C08', rim: '#FFF6D8' },
};

export const SHIELD_NEON = '#39FF6A';
export const SHIELD_HOT = '#EFFFF4';
export const SHIELD_GLOW = 'rgba(57,255,106,0.42)';
export const RAPID_BODY = '#3EF3FF';
export const RAPID_CORE = '#FFFFFF';
export const LASER_BEAM = '#FF5A2A';
export const LASER_CORE = '#FFE08A';
export const LASER_HOT = '#FFF8E4';

/** Muzzle sits this far below the badge center, as a fraction of the radius. */
export const RAPID_MUZZLE = 0.58;

export type Point = [number, number];

export function quad(x0: number, y0: number, x1: number, y1: number, half: number): Point[] {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const px = (-dy / len) * half;
  const py = (dx / len) * half;
  return [
    [x0 + px, y0 + py],
    [x1 + px, y1 + py],
    [x1 - px, y1 - py],
    [x0 - px, y0 - py],
  ];
}

/**
 * Four tracers inside the live rapid-fire cone (±RAPID_CONE/2, currently ±15°).
 * From the muzzle outward: left edge, right edge, then a shallower left and right.
 * Every streak is the same length and has flat ends.
 */
export function rapidLean(index: number): number {
  const half = RAPID_CONE / 2;
  const magnitude = index < 2 ? half : half / 3;
  return (index % 2 === 0 ? -1 : 1) * magnitude;
}

export interface RapidStreak {
  lean: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  body: Point[];
  core: Point[];
}

export function rapidStreaks(radius: number): RapidStreak[] {
  const length = radius * 0.5;
  const muzzleY = radius * RAPID_MUZZLE;
  return [0, 1, 2, 3].map((index) => {
    const lean = rapidLean(index);
    const dist = radius * (0.05 + index * 0.15);
    const dx = Math.sin(lean);
    const dy = -Math.cos(lean);
    const x0 = dx * dist;
    const y0 = muzzleY + dy * dist;
    const x1 = x0 + dx * length;
    const y1 = y0 + dy * length;
    return {
      lean,
      x0,
      y0,
      x1,
      y1,
      body: quad(x0, y0, x1, y1, radius * 0.1),
      core: quad(x0, y0, x1, y1, radius * 0.034),
    };
  });
}

export function hexPoints(cx: number, cy: number, radius: number): Point[] {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI) / 3;
    return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
  });
}

export interface Disc {
  x: number;
  y: number;
  r: number;
  color: string;
}

export function bombArt(radius: number): {
  ring: { x: number; y: number; rx: number; ry: number; width: number; color: string };
  stem: Point[];
  stemHot: Point[];
  lobes: Disc[];
} {
  const s = radius;
  return {
    ring: {
      x: 0,
      y: s * 0.5,
      rx: s * 0.58,
      ry: s * 0.12,
      width: Math.max(1.15, s * 0.055),
      color: 'rgba(255,246,220,0.96)',
    },
    stem: [
      [-s * 0.08, s * 0.46],
      [s * 0.08, s * 0.46],
      [s * 0.13, s * 0.02],
      [-s * 0.13, s * 0.02],
    ],
    stemHot: [
      [-s * 0.03, s * 0.42],
      [s * 0.03, s * 0.42],
      [s * 0.045, s * 0.05],
      [-s * 0.045, s * 0.05],
    ],
    lobes: [
      { x: -s * 0.3, y: -s * 0.02, r: s * 0.26, color: '#8A3C22' },
      { x: s * 0.32, y: 0, r: s * 0.24, color: '#C85A28' },
      { x: 0, y: -s * 0.28, r: s * 0.32, color: '#E25822' },
      { x: -s * 0.08, y: -s * 0.4, r: s * 0.15, color: '#FFE0A8' },
      { x: s * 0.12, y: -s * 0.46, r: s * 0.08, color: '#FFF8E4' },
      { x: -s * 0.38, y: -s * 0.08, r: s * 0.065, color: '#2A1812' },
    ],
  };
}

export function wingmanArt(radius: number): { outlines: Point[][]; dots: Disc[] } {
  const fighters = [-1, 1].map((side) => {
    const cx = side * radius * 0.36;
    const cy = radius * 0.04;
    const s = radius * 0.5;
    const outline: Point[] = [
      [cx, cy - s],
      [cx + side * s * 0.58, cy + s * 0.7],
      [cx, cy + s * 0.18],
      [cx - side * s * 0.58, cy + s * 0.7],
    ];
    return {
      outline,
      dot: { x: cx, y: cy + s * 0.5, r: radius * 0.07, color: '#FF3AD4' },
    };
  });
  return { outlines: fighters.map((fighter) => fighter.outline), dots: fighters.map((fighter) => fighter.dot) };
}

export function clockArt(radius: number): { ticks: Point[][]; minute: Point[]; hour: Point[]; face: number; hub: number } {
  const ticks = Array.from({ length: 12 }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI) / 6;
    const inner = radius * (index % 3 === 0 ? 0.44 : 0.5);
    const outer = radius * 0.6;
    const half = radius * (index % 3 === 0 ? 0.032 : 0.018);
    return quad(Math.cos(angle) * inner, Math.sin(angle) * inner, Math.cos(angle) * outer, Math.sin(angle) * outer, half);
  });
  const hourAngle = Math.PI / 6;
  return {
    ticks,
    minute: quad(0, radius * 0.06, 0, -radius * 0.44, radius * 0.028),
    hour: quad(0, 0, Math.cos(hourAngle) * radius * 0.28, Math.sin(hourAngle) * radius * 0.28, radius * 0.034),
    face: radius * 0.62,
    hub: radius * 0.065,
  };
}

export interface MissileGlyph {
  body: Point[];
  core: Point[];
  tip: Point[];
}

export function missileArt(radius: number): { missiles: MissileGlyph[]; lock: { x: number; y: number }; reticle: number } {
  const lock = { x: 0, y: -radius * 0.52 };
  const tails = [
    { x: -radius * 0.58, y: radius * 0.36 },
    { x: radius * 0.02, y: radius * 0.62 },
    { x: radius * 0.6, y: radius * 0.14 },
  ];
  const missiles = tails.map((tail) => {
    const dx = lock.x - tail.x;
    const dy = lock.y - tail.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const bodyEnd = { x: tail.x + ux * len * 0.58, y: tail.y + uy * len * 0.58 };
    const tipAt = { x: tail.x + ux * len * 0.8, y: tail.y + uy * len * 0.8 };
    const px = -uy * radius * 0.1;
    const py = ux * radius * 0.1;
    return {
      body: quad(tail.x, tail.y, bodyEnd.x, bodyEnd.y, radius * 0.07),
      core: quad(tail.x, tail.y, bodyEnd.x, bodyEnd.y, radius * 0.026),
      tip: [
        [tipAt.x, tipAt.y],
        [bodyEnd.x + px, bodyEnd.y + py],
        [bodyEnd.x - px, bodyEnd.y - py],
      ] as Point[],
    };
  });
  return { missiles, lock, reticle: radius * 0.14 };
}
