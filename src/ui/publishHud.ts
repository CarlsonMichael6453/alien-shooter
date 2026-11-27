import { CAMPAIGN_SECTORS } from '../game/campaign';
import { sectorTheme } from '../game/sectors';
import type { GameState } from '../game/types';
import type { ControlScheme } from './controlsMode';
import type { HudModel } from './Hud';

export function publishHud(
  state: GameState,
  hudRef: { current: HudModel },
  setHud: (model: HudModel) => void,
  finePointer: boolean,
  scheme: ControlScheme,
  stickX: number,
  stickY: number,
  fireHeld: boolean,
  laserAimX: number,
  laserAimY: number,
  laserHint: boolean,
  shipId: string,
  guide: { x: number; y: number } | null,
): void {
  const powerOn =
    state.rapidTimer > 0 ||
    state.laserTimer > 0 ||
    state.wingmanTimer > 0 ||
    state.missileLeft > 0 ||
    state.missiles.length > 0 ||
    state.bomb != null ||
    state.blast != null;
  const sectorName =
    state.runKind === 'campaign'
      ? (CAMPAIGN_SECTORS[state.campaignSector]?.name ?? 'Campaign')
      : sectorTheme(state.sector).name;
  const story = state.introTimer > 0 || state.campaignCleared ? state.introText : '';
  const hint =
    state.mode !== 'playing'
      ? null
      : state.ammo <= 0
        ? 'Out of ammo — fly into a box'
            : state.laserTimer > 0 && finePointer
              ? 'Point the mouse to aim the laser'
              : state.shotsFired === 0 && state.time < 8
            ? finePointer
              ? 'Hold Space or the fire button'
              : 'Hold the fire button'
            : null;
  const prev = hudRef.current;
  if (
    prev.mode === state.mode &&
    prev.score === state.score &&
    prev.lives === state.lives &&
    prev.best === state.best &&
    prev.ammo === state.ammo &&
    prev.inventory.join() === state.inventory.join() &&
    prev.powerOn === powerOn &&
    prev.hint === hint &&
    Math.abs(prev.rapidTimer - state.rapidTimer) < 0.05 &&
    Math.abs(prev.laserTimer - state.laserTimer) < 0.05 &&
    Math.abs(prev.wingmanTimer - state.wingmanTimer) < 0.05 &&
    Math.abs(prev.warpTimer - state.warpTimer) < 0.05 &&
    prev.missileLeft === state.missileLeft &&
    prev.wave === state.wave &&
    Math.abs(prev.sectorBanner - state.sectorBanner) < 0.05 &&
    Math.abs(prev.upgradeFlash - state.upgradeFlash) < 0.05 &&
    prev.sectorName === sectorName &&
    prev.story === story &&
    prev.bossHp === (state.boss?.hp ?? 0) &&
    Math.abs(prev.stickX - stickX) < 0.02 &&
    Math.abs(prev.stickY - stickY) < 0.02 &&
    prev.fireHeld === fireHeld &&
    Math.abs(prev.laserAimX - laserAimX) < 1 &&
    Math.abs(prev.laserAimY - laserAimY) < 1 &&
    prev.laserHint === laserHint &&
    prev.shipId === shipId &&
    prev.guideOn === (guide != null) &&
    Math.abs(prev.guideX - (guide?.x ?? 0)) < 2 &&
    Math.abs(prev.guideY - (guide?.y ?? 0)) < 2
  ) {
    return;
  }
  const next = {
    mode: state.mode,
    score: state.score,
    lives: state.lives,
    best: state.best,
    ammo: state.ammo,
    inventory: state.inventory.slice(),
    powerOn,
    rapidTimer: state.rapidTimer,
    laserTimer: state.laserTimer,
    hint,
    sectorName,
    story,
    sectorBanner: state.sectorBanner,
    upgradeFlash: state.upgradeFlash,
    bossHp: state.boss?.hp ?? 0,
    bossMax: state.boss?.maxHp ?? 0,
    wingmanTimer: state.wingmanTimer,
    warpTimer: state.warpTimer,
    missileLeft: state.missileLeft,
    wave: state.wave,
    stickX,
    stickY,
    fireHeld,
    laserAimX,
    laserAimY,
    laserHint,
    shipId,
    guideOn: guide != null,
    guideX: guide?.x ?? 0,
    guideY: guide?.y ?? 0,
  };
  hudRef.current = next;
  setHud(next);
}




