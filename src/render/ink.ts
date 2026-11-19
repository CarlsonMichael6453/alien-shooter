import * as THREE from 'three';

const VERT = `
attribute vec3 inkColor;
varying vec3 vInk;
varying vec3 vN;
varying vec3 vWorld;
varying vec2 vUv;
void main() {
  vInk = inkColor;
  vUv = uv;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAG = `
uniform sampler2D paint;
uniform vec3 lightDir;
uniform vec3 rimColor;
uniform vec3 tint;
uniform float detail;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
uniform float flash;
uniform float warp;
varying vec3 vInk;
varying vec3 vN;
varying vec3 vWorld;
varying vec2 vUv;
void main() {
  vec3 n = normalize(vN);
  vec3 l = normalize(lightDir);
  float wrap = dot(n, l) * 0.5 + 0.5;
  float band = 0.36;
  band += smoothstep(0.18, 0.28, wrap) * 0.30;
  band += smoothstep(0.46, 0.56, wrap) * 0.26;
  band += smoothstep(0.74, 0.88, wrap) * 0.22;
  vec3 grunge = texture2D(paint, vUv * detail).rgb;
  vec3 albedo = vInk * grunge * tint;
  vec3 col = albedo * (band + flash * 0.65);
  float shadow = 1.0 - smoothstep(0.16, 0.42, wrap);
  float hatch = step(0.6, fract(vUv.y * detail * 2.4 + sin(vUv.x * detail) * 0.07));
  float crossHatch = step(0.78, fract((vUv.x - vUv.y) * detail * 1.6));
  col *= 1.0 - shadow * (hatch * 0.62 + crossHatch * 0.4);
  col *= 1.0 - smoothstep(0.34, 0.0, wrap) * 0.5;
  vec3 viewDir = normalize(cameraPosition - vWorld);
  float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 2.2);
  col += rimColor * rim * 0.28;
  col *= mix(1.0, 0.35, smoothstep(0.55, 0.92, rim));
  col = mix(col, col * vec3(0.62, 0.78, 1.18) + vec3(0.02, 0.05, 0.08), warp);
  float dist = length(cameraPosition - vWorld);
  float fogFactor = smoothstep(fogNear, fogFar, dist);
  col = mix(col, fogColor, fogFactor);
  gl_FragColor = vec4(col, 1.0);
}
`;

const OUTLINE_VERT = `
uniform float thickness;
varying float vFog;
void main() {
  float wobble = 0.62 + 0.38 * sin(position.x * 21.0 + position.y * 13.0 + position.z * 9.0);
  vec3 pos = position + normal * thickness * wobble;
  vec4 world = modelMatrix * vec4(pos, 1.0);
  vFog = length(cameraPosition - world.xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const OUTLINE_FRAG = `
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
varying float vFog;
void main() {
  float fogFactor = smoothstep(fogNear, fogFar, vFog);
  vec3 ink = vec3(0.05, 0.035, 0.03);
  gl_FragColor = vec4(mix(ink, fogColor, fogFactor), 1.0);
}
`;

export interface PaintMaterial extends THREE.ShaderMaterial {
  uniforms: {
    paint: { value: THREE.Texture };
    lightDir: { value: THREE.Vector3 };
    rimColor: { value: THREE.Color };
    tint: { value: THREE.Color };
    detail: { value: number };
    fogColor: { value: THREE.Color };
    fogNear: { value: number };
    fogFar: { value: number };
    flash: { value: number };
    warp: { value: number };
  };
}

export function createPaintTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#d5cbb8';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2200; i += 1) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const dark = Math.random() > 0.42;
      ctx.fillStyle = dark ? `rgba(36, 26, 18, ${Math.random() * 0.38})` : `rgba(255, 246, 230, ${Math.random() * 0.22})`;
      ctx.fillRect(x, y, 1 + Math.random() * 3.2, 1 + Math.random() * 2.2);
    }
    ctx.strokeStyle = 'rgba(18, 12, 8, 0.82)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 18; x < 256; x += 46) {
      ctx.moveTo(x + Math.sin(x) * 3, 0);
      ctx.lineTo(x - Math.sin(x) * 2, 256);
    }
    for (let y = 22; y < 256; y += 54) {
      ctx.moveTo(0, y);
      ctx.lineTo(256, y + Math.sin(y * 0.4) * 4);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(22, 14, 10, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -256; i < 256; i += 6) {
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 70, 256);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(28, 16, 10, 0.75)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 36; i += 1) {
      ctx.beginPath();
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 18, y - 4, x + 30 + Math.random() * 16, y + Math.random() * 8 - 4);
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createPaintMaterial(paint: THREE.Texture): PaintMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      paint: { value: paint },
      lightDir: { value: new THREE.Vector3(0.42, 0.82, 0.32).normalize() },
      rimColor: { value: new THREE.Color('#ff4f8a') },
      tint: { value: new THREE.Color('#ffffff') },
      detail: { value: 3.2 },
      fogColor: { value: new THREE.Color('#243230') },
      fogNear: { value: 16 },
      fogFar: { value: 52 },
      flash: { value: 0 },
      warp: { value: 0 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
  }) as PaintMaterial;
  return material;
}

