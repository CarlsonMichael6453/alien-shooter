/**
 * Shot voices, synthesized in Web Audio from these curves. No samples.
 * Regular ships share the retro zap. SuperPink uses the wobble ray.
 * Festive rings sleigh bells. MegaDark uses a deep thump.
 */
import { PEW_GAP } from './shipThemes';

export interface CurvedShot {
  kind: 'curve';
  name: 'retro-zap' | 'wobble-ray';
  type: 'sawtooth' | 'triangle';
  from: number;
  to: number;
  dur: number;
  /** f = to + (from - to) * (1 - t/dur) ^ curve */
  curve: number;
  /** Relative loudness is exp(-decay * t), then the optional wobble. */
  decay: number;
  /** Peak before the envelope. */
  gain: number;
  wobbleHz?: number;
  wobbleDepth?: number;
}

export interface BellHit {
  at: number;
  freq: number;
  decay: number;
  dur: number;
}

export interface BellsShot {
  kind: 'bells';
  name: 'sleigh-bells';
  /** Peak of a partial before exp(-decay * t). */
  gain: number;
  /** bell(f) = partials[i] * sine(ratios[i] * f) */
  partials: readonly number[];
  ratios: readonly number[];
  hits: readonly BellHit[];
  /** Noise mix, then exp(-shimmerDecay * t). */
  shimmer: number;
  shimmerDecay: number;
  shimmerDur: number;
}

export interface ThumpShot {
  kind: 'thump';
  name: 'deep-thump';
  type: 'sine';
  dur: number;
  /** f(t) = baseHz + dropHz * exp(-pitchDecay * t) */
  baseHz: number;
  dropHz: number;
  pitchDecay: number;
  /** Fundamental loudness is exp(-ampDecay * t) after the attack. */
  ampDecay: number;
  /** Second harmonic mix, with its own faster envelope exp(-harmonicDecay * t). */
  harmonic: number;
  harmonicDecay: number;
  /** Linear rise from silence, in seconds. */
  attack: number;
  /** tanh soft-clip drive. */
  drive: number;
  /** Peak of the fundamental before the envelope. */
  gain: number;
  /** Minimum time before this shot may play again. */
  gap: number;
}

export type ShotSpec = CurvedShot | BellsShot | ThumpShot;

export const RETRO_ZAP: CurvedShot = {
  kind: 'curve',
  name: 'retro-zap',
  type: 'sawtooth',
  from: 1800,
  to: 120,
  dur: 0.18,
  curve: 2,
  decay: 14,
  gain: 0.22,
};

export const WOBBLE_RAY: CurvedShot = {
  kind: 'curve',
  name: 'wobble-ray',
  type: 'triangle',
  from: 1500,
  to: 400,
  dur: 0.15,
  curve: 1.5,
  decay: 15,
  gain: 0.22,
  wobbleHz: 60,
  wobbleDepth: 0.5,
};

export const SLEIGH_BELLS: BellsShot = {
  kind: 'bells',
  name: 'sleigh-bells',
  gain: 0.18,
  partials: [1, 0.6, 0.4],
  ratios: [1, 2.76, 5.4],
  hits: [
    { at: 0, freq: 1568, decay: 18, dur: 0.18 },
    { at: 0.02, freq: 2093, decay: 20, dur: 0.16 },
    { at: 0.045, freq: 1760, decay: 22, dur: 0.15 },
  ],
  shimmer: 0.25,
  shimmerDecay: 40,
  shimmerDur: 0.12,
};

export const DEEP_THUMP: ThumpShot = {
  kind: 'thump',
  name: 'deep-thump',
  type: 'sine',
  dur: 0.3,
  baseHz: 40,
  dropHz: 80,
  pitchDecay: 25,
  ampDecay: 9,
  harmonic: 0.3,
  harmonicDecay: 20,
  attack: 0.003,
  drive: 1.5,
  gain: 0.45,
  gap: 0.08,
};

