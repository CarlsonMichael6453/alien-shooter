export const SECTOR_SCORE = 1000;

export const SECTORS = [
  { name: 'Deep Space', sky: ['#03060E', '#0A1022', '#120818', '#070B16'], nebula: 'rgba(88, 48, 150, 0.16)', dust: 'rgba(150, 50, 90, 0.12)', enemy: '#E7F4FF' },
  { name: 'Asteroid Belt', sky: ['#100E0C', '#1C1814', '#2A2118', '#12100E'], nebula: 'rgba(120, 90, 60, 0.18)', dust: 'rgba(80, 70, 60, 0.16)', enemy: '#E4D2B0' },
  { name: 'Nebula', sky: ['#140818', '#2A1030', '#123048', '#100818'], nebula: 'rgba(180, 60, 160, 0.22)', dust: 'rgba(40, 140, 170, 0.16)', enemy: '#F0C8FF' },
  { name: 'Red Giant', sky: ['#1A0806', '#3A140C', '#5A2010', '#140806'], nebula: 'rgba(200, 70, 30, 0.22)', dust: 'rgba(255, 140, 60, 0.14)', enemy: '#FFD0B0' },
  { name: 'Alien Homeworld', sky: ['#06140C', '#0C2818', '#143020', '#08140C'], nebula: 'rgba(40, 160, 90, 0.2)', dust: 'rgba(180, 200, 60, 0.12)', enemy: '#D8FFC0' },
] as const;

export interface SectorTheme {
  index: number;
  loop: number;
  name: string;
  sky: readonly [string, string, string, string];
  nebula: string;
  dust: string;
  enemy: string;
}

export function sectorTheme(index: number): SectorTheme {
  const loop = Math.floor(Math.max(0, index) / SECTORS.length);
  const theme = SECTORS[((index % SECTORS.length) + SECTORS.length) % SECTORS.length];
  return { index, loop, ...theme };
}

/** Boss at the end of a sector. The first fight is 50, then +20 each sector. */
export function bossHealth(sectorIndex: number): number {
  return 50 + Math.max(0, sectorIndex) * 20;
}

export function bossBulletSpeed(sectorIndex: number): number {
  return 140 + Math.max(0, sectorIndex) * 14;
}

export function nextBossScore(sectorIndex: number): number {
  return (Math.max(0, sectorIndex) + 1) * SECTOR_SCORE;
}
