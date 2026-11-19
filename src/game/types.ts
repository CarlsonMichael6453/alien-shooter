export type Mode = 'ready' | 'playing' | 'over';

export type EnemyKind = 'alien' | 'asteroid';

export type EnemyShape = 'saucer' | 'dart' | 'rock' | 'cruiser' | 'battleship' | 'carrier';

export type PickupKind = 'ammo' | 'rapid' | 'bomb' | 'laser' | 'shield' | 'wingman' | 'warp';

export type PowerKind = 'rapid' | 'bomb' | 'laser' | 'shield' | 'wingman' | 'warp';

export interface Enemy {
  id: number;
  kind: EnemyKind;
  shape: EnemyShape;
  x: number;
  y: number;
  baseX: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  rotSpeed: number;
  phase: number;
  wobbleAmp: number;
  wobbleFreq: number;
  tint: number;
  score: number;
  hp: number;
  maxHp: number;
  /** Seconds until this ship fires or launches a scout. A large value means it never does. */
  gun: number;
}

export interface Bullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

export interface Pickup {
  id: number;
  kind: PickupKind;
  amount: number;
  x: number;
  y: number;
  vy: number;
  r: number;
  spin: number;
}

export interface Bomb {
  x: number;
  y: number;
  vy: number;
  age: number;
  pulse: number;
}

export interface EnemyBullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

export interface Boss {
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  dir: number;
  age: number;
  pattern: number;
  patternTime: number;
  cooldown: number;
  beam: number;
  beamDir: number;
  burned: boolean;
}

export interface Blast {
  x: number;
  y: number;
  age: number;
  maxRadius: number;
  hit: number[];
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  r: number;
  color: string;
}

export interface Star {
  /** Horizontal position as a fraction of the playfield width. */
  x: number;
  /** Vertical position as a fraction of the playfield height. */
  y: number;
  /** Fraction of the screen height traveled per second. */
  speed: number;
  size: number;
  alpha: number;
  warm: boolean;
}

export interface GameState {
  mode: Mode;
  width: number;
  height: number;
  time: number;
  score: number;
  best: number;
  lives: number;
  shipX: number;
  shipY: number;
  firing: boolean;
  invuln: number;
  hitFlash: number;
  shake: number;
  muzzle: number;
  fireCooldown: number;
  spawnCooldown: number;
  shotsFired: number;
  /** Seconds spent on the game-over card. Restarts are ignored until this passes a short lock. */
  overTimer: number;
  ammo: number;
  inventory: PowerKind[];
  rapidTimer: number;
  laserTimer: number;
  laserAngle: number;
  shieldTimer: number;
  shieldHits: number;
  wingmanTimer: number;
  wingmanCooldown: number;
  warpTimer: number;
  sector: number;
  /** Score at which the next boss arrives. */
  bossScore: number;
  sectorBanner: number;
  spark: number;
  /** When true the simulation is frozen so a frame can be inspected. */
  hold: boolean;
  nextId: number;
  bullets: Bullet[];
  enemyBullets: EnemyBullet[];
  enemies: Enemy[];
  pickups: Pickup[];
  boss: Boss | null;
  bomb: Bomb | null;
  blast: Blast | null;
  particles: Particle[];
  stars: Star[];
  ammoCooldown: number;
  powerCooldown: number;
  rng: Rng;
}

export interface Rng {
  next(): number;
}

/** What the simulation should do this frame. Pointer math lives outside the sim. */
export interface Intent {
  moveActive: boolean;
  targetX: number;
  targetY: number;
  firing: boolean;
  keyX: number;
  keyY: number;
  start: boolean;
  restart: boolean;
  activateSlot: number | null;
  fireDragX: number;
  fireDragY: number;
  stickX: number;
  stickY: number;
  hoverActive: boolean;
  hoverX: number;
  hoverY: number;
}
