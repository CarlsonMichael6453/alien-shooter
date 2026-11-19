import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import type { GameState } from '../game/types';
import { createComicView } from './comic3d';
import type { GameCanvasHandle } from './types';

interface Props {
  width: number;
  height: number;
}

export const GameCanvas = forwardRef<GameCanvasHandle, Props>(function GameCanvas({ width, height }, ref) {
  const viewRef = useRef<ReturnType<typeof createComicView> | null>(null);
  const sizeRef = useRef({ width, height });
  sizeRef.current = { width, height };

  useEffect(() => {
    const host = document.getElementById('alien-shooter-canvas');
    if (!host) return;
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.touchAction = 'none';
    canvas.style.pointerEvents = 'none';
    host.replaceChildren(canvas);
    viewRef.current = createComicView(canvas);
    return () => {
      viewRef.current = null;
      canvas.remove();
    };
  }, []);

  useImperativeHandle(ref, () => ({
    draw(state: GameState) {
      const view = viewRef.current;
      const { width: cssWidth, height: cssHeight } = sizeRef.current;
      if (!view || cssWidth <= 0 || cssHeight <= 0) return;
      view.resize(cssWidth, cssHeight);
      view.render(state);
    },
  }));

  return <View nativeID="alien-shooter-canvas" pointerEvents="none" style={[styles.host, { width, height }]} />;
});

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    top: 0,
    backgroundColor: '#1a1612',
    borderWidth: 3,
    borderColor: '#120e0c',
    overflow: 'hidden',
  },
});
