import { DRAG_FOLLOW } from './constants';

/** Fraction of the stick radius that does not move the ship. */
export const STICK_DEAD_ZONE = 0.09;

/**
 * Analog stick output in [-1, 1]. `t` is the travel from the dead zone to the
 * rim, clamped at the edge. Speed fraction is `t` to the power 1.5.
 */
export function stickResponse(dx: number, dy: number, radius: number): { x: number; y: number } {
  if (radius <= 0) return { x: 0, y: 0 };
  const mag = Math.hypot(dx, dy);
  if (mag === 0) return { x: 0, y: 0 };
  const raw = Math.min(1, mag / radius);
  if (raw <= STICK_DEAD_ZONE) return { x: 0, y: 0 };
  const t = (raw - STICK_DEAD_ZONE) / (1 - STICK_DEAD_ZONE);
  const speed = t ** 1.5;
  return { x: (dx / mag) * speed, y: (dy / mag) * speed };
}

export interface ControlFrame {
  moveActive: boolean;
  targetX: number;
  targetY: number;
  firing: boolean;
  keyX: number;
  keyY: number;
  fireDragX: number;
  fireDragY: number;
  stickX: number;
  stickY: number;
  hoverActive: boolean;
  hoverX: number;
  hoverY: number;
}

export interface BombRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type PointerRole = 'play' | 'power' | 'chrome';
export type ControlScheme = 'joystick' | 'drag';

interface Track {
  id: number;
  role: 'move' | 'fire';
  x: number;
  y: number;
  originX: number;
  originY: number;
  shipX: number;
  shipY: number;
}

/**
 * Two-finger scheme: the first touch steers, the second touch fires.
 * Roles stay attached to the touch that claimed them. Lifting the move
 * finger does not turn the fire finger into a move finger.
 */
export class Controls {
  moveId: number | null = null;
  fireId: number | null = null;
  mouseFire = false;
  hoverX = 0;
  hoverY = 0;
  hoverActive = false;
  private pointers = new Map<number, Track>();
  private keys = new Set<string>();
  private inventoryRects: BombRect[] = [];
  private chromeRects: BombRect[] = [];
  private stickRect: BombRect | null = null;
  private fireRect: BombRect | null = null;
  private scheme: ControlScheme = 'joystick';
  private powerRequest: number | null = null;
  private chromeRequest = false;

  setScheme(scheme: ControlScheme): void {
    if (this.scheme === scheme) return;
    this.scheme = scheme;
    this.clearTransient();
  }

  setActionRects(stick: BombRect | null, fire: BombRect | null): void {
    this.stickRect = stick;
    this.fireRect = fire;
  }

  setInventoryRects(rects: BombRect[]): void {
    this.inventoryRects = rects;
  }

  setChromeRects(rects: BombRect[]): void {
    this.chromeRects = rects;
  }

  consumePower(): number | null {
    const requested = this.powerRequest;
    this.powerRequest = null;
    return requested;
  }

  consumeChrome(): boolean {
    const requested = this.chromeRequest;
    this.chromeRequest = false;
    return requested;
  }

  hover(x: number, y: number): void {
    this.hoverX = x;
    this.hoverY = y;
    this.hoverActive = true;
  }

  pointerDown(id: number, x: number, y: number, shipX: number, shipY: number): PointerRole {
    if (this.pointers.has(id)) return 'play';
    const slot = this.hitsInventory(x, y);
    if (slot >= 0) {
      this.powerRequest = slot;
      return 'power';
    }
    if (this.hitsChrome(x, y)) {
      this.chromeRequest = true;
      return 'chrome';
    }
    if (this.scheme === 'joystick' && id >= 0) return this.claimPad(id, x, y, shipX, shipY);
    if (this.moveId == null) {
      this.moveId = id;
      this.pointers.set(id, {
        id,
        role: 'move',
        x,
        y,
        originX: x,
        originY: y,
        shipX,
        shipY,
      });
      return 'play';
    }
    if (this.fireId == null) {
      this.fireId = id;
      this.pointers.set(id, {
        id,
        role: 'fire',
        x,
        y,
        originX: x,
        originY: y,
        shipX,
        shipY,
      });
    }
    return 'play';
  }

  pointerMove(id: number, x: number, y: number): void {
    const track = this.pointers.get(id);
    if (!track) return;
    track.x = x;
    track.y = y;
  }

  pointerUp(id: number): void {
    const track = this.pointers.get(id);
    if (!track) return;
    this.pointers.delete(id);
    if (this.moveId === id) this.moveId = null;
    if (this.fireId === id) this.fireId = null;
  }

  /** Left button steers. Right or middle button fires, even if it lands first. */
  mouseDown(button: number, x: number, y: number, shipX: number, shipY: number): PointerRole {
    const slot = this.hitsInventory(x, y);
    if (slot >= 0) {
      this.powerRequest = slot;
      return 'power';
    }
    if (this.hitsChrome(x, y)) {
      this.chromeRequest = true;
      return 'chrome';
    }
    if (button === 0) {
      if (this.moveId != null && this.moveId !== -1) return 'play';
      this.pointerUp(-1);
      return this.pointerDown(-1, x, y, shipX, shipY);
    }
    if (button === 1 || button === 2) {
      this.mouseFire = true;
      if (this.fireId != null && this.fireId !== -2) return 'play';
      this.pointerUp(-2);
      this.fireId = -2;
      this.pointers.set(-2, {
        id: -2,
        role: 'fire',
        x,
        y,
        originX: x,
        originY: y,
        shipX,
        shipY,
      });
    }
    return 'play';
  }

