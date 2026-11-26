import type { Controls } from '../game/controls';
import { classifyTouch, resolveTouchSurface } from './touchUi';

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

function laserZone(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[data-alien-laser]') != null;
}

function clientInside(selector: string, clientX: number, clientY: number): boolean {
  const node = document.querySelector(selector);
  if (!(node instanceof HTMLElement)) return false;
  const rect = node.getBoundingClientRect();
  return clientX >= rect.left && clientY >= rect.top && clientX <= rect.right && clientY <= rect.bottom;
}

function domElement(node: unknown): HTMLElement | null {
  return node instanceof HTMLElement ? node : null;
}

const TOUCH_BUILD = 'touch-hit-2';
let paintPressed: (down: boolean) => void = () => {};
let rememberTouch: (line: string) => void = () => {};

function bindFireElement(element: HTMLElement): void {
  element.setAttribute('data-alien-fire', '1');
  element.style.touchAction = 'none';
  element.style.pointerEvents = 'auto';
  element.style.zIndex = '40';
  if (element.dataset.fireBound === '1') return;
  element.dataset.fireBound = '1';
  const localPoint = (touch: { clientX: number; clientY: number }) => {
    const root = document.getElementById('alien-shooter-root');
    const rect = root?.getBoundingClientRect();
    return {
      x: rect ? touch.clientX - rect.left : touch.clientX,
      y: rect ? touch.clientY - rect.top : touch.clientY,
    };
  };
  const start = (event: TouchEvent) => {
    // passive:false so the browser delivers the touch to this node. Do not
    // preventDefault here: iOS cancels the rest of the gesture when touchstart
    // is cancelled, and the button then never sees the finger lift.
    const handler = fireTouchHandler;
    if (!handler) return;
    for (const touch of Array.from(event.changedTouches)) {
      const point = localPoint(touch);
      handler(touch.identifier, point.x, point.y);
    }
    paintPressed(true);
    rememberTouch(`button touchstart ids=${Array.from(event.changedTouches, (touch) => touch.identifier).join(',')}`);
  };
  const move = (event: TouchEvent) => {
    if (event.cancelable) event.preventDefault();
  };
  const end = (event: TouchEvent) => {
    const handler = fireReleaseHandler;
    if (!handler) return;
    const fromCancel = event.type === 'touchcancel';
    for (const touch of Array.from(event.changedTouches)) handler(touch.identifier, fromCancel);
    rememberTouch(`button ${event.type}`);
  };
  const listen: AddEventListenerOptions = { capture: true, passive: false };
  element.addEventListener('touchstart', start, listen);
  element.addEventListener('touchmove', move, listen);
  element.addEventListener('touchend', end, listen);
  element.addEventListener('touchcancel', end, listen);
}

