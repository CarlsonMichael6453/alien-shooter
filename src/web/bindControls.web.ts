import type { Controls } from '../game/controls';
import { classifyTouch } from './touchUi';

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

function uiNode(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[data-alien-ui]') != null;
}

function fireZone(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[data-alien-fire]') != null;
}

function slotIndex(target: EventTarget | null): number | null {
  if (!(target instanceof Element)) return null;
  const node = target.closest('[data-alien-slot]');
  if (!node) return null;
  const index = Number(node.getAttribute('data-alien-slot'));
  if (!Number.isInteger(index) || index < 0 || index > 2) return null;
  return index;
}

export function markFireZone(node: unknown): void {
  const element = node as HTMLElement | null;
  if (!element?.setAttribute || !element.addEventListener) return;
  element.setAttribute('data-alien-fire', '1');
  element.style.touchAction = 'none';
  if (element.dataset.fireBound === '1') return;
  element.dataset.fireBound = '1';
  const localPoint = (touch: Touch) => {
    const root = document.getElementById('alien-shooter-root');
    const rect = root?.getBoundingClientRect();
    return {
      x: rect ? touch.clientX - rect.left : touch.clientX,
      y: rect ? touch.clientY - rect.top : touch.clientY,
    };
  };
  const start = (event: TouchEvent) => {
    event.preventDefault();
    const handler = fireTouchHandler;
    if (!handler) return;
    for (const touch of Array.from(event.changedTouches)) {
      const point = localPoint(touch);
      handler(touch.identifier, point.x, point.y);
    }
  };
  const end = (event: TouchEvent) => {
    const handler = fireReleaseHandler;
    if (!handler) return;
    for (const touch of Array.from(event.changedTouches)) handler(touch.identifier);
  };
  element.addEventListener('touchstart', start, { passive: false });
  element.addEventListener('touchend', end);
  element.addEventListener('touchcancel', end);
}

let fireTouchHandler: ((id: number, x: number, y: number) => void) | null = null;
let fireReleaseHandler: ((id: number) => void) | null = null;

export function bindControls(
  element: HTMLElement,
  controls: Controls,
  getShip: () => { x: number; y: number },
  onPress: () => void,
  isUiOpen: () => boolean = () => false,
): () => void {
  const local = (clientX: number, clientY: number) => {
    const rect = element.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const claimFireTouch = (id: number, x: number, y: number) => {
    if (isUiOpen()) return;
    const ship = getShip();
    controls.claimFire(id, x, y, ship.x, ship.y);
    try {
      onPress();
    } catch {
      // Audio setup must not drop the trigger.
    }
  };
  fireTouchHandler = claimFireTouch;
  fireReleaseHandler = (id) => {
    controls.pointerUp(id);
  };

  const onTouchStart = (event: TouchEvent) => {
    if (isUiOpen()) {
      if (!uiNode(event.target) && event.cancelable) event.preventDefault();
      return;
    }
    const ship = getShip();
    let play = false;
    let cancel = true;
    for (const touch of Array.from(event.changedTouches)) {
      const point = local(touch.clientX, touch.clientY);
      const onFireZone = fireZone(touch.target) || (event.changedTouches.length === 1 && fireZone(event.target));
      if (onFireZone) {
        controls.claimFire(touch.identifier, point.x, point.y, ship.x, ship.y);
        play = true;
        continue;
      }
      const role = controls.pointerDown(touch.identifier, point.x, point.y, ship.x, ship.y);
      const onFire = controls.fireId === touch.identifier || controls.onFireButton(point.x, point.y);
      const slot = onFire ? null : (slotIndex(touch.target) ?? (event.changedTouches.length === 1 ? slotIndex(event.target) : null));
      if (slot != null) controls.claimPower(touch.identifier, slot);
      const target = touch.target ?? event.target;
      const onUi = uiNode(target);
      const decision = classifyTouch(onUi, role, controls.fireId === touch.identifier, slot != null || role === 'power');
      if (decision.dropPlayPointer) controls.pointerUp(touch.identifier);
      if (decision.play) play = true;
      if (!decision.cancel) cancel = false;
    }
    if (play) {
      try {
        onPress();
      } catch {
        // A sound or wake-lock failure must not cancel the finger already claimed.
      }
    }
    if (cancel && event.cancelable) event.preventDefault();
  };

  const onTouchMove = (event: TouchEvent) => {
    if (isUiOpen()) return;
    if (event.cancelable) event.preventDefault();
    const touches = event.changedTouches.length > 0 ? event.changedTouches : event.touches;
    for (const touch of Array.from(touches)) {
      const point = local(touch.clientX, touch.clientY);
      controls.pointerMove(touch.identifier, point.x, point.y);
    }
  };

  const onTouchEnd = (event: TouchEvent) => {
    // Cancelling touchend suppresses the click mobile browsers send to a button.
    const onUi = uiNode(event.target);
    const onSlot = slotIndex(event.target) != null;
    if (!isUiOpen() && (!onUi || onSlot) && event.cancelable) event.preventDefault();
    if (isUiOpen()) return;
    for (const touch of Array.from(event.changedTouches)) controls.pointerUp(touch.identifier);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    if (isUiOpen()) return;
    const point = local(event.clientX, event.clientY);
    const ship = getShip();
    const slot = controls.onFireButton(point.x, point.y) ? null : slotIndex(event.target);
    if (slot != null) {
      controls.claimPower(event.button === 0 ? -1 : -2, slot);
      if (event.cancelable) event.preventDefault();
      return;
    }
    if (uiNode(event.target)) {
      const before = controls.fireId;
      const role = controls.mouseDown(event.button, point.x, point.y, ship.x, ship.y);
      if (controls.fireId != null && controls.fireId !== before) {
        if (event.cancelable) event.preventDefault();
        try {
          onPress();
        } catch {
          // Keep the fire button even if audio setup throws.
        }
        return;
      }
      if (role === 'play') controls.pointerUp(event.button === 0 ? -1 : -2);
      return;
    }
    if (event.cancelable) event.preventDefault();
    if (controls.mouseDown(event.button, point.x, point.y, ship.x, ship.y) === 'play') {
      try {
        onPress();
      } catch {
        // Keep the press.
      }
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' || isUiOpen()) return;
    const point = local(event.clientX, event.clientY);
    controls.hover(point.x, point.y);
    if ((event.buttons & 1) === 0 && (event.buttons & 2) === 0) return;
    controls.mouseMove(point.x, point.y);
  };

  const onPointerUp = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' || isUiOpen()) return;
    controls.mouseUp(event.button);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (isUiOpen()) return;
    if (!GAME_KEYS.has(event.code)) return;
    event.preventDefault();
    if (event.repeat) return;
    controls.keyDown(event.code);
    onPress();
  };

  const onKeyUp = (event: KeyboardEvent) => {
    if (isUiOpen()) return;
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
    fireTouchHandler = null;
    fireReleaseHandler = null;
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
