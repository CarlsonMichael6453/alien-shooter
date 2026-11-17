export interface ControlFrame {
  moveActive: boolean;
  targetX: number;
  targetY: number;
  firing: boolean;
  keyX: number;
  keyY: number;
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
  private pointers = new Map<number, Track>();
  private keys = new Set<string>();

  pointerDown(id: number, x: number, y: number, shipX: number, shipY: number): void {
    if (this.pointers.has(id)) return;
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
    if (button === 0) {
      if (this.moveId != null && this.moveId !== -1) return;
      this.pointerUp(-1);
      this.pointerDown(-1, x, y, shipX, shipY);
      return;
    }
    if (button === 1 || button === 2) this.mouseFire = true;
  }

  mouseMove(x: number, y: number): void {
    this.pointerMove(-1, x, y);
  }

  mouseUp(button: number): void {
    if (button === 0) this.pointerUp(-1);
    if (button === 1 || button === 2) this.mouseFire = false;
  }

  keyDown(code: string): void {
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
    return {
      moveActive,
      targetX,
      targetY,
      firing: this.fireId != null || this.mouseFire || keyFire,
      keyX: moveActive ? 0 : keyX,
      keyY: moveActive ? 0 : keyY,
    };
  }
}
