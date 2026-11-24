import type { Kv } from './kv';

export const LAYOUT_KEY = 'alien-shooter:hud-layout';
export const GEAR_SIZE = 44;
export const PAUSE_SIZE = 44;

export const HUD_IDS = ['score', 'ammo', 'lowAmmo', 'lives', 'inventory', 'sector', 'joystick', 'fire'] as const;
export const JOYSTICK_SIZE = 118;
export const FIRE_BUTTON_SIZE = 80;
export const SLOT_SIZE = 46;
export const SLOT_GAP = 6;
export type HudElementId = (typeof HUD_IDS)[number];

export interface HudElement {
  id: HudElementId;
  /** Top-left, as a fraction of the playfield. */
  x: number;
  y: number;
  scale: number;
  opacity: number;
  visible: boolean;
}

export interface HudLayout {
  elements: HudElement[];
}

export interface Field {
  width: number;
  height: number;
  top: number;
  bottom: number;
}

export interface HudRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MIN_SCALE = 0.6;
const MAX_SCALE = 1.8;
const MIN_OPACITY = 0.35;
const EDGE = 6;

/**
 * Space kept under the fire button. iOS Safari claims touches in the strip
 * above the home indicator and the bottom toolbar, and the button used to sit
 * inside that strip.
 */
export const FIRE_BOTTOM_CLEARANCE = 48;
export const LASER_STICK_SIZE = 92;

export function elementLabel(id: HudElementId): string {
  if (id === 'score') return 'Score';
  if (id === 'ammo') return 'Ammo';
  if (id === 'lowAmmo') return 'Low ammo';
  if (id === 'lives') return 'Lives';
  if (id === 'sector') return 'Sector';
  if (id === 'joystick') return 'Joystick';
  if (id === 'fire') return 'Fire button';
  return 'Power-ups';
}

export function elementSize(id: HudElementId, scale: number, inventoryCount: number): { w: number; h: number } {
  if (id === 'score') return { w: 124 * scale, h: 50 * scale };
  if (id === 'ammo') return { w: 124 * scale, h: 54 * scale };
  if (id === 'lowAmmo') return { w: 116 * scale, h: 32 * scale };
  if (id === 'lives') return { w: 84 * scale, h: 68 * scale };
  if (id === 'sector') return { w: 118 * scale, h: 22 * scale };
  if (id === 'joystick') return { w: JOYSTICK_SIZE * scale, h: JOYSTICK_SIZE * scale };
  if (id === 'fire') return { w: FIRE_BUTTON_SIZE * scale, h: FIRE_BUTTON_SIZE * scale };
  const count = Math.max(1, Math.min(3, inventoryCount));
  const slot = SLOT_SIZE * scale;
  const gap = SLOT_GAP * scale;
  return { w: slot * count + gap * (count - 1), h: slot };
}

/** Small aim stick on the right, above the fire button and the power-up slots. */
export function laserStickRect(field: Field, layout?: HudLayout | null): HudRect {
  const size = LASER_STICK_SIZE;
  const gap = 12;
  const source = layout ?? defaultLayout(field);
  const fireEl = source.elements.find((element) => element.id === 'fire');
  const slotEl = source.elements.find((element) => element.id === 'inventory');
  const fire = fireEl ? elementBounds(fireEl, field, 1) : { x: field.width - 88, y: field.height - 140, w: 80, h: 80 };
  const slots = slotEl ? elementBounds(slotEl, field, 3) : fire;
  const right = Math.max(fire.x + fire.w, slots.x + slots.w);
  const topLimit = Math.min(fire.y, slots.y);
  let x = Math.max(EDGE, right - size);
  let y = topLimit - gap - size;
  const minTop = Math.max(EDGE, field.top);
  if (y < minTop) y = minTop;
  let rect = { x, y, w: size, h: size };
  if (rectsOverlap(rect, fire) || rectsOverlap(rect, slots)) {
    x = Math.max(EDGE, Math.min(fire.x, slots.x) - gap - size);
    rect = { x, y, w: size, h: size };
  }
  // A clamped stick can still sit on the fire button. Keep its hit box off that button.
  if (rectsOverlap(rect, fire)) {
    const above = fire.y - gap - size;
    rect = above >= minTop ? { ...rect, y: above } : { ...rect, x: Math.max(EDGE, fire.x - gap - size) };
  }
  return rect;
}

