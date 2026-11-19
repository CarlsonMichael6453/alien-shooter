import { activateKeepAwakeAsync, useKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useRef, useState } from 'react';
import {
  AppState,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Controls } from '../game/controls';
import { createGame, resizeGame, step } from '../game/logic';
import type { GameState } from '../game/types';
import { GameCanvas } from '../render/GameCanvas';
import type { GameCanvasHandle } from '../render/types';
import { bindControls } from '../web/bindControls';
import { installWebGestureLock } from '../web/gestureLock';
import { Overlay, type HudModel, type UiMode } from './Hud';
import {
  clampLayout,
  defaultLayout,
  gearRect,
  inventoryRects,
  loadLayout,
  mergeLayout,
  patchElement,
  placeElement,
  saveLayout,
  type Field,
  type HudElement,
  type HudElementId,
  type HudLayout,
} from './hudLayout';
import { createAppStore } from './storage';
import { isNewHighScore, loadRatingMemory, rememberRatingChoice, saveRatingMemory, shouldAskForRating, type RatingMemory } from '../feedback/ratingPrompt';
import {
  FRESH_TUTORIAL,
  advanceTutorial,
  freshSession,
  loadTutorial,
  sameProgress,
  saveTutorial,
  type TutorialCue,
  type TutorialProgress,
  type TutorialSession,
} from './tutorial';

const INITIAL_HUD: HudModel = {
  mode: 'ready',
  score: 0,
  best: 0,
  lives: 3,
  ammo: 100,
  inventory: [],
  powerOn: false,
  rapidTimer: 0,
  laserTimer: 0,
  hint: null,
};

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
    };
  }
}

