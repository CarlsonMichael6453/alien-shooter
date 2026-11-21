import type { Kv } from '../ui/kv';

export const RATING_KEY = 'alien-shooter:rating-prompt';
export const RATING_MIN_DEATHS = 5;
export const RATING_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

export interface RatingMemory {
  never: boolean;
  lastAskedAt: number | null;
  deaths: number;
}

export const FRESH_RATING: RatingMemory = { never: false, lastAskedAt: null, deaths: 0 };

export type RatingChoice = 'rate' | 'later' | 'never';

export function recordDeath(memory: RatingMemory): RatingMemory {
  return { ...memory, deaths: memory.deaths + 1 };
}

export function shouldAskForRating(memory: RatingMemory, now: number): boolean {
  if (memory.never || memory.deaths < RATING_MIN_DEATHS) return false;
  if (memory.lastAskedAt == null) return true;
  if (now < memory.lastAskedAt) return false;
  return now - memory.lastAskedAt >= RATING_COOLDOWN_MS;
}

export function rememberRatingChoice(choice: RatingChoice, now: number, deaths: number): RatingMemory {
  if (choice === 'never') return { never: true, lastAskedAt: now, deaths };
  return { never: false, lastAskedAt: now, deaths };
}

export function parseRatingMemory(raw: string | null): RatingMemory {
  if (!raw) return { ...FRESH_RATING };
  try {
    const value = JSON.parse(raw) as Partial<RatingMemory> | null;
    if (!value || typeof value !== 'object') return { ...FRESH_RATING };
    const last = typeof value.lastAskedAt === 'number' && Number.isFinite(value.lastAskedAt) ? value.lastAskedAt : null;
    const deaths = typeof value.deaths === 'number' && Number.isFinite(value.deaths) ? Math.max(0, Math.floor(value.deaths)) : 0;
    return { never: value.never === true, lastAskedAt: last, deaths };
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