function rectsOverlap(a: HudRect, b: HudRect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function gearRect(field: Field): HudRect {
  return {
    x: Math.max(EDGE, field.width - 12 - GEAR_SIZE),
    y: Math.max(8, field.top),
    w: GEAR_SIZE,
    h: GEAR_SIZE,
  };
}

/** Fixed top-left control. It is not a layout-editor element, so a dragged HUD piece cannot replace it. */
export function pauseRect(field: Field): HudRect {
  return {
    x: 12,
    y: Math.max(8, field.top),
    w: PAUSE_SIZE,
    h: PAUSE_SIZE,
  };
}

export function defaultLayout(field: Field): HudLayout {
  const gear = gearRect(field);
  const pause = pauseRect(field);
  const livesW = elementSize('lives', 1, 1).w;
  const width = Math.max(1, field.width);
  const height = Math.max(1, field.height);
  const bottomPad = Math.max(8, field.bottom);
  const margin = 14;
  /** Gap between the fire button and the screen edge. */
  const corner = 8;
  const stackGap = 8;
  const fire = elementSize('fire', 1, 1);
  const joy = elementSize('joystick', 1, 1);
  const slots = elementSize('inventory', 1, 3);
  const fireX = width - corner - fire.w;
  const fireClearance = Math.max(field.bottom, FIRE_BOTTOM_CLEARANCE);
  const fireY = height - fireClearance - fire.h;
  const elements: HudElement[] = [
    { id: 'score', x: 16 / width, y: (pause.y + pause.h + 8) / height, scale: 1, opacity: 1, visible: true },
    { id: 'ammo', x: 16 / width, y: (pause.y + pause.h + 62) / height, scale: 1, opacity: 1, visible: true },
    { id: 'lowAmmo', x: 16 / width, y: (pause.y + pause.h + 122) / height, scale: 1, opacity: 1, visible: true },
    {
      id: 'lives',
      x: Math.max(EDGE, gear.x - 10 - livesW) / width,
      y: Math.max(8, field.top) / height,
      scale: 1,
      opacity: 1,
      visible: true,
    },
    {
      id: 'inventory',
      x: (fireX + fire.w - slots.w) / width,
      y: (fireY - stackGap - slots.h) / height,
      scale: 1,
      opacity: 1,
      visible: true,
    },
    {
      id: 'sector',
      x: (width - 118) / 2 / width,
      y: Math.max(8, field.top) / height,
      scale: 1,
      opacity: 1,
      visible: true,
    },
    {
      id: 'joystick',
      x: 16 / width,
      y: (height - bottomPad - margin - joy.h) / height,
      scale: 1,
      opacity: 1,
      visible: true,
    },
    {
      id: 'fire',
      x: fireX / width,
      y: fireY / height,
      scale: 1,
      opacity: 1,
      visible: true,
    },
  ];
  return clampLayout({ elements }, field, 3).layout;
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function clampElement(element: HudElement, field: Field, inventoryCount: number): HudElement {
  const scale = clampNumber(element.scale, MIN_SCALE, MAX_SCALE);
  const opacity = clampNumber(element.opacity, MIN_OPACITY, 1);
  const size = elementSize(element.id, scale, element.id === 'inventory' ? inventoryCount : 1);
  const minX = EDGE;
  const minY = Math.max(EDGE, field.top);
  const maxX = Math.max(minX, field.width - EDGE - size.w);
  const bottomGap = element.id === 'fire' ? Math.max(field.bottom, FIRE_BOTTOM_CLEARANCE) : Math.max(EDGE, field.bottom);
  const maxY = Math.max(minY, field.height - bottomGap - size.h);
  const px = clampNumber(element.x * field.width, minX, maxX);
  const py = clampNumber(element.y * field.height, minY, maxY);
  return {
    id: element.id,
    scale,
    opacity,
    visible: element.visible !== false,
    x: field.width > 0 ? px / field.width : 0,
    y: field.height > 0 ? py / field.height : 0,
  };
}

export function clampLayout(layout: HudLayout, field: Field, inventoryCount: number): { layout: HudLayout; changed: boolean } {
  const elements = separateInventoryFromFire(
    layout.elements.map((element) => clampElement(element, field, inventoryCount)),
    field,
    inventoryCount,
  );
  const changed = elements.some((element, index) => !sameElement(element, layout.elements[index]));
  return { layout: { elements }, changed };
}

/** Keep the ability row from sitting on the fire button after the button is lifted. */
function separateInventoryFromFire(elements: HudElement[], field: Field, inventoryCount: number): HudElement[] {
  const fire = elements.find((element) => element.id === 'fire');
  const inventory = elements.find((element) => element.id === 'inventory');
  if (!fire || !inventory || field.height <= 0) return elements;
  const fireBox = elementBounds(fire, field, 1);
  const slots = elementBounds(inventory, field, Math.max(1, inventoryCount));
  const gap = 8;
  const horizontal = slots.x < fireBox.x + fireBox.w && slots.x + slots.w > fireBox.x;
  const crowding = slots.y + slots.h + gap > fireBox.y && slots.y < fireBox.y + fireBox.h;
  if (!horizontal || !crowding) return elements;
  const nextY = (fireBox.y - gap - slots.h) / field.height;
  return elements.map((element) =>
    element.id === 'inventory' ? clampElement({ ...element, y: nextY }, field, inventoryCount) : element,
  );
}

function sameElement(a: HudElement, b: HudElement | undefined): boolean {
  if (!b) return false;
  return (
    a.id === b.id &&
    a.visible === b.visible &&
    Math.abs(a.x - b.x) < 0.0001 &&
    Math.abs(a.y - b.y) < 0.0001 &&
    Math.abs(a.scale - b.scale) < 0.0001 &&
    Math.abs(a.opacity - b.opacity) < 0.0001
  );
}

export function placeElement(layout: HudLayout, id: HudElementId, pixelX: number, pixelY: number, field: Field, inventoryCount: number): HudLayout {
  return {
    elements: layout.elements.map((element) =>
      element.id === id
        ? clampElement({ ...element, x: pixelX / Math.max(1, field.width), y: pixelY / Math.max(1, field.height) }, field, inventoryCount)
        : element,
    ),
  };
}

export function patchElement(layout: HudLayout, id: HudElementId, patch: Partial<Pick<HudElement, 'scale' | 'opacity' | 'visible'>>, field: Field, inventoryCount: number): HudLayout {
  return {
    elements: layout.elements.map((element) =>
      element.id === id ? clampElement({ ...element, ...patch }, field, inventoryCount) : element,
    ),
  };
}

const INVENTORY_ANCHOR = 3;

/**
 * Visible ability icons sit in the rightmost cells of the 3-slot row, so one
 * owned power is the cell stacked on the fire button. The saved layout still
 * stores the left edge of that full row.
 */
export function inventoryOrigin(element: HudElement, field: Field, count: number): { x: number; y: number; slot: number; gap: number; w: number; h: number } {
  const shown = Math.max(0, Math.min(INVENTORY_ANCHOR, count));
  const placed = clampElement(element, field, INVENTORY_ANCHOR);
  const slot = SLOT_SIZE * placed.scale;
  const gap = SLOT_GAP * placed.scale;
  const anchorWidth = elementSize('inventory', placed.scale, INVENTORY_ANCHOR).w;
  const used = elementSize('inventory', placed.scale, Math.max(1, shown)).w;
  const shift = shown === 0 ? 0 : anchorWidth - used;
  const minX = EDGE;
  const maxX = Math.max(minX, field.width - EDGE - used);
  const left = Math.min(maxX, Math.max(minX, placed.x * field.width + shift));
  return { x: left, y: placed.y * field.height, slot, gap, w: used, h: slot };
}

export function inventoryRects(element: HudElement, field: Field, count: number, offsetX: number): HudRect[] {
  if (!element.visible || count <= 0) return [];
  const origin = inventoryOrigin(element, field, count);
  return Array.from({ length: Math.min(INVENTORY_ANCHOR, count) }, (_, index) => ({
    x: origin.x + offsetX + index * (origin.slot + origin.gap),
    y: origin.y,
    w: origin.slot,
    h: origin.slot,
  }));
}

export function elementBounds(element: HudElement, field: Field, inventoryCount: number): HudRect {
  if (element.id === 'inventory') {
    const origin = inventoryOrigin(element, field, Math.max(1, inventoryCount));
    return { x: origin.x, y: origin.y, w: origin.w, h: origin.h };
  }
  const placed = clampElement(element, field, inventoryCount);
  const size = elementSize(element.id, placed.scale, inventoryCount);
  return { x: placed.x * field.width, y: placed.y * field.height, w: size.w, h: size.h };
}

function isId(value: unknown): value is HudElementId {
  return typeof value === 'string' && (HUD_IDS as readonly string[]).includes(value);
}

export function parseLayout(raw: string | null): HudElement[] | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { elements?: unknown } | null;
    if (!value || !Array.isArray(value.elements)) return null;
    const elements: HudElement[] = [];
    for (const item of value.elements) {
      if (!item || typeof item !== 'object') continue;
      const record = item as Partial<HudElement>;
      if (!isId(record.id)) continue;
      elements.push({
        id: record.id,
        x: typeof record.x === 'number' ? record.x : 0,
        y: typeof record.y === 'number' ? record.y : 0,
        scale: typeof record.scale === 'number' ? record.scale : 1,
        opacity: typeof record.opacity === 'number' ? record.opacity : 1,
        visible: record.visible !== false,
      });
    }
    return elements.length > 0 ? elements : null;
  } catch {
    return null;
  }
}

const BUTTON_IDS = new Set<HudElementId>(['fire', 'inventory', 'joystick']);

export function resetButtonLayout(layout: HudLayout, field: Field): HudLayout {
  const defaults = new Map(defaultLayout(field).elements.map((element) => [element.id, element]));
  return {
    elements: layout.elements.map((element) => (BUTTON_IDS.has(element.id) ? { ...defaults.get(element.id)! } : element)),
  };
}

export function mergeLayout(saved: HudElement[] | null, field: Field): HudLayout {
  const defaults = defaultLayout(field);
  if (!saved) return defaults;
  const byId = new Map(saved.map((element) => [element.id, element]));
  return clampLayout(
    {
      elements: defaults.elements.map((element) => {
        const found = byId.get(element.id);
        return found ? { ...element, ...found, id: element.id } : element;
      }),
    },
    field,
    3,
  ).layout;
}

export async function loadLayout(store: Kv): Promise<HudElement[] | null> {
  return parseLayout(await store.getItem(LAYOUT_KEY));
}

export async function saveLayout(store: Kv, layout: HudLayout): Promise<void> {
  await store.setItem(LAYOUT_KEY, JSON.stringify({ v: 1, elements: layout.elements }));
}
