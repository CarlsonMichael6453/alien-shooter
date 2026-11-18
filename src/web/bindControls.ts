import type { Controls } from '../game/controls';

export function bindControls(
  _element: HTMLElement,
  _controls: Controls,
  _getShip: () => { x: number; y: number },
  _onPress: () => void,
  _isUiOpen: () => boolean = () => false,
): () => void {
  return () => {};
}
