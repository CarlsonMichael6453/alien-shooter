import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifyTouch } from './touchUi';

describe('touch controls over buttons', () => {
  it('keeps a settings tap from steering and from cancelling the button click', () => {
    assert.deepEqual(classifyTouch(true, 'chrome'), { play: false, cancel: false, dropPlayPointer: false });
    assert.deepEqual(classifyTouch(true, 'play'), { play: false, cancel: false, dropPlayPointer: true });
  });

  it('still cancels ordinary play touches so the page cannot scroll', () => {
    assert.deepEqual(classifyTouch(false, 'play'), { play: true, cancel: true, dropPlayPointer: false });
  });

  it('lets a power-up slot consume the touch without firing a click', () => {
    assert.deepEqual(classifyTouch(false, 'power'), { play: false, cancel: true, dropPlayPointer: false });
  });

  it('keeps an ability slot when iOS reports the icon as a menu control', () => {
    assert.deepEqual(classifyTouch(true, 'play', false, true), { play: false, cancel: true, dropPlayPointer: false });
    assert.deepEqual(classifyTouch(true, 'power'), { play: false, cancel: true, dropPlayPointer: false });
    assert.equal(classifyTouch(true, 'play').dropPlayPointer, true);
  });

  it('keeps a finger that landed on the fire button graphic', () => {
    assert.deepEqual(classifyTouch(true, 'play', true), { play: true, cancel: true, dropPlayPointer: false });
    assert.deepEqual(classifyTouch(true, 'power', true, true), { play: true, cancel: true, dropPlayPointer: false });
    assert.equal(classifyTouch(true, 'play').dropPlayPointer, true);
  });
});
