import type { PointerRole } from '../game/controls';

/**
 * A touch that lands on a button must not become a steering or firing finger,
 * and its touchend must not be cancelled. Cancelling touchend suppresses the
 * click that mobile browsers use to activate a button.
 */
export function classifyTouch(
  targetIsUi: boolean,
  role: PointerRole,
  claimedFire = false,
  claimedPower = false,
): { play: boolean; cancel: boolean; dropPlayPointer: boolean } {
  // iOS Safari can hit-test the fire graphic even though it is pointer-events: none.
  // That graphic sits inside a HUD node, so a plain UI check would drop the finger.
  // The fire button also wins when a nearby ability icon is reported as the target.
  if (claimedFire) return { play: true, cancel: true, dropPlayPointer: false };
  // An ability glyph can be reported as a menu control. Keep the slot tap.
  if (claimedPower || role === 'power') return { play: false, cancel: true, dropPlayPointer: false };
  if (role === 'chrome') return { play: false, cancel: !targetIsUi, dropPlayPointer: false };
  if (targetIsUi) return { play: false, cancel: false, dropPlayPointer: true };
  return { play: true, cancel: true, dropPlayPointer: false };
}

export type TouchSurface = 'fire' | 'laser' | 'other';

/**
 * Safari can report a touch on the fire button as a hit on the laser stick,
 * because the stick sits just above that button. The button wins by finger
 * position. The stick receives a touch only while the laser is armed.
 */
export function resolveTouchSurface(input: {
  target: TouchSurface;
  onFireButton: boolean;
  laserArmed: boolean;
  onLaserStick: boolean;
}): 'fire' | 'laser' | 'other' {
  if (input.onFireButton || input.target === 'fire') return 'fire';
  if (input.laserArmed && (input.target === 'laser' || input.onLaserStick)) return 'laser';
  return 'other';
}
