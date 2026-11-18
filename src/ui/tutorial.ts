import type { Kv } from './kv';

export const TUTORIAL_KEY = 'alien-shooter:tutorial';
export const MOVE_DISTANCE = 14;
export const POWER_HINT_SECONDS = 6;

export interface TutorialProgress {
  moved: boolean;
  fired: boolean;
  power: boolean;
}

export type TutorialCue = 'move' | 'shoot' | 'power' | null;

export const FRESH_TUTORIAL: TutorialProgress = { moved: false, fired: false, power: false };

export interface TutorialSession {
  inRun: boolean;
  shipMoved: boolean;
  shot: boolean;
  powerUsed: boolean;
  powerElapsed: number;
  anchorX: number;
  anchorY: number;
}

export function freshSession(): TutorialSession {
  return {
    inRun: false,
    shipMoved: false,
    shot: false,
    powerUsed: false,
    powerElapsed: 0,
    anchorX: 0,
    anchorY: 0,
  };
}

export interface TutorialInput {
  playing: boolean;
  shipMoved: boolean;
  shot: boolean;
  inventoryCount: number;
  powerUsed: boolean;
  powerHintElapsed: number;
}

export function tutorialCue(progress: TutorialProgress, input: TutorialInput): { cue: TutorialCue; progress: TutorialProgress } {
  if (!input.playing) return { cue: null, progress };
  let next = progress;
  if (input.shipMoved) next = { ...next, moved: true };
  if (input.shot) next = { ...next, fired: true };
  if (input.powerUsed) next = { ...next, power: true };
  const showingPower = next.moved && next.fired && !next.power && input.inventoryCount > 0;
  if (showingPower && input.powerHintElapsed >= POWER_HINT_SECONDS) next = { ...next, power: true };
  if (!next.moved) return { cue: 'move', progress: next };
  if (!next.fired) return { cue: 'shoot', progress: next };
  if (!next.power && input.inventoryCount > 0) return { cue: 'power', progress: next };
  return { cue: null, progress: next };
}

export interface TutorialFrame {
  mode: 'ready' | 'playing' | 'over';
  dt: number;
  shipX: number;
  shipY: number;
  moveInput: boolean;
  shotsFired: number;
  shotsBefore: number;
  inventory: number;
  inventoryBefore: number;
  frozen: boolean;
}

export function advanceTutorial(
  progress: TutorialProgress,
  session: TutorialSession,
  frame: TutorialFrame,
): { progress: TutorialProgress; session: TutorialSession; cue: TutorialCue } {
  if (frame.mode !== 'playing') {
    return { progress, session: { ...session, inRun: false }, cue: null };
  }
  let nextSession = session;
  if (!nextSession.inRun) {
    nextSession = { ...freshSession(), inRun: true, anchorX: frame.shipX, anchorY: frame.shipY };
  }
  if (frame.frozen) {
    const shown = tutorialCue(progress, {
      playing: true,
      shipMoved: false,
      shot: false,
      inventoryCount: frame.inventory,
      powerUsed: false,
      powerHintElapsed: 0,
    });
    return { progress, session: nextSession, cue: shown.cue };
  }

  if (frame.moveInput) {
    const dist = Math.hypot(frame.shipX - nextSession.anchorX, frame.shipY - nextSession.anchorY);
    if (dist >= MOVE_DISTANCE) nextSession = { ...nextSession, shipMoved: true };
  } else {
    nextSession = { ...nextSession, anchorX: frame.shipX, anchorY: frame.shipY };
  }
  if (frame.shotsFired > frame.shotsBefore) nextSession = { ...nextSession, shot: true };
  if (frame.inventory < frame.inventoryBefore) nextSession = { ...nextSession, powerUsed: true };

  const learnedMove = progress.moved || nextSession.shipMoved;
  const learnedShot = progress.fired || nextSession.shot;
  const learnedPower = progress.power || nextSession.powerUsed;
  let elapsed = nextSession.powerElapsed;
  if (!learnedPower && learnedMove && learnedShot && frame.inventory > 0) elapsed += Math.min(0.05, Math.max(0, frame.dt));
  else if (frame.inventory === 0) elapsed = 0;
  nextSession = { ...nextSession, powerElapsed: elapsed };

  const result = tutorialCue(progress, {
    playing: true,
    shipMoved: nextSession.shipMoved,
    shot: nextSession.shot,
    inventoryCount: frame.inventory,
    powerUsed: nextSession.powerUsed,
    powerHintElapsed: elapsed,
  });
  return { progress: result.progress, session: nextSession, cue: result.cue };
}

export function sameProgress(a: TutorialProgress, b: TutorialProgress): boolean {
  return a.moved === b.moved && a.fired === b.fired && a.power === b.power;
}

export function parseTutorial(raw: string | null): TutorialProgress {
  if (!raw) return { ...FRESH_TUTORIAL };
  try {
    const value = JSON.parse(raw) as Partial<TutorialProgress> | null;
    if (!value || typeof value !== 'object') return { ...FRESH_TUTORIAL };
    return {
      moved: value.moved === true,
      fired: value.fired === true,
      power: value.power === true,
    };
  } catch {
    return { ...FRESH_TUTORIAL };
  }
}

export async function loadTutorial(store: Kv): Promise<TutorialProgress> {
  return parseTutorial(await store.getItem(TUTORIAL_KEY));
}

export async function saveTutorial(store: Kv, progress: TutorialProgress): Promise<void> {
  await store.setItem(TUTORIAL_KEY, JSON.stringify(progress));
}
