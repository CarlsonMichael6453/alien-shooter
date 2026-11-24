import type { Controls } from '../game/controls';

export function markFireZone(_node: unknown): void {}

export function markLaserZone(_node: unknown): void {}

export function markIgnoresPointer(_node: unknown): void {}

export function bindControls(
  _element: HTMLElement,
  _controls: Controls,
  _getShip: () => { x: number; y: number },
  _onPress: () => void,
  _isUiOpen: () => boolean = () => false,
): () => void {
  return () => {};
}
