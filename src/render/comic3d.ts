import * as THREE from 'three';
import { audio } from '../audio/arcade';
import { sectorTheme } from '../game/sectors';
import type { Enemy, GameState } from '../game/types';

const LANE_DEPTH = 46;
const LANE_WIDTH = 14;
const LOOK_LIMIT = 0.32;

export function worldOf(width: number, height: number, x: number, y: number, lift = 0): THREE.Vector3 {
  const wx = (x / Math.max(1, width) - 0.5) * LANE_WIDTH;
  const wz = -((height - y) / Math.max(1, height)) * LANE_DEPTH;
  return new THREE.Vector3(wx, lift, wz);
}

function rampTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ['#1a1a1a', '#5c5c5c', '#d0d0d0', '#ffffff'].forEach((color, index) => {
      ctx.fillStyle = color;
      ctx.fillRect(index, 0, 1, 1);
    });
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

function wordTexture(text: string, fill: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 256, 128);
    ctx.font = '900 78px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#111111';
    ctx.strokeText(text, 128, 68);
    ctx.fillStyle = fill;
    ctx.fillText(text, 128, 68);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

interface Slot {
  group: THREE.Group;
  body: THREE.Mesh;
  ink: THREE.Mesh;
}

interface Word {
  sprite: THREE.Sprite;
  age: number;
}

