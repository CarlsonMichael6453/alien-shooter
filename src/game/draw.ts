import { beamNose } from './logic';
import { sectorTheme } from './sectors';
import type { Boss, Enemy, GameState, Pickup } from './types';
import type { Painter } from '../render/painter';

export function paintGame(painter: Painter, state: GameState): void {
  const { width: w, height: h } = state;
  const theme = sectorTheme(state.sector);
  painter.fillVerticalGradient(0, 0, w, h, theme.sky);
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
    drawEnemy(painter, enemy, theme.enemy);
    drawHealth(painter, enemy);
  }
  if (state.boss) drawBoss(painter, state.boss, theme.enemy, state.time);

  if (state.bomb) drawBomb(painter, state.bomb);
  if (state.laserTimer > 0) drawLaser(painter, state);
  if (state.blast && state.blast.age <= 1.7) drawBlast(painter, state.blast);

  for (const bullet of state.enemyBullets) {
    painter.fillCircle(bullet.x, bullet.y, bullet.r + 2, 'rgba(255, 120, 60, 0.35)');
    painter.fillCircle(bullet.x, bullet.y, bullet.r * 0.7, '#FFE0B0');
  }
  for (const bullet of state.bullets) drawBullet(painter, bullet);

  if (state.wingmanTimer > 0) drawWingmen(painter, state);
  drawShip(painter, state);
  if (state.shieldHits > 0) drawShield(painter, state);
  painter.restore();

  if (state.warpTimer > 0) {
    painter.fillRect(0, 0, w, h, 'rgba(70, 120, 255, 0.16)');
  }
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
  const theme = sectorTheme(state.sector);
  const dust = (time * 12) % h;
  painter.fillEllipse(w * 0.2, (h * 0.3 + dust * 0.15) % h, w * 0.46, h * 0.18, theme.nebula);
  painter.fillEllipse(w * 0.72, (h * 0.58 + dust * 0.08) % h, w * 0.38, h * 0.14, theme.dust);
  painter.fillEllipse(w * 0.48, h * 0.82, w * 0.55, h * 0.1, 'rgba(255,255,255,0.04)');
  if (state.sector % 5 === 1) {
    painter.fillEllipse(w * 0.3, h * 0.4, 18, 10, 'rgba(160,140,110,0.35)');
    painter.fillEllipse(w * 0.62, h * 0.66, 28, 14, 'rgba(120,100,80,0.4)');
  }
  const planet = state.sector % 5 === 3 ? '#8A4030' : state.sector % 5 === 4 ? '#3E6A48' : '#6E5A48';
  drawPlanet(painter, w * 0.82, h * 0.18, state.sector % 5 === 3 ? 40 : 26, planet, '#2A2018', true);
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
  else if (pickup.kind === 'shield') drawShieldIcon(painter);
  else if (pickup.kind === 'wingman') drawWingmanIcon(painter);
  else if (pickup.kind === 'warp') drawWarpIcon(painter);
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
  painter.fillCircle(0, 0, 20, '#140E0C');
  painter.strokeCircle(0, 0, 20, '#A84820', 1.5);
  drawMushroomCloud(painter, 1, 0);
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

