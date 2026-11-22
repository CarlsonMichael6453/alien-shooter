import type { Kv } from './kv';
import { DEFAULT_SHIP, SHIPS, shipUnlocked } from '../game/ships';

export const PROFILE_KEY = 'alien-shooter:profile';
export const SCORE_LIMIT = 10;

export interface ScoreEntry {
  score: number;
  wave: number;
  at: number;
}

export interface Profile {
  scores: ScoreEntry[];
  bestScore: number;
  bestWave: number;
  shipId: string;
}

export const FRESH_PROFILE: Profile = { scores: [], bestScore: 0, bestWave: 1, shipId: DEFAULT_SHIP };

export function parseProfile(raw: string | null): Profile {
  if (!raw) return { ...FRESH_PROFILE, scores: [] };
  try {
    const value = JSON.parse(raw) as Partial<Profile> | null;
    if (!value || typeof value !== 'object') return { ...FRESH_PROFILE, scores: [] };
    const scores = Array.isArray(value.scores) ? value.scores.flatMap(parseEntry).slice(0, SCORE_LIMIT) : [];
    const shipId = SHIPS.some((ship) => ship.id === value.shipId) ? (value.shipId as string) : DEFAULT_SHIP;
    const bestScore = Math.max(0, finite(value.bestScore), ...scores.map((entry) => entry.score));
    const bestWave = Math.max(1, finite(value.bestWave), ...scores.map((entry) => entry.wave));
    return { scores: sortScores(scores), bestScore, bestWave, shipId };
  } catch {
    return { ...FRESH_PROFILE, scores: [] };
  }
}

function parseEntry(value: unknown): ScoreEntry[] {
  if (!value || typeof value !== 'object') return [];
  const entry = value as Partial<ScoreEntry>;
  if (typeof entry.score !== 'number' || typeof entry.wave !== 'number') return [];
  return [{ score: Math.max(0, Math.floor(entry.score)), wave: Math.max(1, Math.floor(entry.wave)), at: finite(entry.at) }];
}

function finite(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function sortScores(scores: readonly ScoreEntry[]): ScoreEntry[] {
  return [...scores].sort((a, b) => b.score - a.score || b.wave - a.wave || b.at - a.at).slice(0, SCORE_LIMIT);
}

/** Keeps the top 10. A run that misses the board still raises the unlock marks. */
export function recordRun(profile: Profile, score: number, wave: number, at: number): Profile {
  const nextScore = Math.max(0, Math.floor(score));
  const nextWave = Math.max(1, Math.floor(wave));
  const scores = sortScores([...profile.scores, { score: nextScore, wave: nextWave, at }]);
  return {
    scores,
    bestScore: Math.max(profile.bestScore, nextScore),
    bestWave: Math.max(profile.bestWave, nextWave),
    shipId: profile.shipId,
  };
}

export function selectShip(profile: Profile, shipId: string): Profile {
  const ship = SHIPS.find((item) => item.id === shipId);
  if (!ship || !shipUnlocked(ship, profile.bestScore, profile.bestWave)) return profile;
  return { ...profile, shipId };
}

export async function loadProfile(store: Kv): Promise<Profile> {
  return parseProfile(await store.getItem(PROFILE_KEY));
}

export async function saveProfile(store: Kv, profile: Profile): Promise<void> {
  await store.setItem(PROFILE_KEY, JSON.stringify(profile));
}
