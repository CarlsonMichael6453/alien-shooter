import * as THREE from 'three';
import type { PaintMaterial } from './ink';

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const GLOW_SPHERE = new THREE.SphereGeometry(1, 8, 6);

export interface GlowSpec {
  color: string;
  x: number;
  y: number;
  z: number;
  s: number;
}

export interface Archetype {
  body: THREE.BufferGeometry;
  glows: GlowSpec[];
}

const color = new THREE.Color();

function stamp(source: THREE.BufferGeometry, hex: string, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0): THREE.BufferGeometry {
  const geo = source.clone();
  geo.applyMatrix4(
    new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(sx, sy, sz),
    ),
  );
  const flat = geo.index ? geo.toNonIndexed() : geo;
  if (flat !== geo) geo.dispose();
  const count = flat.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  color.set(hex);
  for (let i = 0; i < count; i += 1) {
    const jitter = 0.9 + ((i * 13) % 11) / 70;
    colors[i * 3] = color.r * jitter;
    colors[i * 3 + 1] = color.g * jitter;
    colors[i * 3 + 2] = color.b * jitter;
  }
  flat.setAttribute('inkColor', new THREE.BufferAttribute(colors, 3));
  return flat;
}

function box(w: number, h: number, d: number, hex: string, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): THREE.BufferGeometry {
  return stamp(UNIT_BOX, hex, x, y, z, w, h, d, rx, ry, rz);
}

function tube(rt: number, rb: number, h: number, hex: string, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, seg = 8): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(rt, rb, h, seg);
  const out = stamp(geo, hex, x, y, z, 1, 1, 1, rx, ry, rz);
  geo.dispose();
  return out;
}

function cone(r: number, h: number, hex: string, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): THREE.BufferGeometry {
  const geo = new THREE.ConeGeometry(r, h, 6);
  const out = stamp(geo, hex, x, y, z, 1, 1, 1, rx, ry, rz);
  geo.dispose();
  return out;
}

function sphere(r: number, hex: string, x: number, y: number, z: number, sy = 1): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(r, 8, 6);
  const out = stamp(geo, hex, x, y, z, 1, sy, 1);
  geo.dispose();
  return out;
}

