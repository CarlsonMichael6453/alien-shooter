import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LASER_AIM_LIMIT, LASER_AIM_RADIUS, laserAngleFromStick } from './laserAim';

const UP = -Math.PI / 2;

describe('laser aim stick', () => {
  it('leaves the beam alone inside the dead zone', () => {
    assert.equal(laserAngleFromStick(0, 0), null);
    assert.equal(laserAngleFromStick(2, -3), null);
  });

  it('aims straight up when the stick is pushed up', () => {
    const angle = laserAngleFromStick(0, -LASER_AIM_RADIUS);
    assert.ok(angle != null);
    assert.ok(Math.abs(angle - UP) < 0.001);
  });

  it('stops at about 75 degrees either side of straight up', () => {
    const right = laserAngleFromStick(LASER_AIM_RADIUS, 0);
    const left = laserAngleFromStick(-LASER_AIM_RADIUS, 0);
    const down = laserAngleFromStick(0, LASER_AIM_RADIUS);
    assert.ok(right != null && left != null && down != null);
    assert.ok(Math.abs(right - (UP + LASER_AIM_LIMIT)) < 0.001);
    assert.ok(Math.abs(left - (UP - LASER_AIM_LIMIT)) < 0.001);
    assert.ok(Math.abs(Math.abs(down - UP) - LASER_AIM_LIMIT) < 0.001);
    assert.ok(LASER_AIM_LIMIT > (70 * Math.PI) / 180 && LASER_AIM_LIMIT < (80 * Math.PI) / 180);
  });
});