export function createComicView(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x120818, 1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x120818, 18, 52);
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 80);
  const ramp = rampTexture();
  const inkMat = new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.BackSide });
  const colors = new Map<string, THREE.MeshToonMaterial>();
  const toon = (color: string) => {
    let material = colors.get(color);
    if (!material) {
      material = new THREE.MeshToonMaterial({ color, gradientMap: ramp });
      colors.set(color, material);
    }
    return material;
  };

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sun = new THREE.DirectionalLight(0xfff1d2, 1.35);
  sun.position.set(4, 10, 6);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x88ccff, 0.45);
  rim.position.set(-6, 4, -4);
  scene.add(rim);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(18, 70), toon('#243044'));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -18);
  const groundInk = new THREE.Mesh(ground.geometry, inkMat);
  groundInk.scale.setScalar(1.02);
  ground.add(groundInk);
  scene.add(ground);

  const laneMarks: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i += 1) {
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 1.4), toon('#f4fbff'));
    mark.position.set(i % 2 === 0 ? -1.2 : 1.2, 0.03, -4 - i * 5);
    scene.add(mark);
    laneMarks.push(mark);
  }

  const geos: Record<string, THREE.BufferGeometry> = {
    dart: new THREE.ConeGeometry(0.45, 1.3, 5),
    saucer: new THREE.SphereGeometry(0.7, 8, 6),
    cruiser: new THREE.BoxGeometry(1.5, 0.45, 0.9),
    rock: new THREE.DodecahedronGeometry(0.7, 0),
    battleship: new THREE.BoxGeometry(2.1, 0.55, 1.15),
    carrier: new THREE.BoxGeometry(2.2, 0.4, 1.3),
    bullet: new THREE.BoxGeometry(0.16, 0.16, 0.45),
    shot: new THREE.SphereGeometry(0.14, 6, 5),
  };

  const makeSlot = (): Slot => {
    const body = new THREE.Mesh(geos.saucer, toon('#ffffff'));
    const ink = new THREE.Mesh(geos.saucer, inkMat);
    ink.scale.setScalar(1.12);
    const group = new THREE.Group();
    group.add(ink, body);
    group.visible = false;
    scene.add(group);
    return { group, body, ink };
  };

  const enemies = Array.from({ length: 18 }, makeSlot);
  const bullets = Array.from({ length: 40 }, () => {
    const mesh = new THREE.Mesh(geos.bullet, toon('#fff4c8'));
    mesh.visible = false;
    scene.add(mesh);
    return mesh;
  });
  const enemyShots = Array.from({ length: 28 }, () => {
    const mesh = new THREE.Mesh(geos.shot, toon('#ffb15a'));
    mesh.visible = false;
    scene.add(mesh);
    return mesh;
  });
  const pickups = Array.from({ length: 8 }, makeSlot);
  const bursts = Array.from({ length: 20 }, () => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 5), toon('#ffe08a'));
    mesh.visible = false;
    scene.add(mesh);
    return mesh;
  });

  const ship = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.5, 6), toon('#7ee7ff'));
  hull.rotation.x = Math.PI / 2;
  const hullInk = new THREE.Mesh(hull.geometry, inkMat);
  hullInk.scale.setScalar(1.14);
  hullInk.rotation.x = Math.PI / 2;
  const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.35), toon('#ff5a3a'));
  wingL.position.set(-0.55, 0, 0.15);
  const wingR = wingL.clone();
  wingR.position.x = 0.55;
  ship.add(hullInk, hull, wingL, wingR);
  scene.add(ship);

  const shield = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 10, 8),
    new THREE.MeshToonMaterial({ color: '#9debff', gradientMap: ramp, transparent: true, opacity: 0.35 }),
  );
  shield.visible = false;
  scene.add(shield);

  const wingmen: THREE.Mesh[] = [-1, 1].map((side) => {
    const drone = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.55, 5), toon('#e7f3ff'));
    drone.rotation.x = Math.PI / 2;
    const ink = new THREE.Mesh(drone.geometry, inkMat);
    ink.scale.setScalar(1.15);
    drone.add(ink);
    drone.visible = false;
    drone.userData.side = side;
    scene.add(drone);
    return drone;
  });

  const laser = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 8), toon('#ff4a2a'));
  laser.visible = false;
  scene.add(laser);

  const boss = new THREE.Group();
  const bossBody = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 1.6), toon('#1b2836'));
  const bossInk = new THREE.Mesh(bossBody.geometry, inkMat);
  bossInk.scale.setScalar(1.08);
  const bossCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), toon('#f0c8ff'));
  boss.add(bossInk, bossBody, bossCore);
  boss.visible = false;
  scene.add(boss);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 12), toon('#ff5a32'));
  beam.visible = false;
  scene.add(beam);

  const words: Word[] = ['BOOM!', 'ZAP!', 'KRAK!'].flatMap((text) => {
    const fill = text === 'BOOM!' ? '#ffd23a' : text === 'ZAP!' ? '#7ef0ff' : '#ff5a3a';
    return [0, 1].map(() => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: wordTexture(text, fill), transparent: true, depthWrite: false }));
      sprite.userData.word = text;
      sprite.visible = false;
      sprite.scale.set(3.2, 1.6, 1);
      scene.add(sprite);
      return { sprite, age: 10 };
    });
  });

  let primed = false;
  let prev = { shots: 0, score: 0, lives: 3, blast: false, boss: false, pickups: 0, shield: 0, wing: 0, warp: 0, rapid: 0, laser: 0, enemyShots: 0 };

  const place = (object: THREE.Object3D, width: number, height: number, x: number, y: number, lift: number) => {
    const point = worldOf(width, height, x, y, lift);
    object.position.copy(point);
    point.y = 0;
  };

  const shout = (text: 'BOOM!' | 'ZAP!' | 'KRAK!', at: THREE.Vector3) => {
    const free = words.find((item) => !item.sprite.visible && item.sprite.userData.word === text) ?? words.find((item) => item.sprite.userData.word === text);
    if (!free) return;
    free.sprite.position.copy(at);
    free.sprite.position.y += 1.2;
    free.sprite.visible = true;
    free.age = 0;
  };

  const showShape = (slot: Slot, shape: string, color: string, scale: number) => {
    const geo = geos[shape] ?? geos.saucer;
    slot.body.geometry = geo;
    slot.ink.geometry = geo;
    slot.body.material = toon(color);
    slot.group.scale.setScalar(scale);
    slot.group.visible = true;
  };

  return {
    resize(width: number, height: number) {
      if (width <= 0 || height <= 0) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },
    render(state: GameState) {
      const theme = sectorTheme(state.sector);
      renderer.setClearColor(theme.sky[0]);
      scene.fog = new THREE.Fog(new THREE.Color(theme.sky[1]), state.warpTimer > 0 ? 12 : 18, state.warpTimer > 0 ? 40 : 54);
      (ground.material as THREE.MeshToonMaterial).color.set(theme.sky[2]);
      const shipPoint = worldOf(state.width, state.height, state.shipX, state.shipY, 0.75);
      ship.position.copy(shipPoint);
      ship.visible = state.mode !== 'ready' || true;
      const aim = state.laserTimer > 0 ? state.laserAngle + Math.PI / 2 : (state.shipX / Math.max(1, state.width) - 0.5) * 0.7;
      const yaw = THREE.MathUtils.clamp(aim, -LOOK_LIMIT, LOOK_LIMIT);
      const pitch = THREE.MathUtils.clamp((state.shipY / Math.max(1, state.height) - 0.72) * -0.5, -0.25, 0.22);
      camera.position.set(shipPoint.x * 0.35 + Math.sin(yaw) * 0.8, 6.2, shipPoint.z + 8.4);
      camera.lookAt(shipPoint.x + Math.sin(yaw) * 3.5, 1.15 + pitch, shipPoint.z - 15);

      shield.position.copy(shipPoint);
      shield.visible = state.shieldHits > 0;
      wingmen.forEach((drone) => {
        const side = drone.userData.side as number;
        drone.visible = state.wingmanTimer > 0;
        drone.position.set(shipPoint.x + side * 1.15, shipPoint.y, shipPoint.z + 0.2);
      });
      laser.visible = state.laserTimer > 0;
      if (state.laserTimer > 0) {
        const dirX = Math.cos(state.laserAngle);
        const dirZ = Math.sin(state.laserAngle);
        laser.position.set(shipPoint.x + dirX * 2.2, shipPoint.y, shipPoint.z + dirZ * 4);
        laser.lookAt(shipPoint.x + dirX * 8, shipPoint.y, shipPoint.z + dirZ * 12);
      }

      enemies.forEach((slot) => {
        slot.group.visible = false;
      });
      state.enemies.slice(0, enemies.length).forEach((enemy, index) => {
        const slot = enemies[index];
        const color = colorFor(enemy, theme.enemy);
        showShape(slot, enemy.shape, color, Math.max(0.45, enemy.r / 24));
        place(slot.group, state.width, state.height, enemy.x, enemy.y, 0.35 * (enemy.r / 24));
      });

      bullets.forEach((mesh) => {
        mesh.visible = false;
      });
      state.bullets.slice(0, bullets.length).forEach((bullet, index) => {
        const mesh = bullets[index];
        mesh.visible = true;
        const point = worldOf(state.width, state.height, bullet.x, bullet.y, 0.6);
        mesh.position.copy(point);
      });
      enemyShots.forEach((mesh) => {
        mesh.visible = false;
      });
      state.enemyBullets.slice(0, enemyShots.length).forEach((bullet, index) => {
        const mesh = enemyShots[index];
        mesh.visible = true;
        mesh.position.copy(worldOf(state.width, state.height, bullet.x, bullet.y, 0.55));
      });

      pickups.forEach((slot) => {
        slot.group.visible = false;
      });
      state.pickups.slice(0, pickups.length).forEach((pickup, index) => {
        const slot = pickups[index];
        showShape(slot, 'saucer', pickupColor(pickup.kind), 0.7);
        place(slot.group, state.width, state.height, pickup.x, pickup.y, 0.55);
        slot.group.rotation.y = state.time * 2 + pickup.spin;
      });

      bursts.forEach((mesh) => {
        mesh.visible = false;
      });
      state.particles.slice(0, bursts.length).forEach((particle, index) => {
        const mesh = bursts[index];
        mesh.visible = true;
        mesh.material = toon(particle.color);
        mesh.position.copy(worldOf(state.width, state.height, particle.x, particle.y, 0.5 + particle.r * 0.02));
        mesh.scale.setScalar(Math.max(0.15, particle.r / 8));
      });

      if (state.boss) {
        boss.visible = true;
        boss.position.copy(worldOf(state.width, state.height, state.boss.x, state.boss.y, 0.8));
        bossBody.material = toon('#243246');
        bossCore.material = toon(theme.enemy);
        beam.visible = state.boss.pattern === 1 && state.boss.beam > 0.25;
        if (beam.visible) {
          const angle = Math.PI / 2 + Math.sin(state.boss.beam) * 1.05;
          const from = worldOf(state.width, state.height, state.boss.x, state.boss.y + 30, 0.7);
          const toward = worldOf(
            state.width,
            state.height,
            state.boss.x + Math.cos(angle) * 180,
            state.boss.y + 30 + Math.sin(angle) * 180,
            0.7,
          );
          beam.position.copy(from.clone().lerp(toward, 0.45));
          beam.lookAt(toward);
        }
      } else {
        boss.visible = false;
        beam.visible = false;
      }

      words.forEach((word) => {
        if (!word.sprite.visible) return;
        word.age += 0.016;
        word.sprite.position.y += 0.02;
        const material = word.sprite.material as THREE.SpriteMaterial;
        material.opacity = Math.max(0, 1 - word.age / 0.7);
        if (word.age > 0.7) word.sprite.visible = false;
      });

      if (primed) {
        if (state.shotsFired > prev.shots) {
          audio.shoot();
          if (state.laserTimer > 0) shout('ZAP!', shipPoint.clone());
        }
        if (state.score > prev.score) {
          audio.hit();
          if (state.score - prev.score >= 200) shout('KRAK!', shipPoint.clone().setZ(shipPoint.z - 6));
        }
        if (state.lives < prev.lives) audio.explosion();
        if (state.blast && !prev.blast) {
          audio.explosion();
          shout('BOOM!', worldOf(state.width, state.height, state.blast.x, state.blast.y, 1.4));
        }
        if (state.boss && !prev.boss) audio.bossIntro();
        if (!state.boss && prev.boss) {
          audio.bossWin();
          shout('BOOM!', shipPoint.clone());
        }
        if (state.enemyBullets.length > prev.enemyShots + 2) audio.bossAttack();
        if (state.pickups.length < prev.pickups) audio.pickup();
        if (state.shieldTimer > 0 && prev.shield === 0) audio.power('shield');
        if (state.wingmanTimer > 0 && prev.wing === 0) audio.power('wingman');
        if (state.warpTimer > 0 && prev.warp === 0) audio.power('warp');
        if (state.rapidTimer > 0 && prev.rapid === 0) audio.power('rapid');
        if (state.laserTimer > 0 && prev.laser === 0) audio.power('laser');
      }
      primed = true;
      prev = {
        shots: state.shotsFired,
        score: state.score,
        lives: state.lives,
        blast: state.blast != null,
        boss: state.boss != null,
        pickups: state.pickups.length,
        shield: state.shieldTimer,
        wing: state.wingmanTimer,
        warp: state.warpTimer,
        rapid: state.rapidTimer,
        laser: state.laserTimer,
        enemyShots: state.enemyBullets.length,
      };
      if (state.mode === 'playing') audio.tickMusic(state.sector, state.boss != null);
      renderer.render(scene, camera);
    },
  };
}

function colorFor(enemy: Enemy, tint: string): string {
  if (enemy.shape === 'battleship') return '#c5ced8';
  if (enemy.shape === 'carrier') return '#8ea0b0';
  if (enemy.shape === 'dart') return '#ff5a7a';
  if (enemy.shape === 'cruiser' || enemy.shape === 'rock') return '#e2b15a';
  return tint;
}

function pickupColor(kind: string): string {
  if (kind === 'shield') return '#9debff';
  if (kind === 'wingman') return '#e7f3ff';
  if (kind === 'warp') return '#c9d4ff';
  if (kind === 'bomb') return '#ff7a1a';
  if (kind === 'laser') return '#ff4a2a';
  if (kind === 'rapid') return '#f4feff';
  return '#7ef0ff';
}
