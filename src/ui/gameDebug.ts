import { Platform } from 'react-native';
import type { Controls } from '../game/controls';
import type { GameState } from '../game/types';
import type { TutorialCue, TutorialProgress } from './tutorial';
import type { UiMode } from './Hud';

interface DebugSnapshot {
  mode: string;
  score: number;
  best: number;
  lives: number;
  shipX: number;
  shipY: number;
  bullets: number;
  enemies: number;
  shotsFired: number;
  ammo: number;
  inventory: number;
  rapidTimer: number;
  laserTimer: number;
  firing: boolean;
  moveId: number | null;
  fireId: number | null;
  width: number;
  height: number;
  cue: string | null;
  ui: string;
}

declare global {
  interface Window {
    __ALIEN__?: {
      snapshot: () => DebugSnapshot;
      apply: (change: (state: GameState) => void) => void;
      openSettings: () => void;
      openEditor: () => void;
      closeUi: () => void;
      setTutorial: (progress: TutorialProgress) => void;
      offerRating: () => void;
      openPause: () => void;
      openScores: () => void;
      openShips: () => void;
    };
  }
}

export function publishDebug(
  state: GameState,
  controls: Controls,
  ui: {
    openSettings: () => void;
    openEditor: () => void;
    closeUi: () => void;
    setTutorial: (progress: TutorialProgress) => void;
    cue: () => TutorialCue;
    ui: () => UiMode;
    offerRating: () => void;
    openPause: () => void;
    openScores: () => void;
    openShips: () => void;
  },
): void {
  if (Platform.OS !== 'web' || !debugEnabled()) return;
  window.__ALIEN__ = {
    snapshot: () => ({
      mode: state.mode,
      score: state.score,
      best: state.best,
      lives: state.lives,
      shipX: state.shipX,
      shipY: state.shipY,
      bullets: state.bullets.length,
      enemies: state.enemies.length,
      shotsFired: state.shotsFired,
      ammo: state.ammo,
      inventory: state.inventory.length,
      rapidTimer: state.rapidTimer,
      laserTimer: state.laserTimer,
      firing: controls.frame().firing,
      moveId: controls.moveId,
      fireId: controls.fireId,
      width: state.width,
      height: state.height,
      cue: ui.cue(),
      ui: ui.ui(),
    }),
    apply: (change) => change(state),
    openSettings: ui.openSettings,
    openEditor: ui.openEditor,
    closeUi: ui.closeUi,
    setTutorial: ui.setTutorial,
    offerRating: ui.offerRating,
    openPause: ui.openPause,
    openScores: ui.openScores,
    openShips: ui.openShips,
  };
}

function debugEnabled(): boolean {
  return new URLSearchParams(window.location.search).get('debug') === '1';
}
