/** Short pulse when the ship is hit. Web uses the vibration API; native falls back to the same call when present. */
export function pulseHaptic(enabled: boolean): void {
  if (!enabled || typeof navigator === 'undefined') return;
  const vibrate = (navigator as Navigator & { vibrate?: (pattern: number) => boolean }).vibrate;
  if (typeof vibrate !== 'function') return;
  try {
    vibrate(18);
  } catch {
    // iOS Safari has no vibrate API. A throw here must not cancel a shot.
  }
}
