export const START_LIVES = 3;
export const START_AMMO = 200;
export const SHIP_MARGIN = 28;
export const SHIP_HIT_RADIUS = 14;
export const BULLET_RADIUS = 6;
export const BULLET_DAMAGE = 1;
export const BULLET_SPEED = 780;
export const FIRE_INTERVAL = 0.08;
export const KEYBOARD_SPEED = 340;
/** Full-deflection joystick speed. */
export const STICK_SPEED = 530;
/** Drag mode moves the ship this many times the finger travel. Was 1. */
export const DRAG_FOLLOW = 1.5;
export const INVULN_TIME = 1.5;
export const MAX_PARTICLES = 160;
export const MAX_BULLETS = 80;
export const MAX_INVENTORY = 3;

/** Rapid fire lasts this long and shoots at 4x rate. It does not spend ammo. */
export const RAPID_DURATION = 5;
export const RAPID_RATE = 4;
/** Full width of the forward cone, in radians. Shots land inside ± half of this. */
export const RAPID_CONE = (30 * Math.PI) / 180;

export const LASER_DURATION = 8;
export const LASER_DPS = 30;
export const LASER_AIM_DEADZONE = 22;

export const BOMB_FUSE = 3;
export const BOMB_SPEED = 88;
export const BOMB_DAMAGE = 200;
export const BOMB_BLAST_TIME = 0.55;

/** First ammo box, then the slow-to-fast gap. Both are the old delays divided by 1.5. */
export const AMMO_FIRST_DELAY = 5.5 / 1.5;
export const AMMO_INTERVAL_SLOW = 9 / 1.5;
export const AMMO_INTERVAL_FAST = 6.5 / 1.5;
export const AMMO_WEIGHT_100 = 0.6;
export const AMMO_WEIGHT_200 = 0.9;

export const WINGMAN_DURATION = 8;
export const WINGMAN_INTERVAL = 0.22;
export const WARP_DURATION = 5;
export const WARP_SCALE = 0.5;

export const MISSILE_COUNT = 20;
export const MISSILE_INTERVAL = 0.5;
export const MISSILE_DAMAGE = 8;
export const MISSILE_SPEED = 460;
export const MISSILE_TURN = 2.4;

export const SECTOR_BANNER = 1.8;
export const BATTLESHIP_HP = 40;
export const CARRIER_HP = 30;