export function GameScreen() {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const playfield = playfieldSize(window.width, window.height);
  const browserInsets = useBrowserInsets();
  const finePointer = useFinePointer();

  const stateRef = useRef<GameState | null>(null);
  const controlsRef = useRef(new Controls());
  const canvasRef = useRef<GameCanvasHandle>(null);
  const playfieldRef = useRef(playfield);
  const offsetRef = useRef(0);
  const bottomRef = useRef(14);
  const fineRef = useRef(false);
  const pausedRef = useRef(false);
  const startRef = useRef(false);
  const restartRef = useRef(false);
  const hudRef = useRef(INITIAL_HUD);
  const [hud, setHud] = useState<HudModel>(INITIAL_HUD);
  const storeRef = useRef(createAppStore());
  const hudLayoutRef = useRef<HudLayout | null>(null);
  const savedLayoutRef = useRef<HudElement[] | null>(null);
  const loadedRef = useRef(false);
  const [layout, setLayout] = useState<HudLayout | null>(null);
  const tutorialRef = useRef<TutorialProgress>(FRESH_TUTORIAL);
  const sessionRef = useRef<TutorialSession>(freshSession());
  const cueRef = useRef<TutorialCue>(null);
  const [cue, setCue] = useState<TutorialCue>(null);
  const uiRef = useRef<UiMode>('none');
  const openUiRef = useRef<(next: UiMode) => void>(() => {});
  const [ui, setUi] = useState<UiMode>('none');
  const [selected, setSelected] = useState<HudElementId>('score');
  const ratingRef = useRef<RatingMemory>({ never: false, lastAskedAt: null });
  const ratingLoadedRef = useRef(false);
  const [ratingOffer, setRatingOffer] = useState(false);
  const feedbackBackRef = useRef<UiMode>('settings');
  const offerRatingRef = useRef(() => {});
  const topRef = useRef(14);
  const fieldRef = useRef<Field>({ width: 0, height: 0, top: 14, bottom: 14 });
  playfieldRef.current = playfield;
  offsetRef.current = Math.max(0, (window.width - playfield.width) / 2);
  fineRef.current = finePointer;

  const onPressRef = useRef(() => {});
  onPressRef.current = () => {
    const mode = stateRef.current?.mode;
    if (mode === 'ready') startRef.current = true;
    else if (mode === 'over') restartRef.current = true;
    if (Platform.OS === 'web') activateKeepAwakeAsync().catch(() => {});
  };

  useEffect(() => {
    SystemUI.setBackgroundColorAsync('#070B14').catch(() => {});
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    return () => {
      ScreenOrientation.unlockAsync().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    return installWebGestureLock();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const element = document.getElementById('alien-shooter-root');
    if (!element) return;
    return bindControls(
      element,
      controlsRef.current,
      () => {
        const state = stateRef.current;
        return { x: state?.shipX ?? 0, y: state?.shipY ?? 0 };
      },
      () => onPressRef.current(),
      () => uiRef.current !== 'none',
    );
  }, []);

  useEffect(() => {
    const onAppState = (next: string) => {
      pausedRef.current = next !== 'active';
      if (next !== 'active') controlsRef.current.clearTransient();
    };
    const subscription = AppState.addEventListener('change', onAppState);
    const onVisibility = () => {
      pausedRef.current = document.hidden;
      if (document.hidden) controlsRef.current.clearTransient();
    };
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', onVisibility);
    return () => {
      subscription.remove();
      if (Platform.OS === 'web') document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    let cancel = false;
    const store = storeRef.current;
    void (async () => {
      const [progress, saved, rating] = await Promise.all([loadTutorial(store), loadLayout(store), loadRatingMemory(store)]);
      if (cancel) return;
      tutorialRef.current = progress;
      savedLayoutRef.current = saved;
      ratingRef.current = rating;
      ratingLoadedRef.current = true;
      loadedRef.current = true;
    })();
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const { width, height } = playfieldRef.current;
      if (!stateRef.current && width > 0 && height > 0) {
        stateRef.current = createGame(width, height);
      }
      const state = stateRef.current;
      const field = fieldRef.current;
      if (loadedRef.current && !hudLayoutRef.current && width > 0 && height > 0) {
        const next = mergeLayout(savedLayoutRef.current, field);
        hudLayoutRef.current = next;
        setLayout(next);
      }
      if (state && width > 0 && height > 0) {
        if (state.width !== width || state.height !== height) {
          resizeGame(state, width, height);
          controlsRef.current.reanchor(state.shipX, state.shipY);
        }
        if (hudLayoutRef.current) {
          const count = Math.max(1, uiRef.current === 'editor' ? 3 : state.inventory.length);
          const clamped = clampLayout(hudLayoutRef.current, field, count);
          if (clamped.changed) {
            hudLayoutRef.current = clamped.layout;
            setLayout(clamped.layout);
            void saveLayout(storeRef.current, clamped.layout);
          }
        }
        const inventory = hudLayoutRef.current?.elements.find((element) => element.id === 'inventory');
        const slots =
          inventory && state.mode === 'playing' && uiRef.current === 'none'
            ? inventoryRects(inventory, field, state.inventory.length, offsetRef.current)
            : [];
        controlsRef.current.setInventoryRects(slots);
        const gear = gearRect(field);
        controlsRef.current.setChromeRects(
          uiRef.current === 'none' ? [{ ...gear, x: gear.x + offsetRef.current }] : [],
        );
        const shotsBefore = state.shotsFired;
        const inventoryBefore = state.inventory.length;
        const modeBefore = state.mode;
        const bestBefore = state.best;
        const frozen = pausedRef.current || uiRef.current !== 'none';
        const control = controlsRef.current.frame();
        if (!frozen) {
          const restarting = restartRef.current && state.mode === 'over';
          step(
            state,
            {
              ...control,
              moveActive: restarting ? false : control.moveActive,
              activateSlot: controlsRef.current.consumePower(),
              start: startRef.current,
              restart: restartRef.current,
            },
            dt,
          );
          startRef.current = false;
          restartRef.current = false;
          if (restarting) controlsRef.current.reanchor(state.shipX, state.shipY);
        } else {
          controlsRef.current.consumePower();
        }
        if (controlsRef.current.consumeChrome()) openUiRef.current('settings');
        if (
          ratingLoadedRef.current &&
          !frozen &&
          modeBefore !== 'over' &&
          state.mode === 'over' &&
          shouldAskForRating(ratingRef.current, Date.now(), isNewHighScore(state.score, bestBefore))
        ) {
          setRatingOffer(true);
        }
        const tutorial = advanceTutorial(tutorialRef.current, sessionRef.current, {
          mode: state.mode,
          dt,
          shipX: state.shipX,
          shipY: state.shipY,
          moveInput: !frozen && (control.moveActive || control.keyX !== 0 || control.keyY !== 0),
          shotsFired: state.shotsFired,
          shotsBefore,
          inventory: state.inventory.length,
          inventoryBefore,
          frozen,
        });
        sessionRef.current = tutorial.session;
        if (!sameProgress(tutorialRef.current, tutorial.progress)) {
          tutorialRef.current = tutorial.progress;
          void saveTutorial(storeRef.current, tutorial.progress);
        }
        if (cueRef.current !== tutorial.cue) {
          cueRef.current = tutorial.cue;
          setCue(tutorial.cue);
        }
        canvasRef.current?.draw(state);
        publishHud(state, hudRef, setHud, fineRef.current);
        publishDebug(state, controlsRef.current, {
        openSettings: () => openUiRef.current('settings'),
        openEditor: () => openUiRef.current('editor'),
        closeUi: () => openUiRef.current('none'),
        setTutorial: (progress) => {
          tutorialRef.current = progress;
          sessionRef.current = {
            ...freshSession(),
            inRun: state.mode === 'playing',
            anchorX: state.shipX,
            anchorY: state.shipY,
          };
        },
        cue: () => cueRef.current,
        ui: () => uiRef.current,
        offerRating: () => offerRatingRef.current(),
      });
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  const top = Math.max(insets.top, browserInsets.top, 14);
  const bottom = Math.max(insets.bottom, browserInsets.bottom, 14);
  bottomRef.current = bottom;
  topRef.current = top;
  fieldRef.current = { width: playfield.width, height: playfield.height, top, bottom };
  const field = fieldRef.current;

  openUiRef.current = (next) => {
    uiRef.current = next;
    setUi(next);
    if (next !== 'none') controlsRef.current.clearTransient();
  };
  offerRatingRef.current = () => setRatingOffer(true);

  const answerRating = (choice: 'rate' | 'later' | 'never') => {
    const next = rememberRatingChoice(choice, Date.now());
    ratingRef.current = next;
    void saveRatingMemory(storeRef.current, next);
    setRatingOffer(false);
    if (choice === 'rate') {
      feedbackBackRef.current = 'none';
      openUiRef.current('feedback');
    }
  };

  const commitLayout = (next: HudLayout, persist: boolean) => {
    hudLayoutRef.current = next;
    setLayout(next);
    if (persist) void saveLayout(storeRef.current, next);
  };

  const inventoryCount = Math.max(3, stateRef.current?.inventory.length ?? 0);

  return (
    <View
      nativeID="alien-shooter-root"
      collapsable={false}
      accessibilityLabel="Alien Shooter. Drag one finger to move the ship. Hold a second finger anywhere to fire."
      style={[styles.root, webTouch as object]}
      {...nativeTouchProps(controlsRef, stateRef, uiRef, () => onPressRef.current())}
    >
      <View pointerEvents="box-none" style={{ width: playfield.width, height: playfield.height }}>
        <View pointerEvents="none" style={styles.playfield}>
          <GameCanvas ref={canvasRef} width={playfield.width} height={playfield.height} />
        </View>
        {layout ? (
          <Overlay
            model={hud}
            layout={layout}
            field={field}
            finePointer={finePointer}
            cue={cue}
            ui={ui}
            selected={selected}
            onOpenSettings={() => openUiRef.current('settings')}
            onCloseUi={() => openUiRef.current(ui === 'feedback' ? feedbackBackRef.current : 'none')}
            onReplayTutorial={() => {
              tutorialRef.current = { ...FRESH_TUTORIAL };
              const current = stateRef.current;
              sessionRef.current = {
                ...freshSession(),
                inRun: current?.mode === 'playing',
                anchorX: current?.shipX ?? 0,
                anchorY: current?.shipY ?? 0,
              };
              cueRef.current = null;
              setCue(null);
              void saveTutorial(storeRef.current, FRESH_TUTORIAL);
              openUiRef.current('none');
            }}
            onOpenFeedback={() => {
              feedbackBackRef.current = uiRef.current === 'none' ? 'none' : 'settings';
              openUiRef.current('feedback');
            }}
            ratingOffer={ratingOffer}
            onRate={() => answerRating('rate')}
            onLater={() => answerRating('later')}
            onNever={() => answerRating('never')}
            onEditHud={() => openUiRef.current('editor')}
            onDoneEditing={() => openUiRef.current('settings')}
            onSelect={setSelected}
            onPlace={(id, x, y) => {
              if (!hudLayoutRef.current) return;
              commitLayout(placeElement(hudLayoutRef.current, id, x, y, field, inventoryCount), false);
            }}
            onPlaceEnd={() => {
              if (hudLayoutRef.current) void saveLayout(storeRef.current, hudLayoutRef.current);
            }}
            onPatch={(id, patch) => {
              if (!hudLayoutRef.current) return;
              commitLayout(patchElement(hudLayoutRef.current, id, patch, field, inventoryCount), true);
            }}
            onResetLayout={() => commitLayout(defaultLayout(field), true)}
          />
        ) : null}
      </View>
    </View>
  );
}

function playfieldSize(windowWidth: number, windowHeight: number): { width: number; height: number } {
  if (windowWidth <= 0 || windowHeight <= 0) return { width: 0, height: 0 };
  const width =
    windowWidth > windowHeight
      ? Math.min(windowWidth, windowHeight * (9 / 16), 480)
      : Math.min(windowWidth, 480);
  return { width, height: windowHeight };
}

function publishHud(
  state: GameState,
  hudRef: { current: HudModel },
  setHud: (model: HudModel) => void,
  finePointer: boolean,
): void {
  const powerOn = state.rapidTimer > 0 || state.laserTimer > 0 || state.bomb != null || state.blast != null;
  const hint =
    state.mode !== 'playing'
      ? null
      : state.ammo <= 0
        ? 'Out of ammo — fly into a box'
        : state.laserTimer > 0
          ? finePointer
            ? 'Point the mouse to aim the laser'
            : 'Move the firing finger to aim'
          : state.shotsFired === 0 && state.time < 8
            ? finePointer
              ? 'Hold Space to fire'
              : 'Hold a second finger to fire'
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
    Math.abs(prev.laserTimer - state.laserTimer) < 0.05
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
  };
  hudRef.current = next;
  setHud(next);
}

function publishDebug(
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
  };
}

function debugEnabled(): boolean {
  return new URLSearchParams(window.location.search).get('debug') === '1';
}

function nativeTouchProps(
  controlsRef: { current: Controls },
  stateRef: { current: GameState | null },
  uiRef: { current: UiMode },
  onPress: () => void,
) {
  if (Platform.OS === 'web') return {};
  const each = (
    event: GestureResponderEvent,
    which: 'changed' | 'active',
    fn: (id: number, x: number, y: number) => void,
  ) => {
    const native = event.nativeEvent;
    const list = which === 'changed' ? native.changedTouches : native.touches;
    if (list && list.length > 0) {
      for (const touch of list) fn(touch.identifier, touch.locationX, touch.locationY);
      return;
    }
    fn(native.identifier, native.locationX, native.locationY);
  };
  return {
    onTouchStart: (event: GestureResponderEvent) => {
      if (uiRef.current !== 'none') return;
      const state = stateRef.current;
      if (!state) return;
      let play = false;
      each(event, 'changed', (id, x, y) => {
        if (controlsRef.current.pointerDown(id, x, y, state.shipX, state.shipY) === 'play') play = true;
      });
      if (play) onPress();
    },
    onTouchMove: (event: GestureResponderEvent) => {
      const native = event.nativeEvent;
      const which = native.touches && native.touches.length > 0 ? 'active' : 'changed';
      each(event, which, (id, x, y) => controlsRef.current.pointerMove(id, x, y));
    },
    onTouchEnd: (event: GestureResponderEvent) => {
      each(event, 'changed', (id) => controlsRef.current.pointerUp(id));
    },
    onTouchCancel: (event: GestureResponderEvent) => {
      each(event, 'changed', (id) => controlsRef.current.pointerUp(id));
    },
    onStartShouldSetResponder: () => uiRef.current === 'none',
    onMoveShouldSetResponder: () => uiRef.current === 'none',
    onResponderTerminationRequest: () => false,
  };
}

function useBrowserInsets(): { top: number; bottom: number } {
  const [insets, setInsets] = useState({ top: 0, bottom: 0 });
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;left:0;top:0;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);visibility:hidden;pointer-events:none;';
    document.body.appendChild(probe);
    const computed = getComputedStyle(probe);
    setInsets({
      top: Number.parseFloat(computed.paddingTop) || 0,
      bottom: Number.parseFloat(computed.paddingBottom) || 0,
    });
    probe.remove();
  }, []);
  return insets;
}

function useFinePointer(): boolean {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window.matchMedia !== 'function') return;
    setFine(window.matchMedia('(pointer: fine)').matches);
  }, []);
  return fine;
}

const webTouch =
  Platform.OS === 'web'
    ? ({
        touchAction: 'none',
        userSelect: 'none',
      } as const)
    : null;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#070B14',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  playfield: {
    ...StyleSheet.absoluteFill,
  },
});