  mouseMove(x: number, y: number): void {
    this.hover(x, y);
    this.pointerMove(-1, x, y);
    if (this.pointers.has(-2)) this.pointerMove(-2, x, y);
  }

  mouseUp(button: number): void {
    if (button === 0) this.pointerUp(-1);
    if (button === 1 || button === 2) {
      this.mouseFire = false;
      this.pointerUp(-2);
    }
  }

  keyDown(code: string): void {
    if (code === 'Digit1' || code === 'Digit2' || code === 'Digit3') {
      this.powerRequest = Number(code.slice(-1)) - 1;
      return;
    }
    this.keys.add(code);
  }

  keyUp(code: string): void {
    this.keys.delete(code);
  }

  clearTransient(): void {
    this.pointers.clear();
    this.keys.clear();
    this.moveId = null;
    this.fireId = null;
    this.mouseFire = false;
    this.hoverActive = false;
    this.powerRequest = null;
    this.chromeRequest = false;
  }

  /** Keep the ship from jumping after a restart or a resize while a finger is down. */
  reanchor(shipX: number, shipY: number): void {
    if (this.moveId == null) return;
    const track = this.pointers.get(this.moveId);
    if (!track) return;
    track.originX = track.x;
    track.originY = track.y;
    track.shipX = shipX;
    track.shipY = shipY;
  }

  frame(): ControlFrame {
    let moveActive = false;
    let targetX = 0;
    let targetY = 0;
    let stickX = 0;
    let stickY = 0;
    const stickHeld = this.scheme === 'joystick' && this.moveId != null && this.moveId >= 0;
    if (this.moveId != null) {
      const track = this.pointers.get(this.moveId);
      if (track) {
        if (stickHeld) {
          const stick = this.stickVector(track);
          stickX = stick.x;
          stickY = stick.y;
        } else {
          moveActive = true;
          targetX = track.shipX + (track.x - track.originX) * DRAG_FOLLOW;
          targetY = track.shipY + (track.y - track.originY) * DRAG_FOLLOW;
        }
      }
    }

    let keyX = 0;
    let keyY = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) keyX -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) keyX += 1;
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) keyY -= 1;
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) keyY += 1;
    const mag = Math.hypot(keyX, keyY);
    if (mag > 0) {
      keyX /= mag;
      keyY /= mag;
    }

    const keyFire = this.keys.has('Space') || this.keys.has('KeyJ');
    let fireDragX = 0;
    let fireDragY = 0;
    if (this.fireId != null) {
      const fire = this.pointers.get(this.fireId);
      if (fire) {
        fireDragX = fire.x - fire.originX;
        fireDragY = fire.y - fire.originY;
      }
    }
    return {
      moveActive,
      targetX,
      targetY,
      firing: this.fireId != null || this.mouseFire || keyFire,
      keyX: moveActive || stickHeld ? 0 : keyX,
      keyY: moveActive || stickHeld ? 0 : keyY,
      fireDragX,
      fireDragY,
      stickX,
      stickY,
      hoverActive: this.hoverActive,
      hoverX: this.hoverX,
      hoverY: this.hoverY,
    };
  }

  private claimPad(id: number, x: number, y: number, shipX: number, shipY: number): PointerRole {
    if (this.moveId == null && this.inside(this.stickRect, x, y)) {
      this.moveId = id;
      this.pointers.set(id, { id, role: 'move', x, y, originX: x, originY: y, shipX, shipY });
      return 'play';
    }
    if (this.fireId == null && this.inside(this.fireRect, x, y)) {
      this.fireId = id;
      this.pointers.set(id, { id, role: 'fire', x, y, originX: x, originY: y, shipX, shipY });
    }
    return 'play';
  }

  private inside(rect: BombRect | null, x: number, y: number): boolean {
    if (!rect) return false;
    return x >= rect.x && y >= rect.y && x <= rect.x + rect.w && y <= rect.y + rect.h;
  }

  private stickVector(track: Track): { x: number; y: number } {
    const rect = this.stickRect;
    if (!rect) return { x: 0, y: 0 };
    const radius = Math.min(rect.w, rect.h) * 0.42;
    if (radius <= 0) return { x: 0, y: 0 };
    const dx = track.x - (rect.x + rect.w / 2);
    const dy = track.y - (rect.y + rect.h / 2);
    return stickResponse(dx, dy, radius);
  }

  private hitsInventory(x: number, y: number): number {
    for (let index = 0; index < this.inventoryRects.length; index += 1) {
      const rect = this.inventoryRects[index];
      if (x >= rect.x && y >= rect.y && x <= rect.x + rect.w && y <= rect.y + rect.h) return index;
    }
    return -1;
  }

  private hitsChrome(x: number, y: number): boolean {
    return this.chromeRects.some((rect) => x >= rect.x && y >= rect.y && x <= rect.x + rect.w && y <= rect.y + rect.h);
  }
}
