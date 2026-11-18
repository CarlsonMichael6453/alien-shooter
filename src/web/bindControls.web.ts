import type { Controls } from '../game/controls';

const GAME_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'KeyA',
  'KeyD',
  'KeyW',
  'KeyS',
  'Space',
  'Enter',
  'KeyJ',
  'Digit1',
  'Digit2',
  'Digit3',
]);

export function bindControls(
  element: HTMLElement,
  controls: Controls,
  getShip: () => { x: number; y: number },
  onPress: () => void,
): () => void {
  const local = (clientX: number, clientY: number) => {
    const rect = element.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const onTouchStart = (event: TouchEvent) => {
    if (event.cancelable) event.preventDefault();
    const ship = getShip();
    for (const touch of Array.from(event.changedTouches)) {
      const point = local(touch.clientX, touch.clientY);
      controls.pointerDown(touch.identifier, point.x, point.y, ship.x, ship.y);
    }
    onPress();
  };

  const onTouchMove = (event: TouchEvent) => {
    if (event.cancelable) event.preventDefault();
    const touches = event.changedTouches.length > 0 ? event.changedTouches : event.touches;
    for (const touch of Array.from(touches)) {
      const point = local(touch.clientX, touch.clientY);
      controls.pointerMove(touch.identifier, point.x, point.y);
    }
  };

  const onTouchEnd = (event: TouchEvent) => {
    if (event.cancelable) event.preventDefault();
    for (const touch of Array.from(event.changedTouches)) controls.pointerUp(touch.identifier);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    if (event.cancelable) event.preventDefault();
    const point = local(event.clientX, event.clientY);
    const ship = getShip();
    controls.mouseDown(event.button, point.x, point.y, ship.x, ship.y);
    onPress();
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    const point = local(event.clientX, event.clientY);
    controls.hover(point.x, point.y);
    if ((event.buttons & 1) === 0 && (event.buttons & 2) === 0) return;
    controls.mouseMove(point.x, point.y);
  };

  const onPointerUp = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    controls.mouseUp(event.button);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (!GAME_KEYS.has(event.code)) return;
    event.preventDefault();
    if (event.repeat) return;
    controls.keyDown(event.code);
    onPress();
  };

  const onKeyUp = (event: KeyboardEvent) => {
    if (!GAME_KEYS.has(event.code)) return;
    controls.keyUp(event.code);
  };

  const onContext = (event: Event) => event.preventDefault();
  const onBlur = () => controls.clearTransient();

  const touchOptions: AddEventListenerOptions = { capture: true, passive: false };
  window.addEventListener('touchstart', onTouchStart, touchOptions);
  window.addEventListener('touchmove', onTouchMove, touchOptions);
  window.addEventListener('touchend', onTouchEnd, touchOptions);
  window.addEventListener('touchcancel', onTouchEnd, touchOptions);
  window.addEventListener('pointerdown', onPointerDown, true);
  window.addEventListener('pointermove', onPointerMove, true);
  window.addEventListener('pointerup', onPointerUp, true);
  window.addEventListener('pointercancel', onPointerUp, true);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('contextmenu', onContext);
  window.addEventListener('blur', onBlur);

  return () => {
    window.removeEventListener('touchstart', onTouchStart, touchOptions);
    window.removeEventListener('touchmove', onTouchMove, touchOptions);
    window.removeEventListener('touchend', onTouchEnd, touchOptions);
    window.removeEventListener('touchcancel', onTouchEnd, touchOptions);
    window.removeEventListener('pointerdown', onPointerDown, true);
    window.removeEventListener('pointermove', onPointerMove, true);
    window.removeEventListener('pointerup', onPointerUp, true);
    window.removeEventListener('pointercancel', onPointerUp, true);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('contextmenu', onContext);
    window.removeEventListener('blur', onBlur);
  };
}
