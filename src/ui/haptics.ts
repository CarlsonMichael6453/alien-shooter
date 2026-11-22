/** Short pulse when the ship is hit. Web uses the vibration API; native falls back to the same call when present. */
export function pulseHaptic(enabled: boolean): void {
  if (!enabled || typeof navigator === 'undefined') return;
  const vibrate = navigator.vibrate?.bind(navigator);
  if (!vibrate) return;
  try {
    vibrate(18);
  } catch {
    // Some browsers expose vibrate and then refuse the call.
  }
}