function drawMushroomCloud(painter: Painter, scale: number, time: number): void {
  const sway = Math.sin(time * 6) * 0.6 * scale;
  painter.fillPolygon(
    [
      [-2.4 * scale, 9 * scale],
      [2.2 * scale, 9 * scale],
      [4.4 * scale + sway, -1 * scale],
      [-4.6 * scale + sway, -1 * scale],
    ],
    '#4A382F',
  );
  painter.fillPolygon(
    [
      [-1.1 * scale, 8 * scale],
      [1.2 * scale, 8 * scale],
      [1.8 * scale + sway * 0.4, 0],
      [-1.5 * scale + sway * 0.4, 0],
    ],
    '#E26A28',
  );
  painter.fillEllipse(sway, -1.5 * scale, 10.5 * scale, 3.6 * scale, '#3A241C');
  painter.fillCircle(-6.2 * scale + sway, -4.2 * scale, 5 * scale, '#5C3428');
  painter.fillCircle(6.4 * scale + sway, -3.6 * scale, 4.8 * scale, '#7A3A2A');
  painter.fillCircle(sway * 0.3, -7.2 * scale, 6 * scale, '#C44A22');
  painter.fillCircle(-3.2 * scale + sway, -8.4 * scale, 3.8 * scale, '#E07030');
  painter.fillCircle(3 * scale + sway, -9 * scale, 3.1 * scale, '#F09A48');
  painter.fillEllipse(sway * 0.2, -7 * scale, 2.8 * scale, 1.8 * scale, '#FFE4B0');
  painter.fillCircle(-8 * scale + sway, -6 * scale, 2.1 * scale, 'rgba(28,22,20,0.9)');
  painter.fillCircle(8.2 * scale + sway, -5.2 * scale, 1.8 * scale, 'rgba(46,32,28,0.85)');
}

function drawBlast(
  painter: Painter,
  blast: { x: number; y: number; age: number; maxRadius: number },
): void {
  const age = blast.age;
  const grow = clamp01(age / 0.5);
  const radius = blast.maxRadius * (1 - (1 - grow) * (1 - grow));
  const fade = clamp01(1 - Math.max(0, age - 0.4) / 1.15);
  const flash = clamp01(1 - age / 0.11);
  const ring = blast.maxRadius * Math.min(1.05, age / 0.38);

  painter.strokeCircle(blast.x, blast.y, Math.max(4, ring), rgba('#FFF0D2', 0.7 * clamp01(1 - age / 0.62)), 3.5);
  painter.strokeCircle(blast.x, blast.y, Math.max(2, ring * 0.86), rgba('#FFB060', 0.35 * clamp01(1 - age / 0.5)), 8);

  for (let i = 0; i < 9; i += 1) {
    const angle = (i / 9) * Math.PI * 2 + age * 0.8;
    const wobble = 0.7 + Math.sin(age * 11 + i * 1.7) * 0.22;
    const reach = radius * (0.62 + (i % 3) * 0.08);
    painter.fillCircle(
      blast.x + Math.cos(angle) * reach,
      blast.y + Math.sin(angle) * reach * 0.92,
      radius * (0.28 + (i % 2) * 0.08) * wobble,
      rgba(i % 2 === 0 ? '#241816' : '#5A301C', 0.55 * fade),
    );
  }

  painter.fillCircle(blast.x, blast.y, radius * 0.9, rgba('#B43210', 0.4 * fade));
  painter.fillCircle(blast.x, blast.y, radius * 0.58, rgba('#FF6A18', 0.5 * fade));
  painter.fillCircle(blast.x, blast.y, radius * 0.32, rgba('#FFC56A', 0.62 * fade));
  painter.fillCircle(blast.x, blast.y, radius * 0.14, rgba('#FFF8E8', 0.8 * fade));
  if (flash > 0) painter.fillCircle(blast.x, blast.y, radius * 0.45 + 24, rgba('#FFFFFF', 0.72 * flash));

  if (age > 0.28) {
    const rise = (age - 0.28) * 120;
    painter.save();
    painter.translate(blast.x, blast.y - radius * 0.15 - rise);
    drawMushroomCloud(painter, Math.max(1.8, radius / 56), age);
    painter.restore();
  }
}

