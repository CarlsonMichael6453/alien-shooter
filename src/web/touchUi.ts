import type { PointerRole } from '../game/controls';

/**
 * A touch that lands on a button must not become a steering or firing finger,
 * and its touchend must not be cancelled. Cancelling touchend suppresses the
 * click that mobile browsers use to activate a button.
 */
export function classifyTouch(targetIsUi: boolean, role: PointerRole): { play: boolean; cancel: boolean; dropPlayPointer: boolean } {
  if (role === 'chrome' || role === 'power') return { play: false, cancel: !targetIsUi, dropPlayPointer: false };
  if (targetIsUi) return { play: false, cancel: false, dropPlayPointer: true };
  return { play: true, cancel: true, dropPlayPointer: false };
}
