import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseControlScheme } from './controlsMode';
import { memoryStore } from './kv';
import {
  HUD_IDS,
  clampElement,
  defaultLayout,
  elementBounds,
  gearRect,
  inventoryRects,
  loadLayout,
  mergeLayout,
  parseLayout,
  placeElement,
  saveLayout,
  type Field,
  type HudElement,
} from './hudLayout';

const phone: Field = { width: 390, height: 844, top: 47, bottom: 34 };

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function inside(bounds: { x: number; y: number; w: number; h: number }, field: Field): boolean {
  return bounds.x >= 6 - 0.01 && bounds.y >= field.top - 0.01 && bounds.x + bounds.w <= field.width - 6 + 0.01 && bounds.y + bounds.h <= field.height - field.bottom + 0.01;
}

describe('hud layout', () => {
  it('keeps the default elements on screen and clear of the settings gear', () => {
    const layout = defaultLayout(phone);
    assert.deepEqual(layout.elements.map((element) => element.id), [...HUD_IDS]);
    const gear = gearRect(phone);
    for (const element of layout.elements) {
      const bounds = elementBounds(element, phone, 3);
      assert.ok(inside(bounds, phone), element.id);
      assert.equal(overlaps(bounds, gear), false, element.id);
    }
  });

  it('clamps a dragged element to the safe area and limits scale and opacity', () => {
    const wild: HudElement = { id: 'score', x: -1, y: 3, scale: 9, opacity: 0, visible: true };
    const clamped = clampElement(wild, phone, 1);
    assert.equal(clamped.scale, 1.8);
    assert.equal(clamped.opacity, 0.35);
    const bounds = elementBounds(clamped, phone, 1);
    assert.ok(inside(bounds, phone));
    assert.ok(bounds.x <= 7);
    assert.ok(bounds.y + bounds.h <= phone.height - phone.bottom + 0.01);
  });

  it('moves inventory hit targets with the slot and drops them when the row is hidden', () => {
    const layout = defaultLayout(phone);
    const moved = placeElement(layout, 'inventory', 180, 300, phone, 2);
    const rects = inventoryRects(moved.elements[4], phone, 2, 12);
    assert.equal(rects.length, 2);
    assert.ok(Math.abs(rects[0].x - (180 + 12)) < 1);
    assert.ok(Math.abs(rects[0].y - 300) < 1);
    assert.ok(rects[1].x > rects[0].x);
    const hidden = { ...moved.elements[4], visible: false };
    assert.deepEqual(inventoryRects(hidden, phone, 2, 12), []);
    assert.deepEqual(inventoryRects(moved.elements[4], phone, 0, 12), []);
  });

  it('pulls an inventory row that would hang off the right edge back onto the screen', () => {
    const layout = defaultLayout(phone);
    const shoved = placeElement(layout, 'inventory', phone.width + 40, 400, phone, 3);
    const bounds = elementBounds(shoved.elements[4], phone, 3);
    assert.ok(inside(bounds, phone));
    const rects = inventoryRects(shoved.elements[4], phone, 3, 0);
    assert.ok(rects[2].x + rects[2].w <= phone.width - 6 + 0.01);
  });

  it('round-trips a custom layout and restores missing elements from the defaults', async () => {
    const store = memoryStore();
    const custom = placeElement(defaultLayout(phone), 'score', 40, 80, phone, 1);
    const faded = {
      elements: custom.elements.map((element) => (element.id === 'ammo' ? { ...element, opacity: 0.5, visible: false } : element)),
    };
    await saveLayout(store, faded);
    const loaded = mergeLayout(await loadLayout(store), phone);
    const ammo = loaded.elements.find((element) => element.id === 'ammo');
    const score = loaded.elements.find((element) => element.id === 'score');
    assert.equal(ammo?.visible, false);
    assert.ok(Math.abs((ammo?.opacity ?? 0) - 0.5) < 0.001);
    assert.ok(Math.abs((score?.x ?? 0) * phone.width - 40) < 1);

    const partial = parseLayout(JSON.stringify({ v: 1, elements: [{ id: 'lives', x: 0.2, y: 0.2, scale: 1.2, opacity: 1, visible: true }] }));
    const merged = mergeLayout(partial, phone);
    assert.equal(merged.elements.length, HUD_IDS.length);
    assert.ok(merged.elements.every((element) => HUD_IDS.includes(element.id)));
    assert.equal(parseLayout('nope'), null);
    assert.equal(await loadLayout(memoryStore()), null);
    assert.deepEqual(mergeLayout(null, phone), defaultLayout(phone));
  });

  it('places the joystick and fire button on opposite sides, clear of the power-ups', () => {
    const layout = defaultLayout(phone);
    const stick = elementBounds(layout.elements.find((element) => element.id === 'joystick')!, phone, 1);
    const fire = elementBounds(layout.elements.find((element) => element.id === 'fire')!, phone, 1);
    const slots = elementBounds(layout.elements.find((element) => element.id === 'inventory')!, phone, 3);
    assert.ok(stick.x + stick.w < fire.x);
    assert.ok(!overlaps(stick, slots));
    assert.ok(!overlaps(fire, slots));
    assert.ok(slots.x + slots.w / 2 > phone.width / 2);
    assert.ok(slots.x + slots.w > fire.x + fire.w - 1);
    assert.ok(slots.y + slots.h <= fire.y + 0.5);
    assert.equal(parseControlScheme(null), 'drag');
    assert.equal(parseControlScheme('drag'), 'drag');
    assert.equal(parseControlScheme('joystick'), 'joystick');
    assert.equal(parseControlScheme('nope'), 'drag');
  });
});
