import { useEffect, useState } from 'react';
import { Platform, type GestureResponderEvent } from 'react-native';
import type { Controls } from '../game/controls';
import type { GameState } from '../game/types';
import type { UiMode } from './Hud';

export function nativeTouchProps(
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

export function useBrowserInsets(): { top: number; bottom: number } {
  const [insets, setInsets] = useState({ top: 0, bottom: 0 });
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const read = () => {
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
    };
    read();
    const frame = requestAnimationFrame(read);
    window.visualViewport?.addEventListener('resize', read);
    window.addEventListener('resize', read);
    return () => {
      cancelAnimationFrame(frame);
      window.visualViewport?.removeEventListener('resize', read);
      window.removeEventListener('resize', read);
    };
  }, []);
  return insets;
}

export function useFinePointer(): boolean {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window.matchMedia !== 'function') return;
    setFine(window.matchMedia('(pointer: fine)').matches);
  }, []);
  return fine;
}
