import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Canvas, Picture, Skia, type SkPicture } from '@shopify/react-native-skia';
import { paintGame } from '../game/draw';
import type { GameState } from '../game/types';
import { createSkiaPainter } from './skiaPainter';
import type { GameCanvasHandle } from './types';

interface Props {
  width: number;
  height: number;
}

export const GameCanvas = forwardRef<GameCanvasHandle, Props>(function GameCanvas({ width, height }, ref) {
  const [picture, setPicture] = useState<SkPicture | null>(null);
  const held = useRef<SkPicture[]>([]);

  useImperativeHandle(
    ref,
    () => ({
      draw(state: GameState) {
        if (width <= 0 || height <= 0) return;
        const recorder = Skia.PictureRecorder();
        const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));
        const painter = createSkiaPainter(canvas);
        paintGame(painter, state);
        const next = recorder.finishRecordingAsPicture();
        painter.dispose();
        held.current.push(next);
        if (held.current.length > 2) held.current.shift()?.dispose();
        setPicture(next);
      },
    }),
    [width, height],
  );

  useEffect(() => {
    const pictures = held.current;
    return () => {
      for (const item of pictures) item.dispose();
      pictures.length = 0;
    };
  }, []);

  return (
    <Canvas style={{ width, height }} opaque>
      {picture ? <Picture picture={picture} /> : null}
    </Canvas>
  );
});
