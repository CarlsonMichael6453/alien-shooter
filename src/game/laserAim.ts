/** How far the beam may swing either side of straight up. */
export const LASER_AIM_LIMIT = (75 * Math.PI) / 180;

/** Stick travel that counts as a full swing to the limit. */
export const LASER_AIM_RADIUS = 34;

const LASER_AIM_DEAD = 0.2;

/** Straight up. The stick keeps the beam inside ±75° of this. */
const LASER_UP = -Math.PI / 2;

/**
 * Turn a finger offset from the laser stick's center into a beam angle.
 * A nudge inside the dead zone returns null so the last angle stays put.
 */
export function laserAngleFromStick(dx: number, dy: number, radius = LASER_AIM_RADIUS): number | null {
  if (radius <= 0) return null;
  const mag = Math.hypot(dx, dy);
  if (mag < radius * LASER_AIM_DEAD) return null;
  const raw = Math.atan2(dy, dx);
  let delta = raw - LASER_UP;
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  if (delta > LASER_AIM_LIMIT) delta = LASER_AIM_LIMIT;
  if (delta < -LASER_AIM_LIMIT) delta = -LASER_AIM_LIMIT;
  return LASER_UP + delta;
}

export function clampLaserAngle(angle: number): number {
  let delta = angle - LASER_UP;
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  if (delta > LASER_AIM_LIMIT) delta = LASER_AIM_LIMIT;
  if (delta < -LASER_AIM_LIMIT) delta = -LASER_AIM_LIMIT;
  return LASER_UP + delta;
}
