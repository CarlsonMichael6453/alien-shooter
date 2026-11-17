import type { Enemy, GameState } from '../game/types';
import type { Painter } from '../render/painter';

const BG = ['#07111F', '#1A0C24', '#10182E'] as const;

export function paintGame(painter: Painter, state: GameState): void {
  const { width: w, height: h } = state;
  painter.fillVerticalGradient(0, 0, w, h, BG);

  painter.fillEllipse(w * 0.22, h * 0.28, w * 0.42, h * 0.16, 'rgba(108,43,217,0.16)');
  painter.fillEllipse(w * 0.78, h * 0.48, w * 0.4, h * 0.14, 'rgba(196,59,120,0.12)');
  painter.fillEllipse(w * 0.48, h * 0.78, w * 0.5, h * 0.12, 'rgba(27,108,255,0.10)');

  for (const star of state.stars) {
    painter.fillCircle(
      star.x * w,
      star.y * h,
      star.size,
      rgba(star.warm ? '#FFD7A8' : '#EAF3FF', star.alpha),
    );
  }

  painter.save();
  if (state.shake > 0) {
    painter.translate(
      Math.sin(state.time * 55) * state.shake * 7,
      Math.cos(state.time * 63) * state.shake * 5,
    );
  }

  for (const particle of state.particles) {
    const alpha = clamp01(particle.life / particle.maxLife);
    painter.fillCircle(particle.x, particle.y, particle.r, rgba(particle.color, alpha));
  }

  const ordered = state.enemies.slice().sort((a, b) => b.r - a.r);
  for (const enemy of ordered) drawEnemy(painter, enemy);

  for (const bullet of state.bullets) {
    painter.fillCircle(bullet.x, bullet.y - 8, 6, 'rgba(126,240,255,0.35)');
    painter.fillRoundRect(bullet.x - 2, bullet.y - 14, 4, 18, 2, '#F4FEFF');
  }

  drawShip(painter, state);
  painter.restore();

  if (state.hitFlash > 0) {
    painter.fillRect(0, 0, w, h, rgba('#FF3355', Math.min(0.38, state.hitFlash)));
  } else if (state.mode === 'playing' && state.lives === 1) {
    const pulse = 0.08 + Math.sin(state.time * 6) * 0.04;
    painter.fillRect(0, 0, w, h, rgba('#FF3355', pulse));
  }

  painter.fillVerticalGradient(0, 0, w, Math.min(140, h * 0.2), [
    'rgba(5,8,16,0.72)',
    'rgba(5,8,16,0)',
  ]);
}

function drawShip(painter: Painter, state: GameState): void {
  const blink = state.invuln > 0 && Math.sin(state.invuln * 28) < 0;
  painter.save();
  painter.translate(state.shipX, state.shipY);
  if (blink) {
    painter.fillCircle(0, 2, 22, 'rgba(126,240,255,0.12)');
  }
  painter.fillCircle(0, 6, 20, 'rgba(46,230,255,0.16)');
  painter.fillPolygon(
    [
      [-26, 8],
      [-12, 2],
      [-8, 16],
      [-18, 18],
    ],
    '#1B6CFF',
  );
  painter.fillPolygon(
    [
      [26, 8],
      [12, 2],
      [8, 16],
      [18, 18],
    ],
    '#1B6CFF',
  );
  painter.fillPolygon(
    [
      [0, -24],
      [13, 16],
      [0, 10],
      [-13, 16],
    ],
    blink ? 'rgba(217,251,255,0.35)' : '#D9FBFF',
  );
  painter.fillPolygon(
    [
      [0, -16],
      [6, 12],
      [0, 7],
      [-6, 12],
    ],
    blink ? 'rgba(126,240,255,0.35)' : '#7EF0FF',
  );
  painter.fillCircle(0, -2, 4.2, '#072033');
  painter.fillCircle(-1.2, -3.4, 1.5, 'rgba(184,246,255,0.95)');

  const flick = 0.72 + Math.sin(state.time * 42) * 0.28;
  const length = (state.firing ? 24 : 13) * flick;
  painter.fillPolygon(
    [
      [-5, 14],
      [0, 14 + length],
      [5, 14],
    ],
    state.firing ? '#FFD36A' : '#FF8A3D',
  );
  painter.fillPolygon(
    [
      [-2.4, 14],
      [0, 14 + length * 0.62],
      [2.4, 14],
    ],
    '#FFF6D8',
  );
  if (state.muzzle > 0) {
    painter.fillCircle(0, -26, 8, 'rgba(231,251,255,0.85)');
  }
  if (state.invuln > 0) {
    painter.strokeCircle(0, 0, 30, 'rgba(154,246,255,0.75)', 1.5);
  }
  painter.restore();
}

