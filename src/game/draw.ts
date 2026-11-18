import { beamNose } from './logic';
import type { Enemy, GameState, Pickup } from './types';
import type { Painter } from '../render/painter';

const BG = ['#03060E', '#0A1022', '#120818', '#070B16'] as const;

export function paintGame(painter: Painter, state: GameState): void {
  const { width: w, height: h } = state;
  painter.fillVerticalGradient(0, 0, w, h, BG);
  drawSpace(painter, state);

  for (const star of state.stars) {
    if (star.speed > 0.045) continue;
    painter.fillCircle(star.x * w, ((star.y * h + state.time * 6) % h), star.size * 0.7, rgba('#9BB0C9', star.alpha * 0.45));
  }
  for (const star of state.stars) {
    if (star.speed <= 0.045) continue;
    painter.fillCircle(
      star.x * w,
      star.y * h,
      star.size,
      rgba(star.warm ? '#FFE0B8' : '#F4FBFF', star.alpha),
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

  for (const pickup of state.pickups) drawPickup(painter, pickup, state.time);

  const ordered = state.enemies.slice().sort((a, b) => b.r - a.r);
  for (const enemy of ordered) {
    drawEnemy(painter, enemy);
    drawHealth(painter, enemy);
  }

  if (state.bomb) drawBomb(painter, state.bomb);
  if (state.laserTimer > 0) drawLaser(painter, state);
  if (state.blast && state.blast.age <= 0.7) drawBlast(painter, state.blast);

  for (const bullet of state.bullets) drawBullet(painter, bullet);

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

function drawSpace(painter: Painter, state: GameState): void {
  const { width: w, height: h, time } = state;
  const dust = (time * 12) % h;
  painter.fillEllipse(w * 0.2, (h * 0.3 + dust * 0.15) % h, w * 0.46, h * 0.18, 'rgba(88, 48, 150, 0.16)');
  painter.fillEllipse(w * 0.72, (h * 0.58 + dust * 0.08) % h, w * 0.38, h * 0.14, 'rgba(150, 50, 90, 0.12)');
  painter.fillEllipse(w * 0.48, h * 0.82, w * 0.55, h * 0.1, 'rgba(30, 70, 140, 0.12)');
  painter.fillEllipse(w * 0.5, h * 0.5, w * 0.9, 18, 'rgba(180, 190, 220, 0.04)');
  drawPlanet(painter, w * 0.82, h * 0.18, 26, '#6E5A48', '#3E3228', true);
  drawPlanet(painter, w * 0.14, h * 0.7, 15, '#31465C', '#1C2A38', false);
}

function drawPlanet(
  painter: Painter,
  x: number,
  y: number,
  radius: number,
  body: string,
  shade: string,
  ring: boolean,
): void {
  if (ring) painter.fillEllipse(x, y, radius * 1.7, radius * 0.28, 'rgba(210, 196, 170, 0.28)');
  painter.fillCircle(x, y, radius, body);
  painter.fillCircle(x - radius * 0.28, y - radius * 0.22, radius * 0.72, shade);
  painter.fillCircle(x - radius * 0.45, y - radius * 0.4, radius * 0.18, 'rgba(255,255,255,0.18)');
}

function drawShip(painter: Painter, state: GameState): void {
  const blink = state.invuln > 0 && Math.sin(state.invuln * 28) < 0;
  painter.save();
  painter.translate(state.shipX, state.shipY);
  if (blink) {
    painter.fillCircle(0, 2, 22, 'rgba(126,240,255,0.12)');
  }
  painter.fillEllipse(0, 18, 16, 10, 'rgba(255, 140, 40, 0.35)');
  painter.fillCircle(0, 4, 22, 'rgba(80, 210, 255, 0.14)');
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
  painter.fillPolygon(
    [
      [-7, 6],
      [-2, 8],
      [-2, 14],
      [-8, 12],
    ],
    '#0E3E66',
  );
  painter.fillPolygon(
    [
      [7, 6],
      [2, 8],
      [2, 14],
      [8, 12],
    ],
    '#0E3E66',
  );
  painter.fillCircle(-20, 10, 2.2, '#7EF0FF');
  painter.fillCircle(20, 10, 2.2, '#7EF0FF');
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

function drawBullet(
  painter: Painter,
  bullet: { x: number; y: number; vx: number; vy: number },
): void {
  const speed = Math.hypot(bullet.vx, bullet.vy) || 1;
  const ux = bullet.vx / speed;
  const uy = bullet.vy / speed;
  const px = -uy;
  const py = ux;
  painter.fillPolygon(
    [
      [bullet.x + px * 2.2, bullet.y + py * 2.2],
      [bullet.x - px * 2.2, bullet.y - py * 2.2],
      [bullet.x - ux * 14 - px * 1.2, bullet.y - uy * 14 - py * 1.2],
      [bullet.x - ux * 14 + px * 1.2, bullet.y - uy * 14 + py * 1.2],
    ],
    '#F4FEFF',
  );
  painter.fillCircle(bullet.x, bullet.y, 9, 'rgba(126,240,255,0.28)');
  painter.fillCircle(bullet.x, bullet.y, 4.2, '#F4FEFF');
}

function drawHealth(painter: Painter, enemy: Enemy): void {
  if (enemy.maxHp <= 1) return;
  const width = Math.max(22, enemy.r * 1.7);
  const x = enemy.x - width / 2;
  const y = enemy.y - enemy.r - 12;
  const ratio = clamp01(enemy.hp / enemy.maxHp);
  painter.fillRoundRect(x, y, width, 5, 2, 'rgba(5,8,16,0.75)');
  const color = ratio > 0.55 ? '#7DFFB2' : ratio > 0.28 ? '#FFD36A' : '#FF5D7A';
  if (ratio > 0) painter.fillRoundRect(x, y, Math.max(3, width * ratio), 5, 2, color);
}

function drawPickup(painter: Painter, pickup: Pickup, time: number): void {
  painter.save();
  painter.translate(pickup.x, pickup.y);
  const bob = Math.sin(time * 4 + pickup.spin) * 2;
  painter.translate(0, bob);
  if (pickup.kind === 'ammo') drawAmmoIcon(painter, pickup.amount);
  else if (pickup.kind === 'rapid') drawRapidIcon(painter);
  else if (pickup.kind === 'bomb') drawMushroomIcon(painter);
  else drawLaserIcon(painter);
  painter.restore();
}

function drawAmmoIcon(painter: Painter, amount: number): void {
  painter.fillRoundRect(-20, -16, 40, 32, 8, '#12344A');
  painter.strokeCircle(0, 0, 22, 'rgba(126,240,255,0.9)', 2);
  drawDigits(painter, String(amount), 0, 1, 2.3, '#E8FBFF');
}

function drawRapidIcon(painter: Painter): void {
  painter.fillCircle(0, 0, 20, '#102033');
  painter.strokeCircle(0, 0, 20, '#D6F6FF', 2);
  for (const tilt of [-0.62, -0.22, 0.22, 0.62]) {
    painter.save();
    painter.rotate(tilt);
    painter.fillRoundRect(-1.3, -17, 2.6, 9, 1.3, '#F4FEFF');
    painter.fillCircle(0, -17, 1.7, '#F4FEFF');
    painter.restore();
  }
}

function drawMushroomIcon(painter: Painter): void {
  painter.fillCircle(0, 0, 20, '#2A160C');
  painter.strokeCircle(0, 0, 20, '#FFB020', 2);
  painter.fillRoundRect(-3, -2, 6, 12, 2, '#F4E2C4');
  painter.fillEllipse(0, -4, 12, 8, '#FF8A3D');
  painter.fillEllipse(-4, -7, 4, 3, '#FFE0A8');
  painter.fillCircle(6, -8, 3.5, 'rgba(255,255,255,0.85)');
}

function drawLaserIcon(painter: Painter): void {
  painter.fillCircle(0, 0, 20, '#2A0C0C');
  painter.strokeCircle(0, 0, 20, '#FF4A2A', 2);
  painter.fillRoundRect(-5, -14, 10, 26, 4, '#FF6A22');
  painter.fillRoundRect(-2.2, -14, 4.4, 26, 2, '#FFE08A');
}

function drawBomb(painter: Painter, bomb: { x: number; y: number; age: number; pulse: number }): void {
  const secondsLeft = Math.max(1, 3 - Math.floor(bomb.age));
  const scale = 1 + bomb.pulse * 0.28;
  painter.save();
  painter.translate(bomb.x, bomb.y);
  painter.fillCircle(0, 0, 16 * scale, 'rgba(255,140,40,0.28)');
  painter.fillCircle(0, 0, 9, '#FFB020');
  painter.fillCircle(0, 0, 4, '#FFF6D8');
  drawDigits(painter, String(secondsLeft), 0, 18, 2.1, '#FFE7B0');
  painter.restore();
}

function drawBlast(
  painter: Painter,
  blast: { x: number; y: number; age: number; maxRadius: number },
): void {
  const t = clamp01(blast.age / 0.55);
  const radius = blast.maxRadius * (1 - (1 - t) * (1 - t));
  const fade = clamp01(1 - Math.max(0, blast.age - 0.35) / 0.3);
  painter.fillCircle(blast.x, blast.y, radius, rgba('#FF6A1A', 0.28 * fade));
  painter.fillCircle(blast.x, blast.y, radius * 0.62, rgba('#FFD36A', 0.45 * fade));
  painter.fillCircle(blast.x, blast.y, radius * 0.28, rgba('#FFF6D8', 0.7 * fade));
  painter.strokeCircle(blast.x, blast.y, Math.max(2, radius), rgba('#FFE7B0', 0.8 * fade), 3);
}

function drawLaser(painter: Painter, state: GameState): void {
  const nose = beamNose(state);
  const angle = state.laserAngle;
  const length = 1500;
  const flicker = 0.82 + Math.sin(state.time * 48) * 0.18;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const px = -dy;
  const py = dx;
  const tipX = nose.x + dx * length;
  const tipY = nose.y + dy * length;
  const band = (half: number, color: string) => {
    painter.fillPolygon(
      [
        [nose.x + px * half, nose.y + py * half],
        [nose.x - px * half, nose.y - py * half],
        [tipX - px * half * 0.7, tipY - py * half * 0.7],
        [tipX + px * half * 0.7, tipY + py * half * 0.7],
      ],
      color,
    );
  };
  band(16 * flicker, 'rgba(255,70,20,0.28)');
  band(9 * flicker, 'rgba(255,48,24,0.8)');
  band(4 * flicker, '#FFD36A');
  painter.fillCircle(nose.x, nose.y, 8 * flicker, '#FFF1C9');
}

function drawEnemy(painter: Painter, enemy: Enemy): void {
  if (enemy.shape === 'cruiser') drawCruiser(painter, enemy);
  else if (enemy.shape === 'rock') drawRock(painter, enemy);
  else if (enemy.shape === 'dart') drawDart(painter, enemy);
  else drawSaucer(painter, enemy);
}

function drawCruiser(painter: Painter, enemy: Enemy): void {
  const { r } = enemy;
  painter.save();
  painter.translate(enemy.x, enemy.y);
  painter.fillEllipse(0, r * 0.35, r * 0.7, r * 0.18, 'rgba(0,0,0,0.3)');
  painter.fillPolygon(
    [
      [0, -r],
      [r * 0.72, -r * 0.15],
      [r * 0.48, r * 0.55],
      [0, r * 0.28],
      [-r * 0.48, r * 0.55],
      [-r * 0.72, -r * 0.15],
    ],
    '#F0B429',
  );
  painter.fillPolygon(
    [
      [0, -r * 0.62],
      [r * 0.32, -r * 0.05],
      [0, r * 0.12],
      [-r * 0.32, -r * 0.05],
    ],
    '#6A3A12',
  );
  painter.fillCircle(-r * 0.22, r * 0.22, r * 0.12, '#FF6A22');
  painter.fillCircle(r * 0.22, r * 0.22, r * 0.12, '#FF6A22');
  painter.fillCircle(0, -r * 0.35, r * 0.1, '#FFF6D8');
  painter.restore();
}

const GLYPHS: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '5': ['111', '100', '111', '001', '111'],
};

function drawDigits(painter: Painter, text: string, x: number, y: number, scale: number, color: string): void {
  const gap = scale;
  const width = text.length * 3 * scale + (text.length - 1) * gap;
  let cursor = x - width / 2;
  for (const char of text) {
    const rows = GLYPHS[char];
    if (!rows) continue;
    rows.forEach((row, rowIndex) => {
      for (let col = 0; col < row.length; col += 1) {
        if (row[col] !== '1') continue;
        painter.fillRect(cursor + col * scale, y - 2.5 * scale + rowIndex * scale, scale * 0.86, scale * 0.86, color);
      }
    });
    cursor += 3 * scale + gap;
  }
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
