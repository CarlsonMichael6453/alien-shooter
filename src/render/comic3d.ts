import * as THREE from 'three';
import { audio } from '../audio/arcade';
import { sectorTheme } from '../game/sectors';
import type { Enemy, GameState } from '../game/types';
import {
  SECTOR_CORE,
  SECTOR_FOG,
  SECTOR_GROUND,
  SECTOR_RIM,
  createFlameTexture,
  createGlowMaterial,
  createGroundTexture,
  createOutlineMaterial,
  createPaintMaterial,
  createPaintTexture,
  createSkyTexture,
  createSmokeTexture,
  syncFog,
  type PaintMaterial,
} from './ink';
import {
  battleshipArchetype,
  bossArchetype,
  buildGroup,
  carrierArchetype,
  cruiserArchetype,
  dartArchetype,
  pickupArchetype,
  rockArchetype,
  saucerArchetype,
  shipArchetype,
  type Archetype,
} from './rigs';

const LANE_DEPTH = 46;
const LANE_WIDTH = 14;
const LOOK_LIMIT = 0.32;

export function worldOf(width: number, height: number, x: number, y: number, lift = 0): THREE.Vector3 {
  const wx = (x / Math.max(1, width) - 0.5) * LANE_WIDTH;
  const wz = -((height - y) / Math.max(1, height)) * LANE_DEPTH;
  return new THREE.Vector3(wx, lift, wz);
}

const SHAPES = ['dart', 'saucer', 'cruiser', 'rock', 'battleship', 'carrier'] as const;
type ShapeName = (typeof SHAPES)[number];

function shapeOf(enemy: Enemy): ShapeName {
  return SHAPES.includes(enemy.shape as ShapeName) ? (enemy.shape as ShapeName) : 'saucer';
}

interface Mote {
  mesh: THREE.Mesh;
  life: number;
  max: number;
  vel: THREE.Vector3;
  grow: number;
}

