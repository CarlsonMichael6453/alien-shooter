/** Endless waves. Combat numbers stay in constants.ts; a wave only decides how many of those enemies show up. */
export const BOSS_EVERY = 3;
export const WAVE_BREAK = 1.35;

export function isBossWave(wave: number): boolean {
  return wave > 0 && wave % BOSS_EVERY === 0;
}

/** How many regular enemies a non-boss wave sends. Grows with the wave and stays capped. */
export function waveQuota(wave: number): number {
  return Math.min(16, 4 + Math.max(0, wave - 1) * 2);
}

/** Boss health still uses the sector curve. Each boss wave is the next sector fight. */
export function bossSectorForWave(wave: number): number {
  return Math.max(0, Math.floor(Math.max(1, wave) / BOSS_EVERY) - 1);
}