function watchFireButtons(): () => void {
  const scan = () => {
    for (const node of document.querySelectorAll('[aria-label="Fire button"]')) {
      if (node instanceof HTMLElement) bindFireElement(node);
    }
  };
  scan();
  const observer = new MutationObserver(scan);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

/** Tutorial cards and arrows must not eat a touch meant for the fire button. */
export function markIgnoresPointer(node: unknown): void {
  const element = node as HTMLElement | null;
  if (!element?.style?.setProperty) return;
  element.style.setProperty('pointer-events', 'none', 'important');
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
  const element = domElement(node);
  if (!element) return;
  bindFireElement(element);
}

let fireTouchHandler: ((id: number, x: number, y: number) => void) | null = null;
let fireReleaseHandler: ((id: number, fromCancel?: boolean) => void) | null = null;
let laserTouchHandler: ((id: number, x: number, y: number) => boolean) | null = null;
let laserReleaseHandler: ((id: number) => void) | null = null;

export function markLaserZone(node: unknown): void {
  const element = node as HTMLElement | null;
  if (!element?.setAttribute || !element.addEventListener) return;
  element.setAttribute('data-alien-laser', '1');
  element.style.touchAction = 'none';
  if (element.dataset.laserBound === '1') return;
  element.dataset.laserBound = '1';
  const localPoint = (touch: Touch) => {
    const root = document.getElementById('alien-shooter-root');
    const rect = root?.getBoundingClientRect();
    return {
      x: rect ? touch.clientX - rect.left : touch.clientX,
      y: rect ? touch.clientY - rect.top : touch.clientY,
    };
  };
  const start = (event: TouchEvent) => {
    const handler = laserTouchHandler;
    if (!handler) return;
    for (const touch of Array.from(event.changedTouches)) {
      // A finger on the fire button stays a shot, even when Safari hit-tests the stick.
      if (clientInside('[data-alien-fire]', touch.clientX, touch.clientY)) continue;
      const point = localPoint(touch);
      handler(touch.identifier, point.x, point.y);
    }
  };
  const end = (event: TouchEvent) => {
    const handler = laserReleaseHandler;
    if (!handler) return;
    for (const touch of Array.from(event.changedTouches)) handler(touch.identifier);
  };
  element.addEventListener('touchstart', start, { passive: false });
  element.addEventListener('touchend', end);
  element.addEventListener('touchcancel', end);
}

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

  const syncPressed = () => {
    const node = document.querySelector('[data-alien-fire]');
    if (!(node instanceof HTMLElement)) return;
    if (controls.fireId != null) node.dataset.pressed = '1';
    else delete node.dataset.pressed;
  };
  paintPressed = () => syncPressed();
  const insideFire = (clientX: number, clientY: number) => {
    if (clientInside('[data-alien-fire]', clientX, clientY)) return true;
    const point = local(clientX, clientY);
    return controls.onFireButton(point.x, point.y);
  };
  const claimFireTouch = (id: number, x: number, y: number) => {
    if (isUiOpen()) return;
    const ship = getShip();
    // One finger arrives as a pointer id and a different touch id. The touch
    // id has to own the trigger, or the pointerup that follows releases it
    // while the finger is still down.
    if (controls.fireId != null && controls.fireId !== id) controls.pointerUp(controls.fireId);
    controls.claimFire(id, x, y, ship.x, ship.y);
    syncPressed();
    rememberTouch(`claimed id=${id} fireId=${controls.fireId ?? 'none'} firing=${controls.frame().firing}`);
    try {
      onPress();
    } catch {
      // Audio setup must not drop the trigger.
    }
  };
  fireTouchHandler = claimFireTouch;
  const touchPointers = new Set<number>();
  fireReleaseHandler = (id, fromCancel = false) => {
    // iOS cancels the touch event while the pointer is still held down.
    if (fromCancel && touchPointers.has(id)) return;
    controls.pointerUp(id);
    syncPressed();
    rememberTouch(`released id=${id} fireId=${controls.fireId ?? 'none'} firing=${controls.frame().firing}`);
  };
  laserTouchHandler = (id, x, y) => {
    if (isUiOpen() || !controls.laserArmed()) return false;
    if (controls.fireId === id || controls.onFireButton(x, y)) return false;
    controls.claimLaser(id, x, y);
    return controls.laserId === id;
  };
  laserReleaseHandler = (id) => {
    // The stick's touchend must not lift the trigger. Safari delivers that
    // event to the stick when it hit-tested the stick for a fire-button touch.
    if (controls.fireId === id) return;
    if (controls.laserId === id) controls.pointerUp(id);
  };

  const syncLiveTouches = (event: TouchEvent, includeChanged = false) => {
    const ids = Array.from(event.touches, (touch) => touch.identifier);
    // iOS can omit the new finger from event.touches on the window listener.
    if (includeChanged) {
      for (const touch of Array.from(event.changedTouches)) {
        if (!ids.includes(touch.identifier)) ids.push(touch.identifier);
      }
    }
    controls.syncTouches(ids);
  };

  const contactDown = (id: number, clientX: number, clientY: number, target: EventTarget | null): boolean => {
    const point = local(clientX, clientY);
    const ship = getShip();
    const targetFire = fireZone(target);
    const targetLaser = !targetFire && laserZone(target);
    const onFireButton = controls.onFireButton(point.x, point.y) || clientInside('[data-alien-fire]', clientX, clientY);
    const surface = resolveTouchSurface({
      target: targetFire ? 'fire' : targetLaser ? 'laser' : 'other',
      onFireButton,
      laserArmed: controls.laserArmed(),
      onLaserStick: controls.onLaserStick(point.x, point.y),
    });
    if (surface === 'fire') {
      controls.claimFire(id, point.x, point.y, ship.x, ship.y);
      return true;
    }
    if (surface === 'laser') {
      controls.claimLaser(id, point.x, point.y);
      if (controls.laserId === id) return false;
    }
    const role = controls.pointerDown(id, point.x, point.y, ship.x, ship.y);
    const onFire = controls.fireId === id || controls.onFireButton(point.x, point.y);
    const slot = onFire ? null : slotIndex(target);
    if (slot != null) controls.claimPower(id, slot);
    const onUi = uiNode(target);
    const decision = classifyTouch(onUi, role, controls.fireId === id, slot != null || role === 'power');
    if (decision.dropPlayPointer) controls.pointerUp(id);
    return decision.play;
  };

  const describe = (target: EventTarget | null, x: number, y: number) => {
    const node = target instanceof Element ? target : null;
    const name = node?.getAttribute('aria-label') || node?.id || node?.tagName || 'none';
    const hit = document.elementFromPoint(x, y);
    const hitName = hit?.getAttribute('aria-label') || hit?.id || hit?.tagName || 'none';
    const owned = node?.closest('[data-alien-fire]') ? 'on-fire' : 'not-fire';
    return `${name} ${owned} hit=${hitName} @${Math.round(x)},${Math.round(y)}`;
  };
  const onTouchStart = (event: TouchEvent) => {
    for (const touch of Array.from(event.changedTouches)) {
      rememberTouch(`touchstart id=${touch.identifier} ${describe(touch.target, touch.clientX, touch.clientY)}`);
    }
    if (isUiOpen()) return;
    let play = false;
    const sole = event.changedTouches.length === 1;
    for (const touch of Array.from(event.changedTouches)) {
      if (insideFire(touch.clientX, touch.clientY)) {
        const point = local(touch.clientX, touch.clientY);
        claimFireTouch(touch.identifier, point.x, point.y);
        continue;
      }
      // A pointer event already claimed this finger. Don't also start a drag.
      if (touchPointers.size > 0) continue;
      const target = touch.target ?? (sole ? event.target : null);
      if (contactDown(touch.identifier, touch.clientX, touch.clientY, target)) play = true;
    }
    if (play) {
      try {
        onPress();
      } catch {
        // A sound or wake-lock failure must not cancel the finger already claimed.
      }
    }
    syncLiveTouches(event, true);
  };

  const onTouchMove = (event: TouchEvent) => {
    if (touchPointers.size > 0) return;
    if (isUiOpen()) {
      syncLiveTouches(event);
      return;
    }
    if (event.cancelable) event.preventDefault();
    const touches = event.changedTouches.length > 0 ? event.changedTouches : event.touches;
    for (const touch of Array.from(touches)) {
      const point = local(touch.clientX, touch.clientY);
      controls.pointerMove(touch.identifier, point.x, point.y);
    }
    syncLiveTouches(event);
  };

  const onTouchEnd = (event: TouchEvent) => {
    for (const touch of Array.from(event.changedTouches)) {
      rememberTouch(`${event.type} id=${touch.identifier} ${describe(touch.target, touch.clientX, touch.clientY)}`);
    }
    const endsFire = Array.from(event.changedTouches).some((touch) => controls.fireId === touch.identifier);
    if (touchPointers.size > 0 && !endsFire) return;
    // Cancelling touchend suppresses the click mobile browsers send to a button.
    const onUi = uiNode(event.target);
    const onSlot = slotIndex(event.target) != null;
    if (!isUiOpen() && event.type !== 'touchcancel' && (!onUi || onSlot) && event.cancelable) event.preventDefault();
    const fromCancel = event.type === 'touchcancel';
    for (const touch of Array.from(event.changedTouches)) {
      if (fromCancel && controls.fireId === touch.identifier) continue;
      controls.pointerUp(touch.identifier);
    }
    if (fromCancel && controls.fireId != null) {
      const live = Array.from(event.touches, (touch) => touch.identifier);
      if (!live.includes(controls.fireId)) live.push(controls.fireId);
      controls.syncTouches(live);
      syncPressed();
      return;
    }
    // A cancel often arrives with no remaining touches. Drop anything the browser no longer lists.
    syncLiveTouches(event);
    syncPressed();
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
      rememberTouch(`pointerdown id=${event.pointerId} ${describe(event.target, event.clientX, event.clientY)}`);
      if (isUiOpen()) return;
      touchPointers.add(event.pointerId);
      // setPointerCapture on a touch pointer makes iOS cancel the gesture, so
      // the fire button never hears the finger. Window listeners already follow it.
      if (insideFire(event.clientX, event.clientY) || fireZone(event.target)) {
        const point = local(event.clientX, event.clientY);
        claimFireTouch(event.pointerId, point.x, point.y);
        return;
      }
      if (contactDown(event.pointerId, event.clientX, event.clientY, event.target)) {
        try {
          onPress();
        } catch {
          // Keep the finger if audio setup throws.
        }
      }
      return;
    }
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
    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
      if (isUiOpen()) return;
      if (event.cancelable) event.preventDefault();
      const point = local(event.clientX, event.clientY);
      controls.pointerMove(event.pointerId, point.x, point.y);
      return;
    }
    if (event.pointerType !== 'mouse' || isUiOpen()) return;
    const point = local(event.clientX, event.clientY);
    controls.hover(point.x, point.y);
    if ((event.buttons & 1) === 0 && (event.buttons & 2) === 0) return;
    controls.mouseMove(point.x, point.y);
  };

  const onPointerUp = (event: PointerEvent) => {
    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
      touchPointers.delete(event.pointerId);
      // The touch event took over the trigger with its own id. This pointerup
      // belongs to the other id and must not release the shot.
      if (controls.fireId != null && controls.fireId !== event.pointerId) {
        syncPressed();
        return;
      }
      controls.pointerUp(event.pointerId);
      syncPressed();
      return;
    }
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
  const releaseAll = () => controls.clearTransient();
  const onBlur = () => releaseAll();
  const onVisibility = () => releaseAll();
  const onPageHide = () => releaseAll();

  if (!document.getElementById('alien-fire-press-style')) {
    const style = document.createElement('style');
    style.id = 'alien-fire-press-style';
    style.textContent = '[data-alien-fire][data-pressed="1"]{background:rgba(255,90,58,.92)!important;box-shadow:inset 0 0 0 4px #fff6c8}';
    document.head.appendChild(style);
  }
  const debugOn = new URLSearchParams(window.location.search).get('debugTouch') === '1';
  const debugLines: string[] = [];
  let debugPanel: HTMLDivElement | null = null;
  rememberTouch = (line: string) => {
    if (!debugOn) return;
    debugLines.unshift(line);
    if (debugLines.length > 12) debugLines.length = 12;
    if (!debugPanel) {
      debugPanel = document.createElement('div');
      debugPanel.id = 'alien-touch-debug';
      debugPanel.setAttribute('data-alien-touch-debug', '1');
      debugPanel.style.cssText =
        'position:fixed;left:8px;right:8px;top:8px;z-index:80;pointer-events:none;background:rgba(0,0,0,.78);color:#d5f7ff;font:12px/1.35 ui-monospace,monospace;padding:8px 10px;border-radius:8px;white-space:pre-wrap;';
      document.body.appendChild(debugPanel);
    }
    const bound = document.querySelector('[data-alien-fire]')?.getAttribute('data-fire-bound') ?? 'missing';
    const snap = (window as unknown as { __ALIEN__?: { snapshot: () => { shotsFired: number } } }).__ALIEN__?.snapshot();
    const shots = snap ? snap.shotsFired : '?';
    const latch = `latch fireId=${controls.fireId ?? 'none'} firing=${controls.frame().firing} shots=${shots}`;
    debugPanel.textContent = [`build ${TOUCH_BUILD} fireBound=${bound}`, latch, ...debugLines].join('\n');
  };
  const stopWatchingFire = watchFireButtons();
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
  window.addEventListener('pagehide', onPageHide);
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    stopWatchingFire();
    rememberTouch = () => {};
    paintPressed = () => {};
    debugPanel?.remove();
    fireTouchHandler = null;
    fireReleaseHandler = null;
    laserTouchHandler = null;
    laserReleaseHandler = null;
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
    window.removeEventListener('pagehide', onPageHide);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
