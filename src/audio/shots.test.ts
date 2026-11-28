import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FIRE_INTERVAL } from '../game/constants';
import { PEW_GAP, pewAllowed } from './shipThemes';
import {
  DEEP_THUMP,
  QUICK_DIVE,
  SLEIGH_BELLS,
  WOBBLE_RAY,
  bellPartialLevel,
  diveHz,
  diveLevel,
  sampleDive,
  shimmerLevel,
  sampleCurvedShot,
  sampleThump,
  shotFor,
  THUMP_HANDOFF,
  thumpReleaseGain,
  shotGap,
  shotLevel,
  softClipCurve,
  sweepHz,
  thumpFundamental,
  thumpHarmonic,
  thumpHz,
} from './shots';

describe('shot sounds', () => {
  it('gives every regular ship the quick sine dive', () => {
    for (const id of ['classic', 'ember', 'violet', 'gold', 'nope']) {
      const shot = shotFor(id);
      assert.equal(shot, QUICK_DIVE);
      assert.equal(shot.kind, 'dive');
      assert.equal(shot.type, 'sine');
      assert.equal(shot.dur, 0.08);
      assert.equal(shot.rise, 0.0064);
      assert.equal(shot.riseFrom, 4500);
      assert.equal(shot.riseTo, 5100);
      assert.equal(shot.dropTo, 500);
      assert.equal(shot.attack, 0.008);
      assert.equal(shot.decay, 34);
      assert.equal(shot.gain, 0.11);
    }
  });

  it('rises briefly, then front-loads the drop, and keeps the voice limiter', () => {
    assert.equal(diveHz(QUICK_DIVE, 0), 4500);
    assert.ok(Math.abs(diveHz(QUICK_DIVE, 0.0064) - 5100) < 1e-6);
    assert.ok(Math.abs(diveHz(QUICK_DIVE, 0.08) - 500) < 1e-6);
    const span = 0.08 - 0.0064;
    const early = 0.0064 + span * 0.25;
    const expectedEarly = 5100 * (500 / 5100) ** Math.sqrt(0.25);
    assert.ok(Math.abs(diveHz(QUICK_DIVE, early) - expectedEarly) < 1e-6);
    assert.ok(expectedEarly < 2000);
    assert.equal(diveLevel(QUICK_DIVE, 0), 0);
    const attackEnd = 0.11 * Math.exp(-34 * 0.008);
    assert.ok(Math.abs(diveLevel(QUICK_DIVE, 0.008) - attackEnd) < 1e-12);
    const t = 0.04;
    assert.ok(Math.abs(diveLevel(QUICK_DIVE, t) - 0.11 * Math.exp(-34 * t)) < 1e-12);
    assert.equal(QUICK_DIVE.dur, FIRE_INTERVAL);
    assert.equal(shotGap(QUICK_DIVE), PEW_GAP);
    assert.equal(pewAllowed(0, 0.02), false);
    assert.equal(pewAllowed(0, 0.01), false);
    assert.equal(pewAllowed(0, 0.04), false);
    assert.equal(pewAllowed(0, FIRE_INTERVAL), true);
    const sampled = sampleDive(QUICK_DIVE, 161);
    assert.ok(Math.abs(sampled.freq[0] - 4500) < 1e-2);
    assert.ok(Math.abs(sampled.freq[160] - 500) < 1);
    assert.equal(sampled.amp[0], 0);
  });

  it('gives SuperPink the wobble ray', () => {
    const shot = shotFor('superpink');
    assert.equal(shot, WOBBLE_RAY);
    assert.equal(shot.type, 'triangle');
    assert.equal(shot.from, 1500);
    assert.equal(shot.to, 400);
    assert.equal(shot.dur, 0.15);
    assert.equal(shot.curve, 1.5);
    assert.equal(shot.decay, 15);
    assert.equal(shot.wobbleHz, 60);
    assert.equal(shot.wobbleDepth, 0.5);
    const t = 1 / 240;
    const expectedHz = 400 + (1500 - 400) * (1 - t / 0.15) ** 1.5;
    const expectedAmp = Math.exp(-15 * t) * (1 + 0.5 * Math.sin(2 * Math.PI * 60 * t));
    assert.ok(Math.abs(sweepHz(shot.from, shot.to, shot.dur, shot.curve, t) - expectedHz) < 1e-9);
    assert.ok(Math.abs(shotLevel(shot, t) - shot.gain * expectedAmp) < 1e-9);
    assert.ok(Math.abs(shotLevel(shot, 0) - shot.gain) < 1e-9);
  });

  it('samples the wobble ray the synthesizer schedules', () => {
    const { freq, amp } = sampleCurvedShot(WOBBLE_RAY, 49);
    assert.equal(freq[0], 1500);
    assert.ok(Math.abs(freq[freq.length - 1] - 400) < 1e-3);
    const mid = 24;
    const t = (mid / 48) * WOBBLE_RAY.dur;
    assert.ok(Math.abs(freq[mid] - sweepHz(1500, 400, 0.15, 1.5, t)) < 1e-3);
    const wobble = 1 + 0.5 * Math.sin(2 * Math.PI * 60 * t);
    assert.ok(Math.abs(amp[mid] - WOBBLE_RAY.gain * Math.exp(-15 * t) * wobble) < 1e-4);
  });

  it('gives Festive sleigh bells and keeps the shared repeat gap', () => {
    const shot = shotFor('festive');
    assert.equal(shot, SLEIGH_BELLS);
    if (shot.kind !== 'bells') return;
    assert.deepEqual(shot.partials, [1, 0.6, 0.4]);
    assert.deepEqual(shot.ratios, [1, 2.76, 5.4]);
    assert.deepEqual(
      shot.hits.map((hit) => [hit.at, hit.freq, hit.decay, hit.dur]),
      [
        [0, 1568, 18, 0.18],
        [0.02, 2093, 20, 0.16],
        [0.045, 1760, 22, 0.15],
      ],
    );
    assert.equal(shot.shimmer, 0.25);
    assert.equal(shot.shimmerDecay, 40);
    assert.equal(shotGap(shot), 0.05);
    assert.equal(pewAllowed(1, 1.02, shotGap(shot)), false);
    assert.equal(pewAllowed(1, 1.05, shotGap(shot)), true);
    const t = 0.05;
    assert.equal(bellPartialLevel(shot, 0, 0, t), shot.gain * Math.exp(-18 * t));
    assert.ok(Math.abs(bellPartialLevel(shot, 0, 1, t) - shot.gain * 0.6 * Math.exp(-18 * t)) < 1e-12);
    assert.ok(Math.abs(bellPartialLevel(shot, 0, 2, t) - shot.gain * 0.4 * Math.exp(-18 * t)) < 1e-12);
    assert.equal(bellPartialLevel(shot, 1, 0, 0.01), 0);
    assert.ok(Math.abs(bellPartialLevel(shot, 1, 0, 0.02) - shot.gain) < 1e-12);
    assert.equal(bellPartialLevel(shot, 2, 0, 0.04), 0);
    assert.ok(Math.abs(shimmerLevel(shot, 0.03) - shot.gain * 0.25 * Math.exp(-40 * 0.03)) < 1e-12);
    assert.equal(shimmerLevel(shot, shot.shimmerDur + 0.01), 0);
  });

  it('gives MegaDark a deep thump and a longer repeat gap', () => {
    const shot = shotFor('megadark');
    assert.equal(shot, DEEP_THUMP);
    if (shot.kind !== 'thump') return;
    assert.equal(shot.type, 'sine');
    assert.equal(shot.dur, 0.09);
    assert.ok(shot.dur <= shot.gap + shot.release);
    assert.equal(shot.attack, 0.003);
    assert.equal(shot.release, THUMP_HANDOFF);
    assert.ok(shot.release >= 0.01 && shot.release <= 0.015);
    assert.equal(shot.drive, 1.5);
    assert.equal(shot.harmonic, 0.3);
    assert.equal(shotGap(shot), 0.08);
    assert.equal(shotGap(shotFor('classic')), 0.05);
    assert.equal(pewAllowed(1, 1.02, shot.gap), false);
    assert.equal(pewAllowed(1, 1.01, shot.gap), false);
    assert.equal(pewAllowed(1, 1.04, shot.gap), false);
    assert.equal(pewAllowed(1, 1.08, shot.gap), true);
    assert.equal(thumpHz(shot, 0), 120);
    const t = 0.04;
    assert.ok(Math.abs(thumpHz(shot, t) - (40 + 80 * Math.exp(-25 * t))) < 1e-9);
    assert.equal(thumpFundamental(shot, 0), 0);
    assert.ok(Math.abs(thumpFundamental(shot, 0.0015) - shot.gain * 0.5 * Math.exp(-9 * 0.0015)) < 1e-9);
    assert.ok(Math.abs(thumpFundamental(shot, t) - shot.gain * Math.exp(-9 * t)) < 1e-9);
    assert.ok(Math.abs(thumpHarmonic(shot, t) - shot.gain * 0.3 * Math.exp(-20 * t)) < 1e-9);
    assert.equal(thumpReleaseGain(shot, t), 1);
    assert.equal(thumpFundamental(shot, shot.dur), 0);
    assert.equal(thumpHarmonic(shot, shot.dur), 0);
    const sampled = sampleThump(shot, 31);
    assert.equal(sampled.freq[0], 120);
    assert.equal(sampled.fund[0], 0);
    assert.ok(Math.abs(sampled.freq[30] - thumpHz(shot, shot.dur)) < 1e-4);
    assert.ok(sampled.harm[10] > 0);
    const curve = softClipCurve(shot.drive, 5);
    assert.ok(Math.abs(curve[0] + 1) < 1e-9);
    assert.ok(Math.abs(curve[2]) < 1e-9);
    assert.ok(Math.abs(curve[4] - 1) < 1e-9);
    const shaped = Math.tanh(shot.drive * 0.5) / Math.tanh(shot.drive);
    assert.ok(Math.abs(curve[3] - shaped) < 1e-6);
    assert.ok(curve[3] > 0.5);
    assert.ok(1 - curve[3] < curve[3] - curve[2]);
  });
});