export function createComicView(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x1a1814, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.28;
  const scene = new THREE.Scene();
  const fog = new THREE.Fog(0x2a3834, 18, 48);
  scene.fog = fog;
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 90);

  const paintTex = createPaintTexture();
  const groundTex = createGroundTexture();
  const paint = createPaintMaterial(paintTex);
  const shipPaint = createPaintMaterial(paintTex);
  const groundPaint = createPaintMaterial(paintTex);
  const outline = createOutlineMaterial(0.055);
  const paints = [paint, shipPaint, groundPaint];
  const glowCache = new Map<string, THREE.Material>();
  const glowFor = (color: string, halo: boolean) => {
    const key = `${color}:${halo ? 1 : 0}`;
    let material = glowCache.get(key);
    if (!material) {
      material = createGlowMaterial(color, halo);
      glowCache.set(key, material);
    }
    return material;
  };

  const skyMat = new THREE.MeshBasicMaterial({ fog: false, depthWrite: false });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(70, 32), skyMat);
  sky.position.set(0, 8, -44);
  sky.frustumCulled = false;
  scene.add(sky);
  const skyTextures = [0, 1, 2, 3, 4].map((index) => createSkyTexture(index));

  const groundGeo = new THREE.PlaneGeometry(22, 78);
  const groundInk = new Float32Array(groundGeo.getAttribute('position').count * 3).fill(1);
  groundGeo.setAttribute('inkColor', new THREE.BufferAttribute(groundInk, 3));
  const ground = new THREE.Mesh(groundGeo, groundPaint);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -20);
  scene.add(ground);
  const strips: THREE.Mesh[] = [];
  for (let i = 0; i < 7; i += 1) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 1.6), glowFor(i % 2 === 0 ? '#5ee7e4' : '#ff4f8a', false));
    strip.position.set(i % 2 === 0 ? -1.15 : 1.15, 0.03, -4 - i * 5.2);
    scene.add(strip);
    strips.push(strip);
  }

  const archetypes: Record<ShapeName, Archetype> = {
    dart: dartArchetype(),
    saucer: saucerArchetype(),
    cruiser: cruiserArchetype(),
    rock: rockArchetype(),
    battleship: battleshipArchetype(),
    carrier: carrierArchetype(),
  };
  const counts: Record<ShapeName, number> = { dart: 12, saucer: 8, cruiser: 6, rock: 6, battleship: 4, carrier: 4 };
  const pools: Record<ShapeName, THREE.Group[]> = { dart: [], saucer: [], cruiser: [], rock: [], battleship: [], carrier: [] };
  (Object.keys(archetypes) as ShapeName[]).forEach((shape) => {
    const proto = buildGroup(archetypes[shape], paint, outline, glowFor);
    for (let i = 0; i < counts[shape]; i += 1) {
      const group = proto.clone(true);
      group.visible = false;
      scene.add(group);
      pools[shape].push(group);
    }
  });

  const ship = buildGroup(shipArchetype(), shipPaint, outline, glowFor);
  scene.add(ship);
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.72, 12),
    new THREE.MeshBasicMaterial({ color: 0x120e0c, transparent: true, opacity: 0.4, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);

  const shieldMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { tint: { value: new THREE.Color('#5ee7e4') } },
    vertexShader: `
      varying vec3 vN;
      varying vec3 vWorld;
      void main() {
        vN = normalize(normalMatrix * normal);
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform vec3 tint;
      varying vec3 vN;
      varying vec3 vWorld;
      void main() {
        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(cameraPosition - vWorld))), 1.5);
        gl_FragColor = vec4(tint, 0.08 + fres * 0.45);
      }
    `,
  });
  const shield = new THREE.Mesh(new THREE.SphereGeometry(1.05, 12, 8), shieldMat);
  shield.visible = false;
  scene.add(shield);

  const wingProto = buildGroup(dartArchetype(), paint, outline, glowFor);
  const wingmen = [-1, 1].map((side) => {
    const drone = wingProto.clone(true);
    drone.scale.setScalar(0.42);
    drone.visible = false;
    drone.userData.side = side;
    scene.add(drone);
    return drone;
  });

  const laserMat = createGlowMaterial('#ff6a2a', false);
  const laserHaloMat = createGlowMaterial('#ff4f8a', true);
  const laser = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 9), laserMat);
  const laserHalo = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 9), laserHaloMat);
  laser.add(laserHalo);
  laser.visible = false;
  scene.add(laser);

  const boss = buildGroup(bossArchetype(), paint, outline, glowFor);
  const bossCoreMat = createGlowMaterial('#ff4f8a', false);
  const bossCoreHalo = createGlowMaterial('#ff4f8a', true);
  const bossCore = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), bossCoreMat);
  const bossCoreGlow = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), bossCoreHalo);
  bossCore.add(bossCoreGlow);
  bossCore.position.set(0, 0.34, 0.15);
  boss.add(bossCore);
  boss.visible = false;
  scene.add(boss);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 14), laserMat);
  const beamHalo = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 14), laserHaloMat);
  beam.add(beamHalo);
  beam.visible = false;
  scene.add(beam);

  const pickupProto = buildGroup(pickupArchetype(), paint, outline, glowFor);
  const pickups = Array.from({ length: 8 }, () => {
    const group = pickupProto.clone(true);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), createGlowMaterial('#5ee7e4', false));
    glow.position.set(0, 0.02, 0.2);
    glow.name = 'pickup-glow';
    group.add(glow);
    group.visible = false;
    scene.add(group);
    return group;
  });

  const bomb = pickupProto.clone(true);
  const bombGlow = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), createGlowMaterial('#ff6a2a', false));
  bombGlow.position.set(0, 0.05, 0.22);
  bomb.add(bombGlow);
  bomb.visible = false;
  scene.add(bomb);

  const bulletMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.06, 0.36), createGlowMaterial('#fff1c2', false), 40);
  bulletMesh.frustumCulled = false;
  bulletMesh.count = 0;
  scene.add(bulletMesh);
  const shotMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 6, 5), createGlowMaterial('#ff8a3a', false), 28);
  shotMesh.frustumCulled = false;
  shotMesh.count = 0;
  scene.add(shotMesh);
  const dummy = new THREE.Object3D();

  const flameMap = createFlameTexture();
  const smokeMap = createSmokeTexture();
  const flameMat = new THREE.MeshBasicMaterial({
    map: flameMap,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const smokeMat = new THREE.MeshBasicMaterial({
    map: smokeMap,
    transparent: true,
    depthWrite: false,
    opacity: 0.8,
    side: THREE.DoubleSide,
  });
  const plane = new THREE.PlaneGeometry(1, 1);
  const motes: Mote[] = [];
  const spawnMote = (material: THREE.Material, grow: number, max: number) => {
    const mesh = new THREE.Mesh(plane, material);
    mesh.visible = false;
    mesh.frustumCulled = false;
    scene.add(mesh);
    const mote: Mote = { mesh, life: 0, max, vel: new THREE.Vector3(), grow };
    motes.push(mote);
    return mote;
  };
  const fires = Array.from({ length: 18 }, () => spawnMote(flameMat.clone(), 1.1, 0.7));
  const smokes = Array.from({ length: 10 }, () => spawnMote(smokeMat.clone(), 1.6, 0.9));
  const debrisMat = new THREE.MeshBasicMaterial({ color: '#6e6256' });
  const debris: Mote[] = Array.from({ length: 14 }, () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.22), debrisMat);
    mesh.visible = false;
    scene.add(mesh);
    const mote: Mote = { mesh, life: 0, max: 0.7, vel: new THREE.Vector3(), grow: 1 };
    motes.push(mote);
    return mote;
  });

  const blastDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 16), flameMat.clone());
  blastDisc.rotation.x = -Math.PI / 2;
  blastDisc.visible = false;
  scene.add(blastDisc);

  let primed = false;
  let sectorIndex = -1;
  let prev = { shots: 0, score: 0, lives: 3, blast: false, boss: false, pickups: 0, shield: 0, wing: 0, warp: 0, rapid: 0, laser: 0, enemyShots: 0 };
  const cursor: Record<ShapeName, number> = { dart: 0, saucer: 0, cruiser: 0, rock: 0, battleship: 0, carrier: 0 };

  const emit = (pool: Mote[], at: THREE.Vector3, count: number, speed: number) => {
    let left = count;
    for (const mote of pool) {
      if (left <= 0) break;
      if (mote.life > 0) continue;
      mote.life = mote.max * (0.65 + Math.random() * 0.45);
      mote.mesh.visible = true;
      mote.mesh.position.copy(at);
      mote.mesh.position.y += 0.3;
      mote.vel.set((Math.random() - 0.5) * speed, 0.2 + Math.random() * speed * 0.45, (Math.random() - 0.5) * speed);
      left -= 1;
    }
  };

  const boom = (at: THREE.Vector3, big: boolean) => {
    emit(fires, at, big ? 6 : 3, big ? 3.2 : 2);
    emit(smokes, at, big ? 4 : 2, big ? 1.6 : 1);
    emit(debris, at, big ? 5 : 3, big ? 3.4 : 2.2);
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
      const sector = theme.index % 5;
      if (sector !== sectorIndex) {
        sectorIndex = sector;
        skyMat.map = skyTextures[sector];
        skyMat.needsUpdate = true;
        groundPaint.uniforms.tint.value.set(SECTOR_GROUND[sector]);
        groundPaint.uniforms.detail.value = 2.2;
        groundPaint.uniforms.paint.value = groundTex;
      }
      const fogColor = fog.color;
      fogColor.set(state.warpTimer > 0 ? '#31485c' : SECTOR_FOG[sector]);
      fog.near = state.warpTimer > 0 ? 12 : 18;
      fog.far = state.warpTimer > 0 ? 36 : 48;
      renderer.setClearColor(fogColor, 1);
      const warp = state.warpTimer > 0 ? 1 : 0;
      for (const material of paints) {
        material.uniforms.rimColor.value.set(SECTOR_RIM[sector]);
        syncFog(material, fogColor, fog.near, fog.far, warp);
      }
      syncFog(outline, fogColor, fog.near, fog.far, 0);
      shipPaint.uniforms.flash.value = state.hitFlash > 0 ? 1 : 0;

      const shipPoint = worldOf(state.width, state.height, state.shipX, state.shipY, 0.7);
      ship.position.copy(shipPoint);
      ship.rotation.z = (0.5 - state.shipX / Math.max(1, state.width)) * 0.4;
      ship.rotation.y = (state.shipX / Math.max(1, state.width) - 0.5) * 0.35;
      shadow.position.set(shipPoint.x, 0.02, shipPoint.z);
      const aim = state.laserTimer > 0 ? state.laserAngle + Math.PI / 2 : (state.shipX / Math.max(1, state.width) - 0.5) * 0.7;
      const yaw = THREE.MathUtils.clamp(aim, -LOOK_LIMIT, LOOK_LIMIT);
      const pitch = THREE.MathUtils.clamp((state.shipY / Math.max(1, state.height) - 0.72) * -0.5, -0.25, 0.22);
      const kick = Math.min(0.35, state.shake * 0.02);
      camera.position.set(shipPoint.x * 0.35 + Math.sin(yaw) * 0.8 + Math.sin(state.time * 47) * kick, 6.2, shipPoint.z + 8.4);
      camera.lookAt(shipPoint.x + Math.sin(yaw) * 3.5, 1.15 + pitch, shipPoint.z - 15);
      sky.position.x = camera.position.x * 0.15;

      strips.forEach((strip, index) => {
        const travel = (state.time * 9 + index * 5.2) % 28;
        strip.position.z = -14 - travel;
      });

      shield.position.copy(shipPoint);
      shield.visible = state.shieldHits > 0;
      wingmen.forEach((drone) => {
        const side = drone.userData.side as number;
        drone.visible = state.wingmanTimer > 0;
        drone.position.set(shipPoint.x + side * 1.15, shipPoint.y + 0.05, shipPoint.z + 0.15);
      });
      laser.visible = state.laserTimer > 0;
      if (state.laserTimer > 0) {
        const dirX = Math.cos(state.laserAngle);
        const dirZ = Math.sin(state.laserAngle);
        laser.position.set(shipPoint.x + dirX * 2.4, shipPoint.y, shipPoint.z + dirZ * 4.2);
        laser.lookAt(shipPoint.x + dirX * 8, shipPoint.y, shipPoint.z + dirZ * 12);
      }

      (Object.keys(cursor) as ShapeName[]).forEach((shape) => {
        cursor[shape] = 0;
      });
      (Object.keys(pools) as ShapeName[]).forEach((shape) => {
        pools[shape].forEach((group) => {
          group.visible = false;
        });
      });
      for (const enemy of state.enemies) {
        const shape = shapeOf(enemy);
        const group = pools[shape][cursor[shape]];
        if (!group) continue;
        cursor[shape] += 1;
        group.visible = true;
        group.position.copy(worldOf(state.width, state.height, enemy.x, enemy.y, 0.35 + enemy.r / 90));
        const scale = Math.max(0.45, enemy.r / 20);
        group.scale.setScalar(scale);
        group.rotation.set(0, shape === 'rock' ? enemy.rot : 0, Math.sin(enemy.phase + state.time * 1.4) * 0.15);
      }

  bulletMesh.count = Math.min(state.bullets.length, 40);
      for (let index = 0; index < bulletMesh.count; index += 1) {
        const bullet = state.bullets[index];
        dummy.position.copy(worldOf(state.width, state.height, bullet.x, bullet.y, 0.6));
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        bulletMesh.setMatrixAt(index, dummy.matrix);
      }
      bulletMesh.instanceMatrix.needsUpdate = true;
      shotMesh.count = Math.min(state.enemyBullets.length, 28);
      for (let index = 0; index < shotMesh.count; index += 1) {
        const bullet = state.enemyBullets[index];
        dummy.position.copy(worldOf(state.width, state.height, bullet.x, bullet.y, 0.55));
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        shotMesh.setMatrixAt(index, dummy.matrix);
      }
      shotMesh.instanceMatrix.needsUpdate = true;

      pickups.forEach((group) => {
        group.visible = false;
      });
      state.pickups.slice(0, pickups.length).forEach((pickup, index) => {
        const group = pickups[index];
        group.visible = true;
        group.position.copy(worldOf(state.width, state.height, pickup.x, pickup.y, 0.55));
        group.rotation.y = state.time * 1.6 + pickup.spin;
        const glow = group.getObjectByName('pickup-glow') as THREE.Mesh | undefined;
        const material = glow?.material as THREE.MeshBasicMaterial | undefined;
        if (material) material.color.set(pickupColor(pickup.kind));
      });

      bomb.visible = state.bomb != null;
      if (state.bomb) {
        bomb.position.copy(worldOf(state.width, state.height, state.bomb.x, state.bomb.y, 0.5));
        const pulse = 1 + Math.sin(state.bomb.pulse * 8) * 0.08;
        bomb.scale.setScalar(0.85 * pulse);
      }

      if (state.boss) {
        boss.visible = true;
        boss.position.copy(worldOf(state.width, state.height, state.boss.x, state.boss.y, 0.9));
        boss.scale.setScalar(1.65);
        bossCoreMat.color.set(SECTOR_CORE[sector]);
        bossCoreHalo.color.set(SECTOR_CORE[sector]);
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

      const dt = 0.016;
      for (const mote of motes) {
        if (mote.life <= 0) {
          mote.mesh.visible = false;
          continue;
        }
        mote.life -= dt;
        mote.mesh.position.addScaledVector(mote.vel, dt);
        mote.vel.y -= dt * 0.6;
        const fade = Math.max(0, mote.life / mote.max);
        const material = mote.mesh.material as THREE.MeshBasicMaterial;
        if (material.opacity !== undefined && material.map) material.opacity = fade;
        const scale = mote.grow * (1.15 - fade * 0.4);
        mote.mesh.scale.setScalar(Math.max(0.05, scale));
        if (mote.mesh.geometry.type === 'PlaneGeometry') mote.mesh.lookAt(camera.position);
        if (mote.life <= 0) mote.mesh.visible = false;
      }

      state.particles.slice(0, fires.length).forEach((particle, index) => {
        const dusty = particle.color === '#8A7564' || particle.color === '#C4B4A4';
        const pool = dusty ? debris : fires;
        const mote = pool[index % pool.length];
        if (mote.life > 0.2) return;
        mote.life = Math.max(0.05, particle.life);
        mote.max = Math.max(0.2, particle.maxLife);
        mote.mesh.visible = true;
        mote.mesh.position.copy(worldOf(state.width, state.height, particle.x, particle.y, 0.45 + particle.r * 0.02));
        mote.grow = dusty ? 0.45 : Math.max(0.35, particle.r / 10);
        mote.vel.set(particle.vx / 220, 0.2, particle.vy / 220);
      });

      if (state.blast) {
        blastDisc.visible = true;
        const grow = Math.min(1, state.blast.age / 0.35);
        const radius = (state.blast.maxRadius / Math.max(1, state.width)) * LANE_WIDTH * grow;
        blastDisc.position.copy(worldOf(state.width, state.height, state.blast.x, state.blast.y, 0.35));
        blastDisc.scale.setScalar(Math.max(0.2, radius));
        (blastDisc.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - state.blast.age / 1.2);
        const flare = fires[0];
        flare.life = 0.45;
        flare.max = 0.45;
        flare.vel.set(0, 0, 0);
        flare.grow = Math.max(1.1, radius * 0.28);
        flare.mesh.visible = true;
        flare.mesh.position.copy(blastDisc.position);
        flare.mesh.position.y += 0.7;
        flare.mesh.lookAt(camera.position);
        flare.mesh.scale.setScalar(flare.grow);
        (flare.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0.2, 1 - state.blast.age / 1.1);
      } else {
        blastDisc.visible = false;
      }

      const shipBoom = shipPoint.clone();
      if (primed) {
        if (state.shotsFired > prev.shots) audio.shoot();
        if (state.score > prev.score) audio.hit();
        if (state.lives < prev.lives) {
          audio.explosion();
          boom(shipBoom, true);
        }
        if (state.blast && !prev.blast) {
          audio.explosion();
          boom(worldOf(state.width, state.height, state.blast.x, state.blast.y, 0.8), true);
        }
        if (state.boss && !prev.boss) audio.bossIntro();
        if (!state.boss && prev.boss) {
          audio.bossWin();
          boom(shipPoint.clone().setZ(shipPoint.z - 8), true);
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

function pickupColor(kind: string): string {
  if (kind === 'shield') return '#5ee7e4';
  if (kind === 'wingman') return '#f4ede2';
  if (kind === 'warp') return '#9eb6ff';
  if (kind === 'bomb') return '#ff6a2a';
  if (kind === 'laser') return '#ff4f8a';
  if (kind === 'rapid') return '#fff1c2';
  return '#5ee7e4';
}
