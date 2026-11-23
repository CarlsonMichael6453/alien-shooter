import type { Kv } from './kv';

export const LASER_HINT_KEY = 'alien-shooter:laser-aim-hint';
/** Hide the first-run aim cue after this long, even if the stick is never moved. */
export const LASER_HINT_SECONDS = 4;

export function laserHintSeen(raw: string | null): boolean {
  return raw === 'seen';
}

export async function loadLaserHintSeen(store: Kv): Promise<boolean> {
  return laserHintSeen(await store.getItem(LASER_HINT_KEY));
}

export async function saveLaserHintSeen(store: Kv): Promise<void> {
  await store.setItem(LASER_HINT_KEY, 'seen');
}