function drawLaser(painter: Painter, state: GameState): void {
  const nose = beamNose(state);
  const angle = state.laserAngle;
  const length = Math.max(state.width, state.height) * 1.4;
  const flicker = 0.78 + Math.sin(state.time * 54) * 0.14 + Math.sin(state.time * 97) * 0.08;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const px = -dy;
  const py = dx;
  const tipX = nose.x + dx * length;
  const tipY = nose.y + dy * length;
  const band = (half: number, color: string, pinch = 0.65) => {
    painter.fillPolygon(
      [
        [nose.x + px * half, nose.y + py * half],
        [nose.x - px * half, nose.y - py * half],
        [tipX - px * half * pinch, tipY - py * half * pinch],
        [tipX + px * half * pinch, tipY + py * half * pinch],
      ],
      color,
    );
  };
  const shimmer = Math.sin(state.time * 36) * 1.6;
  band(15 * flicker, 'rgba(255,70,16,0.16)');
  band(9 * flicker, 'rgba(255,52,18,0.55)');
  painter.save();
  painter.translate(px * shimmer, py * shimmer);
  band(6.4 * flicker, 'rgba(255,90,24,0.78)', 0.55);
  painter.restore();
  band(3.1 * flicker, '#FFE7A8', 0.4);
  band(1.35, '#FFFFFF', 0.28);

  const steps = 9;
  for (let i = 1; i <= steps; i += 1) {
    const along = (i / steps) * Math.min(length, 460);
    const wave = Math.sin(state.time * 22 + i * 1.4) * (2.4 + (i % 3));
    const side = i % 2 === 0 ? 1 : -1;
    const x = nose.x + dx * along + px * wave * side;
    const y = nose.y + dy * along + py * wave * side;
    painter.fillCircle(x, y, 2.4 + (i % 3) * 0.7, i % 2 === 0 ? 'rgba(255,120,30,0.75)' : 'rgba(255,220,140,0.55)');
  }

  painter.fillCircle(nose.x, nose.y, 16 * flicker, 'rgba(255,90,20,0.35)');
  painter.fillCircle(nose.x, nose.y, 9 * flicker, 'rgba(255,190,90,0.8)');
  painter.fillCircle(nose.x, nose.y, 4.2, '#FFFFFF');

  for (const enemy of state.enemies) {
    const distance = pointLineDistance(enemy.x, enemy.y, nose.x, nose.y, tipX, tipY);
    if (distance > enemy.r + 10) continue;
    const glow = 0.65 + Math.sin(state.time * 40 + enemy.id) * 0.35;
    painter.fillCircle(enemy.x, enemy.y, enemy.r * 0.55, rgba('#2A120C', 0.45));
    painter.fillCircle(enemy.x, enemy.y, 7 * glow, 'rgba(255,220,150,0.85)');
    painter.fillCircle(enemy.x + px * 6, enemy.y + py * 6, 2.2, '#FFF8E8');
  }
}

function pointLineDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len));
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}

function drawEnemy(painter: Painter, enemy: Enemy, tint: string): void {
  painter.save();
  if (enemy.shape === 'cruiser') drawCruiser(painter, enemy);
  else if (enemy.shape === 'rock') drawRock(painter, enemy);
  else if (enemy.shape === 'dart') drawDart(painter, enemy);
  else if (enemy.shape === 'battleship') drawBattleship(painter, enemy);
  else if (enemy.shape === 'carrier') drawCarrier(painter, enemy);
  else drawSaucer(painter, enemy);
  painter.restore();
  if (enemy.shape !== 'rock') painter.strokeCircle(enemy.x, enemy.y, enemy.r + 2, rgba(tint, 0.35), 1.2);
}

function drawBattleship(painter: Painter, enemy: Enemy): void {
  painter.save();
  painter.translate(enemy.x, enemy.y);
  painter.fillPolygon(
    [
      [-enemy.r, 6],
      [-enemy.r * 0.7, -enemy.r * 0.55],
      [enemy.r * 0.7, -enemy.r * 0.55],
      [enemy.r, 6],
      [enemy.r * 0.45, enemy.r * 0.55],
      [-enemy.r * 0.45, enemy.r * 0.55],
    ],
    '#4A5564',
  );
  painter.fillRoundRect(-enemy.r * 0.35, -enemy.r * 0.28, enemy.r * 0.7, enemy.r * 0.5, 4, '#D8DEE6');
  painter.fillRect(-enemy.r * 0.7, -2, enemy.r * 1.4, 5, '#8A7344');
  painter.fillCircle(0, -enemy.r * 0.05, 5, '#F2D48A');
  painter.restore();
}

