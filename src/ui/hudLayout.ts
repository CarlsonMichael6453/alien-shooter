import type { Kv } from './kv';

export const LAYOUT_KEY = 'alien-shooter:hud-layout';
export const GEAR_SIZE = 44;

export const HUD_IDS = ['score', 'ammo', 'lowAmmo', 'lives', 'inventory', 'sector'] as const;
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

export function elementLabel(id: HudElementId): string {
  if (id === 'score') return 'Score';
  if (id === 'ammo') return 'Ammo';
  if (id === 'lowAmmo') return 'Low ammo';
  if (id === 'lives') return 'Lives';
  if (id === 'sector') return 'Sector';
  return 'Power-ups';
}

export function elementSize(id: HudElementId, scale: number, inventoryCount: number): { w: number; h: number } {
  if (id === 'score') return { w: 124 * scale, h: 50 * scale };
  if (id === 'ammo') return { w: 124 * scale, h: 54 * scale };
  if (id === 'lowAmmo') return { w: 116 * scale, h: 32 * scale };
  if (id === 'lives') return { w: 84 * scale, h: 68 * scale };
  if (id === 'sector') return { w: 118 * scale, h: 22 * scale };
  const count = Math.max(1, Math.min(3, inventoryCount));
  const slot = 56 * scale;
  const gap = 8 * scale;
  return { w: slot * count + gap * (count - 1), h: slot };
}

export function gearRect(field: Field): HudRect {
  return {
    x: Math.max(EDGE, field.width - 12 - GEAR_SIZE),
    y: Math.max(8, field.top),
    w: GEAR_SIZE,
    h: GEAR_SIZE,
  };
}

export function defaultLayout(field: Field): HudLayout {
  const gear = gearRect(field);
  const livesW = elementSize('lives', 1, 1).w;
  const width = Math.max(1, field.width);
  const height = Math.max(1, field.height);
  const elements: HudElement[] = [
    { id: 'score', x: 16 / width, y: Math.max(8, field.top) / height, scale: 1, opacity: 1, visible: true },
    { id: 'ammo', x: 16 / width, y: (Math.max(8, field.top) + 54) / height, scale: 1, opacity: 1, visible: true },
    { id: 'lowAmmo', x: 16 / width, y: (Math.max(8, field.top) + 114) / height, scale: 1, opacity: 1, visible: true },
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
      x: 14 / width,
      y: (field.height - Math.max(8, field.bottom) - 16 - 56) / height,
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
  const maxY = Math.max(minY, field.height - Math.max(EDGE, field.bottom) - size.h);
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
  const elements = layout.elements.map((element) => clampElement(element, field, inventoryCount));
  const changed = elements.some((element, index) => !sameElement(element, layout.elements[index]));
  return { layout: { elements }, changed };
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

export function inventoryRects(element: HudElement, field: Field, count: number, offsetX: number): HudRect[] {
  if (!element.visible || count <= 0) return [];
  const placed = clampElement(element, field, count);
  const slot = 56 * placed.scale;
  const gap = 8 * placed.scale;
  const left = placed.x * field.width + offsetX;
  const top = placed.y * field.height;
  return Array.from({ length: Math.min(3, count) }, (_, index) => ({
    x: left + index * (slot + gap),
    y: top,
    w: slot,
    h: slot,
  }));
}

export function elementBounds(element: HudElement, field: Field, inventoryCount: number): HudRect {
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
