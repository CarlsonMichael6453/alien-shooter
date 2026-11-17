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
import { Overlay, type HudModel } from './Hud';

const INITIAL_HUD: HudModel = { mode: 'ready', score: 0, best: 0, lives: 3, hint: false };

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
  firing: boolean;
  moveId: number | null;
  fireId: number | null;
  width: number;
  height: number;
}

declare global {
  interface Window {
    __ALIEN__?: { snapshot: () => DebugSnapshot };
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
  const layoutRef = useRef(playfield);
  const pausedRef = useRef(false);
  const startRef = useRef(false);
  const restartRef = useRef(false);
  const hudRef = useRef(INITIAL_HUD);
  const [hud, setHud] = useState<HudModel>(INITIAL_HUD);
  layoutRef.current = playfield;

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
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const { width, height } = layoutRef.current;
      if (!stateRef.current && width > 0 && height > 0) {
        stateRef.current = createGame(width, height);
      }
      const state = stateRef.current;
      if (state && width > 0 && height > 0) {
        if (state.width !== width || state.height !== height) {
          resizeGame(state, width, height);
          controlsRef.current.reanchor(state.shipX, state.shipY);
        }
        if (!pausedRef.current) {
          const control = controlsRef.current.frame();
          const restarting = restartRef.current && state.mode === 'over';
          step(
            state,
            {
              ...control,
              moveActive: restarting ? false : control.moveActive,
              start: startRef.current,
              restart: restartRef.current,
            },
            dt,
          );
          startRef.current = false;
          restartRef.current = false;
          if (restarting) controlsRef.current.reanchor(state.shipX, state.shipY);
        }
        canvasRef.current?.draw(state);
        publishHud(state, hudRef, setHud);
        publishDebug(state, controlsRef.current);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  const top = Math.max(insets.top, browserInsets.top, 14);
  const bottom = Math.max(insets.bottom, browserInsets.bottom, 14);

  return (
    <View
      nativeID="alien-shooter-root"
      collapsable={false}
      accessibilityLabel="Alien Shooter. Drag one finger to move the ship. Hold a second finger anywhere to fire."
      style={[styles.root, webTouch as object]}
      {...nativeTouchProps(controlsRef, stateRef, () => onPressRef.current())}
    >
      <View pointerEvents="none" style={{ width: playfield.width, height: playfield.height }}>
        <GameCanvas ref={canvasRef} width={playfield.width} height={playfield.height} />
        <Overlay model={hud} top={top} bottom={bottom} finePointer={finePointer} />
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
): void {
  const hint = state.mode === 'playing' && state.shotsFired === 0 && state.time < 8;
  const prev = hudRef.current;
  if (
    prev.mode === state.mode &&
    prev.score === state.score &&
    prev.lives === state.lives &&
    prev.best === state.best &&
    prev.hint === hint
  ) {
    return;
  }
  const next = { mode: state.mode, score: state.score, lives: state.lives, best: state.best, hint };
  hudRef.current = next;
  setHud(next);
}

function publishDebug(state: GameState, controls: Controls): void {
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
      firing: controls.frame().firing,
      moveId: controls.moveId,
      fireId: controls.fireId,
      width: state.width,
      height: state.height,
    }),
  };
}

function debugEnabled(): boolean {
  return new URLSearchParams(window.location.search).get('debug') === '1';
}

function nativeTouchProps(
  controlsRef: { current: Controls },
  stateRef: { current: GameState | null },
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
      const state = stateRef.current;
      if (!state) return;
      each(event, 'changed', (id, x, y) => controlsRef.current.pointerDown(id, x, y, state.shipX, state.shipY));
      onPress();
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
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
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
});