function drawCarrier(painter: Painter, enemy: Enemy): void {
  painter.save();
  painter.translate(enemy.x, enemy.y);
  painter.fillRoundRect(-enemy.r, -enemy.r * 0.38, enemy.r * 2, enemy.r * 0.76, 8, '#5C6A78');
  painter.fillRoundRect(-enemy.r * 0.72, -enemy.r * 0.16, enemy.r * 0.7, enemy.r * 0.34, 3, '#1C2430');
  painter.fillRect(-enemy.r * 0.2, -enemy.r * 0.55, enemy.r * 0.28, enemy.r * 0.7, '#C8D2DC');
  painter.fillCircle(enemy.r * 0.45, 0, 4, '#F0C878');
  painter.restore();
}

function drawBoss(painter: Painter, boss: Boss, tint: string, time: number): void {
  painter.save();
  painter.translate(boss.x, boss.y);
  const pulse = 1 + Math.sin(time * 3) * 0.03;
  painter.fillPolygon(
    [
      [-62 * pulse, 10],
      [-40, -34],
      [0, -48],
      [40, -34],
      [62 * pulse, 10],
      [28, 36],
      [-28, 36],
    ],
    '#1B2836',
  );
  painter.fillPolygon(
    [
      [-28, 4],
      [0, -26],
      [28, 4],
      [12, 20],
      [-12, 20],
    ],
    tint,
  );
  painter.fillCircle(0, 0, 8, '#F6FBFF');
  painter.fillCircle(-34, 14, 4, '#FFB089');
  painter.fillCircle(34, 14, 4, '#FFB089');
  painter.restore();
  if (boss.pattern === 1 && boss.beam > 0.25) {
    const angle = Math.PI / 2 + Math.sin(boss.beam) * 1.05;
    const x2 = boss.x + Math.cos(angle) * 900;
    const y2 = boss.y + 20 + Math.sin(angle) * 900;
    painter.fillCircle(boss.x, boss.y + 18, 10, 'rgba(255,70,40,0.8)');
    const steps = 18;
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      painter.fillCircle(boss.x + (x2 - boss.x) * t, boss.y + 20 + (y2 - (boss.y + 20)) * t, 7, 'rgba(255,90,50,0.45)');
    }
  }
}

function drawShield(painter: Painter, state: GameState): void {
  const flicker = 0.45 + Math.sin(state.time * 8) * 0.15;
  painter.strokeCircle(state.shipX, state.shipY, 28, rgba('#9DEBFF', flicker), 3);
  painter.fillCircle(state.shipX - 8, state.shipY - 8, 6, 'rgba(255,255,255,0.18)');
}

function drawWingmen(painter: Painter, state: GameState): void {
  for (const side of [-1, 1]) {
    const x = state.shipX + side * 36;
    const y = state.shipY + 4;
    painter.fillPolygon(
      [
        [x, y - 12],
        [x + side * 8, y + 6],
        [x - side * 4, y + 4],
      ],
      '#D5E7F5',
    );
    painter.fillCircle(x, y + 8, 2.4, '#7EF0FF');
  }
}

function drawShieldIcon(painter: Painter): void {
  painter.fillCircle(0, 0, 20, '#102433');
  painter.strokeCircle(0, 0, 14, 'rgba(157,235,255,0.9)', 3);
  painter.fillCircle(-4, -4, 3, 'rgba(255,255,255,0.55)');
}

function drawWingmanIcon(painter: Painter): void {
  painter.fillCircle(0, 0, 20, '#102033');
  painter.fillPolygon(
    [
      [-8, 6],
      [-2, -10],
      [2, 4],
    ],
    '#E7F3FF',
  );
  painter.fillPolygon(
    [
      [8, 6],
      [2, -10],
      [-2, 4],
    ],
    '#B7D4EA',
  );
}

function drawWarpIcon(painter: Painter): void {
  painter.fillCircle(0, 0, 20, '#161228');
  painter.strokeCircle(0, 0, 13, 'rgba(150, 170, 255, 0.9)', 2);
  painter.fillCircle(0, 0, 4, '#C9D4FF');
  painter.fillRect(-1, -9, 2, 8, '#E4E9FF');
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
  '4': ['101', '101', '111', '001', '001'],
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
