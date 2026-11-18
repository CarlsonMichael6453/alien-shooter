export const START_LIVES = 3;
export const START_AMMO = 20;
export const SHIP_MARGIN = 28;
export const SHIP_HIT_RADIUS = 14;
export const BULLET_RADIUS = 6;
export const BULLET_DAMAGE = 1;
export const BULLET_SPEED = 780;
export const FIRE_INTERVAL = 0.12;
export const KEYBOARD_SPEED = 340;
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
export const LASER_DPS = 3;
export const LASER_AIM_DEADZONE = 22;

export const BOMB_FUSE = 3;
export const BOMB_SPEED = 88;
export const BOMB_DAMAGE = 15;
export const BOMB_BLAST_TIME = 0.55;

/** Share of ammo boxes that contain 10 rounds. The next slice, up to AMMO_WEIGHT_MID, contains 20. The rest contain 40. */
export const AMMO_WEIGHT_SMALL = 0.6;
export const AMMO_WEIGHT_MID = 0.9;
