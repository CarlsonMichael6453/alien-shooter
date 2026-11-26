import type { GameState } from './types';
import type { Kv } from '../ui/kv';

export const CAMPAIGN_UNLOCK_SCORE = 5000;
export const CAMPAIGN_KEY = 'alien-shooter:campaign';

export interface CampaignSector {
  name: string;
  intro: string;
}

/** Pluto inward. Each sector ends on a mothership. The last fight is over the Moon. */
export const CAMPAIGN_SECTORS: readonly CampaignSector[] = [
  { name: 'Pluto', intro: 'The Swarm crosses the dark. You are the last fighter leaving Pluto.' },
  { name: 'Neptune', intro: 'They pour past Neptune. Hold the gate.' },
  { name: 'Uranus', intro: 'Uranus is already burning. Cut through to the mothership.' },
  { name: 'Mars', intro: 'Mars is the last world before home. Their mothership is in orbit.' },
  { name: 'The Moon', intro: 'The final Swarm mothership hangs over the Moon.' },
];

export const CAMPAIGN_CLEAR_TEXT = 'The Swarm falls back. The Moon is quiet.';

export interface CampaignProgress {
  sector: number;
  cleared: boolean;
}

export const FRESH_CAMPAIGN: CampaignProgress = { sector: 0, cleared: false };

export function campaignUnlocked(bestScore: number, dev = false): boolean {
  return dev || bestScore >= CAMPAIGN_UNLOCK_SCORE;
}

export function devCampaignFromLocation(search: string): boolean {
  const query = new URLSearchParams(search);
  return query.get('unlockCampaign') === '1' || query.get('unlockAll') === '1';
}

export function parseCampaign(raw: string | null): CampaignProgress {
  if (!raw) return { ...FRESH_CAMPAIGN };
  try {
    const value = JSON.parse(raw) as Partial<CampaignProgress> | null;
    if (!value || typeof value !== 'object') return { ...FRESH_CAMPAIGN };
    const sector = typeof value.sector === 'number' && Number.isFinite(value.sector) ? Math.floor(value.sector) : 0;
    return {
      sector: Math.min(CAMPAIGN_SECTORS.length - 1, Math.max(0, sector)),
      cleared: value.cleared === true,
    };
  } catch {
    return { ...FRESH_CAMPAIGN };
  }
}

export function beginCampaign(state: GameState, sector: number): void {
  const index = Math.min(CAMPAIGN_SECTORS.length - 1, Math.max(0, Math.floor(sector)));
  const place = CAMPAIGN_SECTORS[index];
  state.runKind = 'campaign';
  state.campaignSector = index;
  state.campaignCleared = false;
  state.mode = 'playing';
  state.time = 0;
  state.score = 0;
  state.lives = state.lives > 0 ? state.lives : 3;
  state.sector = index;
  state.boss = null;
  state.enemies = [];
  state.enemyBullets = [];
  state.wave = 1;
  state.waveSpawned = 0;
  state.waveBreak = 0;
  state.introText = place.intro;
  state.introTimer = 2.6;
  state.sectorBanner = 2.6;
  state.spawnCooldown = 0.4;
}

export function tickCampaign(state: GameState, dt: number): void {
  if (state.mode !== 'playing' || state.runKind !== 'campaign') return;
  if (state.introTimer > 0) {
    state.introTimer = Math.max(0, state.introTimer - dt);
    if (state.introTimer > 0) return;
  }
  if (state.boss) return;
  const hp = state.campaignSector === CAMPAIGN_SECTORS.length - 1 ? 50 + 6 * 20 : 50 + state.campaignSector * 20;
  state.sector = state.campaignSector;
  state.enemies = [];
  state.boss = {
    hp,
    maxHp: hp,
    x: state.width / 2,
    y: 132,
    dir: 1,
    age: 0,
    pattern: 0,
    patternTime: 0,
    cooldown: 0.35,
    beam: 0,
    beamDir: 1,
    burned: false,
  };
}

/** After the mothership falls. Returns true when the campaign is finished. */
export function onCampaignBossDown(state: GameState): boolean {
  const next = state.campaignSector + 1;
  if (next >= CAMPAIGN_SECTORS.length) {
    state.campaignCleared = true;
    state.mode = 'over';
    state.introText = CAMPAIGN_CLEAR_TEXT;
    state.introTimer = 0;
    return true;
  }
  const place = CAMPAIGN_SECTORS[next];
  state.campaignSector = next;
  state.sector = next;
  state.introText = place.intro;
  state.introTimer = 2.6;
  state.sectorBanner = 2.6;
  return false;
}

export async function loadCampaign(store: Kv): Promise<CampaignProgress> {
  return parseCampaign(await store.getItem(CAMPAIGN_KEY));
}

export async function saveCampaign(store: Kv, progress: CampaignProgress): Promise<void> {
  await store.setItem(CAMPAIGN_KEY, JSON.stringify(progress));
}