function drawEnemy(painter: Painter, enemy: Enemy): void {
  if (enemy.shape === 'rock') drawRock(painter, enemy);
  else if (enemy.shape === 'dart') drawDart(painter, enemy);
  else drawSaucer(painter, enemy);
}

function drawSaucer(painter: Painter, enemy: Enemy): void {
  const { r } = enemy;
  const body = enemy.tint < 0.34 ? '#FF4F9A' : enemy.tint < 0.67 ? '#B06CFF' : '#3DDC97';
  const rim = enemy.tint < 0.34 ? '#FFD0E6' : enemy.tint < 0.67 ? '#E4D4FF' : '#D8FFE8';
  painter.save();
  painter.translate(enemy.x, enemy.y);
  painter.fillEllipse(0, r * 0.42, r * 0.72, r * 0.16, 'rgba(0,0,0,0.28)');
  painter.fillEllipse(0, -r * 0.28, r * 0.4, r * 0.34, '#F7FBFF');
  painter.fillEllipse(0, -r * 0.36, r * 0.18, r * 0.12, 'rgba(255,255,255,0.8)');
  painter.fillEllipse(0, r * 0.02, r, r * 0.38, body);
  painter.fillEllipse(0, r * 0.12, r * 0.7, r * 0.14, rim);
  for (const side of [-0.46, 0, 0.46]) {
    painter.fillCircle(side * r, r * 0.06, Math.max(1.5, r * 0.075), '#FFF6C8');
  }
  painter.restore();
}

function drawDart(painter: Painter, enemy: Enemy): void {
  const { r } = enemy;
  const body = enemy.tint < 0.5 ? '#FF5D8F' : '#7AA2FF';
  painter.save();
  painter.translate(enemy.x, enemy.y);
  painter.rotate(Math.sin(enemy.phase + enemy.y * 0.01) * 0.18);
  painter.fillPolygon(
    [
      [0, r],
      [-r * 0.9, -r * 0.62],
      [0, -r * 0.12],
      [r * 0.9, -r * 0.62],
    ],
    body,
  );
  painter.fillPolygon(
    [
      [0, r * 0.72],
      [-r * 0.28, -r * 0.2],
      [0, -r * 0.02],
      [r * 0.28, -r * 0.2],
    ],
    '#F4FBFF',
  );
  painter.fillCircle(0, r * 0.15, r * 0.14, '#1B2436');
  painter.restore();
}

function drawRock(painter: Painter, enemy: Enemy): void {
  const body = enemy.tint < 0.5 ? '#A39886' : '#7E8C96';
  const pit = enemy.tint < 0.5 ? '#6E6558' : '#556068';
  painter.save();
  painter.translate(enemy.x, enemy.y);
  painter.rotate(enemy.rot);
  painter.fillPolygon(rockPoints(enemy.id, enemy.r), body);
  painter.fillCircle(-enemy.r * 0.22, -enemy.r * 0.08, enemy.r * 0.2, pit);
  painter.fillCircle(enemy.r * 0.24, enemy.r * 0.16, enemy.r * 0.12, pit);
  painter.restore();
}

function rockPoints(id: number, radius: number): Array<[number, number]> {
  const count = 7 + (Math.abs(id) % 3);
  const points: Array<[number, number]> = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    const jag = 0.74 + ((Math.imul(id + 3, i + 5) >>> 0) % 26) / 100;
    points.push([Math.cos(angle) * radius * jag, Math.sin(angle) * radius * jag]);
  }
  return points;
}

function rgba(hex: string, alpha: number): string {
  const value = hex.startsWith('#') ? hex : '#FFFFFF';
  const n = Number.parseInt(value.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${clamp01(alpha)})`;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
