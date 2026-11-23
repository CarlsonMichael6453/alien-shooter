import { ABILITY_THEMES, type BadgeTheme } from './abilityArt';
import type { PowerKind } from './types';

export type ShipLook = 'classic' | 'pink' | 'festive' | 'dark';

export interface ShipTheme {
  look: ShipLook;
  bullets: [string, string];
  bulletGlow: string;
  laser: { glow: string; body: string; core: string; hot: string; spark: string };
  shield: { glow: string; neon: string; hot: string };
  rapid: { body: string; core: string };
  bomb: { body: string; fuse: string; hot: string; band: string };
  wingman: { body: string; trim: string };
  warp: { face: string; hand: string; tick: string };
  missile: { body: string; core: string; tip: string; trail: string };
  badges: Record<PowerKind, BadgeTheme>;
}

const CLASSIC: ShipTheme = {
  look: 'classic',
  bullets: ['#F4FEFF', '#F4FEFF'],
  bulletGlow: 'rgba(126,240,255,0.28)',
  laser: {
    glow: 'rgba(255,70,16,0.16)',
    body: 'rgba(255,52,18,0.55)',
    core: '#FFE7A8',
    hot: '#FFFFFF',
    spark: 'rgba(255,120,30,0.75)',
  },
  shield: { glow: 'rgba(57,255,106,0.34)', neon: '#39FF6A', hot: '#EFFFF4' },
  rapid: { body: '#3EF3FF', core: '#FFFFFF' },
  bomb: { body: '#FFB020', fuse: '#6A3018', hot: '#E25822', band: '#FFF6D8' },
  wingman: { body: '#D5E7F5', trim: '#7EF0FF' },
  warp: { face: '#F4F7FF', hand: '#FFF8E8', tick: '#F7F8FF' },
  missile: { body: '#F0C14A', core: '#FFF4C8', tip: '#D4143A', trail: '#D5DEE8' },
  badges: ABILITY_THEMES,
};

function badges(fill: BadgeTheme, laser: BadgeTheme, shield: BadgeTheme): Record<PowerKind, BadgeTheme> {
  return {
    rapid: fill,
    bomb: fill,
    laser,
    shield,
    wingman: fill,
    warp: fill,
    missiles: fill,
  };
}

const PINK: ShipTheme = {
  look: 'pink',
  bullets: ['#FF4FA3', '#FFB3D9'],
  bulletGlow: 'rgba(255,120,190,0.35)',
  laser: {
    glow: 'rgba(168,80,255,0.22)',
    body: 'rgba(176,70,255,0.72)',
    core: '#E7C6FF',
    hot: '#FFFFFF',
    spark: 'rgba(196,120,255,0.8)',
  },
  shield: { glow: 'rgba(214,176,255,0.55)', neon: '#E4C6FF', hot: '#FBF4FF' },
  rapid: { body: '#FF7AB8', core: '#FFE4F2' },
  bomb: { body: '#FF8CC4', fuse: '#7A3058', hot: '#FFE08A', band: '#FFF0F7' },
  wingman: { body: '#FFD0E6', trim: '#FF4FA3' },
  warp: { face: '#FFE4F4', hand: '#FF4FA3', tick: '#FFF0F8' },
  missile: { body: '#FF6AA8', core: '#FFD0E6', tip: '#C43BFF', trail: '#FFB3D9' },
  badges: badges(
    { highlight: '#FFD0EA', mid: '#E23B8C', edge: '#5C1038', rim: '#FFE8F4' },
    { highlight: '#F0D4FF', mid: '#8A3AD4', edge: '#2A0848', rim: '#F6E8FF' },
    { highlight: '#F7E8FF', mid: '#C49AE8', edge: '#5A3878', rim: '#FBF4FF' },
  ),
};

const FESTIVE: ShipTheme = {
  look: 'festive',
  bullets: ['#E23B3B', '#2F9E4F'],
  bulletGlow: 'rgba(255,220,160,0.28)',
  laser: {
    glow: 'rgba(255,80,80,0.18)',
    body: '#E23B3B',
    core: '#FFF8F2',
    hot: '#FFFFFF',
    spark: '#C43B3B',
  },
  shield: { glow: 'rgba(120,190,255,0.4)', neon: '#7EC8FF', hot: '#FFF8F0' },
  rapid: { body: '#E23B3B', core: '#FFF4E0' },
  bomb: { body: '#C43B3B', fuse: '#2A6B38', hot: '#FFE08A', band: '#FFF8F0' },
  wingman: { body: '#3F8F4A', trim: '#C43B3B' },
  warp: { face: '#FFF6E8', hand: '#C43B3B', tick: '#2F9E4F' },
  missile: { body: '#2F8A42', core: '#7DDE86', tip: '#C43B3B', trail: '#F4E4C8' },
  badges: badges(
    { highlight: '#FFE7C2', mid: '#C47A3A', edge: '#5C3010', rim: '#FFF6E4' },
    { highlight: '#FFD0D0', mid: '#C43B3B', edge: '#4A1010', rim: '#FFF0F0' },
    { highlight: '#D8FFE4', mid: '#2F8A42', edge: '#0E3A18', rim: '#F2FFF6' },
  ),
};

const DARK: ShipTheme = {
  look: 'dark',
  bullets: ['#E10600', '#8E0000'],
  bulletGlow: 'rgba(180,0,0,0.35)',
  laser: {
    glow: 'rgba(40,0,0,0.45)',
    body: '#2A0608',
    core: '#FF1A1A',
    hot: '#FFD0D0',
    spark: 'rgba(180,0,0,0.7)',
  },
  shield: { glow: 'rgba(40,0,8,0.7)', neon: '#6A1020', hot: '#FF4A4A' },
  rapid: { body: '#8E1020', core: '#FF3030' },
  bomb: { body: '#1A1A1A', fuse: '#4A0008', hot: '#FF2020', band: '#2A2A2A' },
  wingman: { body: '#101014', trim: '#C41018' },
  warp: { face: '#1A1A22', hand: '#FF3030', tick: '#8A8A96' },
  missile: { body: '#16161C', core: '#3A3A44', tip: '#E10600', trail: '#2A2A32' },
  badges: badges(
    { highlight: '#3A3A44', mid: '#141418', edge: '#050508', rim: '#6A1020' },
    { highlight: '#4A1018', mid: '#1A0608', edge: '#050204', rim: '#FF3030' },
    { highlight: '#2A1820', mid: '#10080C', edge: '#050204', rim: '#8A3040' },
  ),
};

const BY_ID: Record<string, ShipTheme> = {
  superpink: PINK,
  festive: FESTIVE,
  megadark: DARK,
};

export function shipTheme(id: string): ShipTheme {
  return BY_ID[id] ?? CLASSIC;
}
