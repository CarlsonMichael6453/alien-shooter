export interface ControlFrame {
  moveActive: boolean;
  targetX: number;
  targetY: number;
  firing: boolean;
  keyX: number;
  keyY: number;
  fireDragX: number;
  fireDragY: number;
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
  private powerRequest: number | null = null;

  setInventoryRects(rects: BombRect[]): void {
    this.inventoryRects = rects;
  }

  consumePower(): number | null {
    const requested = this.powerRequest;
    this.powerRequest = null;
    return requested;
  }

  hover(x: number, y: number): void {
    this.hoverX = x;
    this.hoverY = y;
    this.hoverActive = true;
  }

  pointerDown(id: number, x: number, y: number, shipX: number, shipY: number): void {
    if (this.pointers.has(id)) return;
    const slot = this.hitsInventory(x, y);
    if (slot >= 0) {
      this.powerRequest = slot;
      return;
    }
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
      return;
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
  mouseDown(button: number, x: number, y: number, shipX: number, shipY: number): void {
    const slot = this.hitsInventory(x, y);
    if (slot >= 0) {
      this.powerRequest = slot;
      return;
    }
    if (button === 0) {
      if (this.moveId != null && this.moveId !== -1) return;
      this.pointerUp(-1);
      this.pointerDown(-1, x, y, shipX, shipY);
      return;
    }
    if (button === 1 || button === 2) {
      this.mouseFire = true;
      if (this.fireId != null && this.fireId !== -2) return;
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
    if (this.moveId != null) {
      const track = this.pointers.get(this.moveId);
      if (track) {
        moveActive = true;
        targetX = track.shipX + (track.x - track.originX);
        targetY = track.shipY + (track.y - track.originY);
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
      keyX: moveActive ? 0 : keyX,
      keyY: moveActive ? 0 : keyY,
      fireDragX,
      fireDragY,
      hoverActive: this.hoverActive,
      hoverX: this.hoverX,
      hoverY: this.hoverY,
    };
  }

  private hitsInventory(x: number, y: number): number {
    for (let index = 0; index < this.inventoryRects.length; index += 1) {
      const rect = this.inventoryRects[index];
      if (x >= rect.x && y >= rect.y && x <= rect.x + rect.w && y <= rect.y + rect.h) return index;
    }
    return -1;
  }
}
