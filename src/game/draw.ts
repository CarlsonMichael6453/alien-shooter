import { hexPoints } from './abilityArt';
import { shipStyle } from './ships';
import { shipTheme, type ShipTheme } from './shipTheme';
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
  const shake = worldShake(state);
  if (shake.x !== 0 || shake.y !== 0) painter.translate(shake.x, shake.y);

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
  if (state.boss) drawBoss(painter, state.boss, theme.enemy, state.time);

  const pack = shipTheme(state.shipId);
  if (state.bomb) drawBomb(painter, state.bomb, pack);
  if (state.laserTimer > 0) drawLaser(painter, state);
  if (state.blast && state.blast.age <= 1.7) drawBlast(painter, state.blast, pack);

  for (const bullet of state.enemyBullets) {
    painter.fillCircle(bullet.x, bullet.y, bullet.r + 2, 'rgba(255, 120, 60, 0.35)');
    painter.fillCircle(bullet.x, bullet.y, bullet.r * 0.7, '#FFE0B0');
  }
  for (const missile of state.missiles) drawMissile(painter, missile, pack);
  for (const bullet of state.bullets) drawBullet(painter, bullet, pack);

  if (state.wingmanTimer > 0) drawWingmen(painter, state, pack);
  drawShip(painter, state);
  if (state.shieldHits > 0) drawShield(painter, state, pack);
  painter.restore();

  if (state.warpTimer > 0) {
    const veil = pack.look === 'pink' ? 'rgba(255,80,160,0.16)' : pack.look === 'festive' ? 'rgba(80,160,255,0.14)' : pack.look === 'dark' ? 'rgba(40,0,0,0.22)' : 'rgba(70, 120, 255, 0.16)';
    painter.fillRect(0, 0, w, h, veil);
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
  const paint = shipStyle(state.shipId);
  const look = shipTheme(state.shipId).look;
  painter.save();
  painter.translate(state.shipX, state.shipY);
  if (state.laserTimer > 0) painter.rotate(state.laserAngle + Math.PI / 2);
  if (look === 'festive') {
    drawGingerbread(painter, blink);
    painter.restore();
    return;
  }
  if (look === 'dark') {
    drawMenacing(painter, blink, state);
    painter.restore();
    return;
  }
  if (blink) {
    painter.fillCircle(0, 2, 22, 'rgba(126,240,255,0.12)');
  }
  painter.fillEllipse(0, 18, 16, 10, 'rgba(255, 140, 40, 0.35)');
  painter.fillPolygon(
    [
      [-26, 8],
      [-12, 2],
      [-8, 16],
      [-18, 18],
    ],
    paint.wing,
  );
  painter.fillPolygon(
    [
      [26, 8],
      [12, 2],
      [8, 16],
      [18, 18],
    ],
    paint.wing,
  );
  painter.fillPolygon(
    [
      [0, -24],
      [13, 16],
      [0, 10],
      [-13, 16],
    ],
    blink ? 'rgba(217,251,255,0.35)' : paint.hull,
  );
  painter.fillPolygon(
    [
      [0, -16],
      [6, 12],
      [0, 7],
      [-6, 12],
    ],
    blink ? 'rgba(126,240,255,0.35)' : paint.core,
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
  painter.fillCircle(-20, 10, 2.2, paint.accent);
  painter.fillCircle(20, 10, 2.2, paint.accent);
  if (look === 'pink') {
    drawBow(painter, -28, 6, 1);
    drawBow(painter, 28, 6, -1);
  }
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

function drawBow(painter: Painter, x: number, y: number, side: number): void {
  painter.fillCircle(x - side * 4.2, y, 4.6, '#FF4FA3');
  painter.fillCircle(x + side * 4.2, y, 4.6, '#FF7AB8');
  painter.fillCircle(x, y, 2.4, '#FFF0F7');
  painter.fillPolygon(
    [
      [x, y + 1],
      [x - side * 5, y + 8],
      [x - side * 1.5, y + 3],
    ],
    '#FF4FA3',
  );
  painter.fillPolygon(
    [
      [x, y + 1],
      [x + side * 5, y + 8],
      [x + side * 1.5, y + 3],
    ],
    '#FFB3D9',
  );
}

function drawGingerbread(painter: Painter, blink: boolean): void {
  const wall = blink ? 'rgba(196,138,85,0.4)' : '#C48A55';
  const roof = blink ? 'rgba(122,72,40,0.4)' : '#7A4828';
  painter.fillPolygon(
    [
      [0, -28],
      [20, -6],
      [-20, -6],
    ],
    roof,
  );
  painter.fillPolygon(
    [
      [0, -24],
      [14, -8],
      [-14, -8],
    ],
    '#FFF8F0',
  );
  painter.fillRoundRect(-16, -6, 32, 24, 3, wall);
  painter.fillRect(-5, 4, 10, 14, '#6A3018');
  painter.fillRect(-12, -1, 7, 7, '#FFF8F0');
  painter.fillRect(5, -1, 7, 7, '#FFF8F0');
  painter.fillCircle(-10, -16, 2.6, '#E23B3B');
  painter.fillCircle(0, -18, 2.6, '#2F9E4F');
  painter.fillCircle(10, -16, 2.6, '#F0C040');
  painter.fillCircle(-14, 2, 2.2, '#E23B3B');
  painter.fillCircle(14, 2, 2.2, '#2F9E4F');
  painter.fillPolygon(
    [
      [-4, 16],
      [0, 28],
      [4, 16],
    ],
    '#FFE08A',
  );
}

function drawMenacing(painter: Painter, blink: boolean, state: GameState): void {
  const hull = blink ? 'rgba(20,20,24,0.45)' : '#141418';
  painter.fillPolygon(
    [
      [-30, 10],
      [-16, -2],
      [-6, 14],
      [-22, 20],
      [-32, 16],
    ],
    '#0A0A0C',
  );
  painter.fillPolygon(
    [
      [30, 10],
      [16, -2],
      [6, 14],
      [22, 20],
      [32, 16],
    ],
    '#0A0A0C',
  );
  painter.fillPolygon(
    [
      [0, -28],
      [14, 18],
      [0, 8],
      [-14, 18],
    ],
    hull,
  );
  painter.fillPolygon(
    [
      [0, -18],
      [5, 12],
      [0, 4],
      [-5, 12],
    ],
    '#E10600',
  );
  painter.fillRect(-8, -2, 16, 2.2, '#FF2020');
  painter.fillCircle(-22, 12, 1.8, '#E10600');
  painter.fillCircle(22, 12, 1.8, '#E10600');
  const flick = 0.72 + Math.sin(state.time * 42) * 0.28;
  const length = (state.firing ? 24 : 13) * flick;
  painter.fillPolygon(
    [
      [-4, 16],
      [0, 16 + length],
      [4, 16],
    ],
    '#8E0000',
  );
}

function drawBullet(
  painter: Painter,
  bullet: { id: number; x: number; y: number; vx: number; vy: number },
  pack: ShipTheme,
): void {
  const speed = Math.hypot(bullet.vx, bullet.vy) || 1;
  const ux = bullet.vx / speed;
  const uy = bullet.vy / speed;
  const px = -uy;
  const py = ux;
  const color = pack.bullets[Math.abs(bullet.id) % 2];
  painter.fillPolygon(
    [
      [bullet.x + px * 2.2, bullet.y + py * 2.2],
      [bullet.x - px * 2.2, bullet.y - py * 2.2],
      [bullet.x - ux * 14 - px * 1.2, bullet.y - uy * 14 - py * 1.2],
      [bullet.x - ux * 14 + px * 1.2, bullet.y - uy * 14 + py * 1.2],
    ],
    color,
  );
  painter.fillCircle(bullet.x, bullet.y, 9, pack.bulletGlow);
  painter.fillCircle(bullet.x, bullet.y, 4.2, color);
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

export function pickupBob(time: number, spin: number): number {
  return Math.sin(time * 4 + spin) * 2;
}

export function worldShake(state: { time: number; shake: number }): { x: number; y: number } {
  if (state.shake <= 0) return { x: 0, y: 0 };
  return {
    x: Math.sin(state.time * 55) * state.shake * 7,
    y: Math.cos(state.time * 63) * state.shake * 5,
  };
}

function drawPickup(painter: Painter, pickup: Pickup, time: number): void {
  // Ability pickups are the same AbilityGlyph as the HUD slots, placed by ArenaPickups.
  if (pickup.kind !== 'ammo') return;
  painter.save();
  painter.translate(pickup.x, pickup.y);
  const bob = pickupBob(time, pickup.spin);
  painter.translate(0, bob);
  drawAmmoIcon(painter, pickup.amount);
  painter.restore();
}

function drawAmmoIcon(painter: Painter, amount: number): void {
  painter.fillRoundRect(-20, -16, 40, 32, 8, '#12344A');
  painter.strokeCircle(0, 0, 22, 'rgba(126,240,255,0.9)', 2);
  drawDigits(painter, String(amount), 0, 1, 2.3, '#E8FBFF');
}

function drawBomb(painter: Painter, bomb: { x: number; y: number; age: number; pulse: number }, pack: ShipTheme): void {
  const secondsLeft = Math.max(1, 3 - Math.floor(bomb.age));
  const scale = 1 + bomb.pulse * 0.28;
  painter.save();
  painter.translate(bomb.x, bomb.y);
  if (pack.look === 'festive') {
    painter.fillRoundRect(-10, -8, 20, 16, 2, '#C43B3B');
    painter.fillRect(-2, -8, 4, 16, '#FFE08A');
    painter.fillRect(-10, -2, 20, 4, '#FFE08A');
    painter.fillCircle(0, -12, 3, '#2F9E4F');
  } else if (pack.look === 'pink') {
    painter.fillCircle(0, 2, 11 * scale, pack.bomb.body);
    painter.fillCircle(-4, -2, 3.2, '#FF4FA3');
    painter.fillCircle(4, -2, 3.2, '#FFB3D9');
    painter.fillCircle(0, -1, 2, '#FFF0F7');
    painter.fillRect(-1, -14, 2, 10, pack.bomb.fuse);
    painter.fillCircle(0, -15, 2.4, pack.bomb.hot);
  } else if (pack.look === 'dark') {
    painter.fillCircle(0, 2, 11, '#101014');
    painter.strokeCircle(0, 2, 11, '#E10600', 1.6);
    painter.fillRect(-1, -12, 2, 10, '#4A0008');
    painter.fillCircle(0, -13, 2.4, '#FF2020');
  } else {
    painter.fillCircle(0, 0, 16 * scale, 'rgba(255,140,40,0.28)');
    painter.fillCircle(0, 0, 9, pack.bomb.body);
    painter.fillCircle(0, 0, 4, pack.bomb.band);
  }
  drawDigits(painter, String(secondsLeft), 0, 18, 2.1, pack.bomb.band);
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
  pack: ShipTheme,
): void {
  if (pack.look === 'pink') {
    drawGlitter(painter, blast);
    return;
  }
  if (pack.look === 'festive') {
    drawConfetti(painter, blast);
    return;
  }
  if (pack.look === 'dark') {
    drawDarkBlast(painter, blast);
    return;
  }
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

function drawGlitter(painter: Painter, blast: { x: number; y: number; age: number; maxRadius: number }): void {
  const fade = clamp01(1 - blast.age / 1.4);
  for (let i = 0; i < 28; i += 1) {
    const angle = (i / 28) * Math.PI * 2 + blast.age;
    const reach = blast.maxRadius * (0.2 + (i % 5) * 0.14) * clamp01(blast.age / 0.35);
    const color = i % 3 === 0 ? '#FF4FA3' : i % 3 === 1 ? '#FFB3D9' : '#F4E8FF';
    painter.fillCircle(blast.x + Math.cos(angle) * reach, blast.y + Math.sin(angle) * reach, 2 + (i % 4), rgba(color, 0.85 * fade));
  }
  painter.fillCircle(blast.x, blast.y, 18 * fade, rgba('#FFF0F8', 0.7 * fade));
}

function drawConfetti(painter: Painter, blast: { x: number; y: number; age: number; maxRadius: number }): void {
  const fade = clamp01(1 - blast.age / 1.4);
  const colors = ['#E23B3B', '#2F9E4F', '#F0C040', '#FFF8F0', '#7EC8FF'];
  for (let i = 0; i < 26; i += 1) {
    const angle = (i / 26) * Math.PI * 2;
    const reach = blast.maxRadius * (0.25 + (i % 4) * 0.12) * clamp01(blast.age / 0.4);
    painter.save();
    painter.translate(blast.x + Math.cos(angle) * reach, blast.y + Math.sin(angle) * reach);
    painter.rotate(angle + blast.age * 3);
    if (i % 2 === 0) painter.fillRect(-3, -3, 6, 6, rgba(colors[i % colors.length], fade));
    else painter.fillCircle(0, 0, 3.2, rgba('#FFF8F0', fade));
    painter.restore();
  }
}

function drawDarkBlast(painter: Painter, blast: { x: number; y: number; age: number; maxRadius: number }): void {
  const fade = clamp01(1 - blast.age / 1.3);
  const radius = blast.maxRadius * clamp01(blast.age / 0.45);
  painter.fillCircle(blast.x, blast.y, radius * 0.7, rgba('#0A0A0C', 0.55 * fade));
  painter.fillCircle(blast.x, blast.y, radius * 0.28, rgba('#E10600', 0.7 * fade));
  painter.fillCircle(blast.x, blast.y, radius * 0.1, rgba('#FFD0D0', 0.8 * fade));
}

function drawLaser(painter: Painter, state: GameState): void {
  const pack = shipTheme(state.shipId);
  if (pack.look === 'festive') {
    drawCandyCane(painter, state, pack);
    return;
  }
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
  band(15 * flicker, pack.laser.glow);
  band(9 * flicker, pack.laser.body);
  painter.save();
  painter.translate(px * shimmer, py * shimmer);
  band(6.4 * flicker, pack.laser.body, 0.55);
  painter.restore();
  band(3.1 * flicker, pack.laser.core, 0.4);
  band(1.35, pack.laser.hot, 0.28);

  const steps = 9;
  for (let i = 1; i <= steps; i += 1) {
    const along = (i / steps) * Math.min(length, 460);
    const wave = Math.sin(state.time * 22 + i * 1.4) * (2.4 + (i % 3));
    const side = i % 2 === 0 ? 1 : -1;
    const x = nose.x + dx * along + px * wave * side;
    const y = nose.y + dy * along + py * wave * side;
    painter.fillCircle(x, y, 2.4 + (i % 3) * 0.7, i % 2 === 0 ? pack.laser.spark : pack.laser.core);
  }

  painter.fillCircle(nose.x, nose.y, 16 * flicker, pack.laser.glow);
  painter.fillCircle(nose.x, nose.y, 9 * flicker, pack.laser.core);
  painter.fillCircle(nose.x, nose.y, 4.2, pack.laser.hot);

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

function drawEnemy(painter: Painter, enemy: Enemy): void {
  painter.save();
  if (enemy.shape === 'cruiser') drawCruiser(painter, enemy);
  else if (enemy.shape === 'rock') drawRock(painter, enemy);
  else if (enemy.shape === 'dart') drawDart(painter, enemy);
  else if (enemy.shape === 'battleship') drawBattleship(painter, enemy);
  else if (enemy.shape === 'carrier') drawCarrier(painter, enemy);
  else drawSaucer(painter, enemy);
  painter.restore();
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

function drawCandyCane(painter: Painter, state: GameState, pack: ShipTheme): void {
  const nose = beamNose(state);
  const angle = state.laserAngle;
  const length = Math.max(state.width, state.height) * 1.2;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const px = -dy;
  const py = dx;
  const steps = 26;
  for (let i = 0; i < steps; i += 1) {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;
    const side0 = Math.sin(t0 * 16 + state.time * 6) * 8;
    const side1 = Math.sin(t1 * 16 + state.time * 6) * 8;
    const x0 = nose.x + dx * t0 * length + px * side0;
    const y0 = nose.y + dy * t0 * length + py * side0;
    const x1 = nose.x + dx * t1 * length + px * side1;
    const y1 = nose.y + dy * t1 * length + py * side1;
    const color = i % 2 === 0 ? pack.laser.body : pack.laser.core;
    painter.fillPolygon(
      [
        [x0 + px * 3.2, y0 + py * 3.2],
        [x0 - px * 3.2, y0 - py * 3.2],
        [x1 - px * 3.2, y1 - py * 3.2],
        [x1 + px * 3.2, y1 + py * 3.2],
      ],
      color,
    );
  }
  painter.fillCircle(nose.x, nose.y, 7, pack.laser.hot);
}

function drawShield(painter: Painter, state: GameState, pack: ShipTheme): void {
  const flicker = 0.72 + Math.sin(state.time * 8) * 0.18;
  const outer = hexPoints(state.shipX, state.shipY, 42);
  const inner = hexPoints(state.shipX, state.shipY, 33);
  painter.strokePolygon(outer, rgba(pack.shield.neon, 0.34 * flicker), 11);
  painter.strokePolygon(outer, rgba(pack.shield.neon, flicker), 2.6);
  painter.strokePolygon(inner, rgba(pack.shield.hot, 0.92 * flicker), 1.8);
}

function drawWingmen(painter: Painter, state: GameState, pack: ShipTheme): void {
  for (const side of [-1, 1]) {
    const x = state.shipX + side * 36;
    const y = state.shipY + 4;
    if (pack.look === 'festive') {
      painter.fillCircle(x, y + 2, 6, '#F3D2A4');
      painter.fillPolygon(
        [
          [x, y - 12],
          [x + side * 7, y],
          [x - side * 7, y],
        ],
        pack.wingman.trim,
      );
      painter.fillCircle(x, y - 8, 2.2, '#FFF8F0');
      painter.fillCircle(x - 2, y + 1, 0.8, '#1A120C');
      painter.fillCircle(x + 2, y + 1, 0.8, '#1A120C');
      painter.fillRect(x - 3, y + 6, 6, 5, pack.wingman.body);
      continue;
    }
    painter.fillPolygon(
      [
        [x, y - 12],
        [x + side * 8, y + 6],
        [x - side * 4, y + 4],
      ],
      pack.wingman.body,
    );
    painter.fillCircle(x, y + 8, 2.4, pack.wingman.trim);
    if (pack.look === 'pink') drawBow(painter, x, y - 12, side);
  }
}

function drawMissile(painter: Painter, missile: { x: number; y: number; angle: number }, pack: ShipTheme): void {
  const { x, y, angle } = missile;
  for (let i = 5; i >= 1; i -= 1) {
    painter.fillCircle(x - Math.cos(angle) * i * 6, y - Math.sin(angle) * i * 6, 3.4 - i * 0.4, rgba(pack.missile.trail, 0.12 + (6 - i) * 0.08));
  }
  painter.save();
  painter.translate(x, y);
  painter.rotate(angle + Math.PI / 2);
  if (pack.look === 'festive') {
    painter.fillPolygon(
      [
        [0, -12],
        [6, -2],
        [-6, -2],
      ],
      pack.missile.body,
    );
    painter.fillPolygon(
      [
        [0, -7],
        [4.5, 2],
        [-4.5, 2],
      ],
      pack.missile.core,
    );
    painter.fillRect(-1.4, 2, 2.8, 5, '#7A4828');
    painter.fillCircle(0, -10, 1.6, pack.missile.tip);
  } else {
    painter.fillPolygon(
      [
        [0, -10],
        [4.2, 7],
        [-4.2, 7],
      ],
      pack.missile.body,
    );
    painter.fillCircle(0, -6, 2.1, pack.missile.core);
    painter.fillCircle(0, 4, 1.6, pack.missile.tip);
  }
  painter.restore();
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