function rock(r: number, hex: string, x: number, y: number, z: number): THREE.BufferGeometry {
  const geo = new THREE.DodecahedronGeometry(r, 0);
  const out = stamp(geo, hex, x, y, z);
  geo.dispose();
  return out;
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let count = 0;
  for (const part of parts) count += part.getAttribute('position').count;
  const position = new Float32Array(count * 3);
  const normal = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const ink = new Float32Array(count * 3);
  let cursor = 0;
  for (const part of parts) {
    const p = part.getAttribute('position');
    const n = part.getAttribute('normal');
    const u = part.getAttribute('uv');
    const c = part.getAttribute('inkColor');
    const size = p.count;
    for (let i = 0; i < size; i += 1) {
      const at = cursor + i;
      position.set([p.getX(i), p.getY(i), p.getZ(i)], at * 3);
      normal.set(n ? [n.getX(i), n.getY(i), n.getZ(i)] : [0, 1, 0], at * 3);
      uv.set(u ? [u.getX(i), u.getY(i)] : [0.5, 0.5], at * 2);
      ink.set([c.getX(i), c.getY(i), c.getZ(i)], at * 3);
    }
    cursor += size;
    part.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('inkColor', new THREE.BufferAttribute(ink, 3));
  return geo;
}

const ALONG = Math.PI / 2;

export function shipArchetype(): Archetype {
  return {
    body: merge([
      tube(0.2, 0.28, 1.15, '#8d8678', 0, 0, 0.05, ALONG),
      cone(0.18, 0.5, '#c5cdc8', 0, 0.02, -0.78, ALONG),
      box(0.36, 0.08, 0.7, '#5e6864', 0, 0.16, -0.05),
      box(0.22, 0.06, 0.9, '#3e3832', 0, -0.12, 0.05),
      box(0.72, 0.06, 0.38, '#6a5e56', -0.62, 0, 0.18, 0, 0, 0.18),
      box(0.72, 0.06, 0.38, '#6a5e56', 0.62, 0, 0.18, 0, 0, -0.18),
      box(0.4, 0.04, 0.22, '#3a342e', -0.5, 0.05, 0.12),
      box(0.4, 0.04, 0.22, '#3a342e', 0.5, 0.05, 0.12),
      tube(0.13, 0.15, 0.36, '#4a453e', -0.24, 0, 0.58, ALONG),
      tube(0.13, 0.15, 0.36, '#4a453e', 0.24, 0, 0.58, ALONG),
      box(0.1, 0.16, 0.42, '#5c6762', -0.28, 0, -0.12),
      box(0.1, 0.16, 0.42, '#5c6762', 0.28, 0, -0.12),
      box(0.05, 0.05, 0.05, '#2c2824', -0.42, 0.06, 0.02),
      box(0.05, 0.05, 0.05, '#2c2824', 0.42, 0.06, 0.02),
      box(0.05, 0.05, 0.05, '#2c2824', -0.7, 0.04, 0.22),
      box(0.05, 0.05, 0.05, '#2c2824', 0.7, 0.04, 0.22),
    ]),
    glows: [
      { color: '#5ee7e4', x: 0, y: 0.22, z: -0.22, s: 0.12 },
      { color: '#ff3d86', x: -0.24, y: 0, z: 0.74, s: 0.1 },
      { color: '#ff6a2a', x: 0.24, y: 0, z: 0.74, s: 0.1 },
      { color: '#ff6a2a', x: -0.92, y: 0.02, z: 0.22, s: 0.05 },
      { color: '#ff6a2a', x: 0.92, y: 0.02, z: 0.22, s: 0.05 },
    ],
  };
}

export function dartArchetype(): Archetype {
  return {
    body: merge([
      cone(0.22, 1.15, '#8a6670', 0, 0, 0.15, -ALONG),
      box(0.55, 0.05, 0.28, '#4e4448', -0.28, 0, -0.2, 0, 0, 0.4),
      box(0.55, 0.05, 0.28, '#4e4448', 0.28, 0, -0.2, 0, 0, -0.4),
      box(0.08, 0.28, 0.22, '#3a3234', 0, 0.12, -0.15),
      sphere(0.12, '#2a2426', 0, 0, 0.42, 0.8),
    ]),
    glows: [{ color: '#ff4f8a', x: 0, y: 0.04, z: 0.48, s: 0.09 }],
  };
}

export function saucerArchetype(): Archetype {
  return {
    body: merge([
      tube(0.62, 0.62, 0.16, '#8d8474', 0, 0, 0, 0, 0, 0, 10),
      sphere(0.34, '#6e7874', 0, 0.12, 0, 0.55),
      tube(0.28, 0.36, 0.12, '#4a453e', 0, -0.1, 0, 0, 0, 0, 8),
      box(0.16, 0.08, 0.5, '#3e3832', 0, 0.16, 0),
      box(0.08, 0.1, 0.08, '#2c2824', -0.4, 0.02, 0.2),
      box(0.08, 0.1, 0.08, '#2c2824', 0.4, 0.02, -0.15),
    ]),
    glows: [
      { color: '#5ee7e4', x: 0, y: 0.22, z: 0.12, s: 0.08 },
      { color: '#ff4f8a', x: -0.22, y: 0.08, z: 0.28, s: 0.05 },
      { color: '#ff6a2a', x: 0.22, y: 0.08, z: 0.28, s: 0.05 },
    ],
  };
}

export function cruiserArchetype(): Archetype {
  return {
    body: merge([
      box(0.7, 0.28, 1.35, '#6e7c78', 0, 0, 0),
      box(0.5, 0.12, 0.7, '#8d8678', 0, 0.18, -0.1),
      cone(0.28, 0.45, '#c8c2b4', 0, 0.02, 0.85, -ALONG),
      box(0.22, 0.16, 0.4, '#3e3832', -0.42, -0.02, -0.2),
      box(0.22, 0.16, 0.4, '#3e3832', 0.42, -0.02, -0.2),
      tube(0.1, 0.12, 0.28, '#4a453e', -0.28, 0.02, -0.62, ALONG),
      tube(0.1, 0.12, 0.28, '#4a453e', 0.28, 0.02, -0.62, ALONG),
      box(0.06, 0.06, 0.06, '#2c2824', -0.22, 0.2, 0.1),
      box(0.06, 0.06, 0.06, '#2c2824', 0.22, 0.2, 0.1),
    ]),
    glows: [
      { color: '#ff6a2a', x: 0, y: 0.06, z: 0.95, s: 0.08 },
      { color: '#ff3d86', x: -0.28, y: 0.02, z: -0.74, s: 0.06 },
      { color: '#ff3d86', x: 0.28, y: 0.02, z: -0.74, s: 0.06 },
    ],
  };
}

export function rockArchetype(): Archetype {
  return {
    body: merge([
      rock(0.55, '#7a6a58', 0, 0, 0),
      rock(0.22, '#5c5146', 0.38, 0.1, 0.12),
      rock(0.16, '#3e3832', -0.3, -0.08, -0.2),
    ]),
    glows: [{ color: '#ff6a2a', x: 0.12, y: 0.08, z: 0.28, s: 0.07 }],
  };
}

export function battleshipArchetype(): Archetype {
  return {
    body: merge([
      box(1.15, 0.32, 1.7, '#6a6560', 0, 0, 0),
      box(0.7, 0.16, 0.9, '#8a8478', 0, 0.2, -0.05),
      box(0.28, 0.18, 0.28, '#4a453e', -0.22, 0.28, 0.15),
      box(0.28, 0.18, 0.28, '#4a453e', 0.22, 0.28, 0.15),
      box(0.9, 0.08, 0.2, '#3e3832', 0, 0.08, 0.78),
      tube(0.14, 0.16, 0.3, '#3a342e', -0.4, 0, -0.75, ALONG),
      tube(0.14, 0.16, 0.3, '#3a342e', 0.4, 0, -0.75, ALONG),
      box(0.08, 0.08, 0.08, '#2c2824', -0.4, 0.22, -0.2),
      box(0.08, 0.08, 0.08, '#2c2824', 0.4, 0.22, -0.2),
    ]),
    glows: [
      { color: '#ff4f8a', x: 0, y: 0.22, z: 0.15, s: 0.12 },
      { color: '#ff6a2a', x: -0.4, y: 0, z: -0.9, s: 0.07 },
      { color: '#ff6a2a', x: 0.4, y: 0, z: -0.9, s: 0.07 },
    ],
  };
}

export function carrierArchetype(): Archetype {
  return {
    body: merge([
      box(1.45, 0.22, 1.15, '#5e6864', 0, 0, 0),
      box(0.7, 0.2, 0.55, '#3e3832', 0, 0.08, 0.35),
      box(0.28, 0.28, 0.28, '#8d8678', -0.48, 0.18, -0.2),
      box(0.28, 0.28, 0.28, '#8d8678', 0.48, 0.18, -0.2),
      box(0.16, 0.2, 0.4, '#2c2824', 0, 0.12, 0.42),
      tube(0.1, 0.12, 0.24, '#4a453e', -0.55, -0.02, -0.48, ALONG),
      tube(0.1, 0.12, 0.24, '#4a453e', 0.55, -0.02, -0.48, ALONG),
    ]),
    glows: [
      { color: '#5ee7e4', x: -0.18, y: 0.1, z: 0.48, s: 0.06 },
      { color: '#5ee7e4', x: 0.18, y: 0.1, z: 0.48, s: 0.06 },
      { color: '#ff4f8a', x: 0, y: 0.28, z: -0.2, s: 0.07 },
    ],
  };
}

export function bossArchetype(): Archetype {
  return {
    body: merge([
      box(2.1, 0.42, 1.9, '#5c584f', 0, 0, 0),
      box(1.2, 0.22, 1.05, '#7d7870', 0, 0.26, -0.05),
      box(0.46, 0.28, 0.55, '#3e3832', -0.72, 0.32, 0.1),
      box(0.46, 0.28, 0.55, '#3e3832', 0.72, 0.32, 0.1),
      cone(0.42, 0.55, '#c8c0b2', 0, 0.04, 1.1, -ALONG),
      box(0.7, 0.1, 0.18, '#2c2824', 0, 0.08, 1.05),
      tube(0.18, 0.22, 0.36, '#3a342e', -0.78, -0.02, -0.85, ALONG),
      tube(0.18, 0.22, 0.36, '#3a342e', 0.78, -0.02, -0.85, ALONG),
      box(0.16, 0.12, 0.7, '#4e5854', -1.05, 0, 0.1),
      box(0.16, 0.12, 0.7, '#4e5854', 1.05, 0, 0.1),
      box(0.08, 0.08, 0.08, '#241e1a', -0.4, 0.34, -0.25),
      box(0.08, 0.08, 0.08, '#241e1a', 0.4, 0.34, -0.25),
      box(0.08, 0.08, 0.08, '#241e1a', 0, 0.36, 0.25),
    ]),
    glows: [
      { color: '#ff4f8a', x: -0.28, y: 0.16, z: 1.05, s: 0.08 },
      { color: '#ff4f8a', x: 0.28, y: 0.16, z: 1.05, s: 0.08 },
      { color: '#ff6a2a', x: -0.78, y: 0, z: -1.02, s: 0.09 },
      { color: '#ff6a2a', x: 0.78, y: 0, z: -1.02, s: 0.09 },
    ],
  };
}

export function pickupArchetype(): Archetype {
  return {
    body: merge([
      box(0.46, 0.36, 0.46, '#8d8474', 0, 0, 0),
      box(0.5, 0.08, 0.5, '#4a453e', 0, 0.2, 0),
      box(0.08, 0.08, 0.08, '#2c2824', -0.16, 0.22, -0.16),
      box(0.08, 0.08, 0.08, '#2c2824', 0.16, 0.22, 0.16),
    ]),
    glows: [{ color: '#5ee7e4', x: 0, y: 0.02, z: 0.18, s: 0.1 }],
  };
}

export function buildGroup(arch: Archetype, paint: PaintMaterial, outline: THREE.ShaderMaterial, glowFor: (color: string, halo: boolean) => THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(arch.body, outline));
  group.add(new THREE.Mesh(arch.body, paint));
  for (const glow of arch.glows) {
    const core = new THREE.Mesh(GLOW_SPHERE, glowFor(glow.color, false));
    core.position.set(glow.x, glow.y, glow.z);
    core.scale.setScalar(glow.s);
    const halo = new THREE.Mesh(GLOW_SPHERE, glowFor(glow.color, true));
    halo.position.copy(core.position);
    halo.scale.setScalar(glow.s * 2.5);
    group.add(core, halo);
  }
  return group;
}