export function shotFor(shipId: string): ShotSpec {
  if (shipId === 'superpink') return WOBBLE_RAY;
  if (shipId === 'megadark') return DEEP_THUMP;
  if (shipId === 'festive') return SLEIGH_BELLS;
  return RETRO_ZAP;
}

/** MegaDark waits longer so the thump does not mush. Every other shot keeps the shared gap. */
export function shotGap(shot: ShotSpec): number {
  return shot.kind === 'thump' ? shot.gap : PEW_GAP;
}

/** f = f1 + (f0 - f1) * (1 - t/d) ^ curve */
export function sweepHz(from: number, to: number, dur: number, curve: number, t: number): number {
  const u = dur <= 0 ? 1 : Math.min(1, Math.max(0, t / dur));
  return to + (from - to) * (1 - u) ** curve;
}

/** One partial of one bell hit. Silent outside that hit's window. */
export function bellPartialLevel(shot: BellsShot, hitIndex: number, partialIndex: number, t: number): number {
  const hit = shot.hits[hitIndex];
  const local = t - hit.at;
  if (!hit || local < 0 || local > hit.dur) return 0;
  return shot.gain * shot.partials[partialIndex] * Math.exp(-hit.decay * local);
}

export function shimmerLevel(shot: BellsShot, t: number): number {
  if (t < 0 || t > shot.shimmerDur) return 0;
  return shot.gain * shot.shimmer * Math.exp(-shot.shimmerDecay * t);
}

export function shotLevel(shot: CurvedShot, t: number): number {
  const envelope = Math.exp(-shot.decay * t);
  if (shot.wobbleHz == null) return shot.gain * envelope;
  const wobble = 1 + (shot.wobbleDepth ?? 0) * Math.sin(2 * Math.PI * shot.wobbleHz * t);
  return shot.gain * envelope * wobble;
}

export function thumpHz(shot: ThumpShot, t: number): number {
  return shot.baseHz + shot.dropHz * Math.exp(-shot.pitchDecay * t);
}

export function attackGain(attack: number, t: number): number {
  if (attack <= 0) return 1;
  return Math.min(1, Math.max(0, t / attack));
}

export function thumpFundamental(shot: ThumpShot, t: number): number {
  return shot.gain * attackGain(shot.attack, t) * Math.exp(-shot.ampDecay * t);
}

export function thumpHarmonic(shot: ThumpShot, t: number): number {
  return shot.gain * shot.harmonic * attackGain(shot.attack, t) * Math.exp(-shot.harmonicDecay * t);
}

/** tanh(drive * x) / tanh(drive), so the ends stay at -1 and 1. */
export function softClipCurve(drive: number, samples = 1025): Float32Array<ArrayBuffer> {
  const count = Math.max(3, samples | 0);
  const curve = new Float32Array(count);
  const norm = Math.tanh(drive);
  const last = count - 1;
  for (let i = 0; i < count; i += 1) {
    const x = (i / last) * 2 - 1;
    curve[i] = Math.tanh(drive * x) / norm;
  }
  return curve;
}

export function sampleThump(shot: ThumpShot, frames: number): { freq: Float32Array; fund: Float32Array; harm: Float32Array } {
  const count = Math.max(2, frames);
  const freq = new Float32Array(count);
  const fund = new Float32Array(count);
  const harm = new Float32Array(count);
  const last = count - 1;
  for (let i = 0; i < count; i += 1) {
    const t = (i / last) * shot.dur;
    freq[i] = thumpHz(shot, t);
    fund[i] = thumpFundamental(shot, t);
    harm[i] = thumpHarmonic(shot, t);
  }
  return { freq, fund, harm };
}

export function sampleCurvedShot(shot: CurvedShot, frames: number): { freq: Float32Array; amp: Float32Array } {
  const count = Math.max(2, frames);
  const freq = new Float32Array(count);
  const amp = new Float32Array(count);
  const last = count - 1;
  for (let i = 0; i < count; i += 1) {
    const t = (i / last) * shot.dur;
    freq[i] = sweepHz(shot.from, shot.to, shot.dur, shot.curve, t);
    amp[i] = shotLevel(shot, t);
  }
  return { freq, amp };
}
