import type { Painter } from './painter';

export function createCanvasPainter(ctx: CanvasRenderingContext2D): Painter {
  return {
    save() {
      ctx.save();
    },
    restore() {
      ctx.restore();
    },
    translate(x, y) {
      ctx.translate(x, y);
    },
    rotate(radians) {
      ctx.rotate(radians);
    },
    fillRect(x, y, w, h, color) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    },
    fillCircle(x, y, r, color) {
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    },
    strokeCircle(x, y, r, color, width) {
      ctx.beginPath();
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    },
    fillEllipse(x, y, rx, ry, color) {
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, Math.PI * 2);
      ctx.fill();
    },
    fillPolygon(points, color) {
      if (points.length < 3) return;
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
      ctx.closePath();
      ctx.fill();
    },
    fillRoundRect(x, y, w, h, radius, color) {
      const r = Math.max(0, Math.min(radius, w / 2, h / 2));
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
    },
    fillVerticalGradient(x, y, w, h, colors) {
      if (colors.length === 0 || h === 0) return;
      const gradient = ctx.createLinearGradient(x, y, x, y + h);
      colors.forEach((color, index) => {
        gradient.addColorStop(colors.length === 1 ? 0 : index / (colors.length - 1), color);
      });
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, w, h);
    },
  };
}
