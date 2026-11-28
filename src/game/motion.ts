/** Idle hover on the start screen. A reduced-motion preference holds the ship still. */
export function menuShipBob(time: number, reduceMotion: boolean): number {
  if (reduceMotion || !Number.isFinite(time)) return 0;
  return Math.sin(time * 1.7) * 4;
}

export function prefersReducedMotion(): boolean {
  if (typeof matchMedia !== 'function') return false;
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
