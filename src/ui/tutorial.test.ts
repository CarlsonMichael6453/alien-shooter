import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { memoryStore } from './kv';
import {
  FRESH_TUTORIAL,
  POWER_HINT_SECONDS,
  advanceTutorial,
  freshSession,
  loadTutorial,
  parseTutorial,
  saveTutorial,
  tutorialCue,
  type TutorialFrame,
  type TutorialProgress,
  type TutorialSession,
} from './tutorial';

const field = (overrides: Partial<TutorialFrame> = {}): TutorialFrame => ({
  mode: 'playing',
  dt: 0.05,
  shipX: 180,
  shipY: 640,
  moveInput: false,
  shotsFired: 0,
  shotsBefore: 0,
  inventory: 0,
  inventoryBefore: 0,
  frozen: false,
  ...overrides,
});

describe('tutorial prompts', () => {
  it('starts a run on the move prompt and switches after the ship actually moves', () => {
    const started = advanceTutorial(FRESH_TUTORIAL, freshSession(), field());
    assert.equal(started.cue, 'move');
    assert.equal(started.session.inRun, true);
    assert.equal(started.progress.moved, false);

    const nudged = advanceTutorial(started.progress, started.session, field({ moveInput: true, shipX: 188, shipY: 640 }));
    assert.equal(nudged.cue, 'move');

    const moved = advanceTutorial(nudged.progress, nudged.session, field({ moveInput: true, shipX: 210, shipY: 620 }));
    assert.equal(moved.cue, 'shoot');
    assert.equal(moved.progress.moved, true);
  });

  it('dismisses the shoot prompt on the first shot and waits to explain a power-up', () => {
    const learned: TutorialProgress = { moved: true, fired: false, power: false };
    const session: TutorialSession = { ...freshSession(), inRun: true, shipMoved: true, anchorX: 180, anchorY: 640 };
    const shooting = advanceTutorial(learned, session, field({ shotsFired: 1, shotsBefore: 0 }));
    assert.equal(shooting.cue, null);
    assert.equal(shooting.progress.fired, true);

    const holding = advanceTutorial(shooting.progress, shooting.session, field({ inventory: 1, inventoryBefore: 0, shotsFired: 1 }));
    assert.equal(holding.cue, 'power');
    assert.equal(holding.progress.power, false);
  });

  it('dismisses the power prompt when the icon is used or the hint times out', () => {
    const learned: TutorialProgress = { moved: true, fired: true, power: false };
    const session: TutorialSession = { ...freshSession(), inRun: true, anchorX: 180, anchorY: 640 };
    const used = advanceTutorial(learned, session, field({ inventory: 0, inventoryBefore: 1 }));
    assert.equal(used.cue, null);
    assert.equal(used.progress.power, true);

    const waiting = tutorialCue(learned, {
      playing: true,
      shipMoved: false,
      shot: false,
      inventoryCount: 2,
      powerUsed: false,
      powerHintElapsed: POWER_HINT_SECONDS - 0.1,
    });
    assert.equal(waiting.cue, 'power');
    const timedOut = tutorialCue(learned, {
      playing: true,
      shipMoved: false,
      shot: false,
      inventoryCount: 2,
      powerUsed: false,
      powerHintElapsed: POWER_HINT_SECONDS,
    });
    assert.equal(timedOut.cue, null);
    assert.equal(timedOut.progress.power, true);
  });

  it('does not repeat a completed step, including after the run ends', () => {
    const done: TutorialProgress = { moved: true, fired: true, power: true };
    const again = advanceTutorial(done, freshSession(), field({ inventory: 3 }));
    assert.equal(again.cue, null);
    assert.deepEqual(again.progress, done);

    const ended = advanceTutorial(done, again.session, field({ mode: 'over' }));
    assert.equal(ended.cue, null);
    assert.equal(ended.session.inRun, false);
  });

  it('does not complete a step or spend the power timeout while frozen', () => {
    const learned: TutorialProgress = { moved: false, fired: false, power: false };
    const frozen = advanceTutorial(learned, { ...freshSession(), inRun: true, anchorX: 10, anchorY: 10 }, field({ frozen: true, moveInput: true, shipX: 80 }));
    assert.equal(frozen.cue, 'move');
    assert.equal(frozen.progress.moved, false);
    assert.equal(frozen.session.powerElapsed, 0);
  });

  it('persists completion and can be replayed from a cleared save', async () => {
    const store = memoryStore();
    const done: TutorialProgress = { moved: true, fired: true, power: false };
    await saveTutorial(store, done);
    assert.deepEqual(await loadTutorial(store), done);
    await saveTutorial(store, FRESH_TUTORIAL);
    assert.deepEqual(await loadTutorial(store), FRESH_TUTORIAL);
    assert.deepEqual(parseTutorial('{"moved":true,"nope":1}'), { moved: true, fired: false, power: false });
    assert.deepEqual(parseTutorial('not-json'), FRESH_TUTORIAL);
    assert.deepEqual(await loadTutorial(memoryStore()), FRESH_TUTORIAL);
  });
});
