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
import { createGame, ensureTutorialDrop, quitToMenu, resizeGame, step } from '../game/logic';
import { sectorTheme } from '../game/sectors';
import type { GameState } from '../game/types';
import { GameCanvas } from '../render/GameCanvas';
import type { GameCanvasHandle } from '../render/types';
import { bindControls } from '../web/bindControls';
import { installWebGestureLock } from '../web/gestureLock';
import { pulseHaptic } from './haptics';
import { ArenaPickups, type ArenaPickupHandle } from './AbilityGlyph';
import { EMPTY_ENTITLEMENTS, devUnlockAllFromLocation, type Entitlements } from '../game/premium';
import { FRESH_PROFILE, loadProfile, playableShipId, recordRun, saveProfile, selectShip, type Profile } from './profile';
import { Overlay, type HudModel, type UiMode } from './Hud';
import { publishDebug } from './gameDebug';
import { syncAudio } from './syncAudio';
import { nativeTouchProps, useBrowserInsets, useFinePointer } from './screenInput';
import {
  clampLayout,
  defaultLayout,
  elementBounds,
  resetButtonLayout,
  gearRect,
  inventoryRects,
  laserStickRect,
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
import { audio, loadAudio, saveAudio, type AudioSettings } from '../audio/arcade';
import { loadControlScheme, saveControlScheme, type ControlScheme } from './controlsMode';
import { loadRatingMemory, recordDeath, rememberRatingChoice, saveRatingMemory, shouldAskForRating, type RatingMemory } from '../feedback/ratingPrompt';
import {
  FRESH_TUTORIAL,
  TUTORIAL_POWER_DELAY,
  advanceTutorial,
  freshSession,
  loadTutorial,
  sameProgress,
  saveTutorial,
  tutorialGuide,
  type TutorialCue,
  type TutorialProgress,
  type TutorialSession,
} from './tutorial';
import { LASER_HINT_SECONDS, loadLaserHintSeen, saveLaserHintSeen } from './laserHint';
import { LASER_AIM_RADIUS } from '../game/laserAim';

const INITIAL_HUD: HudModel = {
  mode: 'ready',
  score: 0,
  best: 0,
  lives: 3,
  ammo: 200,
  stickX: 0,
  stickY: 0,
  fireHeld: false,
  laserAimX: 0,
  laserAimY: 0,
  laserHint: false,
  shipId: 'classic',
  guideOn: false,
  guideX: 0,
  guideY: 0,
  inventory: [],
  powerOn: false,
  rapidTimer: 0,
  laserTimer: 0,
  hint: null,
  sectorName: 'Deep Space',
  sectorBanner: 0,
  bossHp: 0,
  bossMax: 0,
  shieldTimer: 0,
  wingmanTimer: 0,
  warpTimer: 0,
  missileLeft: 0,
  wave: 1,
};


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
  const pickupsRef = useRef<ArenaPickupHandle>(null);
  const playfieldRef = useRef(playfield);
  const offsetRef = useRef(0);
  const bottomRef = useRef(14);
  const fineRef = useRef(false);
  const pausedRef = useRef(false);
  const startRef = useRef(false);
  const restartRef = useRef(false);
  /** A tap can end before the next frame. Remember it so that frame still shoots once. */
  const triggerPulseRef = useRef(false);
  const hudRef = useRef(INITIAL_HUD);
  const [hud, setHud] = useState<HudModel>(INITIAL_HUD);
  const storeRef = useRef(createAppStore());
  const hudLayoutRef = useRef<HudLayout | null>(null);
  const savedLayoutRef = useRef<HudElement[] | null>(null);
  const loadedRef = useRef(false);
  const laserHintSeenRef = useRef(false);
  const laserHintOnRef = useRef(false);
  const laserHintTimeRef = useRef(0);
  const laserWasOnRef = useRef(false);
  const [layout, setLayout] = useState<HudLayout | null>(null);
  const tutorialRef = useRef<TutorialProgress>(FRESH_TUTORIAL);
  const sessionRef = useRef<TutorialSession>(freshSession());
  const cueRef = useRef<TutorialCue>(null);
  const [cue, setCue] = useState<TutorialCue>(null);
  const uiRef = useRef<UiMode>('none');
  const openUiRef = useRef<(next: UiMode) => void>(() => {});
  const [ui, setUi] = useState<UiMode>('none');
  const [profile, setProfile] = useState<Profile>(FRESH_PROFILE);
  const profileRef = useRef<Profile>(FRESH_PROFILE);
  const [entitlements, setEntitlements] = useState<Entitlements>(EMPTY_ENTITLEMENTS);
  const entitlementsRef = useRef<Entitlements>(EMPTY_ENTITLEMENTS);
  entitlementsRef.current = entitlements;
  const returnRef = useRef<UiMode>('none');
  const [selected, setSelected] = useState<HudElementId>('score');
  const ratingRef = useRef<RatingMemory>({ never: false, lastAskedAt: null, deaths: 0 });
  const ratingLoadedRef = useRef(false);
  const [ratingOffer, setRatingOffer] = useState(false);
  const feedbackBackRef = useRef<UiMode>('settings');
  const offerRatingRef = useRef(() => {});
  const [audioUi, setAudioUi] = useState<AudioSettings>({ music: 0.7, sfx: 0.85, musicOn: true, sfxOn: true, vibrate: true });
  const audioRef = useRef(audioUi);
  audioRef.current = audioUi;
  const [scheme, setScheme] = useState<ControlScheme>('drag');
  const schemeRef = useRef<ControlScheme>('drag');
  const audioPrev = useRef({ shots: 0, score: 0, lives: 3, blast: false, boss: false, pickups: 0, shield: 0, wing: 0, warp: 0, rapid: 0, laser: 0, enemyShots: 0, missileLeft: 0, primed: false });
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
    if (controlsRef.current.frame().firing) triggerPulseRef.current = true;
    if (Platform.OS === 'web') activateKeepAwakeAsync().catch(() => {});
    if (Platform.OS === 'web') audio.unlock();
  };

  useEffect(() => {
    if (Platform.OS === 'web') audio.installUnlock();
    if (Platform.OS === 'web' && devUnlockAllFromLocation(globalThis.location?.search ?? '')) {
      const next = { owned: [], unlockAll: true };
      entitlementsRef.current = next;
      setEntitlements(next);
    }
  }, []);

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
      // On the web, AppState can stay "background" after the tab is visible again and freeze the sim.
      if (Platform.OS === 'web') return;
      pausedRef.current = next !== 'active';
      if (next !== 'active') controlsRef.current.clearTransient();
    };
    const subscription = AppState.addEventListener('change', onAppState);
    const onVisibility = () => {
      pausedRef.current = document.hidden;
      controlsRef.current.clearTransient();
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
      const [progress, saved, rating, audioSettings, savedScheme, savedProfile, laserSeen] = await Promise.all([
        loadTutorial(store),
        loadLayout(store),
        loadRatingMemory(store),
        loadAudio(store),
        loadControlScheme(store),
        loadProfile(store),
        loadLaserHintSeen(store),
      ]);
      if (cancel) return;
      laserHintSeenRef.current = laserSeen;
      tutorialRef.current = progress;
      savedLayoutRef.current = saved;
      ratingRef.current = rating;
      const playable = playableShipId(savedProfile, entitlementsRef.current);
      const ready = playable === savedProfile.shipId ? savedProfile : { ...savedProfile, shipId: playable };
      profileRef.current = ready;
      setProfile(ready);
      if (playable !== savedProfile.shipId) void saveProfile(store, ready);
      if (stateRef.current) {
        stateRef.current.shipId = ready.shipId;
        stateRef.current.best = Math.max(stateRef.current.best, savedProfile.bestScore);
      }
      setAudioUi(audioSettings);
      schemeRef.current = savedScheme;
      setScheme(savedScheme);
      controlsRef.current.setScheme(savedScheme);
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
        stateRef.current.shipId = profileRef.current.shipId;
        stateRef.current.best = Math.max(stateRef.current.best, profileRef.current.bestScore);
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
        controlsRef.current.setScheme(schemeRef.current);
        const playingUi = uiRef.current === 'none';
        const stick = hudLayoutRef.current?.elements.find((element) => element.id === 'joystick');
        const fire = hudLayoutRef.current?.elements.find((element) => element.id === 'fire');
        controlsRef.current.setActionRects(
          playingUi && schemeRef.current === 'joystick' && stick?.visible ? shiftedRect(stick, field, offsetRef.current) : null,
          playingUi && fire?.visible ? shiftedRect(fire, field, offsetRef.current) : null,
        );
        const laserOn = state.mode === 'playing' && state.laserTimer > 0 && playingUi;
        if (laserOn) {
          const aim = laserStickRect(field, hudLayoutRef.current);
          controlsRef.current.setLaserRect({ ...aim, x: aim.x + offsetRef.current });
        } else {
          controlsRef.current.setLaserRect(null);
        }
        const shotsBefore = state.shotsFired;
        const ammoBefore = state.ammo;
        const inventoryBefore = state.inventory.length;
        const modeBefore = state.mode;
        const frozen = pausedRef.current || uiRef.current !== 'none';
        const control = controlsRef.current.frame();
        const triggerPulse = triggerPulseRef.current;
        triggerPulseRef.current = false;
        if (!frozen) {
          const restarting = restartRef.current && state.mode === 'over';
          step(
            state,
            {
              ...control,
              firing: control.firing || triggerPulse,
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
          const aiming = state.laserTimer > 0;
          if (aiming && !laserWasOnRef.current && !laserHintSeenRef.current) {
            laserHintOnRef.current = true;
            laserHintTimeRef.current = 0;
          }
          if (!aiming) laserHintOnRef.current = false;
          if (laserHintOnRef.current && aiming) {
            laserHintTimeRef.current += dt;
            const moved = Math.hypot(control.laserAimX, control.laserAimY) > LASER_AIM_RADIUS * 0.2;
            if (laserHintTimeRef.current >= LASER_HINT_SECONDS || (control.laserAimActive && moved)) {
              laserHintOnRef.current = false;
              laserHintSeenRef.current = true;
              void saveLaserHintSeen(storeRef.current);
            }
          }
          laserWasOnRef.current = aiming;
        } else {
          controlsRef.current.consumePower();
        }
        if (controlsRef.current.consumeChrome()) openUiRef.current('settings');
        if (ratingLoadedRef.current && !frozen && state.lives < audioPrev.current.lives) {
          try {
            pulseHaptic(audioRef.current.vibrate);
          } catch {
            // Haptics never gate the simulation.
          }
        }
        if (ratingLoadedRef.current && !frozen && modeBefore !== 'over' && state.mode === 'over') {
          const now = Date.now();
          const board = recordRun(profileRef.current, state.score, state.wave, now);
          profileRef.current = board;
          setProfile(board);
          void saveProfile(storeRef.current, board);
          if (stateRef.current) stateRef.current.best = Math.max(state.best, board.bestScore);
          const next = recordDeath(ratingRef.current);
          if (shouldAskForRating(next, now)) {
            next.lastAskedAt = now;
            setRatingOffer(true);
          }
          ratingRef.current = next;
          void saveRatingMemory(storeRef.current, next);
        }
        const tutorial = advanceTutorial(tutorialRef.current, sessionRef.current, {
          mode: state.mode,
          dt,
          shipX: state.shipX,
          shipY: state.shipY,
          moveInput: !frozen && (control.moveActive || control.keyX !== 0 || control.keyY !== 0 || control.stickX !== 0 || control.stickY !== 0),
          shotsFired: state.shotsFired,
          shotsBefore,
          ammo: state.ammo,
          ammoBefore,
          inventory: state.inventory.length,
          inventoryBefore,
          frozen,
        });
        let session = tutorial.session;
        if (!frozen && state.mode === 'playing' && tutorial.cue === 'ammo') {
          session = { ...session, ammoDropId: ensureTutorialDrop(state, 'ammo', session.ammoDropId) };
        }
        if (!frozen && state.mode === 'playing' && tutorial.cue === 'pickup' && session.powerDropWait >= TUTORIAL_POWER_DELAY) {
          session = { ...session, powerDropId: ensureTutorialDrop(state, 'power', session.powerDropId) };
        }
        sessionRef.current = session;
        if (!sameProgress(tutorialRef.current, tutorial.progress)) {
          tutorialRef.current = tutorial.progress;
          void saveTutorial(storeRef.current, tutorial.progress);
        }
        if (cueRef.current !== tutorial.cue) {
          cueRef.current = tutorial.cue;
          setCue(tutorial.cue);
        }
        if (Platform.OS === 'web') {
          try {
            syncAudio(state, audioPrev.current, frozen);
          } catch {
            // A Web Audio failure must not stop the frame, or the fire button dies with it.
          }
        }
        canvasRef.current?.draw(state);
        pickupsRef.current?.sync(state);
        const guide = tutorialGuide(state, tutorial.cue);
        publishHud(
          state,
          hudRef,
          setHud,
          fineRef.current,
          schemeRef.current,
          control.stickX,
          control.stickY,
          control.firing,
          control.laserAimX,
          control.laserAimY,
          laserHintOnRef.current && state.laserTimer > 0,
          state.shipId,
          guide,
        );
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
        openPause: () => openUiRef.current('pause'),
        openScores: () => openUiRef.current('scores'),
        openShips: () => openUiRef.current('ships'),
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
  const openUi = (next: UiMode, back?: UiMode) => {
    if (back !== undefined) returnRef.current = back;
    openUiRef.current(next);
  };
  offerRatingRef.current = () => setRatingOffer(true);

  const answerRating = (choice: 'rate' | 'later' | 'never') => {
    const next = rememberRatingChoice(choice, Date.now(), ratingRef.current.deaths);
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
      accessibilityLabel="Alien Shooter. Drag to move. Hold the fire button to shoot."
      style={[styles.root, webTouch as object]}
      {...nativeTouchProps(controlsRef, stateRef, uiRef, () => onPressRef.current())}
    >
      <View pointerEvents="box-none" style={[{ width: playfield.width, height: playfield.height }, webTouch as object]}>
        <View pointerEvents="none" style={[styles.playfield, webTouch as object]}>
          <GameCanvas ref={canvasRef} width={playfield.width} height={playfield.height} />
          <ArenaPickups ref={pickupsRef} />
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
            onOpenSettings={() => openUi('settings', ui === 'pause' ? 'pause' : 'none')}
            onCloseUi={() => {
              const back = ui === 'feedback' ? feedbackBackRef.current : returnRef.current;
              returnRef.current = 'none';
              openUiRef.current(back);
            }}
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
            audio={audioUi}
            onAudio={(patch) => {
              const next = { ...audioUi, ...patch };
              setAudioUi(next);
              void saveAudio(storeRef.current, next);
            }}
            scheme={scheme}
            onScheme={(next) => {
              schemeRef.current = next;
              setScheme(next);
              controlsRef.current.setScheme(next);
              controlsRef.current.clearTransient();
              void saveControlScheme(storeRef.current, next);
            }}
            onEditHud={() => openUiRef.current('editor')}
            onEditButtons={() => openUiRef.current('buttons')}
            onResetButtons={() => {
              if (!hudLayoutRef.current) return;
              commitLayout(resetButtonLayout(hudLayoutRef.current, field), true);
            }}
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
            profile={profile}
            entitlements={entitlements}
            onPlay={() => {
              startRef.current = true;
              if (Platform.OS === 'web') {
                try {
                  audio.unlock();
                } catch {
                  // Starting the audio context must not block Play.
                }
              }
            }}
            onPause={() => openUi('pause', 'none')}
            onResume={() => openUi('none')}
            onQuit={() => {
              const current = stateRef.current;
              if (current) quitToMenu(current);
              controlsRef.current.clearTransient();
              openUi('none');
            }}
            onOpenScores={() => openUi('scores', ui === 'pause' ? 'pause' : 'none')}
            onOpenShips={() => openUi('ships', 'none')}
            onOpenPrivacy={() => openUi('privacy', 'none')}
            closeLabel={returnRef.current === 'pause' ? 'Back' : hud.mode === 'playing' ? 'Resume' : 'Close'}
            onSelectShip={(id) => {
              const next = selectShip(profileRef.current, id, entitlementsRef.current);
              profileRef.current = next;
              setProfile(next);
              if (stateRef.current) stateRef.current.shipId = next.shipId;
              void saveProfile(storeRef.current, next);
            }}
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

function shiftedRect(element: HudElement, field: Field, offsetX: number) {
  const bounds = elementBounds(element, field, 1);
  return { x: bounds.x + offsetX, y: bounds.y, w: bounds.w, h: bounds.h };
}

function publishHud(
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
  const sectorName = sectorTheme(state.sector).name;
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
    Math.abs(prev.shieldTimer - state.shieldTimer) < 0.05 &&
    Math.abs(prev.wingmanTimer - state.wingmanTimer) < 0.05 &&
    Math.abs(prev.warpTimer - state.warpTimer) < 0.05 &&
    prev.missileLeft === state.missileLeft &&
    prev.wave === state.wave &&
    Math.abs(prev.sectorBanner - state.sectorBanner) < 0.05 &&
    prev.sectorName === sectorName &&
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
    sectorBanner: state.sectorBanner,
    bossHp: state.boss?.hp ?? 0,
    bossMax: state.boss?.maxHp ?? 0,
    shieldTimer: state.shieldTimer,
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
