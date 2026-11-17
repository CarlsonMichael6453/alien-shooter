import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { paintGame } from '../game/draw';
import type { GameState } from '../game/types';
import { createCanvasPainter } from './canvasPainter';
import type { GameCanvasHandle } from './types';

interface Props {
  width: number;
  height: number;
}

export const GameCanvas = forwardRef<GameCanvasHandle, Props>(function GameCanvas({ width, height }, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
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
    canvasRef.current = canvas;
    return () => {
      canvas.remove();
      canvasRef.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    draw(state: GameState) {
      const canvas = canvasRef.current;
      const { width: cssWidth, height: cssHeight } = sizeRef.current;
      if (!canvas || cssWidth <= 0 || cssHeight <= 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pixelWidth = Math.max(1, Math.round(cssWidth * dpr));
      const pixelHeight = Math.max(1, Math.round(cssHeight * dpr));
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintGame(createCanvasPainter(ctx), state);
    },
  }));

  return <View nativeID="alien-shooter-canvas" pointerEvents="none" style={[styles.host, { width, height }]} />;
});

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
