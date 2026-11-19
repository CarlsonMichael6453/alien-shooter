import type { Kv } from '../ui/kv';

export const RATING_KEY = 'alien-shooter:rating-prompt';
export const RATING_COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000;

export interface RatingMemory {
  never: boolean;
  lastAskedAt: number | null;
}

export const FRESH_RATING: RatingMemory = { never: false, lastAskedAt: null };

export type RatingChoice = 'rate' | 'later' | 'never';

export function isNewHighScore(score: number, previousBest: number): boolean {
  return score > 0 && score > previousBest;
}

export function shouldAskForRating(memory: RatingMemory, now: number, newHighScore: boolean): boolean {
  if (!newHighScore || memory.never) return false;
  if (memory.lastAskedAt == null) return true;
  if (now < memory.lastAskedAt) return false;
  return now - memory.lastAskedAt >= RATING_COOLDOWN_MS;
}

export function rememberRatingChoice(choice: RatingChoice, now: number): RatingMemory {
  if (choice === 'never') return { never: true, lastAskedAt: now };
  return { never: false, lastAskedAt: now };
}

export function parseRatingMemory(raw: string | null): RatingMemory {
  if (!raw) return { ...FRESH_RATING };
  try {
    const value = JSON.parse(raw) as Partial<RatingMemory> | null;
    if (!value || typeof value !== 'object') return { ...FRESH_RATING };
    const last = typeof value.lastAskedAt === 'number' && Number.isFinite(value.lastAskedAt) ? value.lastAskedAt : null;
    return { never: value.never === true, lastAskedAt: last };
  } catch {
    return { ...FRESH_RATING };
  }
}

export async function loadRatingMemory(store: Kv): Promise<RatingMemory> {
  return parseRatingMemory(await store.getItem(RATING_KEY));
}

export async function saveRatingMemory(store: Kv, memory: RatingMemory): Promise<void> {
  await store.setItem(RATING_KEY, JSON.stringify(memory));
}
