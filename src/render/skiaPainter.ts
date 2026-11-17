import { PaintStyle, Skia, TileMode, type SkCanvas } from '@shopify/react-native-skia';
import type { Painter } from './painter';

interface Disposable {
  dispose(): void;
}

export interface SkiaPainter extends Painter {
  dispose(): void;
}

export function createSkiaPainter(canvas: SkCanvas): SkiaPainter {
  const trash: Disposable[] = [];
  const track = <T extends Disposable>(value: T): T => {
    trash.push(value);
    return value;
  };

  const paintOf = (color: string, stroke?: number) => {
    const paint = track(Skia.Paint());
    paint.setAntiAlias(true);
    paint.setColor(Skia.Color(color));
    if (stroke != null) {
      paint.setStyle(PaintStyle.Stroke);
      paint.setStrokeWidth(stroke);
    }
    return paint;
  };

  return {
    save() {
      canvas.save();
    },
    restore() {
      canvas.restore();
    },
    translate(x, y) {
      canvas.translate(x, y);
    },
    rotate(radians) {
      canvas.rotate((radians * 180) / Math.PI, 0, 0);
    },
    fillRect(x, y, w, h, color) {
      canvas.drawRect(Skia.XYWHRect(x, y, w, h), paintOf(color));
    },
    fillCircle(x, y, r, color) {
      canvas.drawCircle(x, y, r, paintOf(color));
    },
    strokeCircle(x, y, r, color, width) {
      canvas.drawCircle(x, y, r, paintOf(color, width));
    },
    fillEllipse(x, y, rx, ry, color) {
      canvas.drawOval(Skia.XYWHRect(x - rx, y - ry, rx * 2, ry * 2), paintOf(color));
    },
    fillPolygon(points, color) {
      if (points.length < 3) return;
      const builder = track(Skia.PathBuilder.Make());
      builder.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i += 1) builder.lineTo(points[i][0], points[i][1]);
      builder.close();
      canvas.drawPath(track(builder.detach()), paintOf(color));
    },
    fillRoundRect(x, y, w, h, radius, color) {
      const r = Math.max(0, Math.min(radius, w / 2, h / 2));
      canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, y, w, h), r, r), paintOf(color));
    },
    fillVerticalGradient(x, y, w, h, colors) {
      if (colors.length === 0 || h === 0) return;
      const paint = paintOf('#000000');
      const shader = track(
        Skia.Shader.MakeLinearGradient(
          Skia.Point(x, y),
          Skia.Point(x, y + h),
          colors.map((color) => Skia.Color(color)),
          null,
          TileMode.Clamp,
        ),
      );
      paint.setShader(shader);
      canvas.drawRect(Skia.XYWHRect(x, y, w, h), paint);
    },
    dispose() {
      for (const item of trash) item.dispose();
      trash.length = 0;
    },
  };
}
