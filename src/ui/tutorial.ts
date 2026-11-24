import { pickupBob } from '../game/draw';
import type { GameState } from '../game/types';
import type { Kv } from './kv';

export const TUTORIAL_KEY = 'alien-shooter:tutorial';
export const MOVE_DISTANCE = 14;
export const POWER_HINT_SECONDS = 6;

export interface TutorialProgress {
  moved: boolean;
  fired: boolean;
  /** Grabbed the ammo box the opening tutorial places in front of the ship. */
  ammo: boolean;
  power: boolean;
}

export type TutorialCue = 'move' | 'shoot' | 'ammo' | 'pickup' | 'power' | null;

export const FRESH_TUTORIAL: TutorialProgress = { moved: false, fired: false, ammo: false, power: false };

/** How long the "pick up a power-up" line shows before a badge is placed on screen. */
export const TUTORIAL_POWER_DELAY = 0.75;

export interface TutorialSession {
  inRun: boolean;
  shipMoved: boolean;
  shot: boolean;
  ammoCollected: boolean;
  powerUsed: boolean;
  powerElapsed: number;
  powerDropWait: number;
  ammoDropId: number | null;
  powerDropId: number | null;
  anchorX: number;
  anchorY: number;
}

export function freshSession(): TutorialSession {
  return {
    inRun: false,
    shipMoved: false,
    shot: false,
    ammoCollected: false,
    powerUsed: false,
    powerElapsed: 0,
    powerDropWait: 0,
    ammoDropId: null,
    powerDropId: null,
    anchorX: 0,
    anchorY: 0,
  };
}

export interface TutorialInput {
  playing: boolean;
  shipMoved: boolean;
  shot: boolean;
  ammoCollected: boolean;
  inventoryCount: number;
  powerUsed: boolean;
  powerHintElapsed: number;
}

function normalize(progress: TutorialProgress): TutorialProgress {
  return {
    moved: progress.moved === true,
    fired: progress.fired === true,
    ammo: progress.ammo === true,
    power: progress.power === true,
  };
}

export function tutorialCue(progress: TutorialProgress, input: TutorialInput): { cue: TutorialCue; progress: TutorialProgress } {
  if (!input.playing) return { cue: null, progress: normalize(progress) };
  let next = normalize(progress);
  if (input.shipMoved) next = { ...next, moved: true };
  if (input.shot) next = { ...next, fired: true };
  if (input.ammoCollected) next = { ...next, ammo: true };
  if (input.powerUsed) next = { ...next, power: true };
  const showingPower = next.moved && next.fired && next.ammo && !next.power && input.inventoryCount > 0;
  if (showingPower && input.powerHintElapsed >= POWER_HINT_SECONDS) next = { ...next, power: true };
  if (!next.moved) return { cue: 'move', progress: next };
  if (!next.fired) return { cue: 'shoot', progress: next };
  if (!next.ammo) return { cue: 'ammo', progress: next };
  if (!next.power && input.inventoryCount <= 0) return { cue: 'pickup', progress: next };
  if (!next.power) return { cue: 'power', progress: next };
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
  ammo: number;
  ammoBefore: number;
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
      ammoCollected: false,
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
  let ammoCollected = nextSession.ammoCollected;
  if (!progress.ammo && learnedMove && learnedShot && frame.ammo > frame.ammoBefore) ammoCollected = true;
  let elapsed = nextSession.powerElapsed;
  const tick = Math.min(0.05, Math.max(0, frame.dt));
  if (!learnedPower && learnedMove && learnedShot && (progress.ammo || ammoCollected) && frame.inventory > 0) elapsed += tick;
  else if (frame.inventory === 0) elapsed = 0;
  let powerDropWait = nextSession.powerDropWait;
  const waitingForPower = !learnedPower && learnedMove && learnedShot && (progress.ammo || ammoCollected) && frame.inventory === 0;
  powerDropWait = waitingForPower ? powerDropWait + tick : 0;
  nextSession = { ...nextSession, ammoCollected, powerElapsed: elapsed, powerDropWait };

  const result = tutorialCue(progress, {
    playing: true,
    shipMoved: nextSession.shipMoved,
    shot: nextSession.shot,
    ammoCollected,
    inventoryCount: frame.inventory,
    powerUsed: nextSession.powerUsed,
    powerHintElapsed: elapsed,
  });
  return { progress: result.progress, session: nextSession, cue: result.cue };
}

/** Where the tutorial arrow should point, once that drop is on screen. */
export function tutorialGuide(state: GameState, cue: TutorialCue): { x: number; y: number } | null {
  if (cue !== 'ammo' && cue !== 'pickup') return null;
  const wantAmmo = cue === 'ammo';
  let best: { x: number; y: number; spin: number; score: number } | null = null;
  for (const pickup of state.pickups) {
    if ((pickup.kind === 'ammo') !== wantAmmo) continue;
    if (pickup.y < 12 || pickup.y > state.height - 12) continue;
    const score = Math.abs(pickup.x - state.shipX) + (pickup.y < state.shipY ? 0 : 1000);
    if (!best || score < best.score) best = { x: pickup.x, y: pickup.y, spin: pickup.spin, score };
  }
  if (!best) return null;
  return { x: best.x, y: best.y + pickupBob(state.time, best.spin) };
}

export function sameProgress(a: TutorialProgress, b: TutorialProgress): boolean {
  return a.moved === b.moved && a.fired === b.fired && a.ammo === b.ammo && a.power === b.power;
}

export function parseTutorial(raw: string | null): TutorialProgress {
  if (!raw) return { ...FRESH_TUTORIAL };
  try {
    const value = JSON.parse(raw) as Partial<TutorialProgress> | null;
    if (!value || typeof value !== 'object') return { ...FRESH_TUTORIAL };
    const moved = value.moved === true;
    const fired = value.fired === true;
    const power = value.power === true;
    // Saves from before the ammo step have no `ammo` field. A finished tutorial stays finished.
    const ammo = value.ammo === true || (value.ammo == null && moved && fired && power);
    return { moved, fired, ammo, power };
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