export function createOutlineMaterial(thickness = 0.055): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      thickness: { value: thickness },
      fogColor: { value: new THREE.Color('#243230') },
      fogNear: { value: 16 },
      fogFar: { value: 52 },
    },
    side: THREE.BackSide,
    vertexShader: OUTLINE_VERT,
    fragmentShader: OUTLINE_FRAG,
  });
}

export function syncFog(material: THREE.ShaderMaterial, color: THREE.Color, near: number, far: number, warp: number): void {
  const uniforms = material.uniforms;
  if (uniforms.fogColor) (uniforms.fogColor.value as THREE.Color).copy(color);
  if (uniforms.fogNear) uniforms.fogNear.value = near;
  if (uniforms.fogFar) uniforms.fogFar.value = far;
  if (uniforms.warp) uniforms.warp.value = warp;
}

export function createGlowMaterial(color: string, halo = false): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: halo ? 0.38 : 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
}

export function createFlameTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 128, 128);
    const blobs = [
      { x: 64, y: 70, rx: 40, ry: 46, color: '#ff4a1a' },
      { x: 48, y: 78, rx: 22, ry: 28, color: '#ff2f86' },
      { x: 78, y: 60, rx: 18, ry: 30, color: '#ff8a2a' },
      { x: 64, y: 64, rx: 16, ry: 18, color: '#ffe08a' },
    ];
    for (const blob of blobs) {
      ctx.fillStyle = blob.color;
      ctx.beginPath();
      ctx.ellipse(blob.x, blob.y, blob.rx, blob.ry, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#140c08';
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(30, 96);
    ctx.quadraticCurveTo(20, 60, 46, 34);
    ctx.quadraticCurveTo(64, 12, 86, 40);
    ctx.quadraticCurveTo(112, 58, 96, 96);
    ctx.quadraticCurveTo(64, 112, 30, 96);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(12, 8, 6, 0.85)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      ctx.moveTo(40 + i * 10, 88);
      ctx.lineTo(52 + i * 8, 48);
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createSmokeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = 'rgba(42, 36, 32, 0.82)';
    ctx.beginPath();
    ctx.ellipse(64, 68, 40, 34, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(70, 60, 52, 0.55)';
    ctx.beginPath();
    ctx.ellipse(78, 58, 24, 20, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(12, 8, 6, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(64, 68, 40, 34, 0.3, 0.4, 5.6);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo(36 + i * 12, 84);
      ctx.quadraticCurveTo(50 + i * 8, 60, 70 + i * 6, 46);
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const SKIES = [
  { top: '#24302e', mid: '#3c4a46', bot: '#1a1814', a: '#2ec8c0', b: '#ff3d86', planet: '#7f948e', ink: '#1a120e' },
  { top: '#3a3228', mid: '#5a4a38', bot: '#1c1612', a: '#e08a3a', b: '#8a7058', planet: '#b09778', ink: '#1a120c' },
  { top: '#2a2030', mid: '#4a3058', bot: '#160e18', a: '#ff4f9a', b: '#3ad4e4', planet: '#6d5878', ink: '#140c12' },
  { top: '#3a2018', mid: '#6a3424', bot: '#1a100c', a: '#ff5a28', b: '#ffb060', planet: '#c46a48', ink: '#160c08' },
  { top: '#1a2820', mid: '#2c4636', bot: '#101612', a: '#3ee08a', b: '#ff4f8a', planet: '#4e6a58', ink: '#10140e' },
];

export function createSkyTexture(index: number): THREE.CanvasTexture {
  const sky = SKIES[((index % SKIES.length) + SKIES.length) % SKIES.length];
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const wash = ctx.createLinearGradient(0, 0, 0, 512);
    wash.addColorStop(0, sky.top);
    wash.addColorStop(0.45, sky.mid);
    wash.addColorStop(1, sky.bot);
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, 512, 512);
    const puff = (x: number, y: number, rx: number, ry: number, color: string) => {
      const grad = ctx.createRadialGradient(x, y, 8, x, y, rx);
      grad.addColorStop(0, color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0.4, 0, Math.PI * 2);
      ctx.fill();
    };
    puff(150, 300, 120, 46, sky.a);
    puff(330, 280, 90, 36, sky.b);
    ctx.strokeStyle = sky.ink;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(70, 310);
    ctx.quadraticCurveTo(150, 250, 230, 305);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(250, 290);
    ctx.quadraticCurveTo(330, 246, 410, 288);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = sky.planet;
    ctx.beginPath();
    ctx.arc(400, 250, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#120e0c';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(18, 12, 8, 0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(400, 248, 42, 12, 0.3, 0, Math.PI * 2);
    ctx.stroke();
    const horizon = ctx.createLinearGradient(0, 340, 0, 512);
    horizon.addColorStop(0, 'rgba(0,0,0,0)');
    horizon.addColorStop(1, sky.bot);
    ctx.fillStyle = horizon;
    ctx.fillRect(0, 340, 512, 172);
    ctx.fillStyle = '#f6f0e6';
    for (let i = 0; i < 90; i += 1) {
      const x = (i * 97) % 512;
      const y = (i * 57) % 360;
      const s = i % 7 === 0 ? 2 : 1;
      ctx.globalAlpha = 0.35 + (i % 5) * 0.12;
      ctx.fillRect(x, y, s, s);
    }
    ctx.globalAlpha = 1;
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createGroundTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#cbbfa8';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i += 1) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(40, 30, 22, 0.28)' : 'rgba(255, 246, 230, 0.16)';
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 4, 1 + Math.random() * 2);
    }
    ctx.strokeStyle = 'rgba(24, 16, 12, 0.75)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 78);
    ctx.lineTo(256, 70);
    ctx.moveTo(128, 0);
    ctx.lineTo(118, 256);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(30, 20, 14, 0.45)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i += 1) {
      ctx.beginPath();
      const x = 20 + i * 28;
      ctx.moveTo(x, 90);
      ctx.lineTo(x + 18, 160);
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createNebulaTexture(index: number): THREE.CanvasTexture {
  const sky = SKIES[((index % SKIES.length) + SKIES.length) % SKIES.length];
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 256, 256);
    const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 110);
    grad.addColorStop(0, sky.a);
    grad.addColorStop(0.55, sky.b);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.ellipse(128, 130, 100, 62, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = '#120e0c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(128, 130, 86, 50, 0.5, 0.3, 5.4);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export const SECTOR_FOG = ['#2a3834', '#3a3228', '#2c2234', '#3a241c', '#1c3028'];
export const SECTOR_RIM = ['#ff4f8a', '#ff8a3a', '#5ee7e4', '#ff5a2a', '#ff4f8a'];
export const SECTOR_GROUND = ['#6d7c76', '#7d6c56', '#6a5874', '#7a5646', '#4e6a58'];
export const SECTOR_CORE = ['#5ee7e4', '#ff8a3a', '#ff4f8a', '#ff5a2a', '#7dffb0'];
