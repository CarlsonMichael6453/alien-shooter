/**
 * Original music and sound effects, synthesized in the browser with WebAudio.
 * There are no sampled recordings and no third-party audio files.
 */
import { shipMusic, type MusicVoice } from './shipThemes';

export interface AudioSettings {
  music: number;
  sfx: number;
  musicOn: boolean;
  sfxOn: boolean;
  vibrate: boolean;
}

export const DEFAULT_AUDIO: AudioSettings = { music: 0.7, sfx: 0.85, musicOn: true, sfxOn: true, vibrate: true };
const AUDIO_KEY = 'alien-shooter:audio';

export function parseAudioSettings(raw: string | null): AudioSettings {
  if (!raw) return { ...DEFAULT_AUDIO };
  try {
    const value = JSON.parse(raw) as Partial<AudioSettings> | null;
    if (!value || typeof value !== 'object') return { ...DEFAULT_AUDIO };
    return {
      music: clamp01(typeof value.music === 'number' ? value.music : DEFAULT_AUDIO.music),
      sfx: clamp01(typeof value.sfx === 'number' ? value.sfx : DEFAULT_AUDIO.sfx),
      musicOn: value.musicOn !== false,
      sfxOn: value.sfxOn !== false,
      vibrate: value.vibrate !== false,
    };
  } catch {
    return { ...DEFAULT_AUDIO };
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

type Tone = MusicVoice;

/** Charge into the beam, then the looping body, then the fall-away. Seconds, not gameplay time. */
export const LASER_CHARGE = 0.26;
export const LASER_TAIL = 0.42;

export type LaserIntent = 'play' | 'suspend' | 'off';

/** Beam heard only while it is firing and the run is not paused. Death and quit are off. */
export function laserIntent(beamOn: boolean, paused: boolean): LaserIntent {
  if (!beamOn) return 'off';
  if (paused) return 'suspend';
  return 'play';
}

class ArcadeAudio {
  settings: AudioSettings = { ...DEFAULT_AUDIO };
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private nextBeat = 0;
  private step = 0;
  private ship = '';
  private boss = false;
  private unlocked = false;
  private laser: LaserBed | null = null;

  installUnlock(): void {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      this.unlock();
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('touchstart', unlock, { capture: true });
    window.addEventListener('keydown', unlock);
  }

  unlock(): void {
    try {
      const ctx = this.ensure();
      if (!ctx) return;
      if (ctx.state === 'suspended') void ctx.resume();
      this.unlocked = true;
    } catch {
      // iOS only allows AudioContext from a gesture, and may still throw. Ignore it.
    }
  }

  applySettings(next: AudioSettings): void {
    this.settings = {
      music: clamp01(next.music),
      sfx: clamp01(next.sfx),
      musicOn: next.musicOn,
      sfxOn: next.sfxOn,
      vibrate: next.vibrate,
    };
    this.pushGains();
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === 'undefined') return null;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    let ctx: AudioContext;
    try {
      ctx = new Ctx();
    } catch {
      return null;
    }
    const music = ctx.createGain();
    const sfx = ctx.createGain();
    music.connect(ctx.destination);
    sfx.connect(ctx.destination);
    this.ctx = ctx;
    this.musicGain = music;
    this.sfxGain = sfx;
    this.pushGains();
    return ctx;
  }

  private pushGains(): void {
    const music = this.settings.musicOn ? this.settings.music * 0.18 : 0;
    const sfx = this.settings.sfxOn ? this.settings.sfx * 0.35 : 0;
    const now = this.ctx?.currentTime ?? 0;
    this.musicGain?.gain.setTargetAtTime(music, now, 0.05);
    this.sfxGain?.gain.setTargetAtTime(sfx, now, 0.03);
  }

  private tone(freq: number, dur: number, type: Tone, gain: number, slide = 0.5, bus: 'sfx' | 'music' = 'sfx'): void {
    const ctx = this.ctx;
    const dest = bus === 'music' ? this.musicGain : this.sfxGain;
    if (!ctx || !dest || !this.unlocked) return;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(40, freq), ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), ctx.currentTime + dur);
    amp.gain.setValueAtTime(gain, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(amp);
    amp.connect(dest);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  shoot(shipId = 'classic'): void {
    const theme = shipMusic(shipId);
    this.tone(theme.shoot, 0.06, theme.voice === 'sine' ? 'square' : theme.voice, 0.35, 0.45);
  }

  hit(): void {
    this.tone(220, 0.08, 'square', 0.4, 0.4);
  }

  explosion(): void {
    this.tone(140, 0.28, 'sawtooth', 0.55, 0.25);
    this.tone(70, 0.36, 'triangle', 0.4, 0.3);
  }

  pickup(): void {
    this.tone(520, 0.08, 'square', 0.3, 1.4);
    this.tone(780, 0.12, 'square', 0.25, 1);
  }

  syncLaser(beamOn: boolean, paused: boolean): void {
    try {
      this.syncLaserUnsafe(beamOn, paused);
    } catch {
      // Never let the beam synth abort the frame that fires bullets.
    }
  }

  private syncLaserUnsafe(beamOn: boolean, paused: boolean): void {
    const intent = laserIntent(beamOn, paused);
    if (intent === 'off') {
      this.laser?.end();
      return;
    }
    if (!this.unlocked || typeof window === 'undefined') return;
    const ctx = this.ensure();
    if (!ctx || !this.sfxGain) return;
    if (!this.laser || this.laser.dead) this.laser = new LaserBed(ctx, this.sfxGain);
    if (intent === 'suspend') this.laser.suspend();
    else this.laser.play();
  }

  power(kind: string, shipId = 'classic'): void {
    const theme = shipMusic(shipId);
    if (kind === 'shield') this.tone(theme.shoot * 0.75, 0.18, 'sine', 0.4, 1.6);
    else if (kind === 'warp') this.tone(theme.root * 1.4, 0.3, 'sawtooth', 0.3, 0.5);
    else if (kind === 'wingman') this.tone(theme.rapid * 0.75, 0.1, 'square', 0.3, 1.5);
    else if (kind === 'missiles') this.tone(theme.root * 2, 0.16, 'sawtooth', 0.32, 1.7);
    else if (kind === 'rapid') this.tone(theme.rapid, 0.08, 'square', 0.32, 1.4);
    else if (kind === 'laser') this.tone(theme.laser, 0.16, 'sawtooth', 0.28, 1.5);
    else this.tone(theme.rapid, 0.1, 'square', 0.28, 1.2);
  }

  bossIntro(): void {
    this.tone(110, 0.45, 'sawtooth', 0.6, 0.4);
    this.tone(82, 0.6, 'triangle', 0.5, 0.5);
  }

  bossAttack(): void {
    this.tone(180, 0.12, 'square', 0.35, 0.6);
  }

  bossWin(): void {
    this.tone(392, 0.12, 'square', 0.4, 1);
    this.tone(523, 0.14, 'square', 0.4, 1);
    this.tone(659, 0.22, 'square', 0.45, 1);
  }

  tickMusic(shipId: string, boss: boolean): void {
    try {
      this.tickMusicUnsafe(shipId, boss);
    } catch {
      // Music must not stop the game loop.
    }
  }

  private tickMusicUnsafe(shipId: string, boss: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.unlocked || !this.settings.musicOn) return;
    const theme = shipMusic(shipId);
    if (theme.id !== this.ship || boss !== this.boss) {
      this.ship = theme.id;
      this.boss = boss;
      this.step = 0;
      this.nextBeat = ctx.currentTime;
    }
    const root = theme.root * (boss ? 0.5 : 1);
    const scale = boss ? [0, 3, 5, 6, 7, 10] : theme.scale;
    const interval = boss ? Math.max(0.14, theme.interval * 0.7) : theme.interval;
    while (this.nextBeat < ctx.currentTime + 0.35) {
      const degree = scale[this.step % scale.length];
      const freq = root * 2 ** (degree / 12) * (this.step % 8 === 0 ? 0.5 : 1);
      this.tone(freq, boss ? 0.12 : 0.16, boss ? 'sawtooth' : theme.voice, this.step % 4 === 0 ? 0.7 : 0.4, 1, 'music');
      if (this.step % 2 === 0) this.tone(boss ? theme.root * 0.4 : theme.root * 0.35, 0.05, 'square', 0.25, 0.5, 'music');
      this.nextBeat += interval;
      this.step += 1;
    }
  }
}

class LaserBed {
  dead = false;
  private phase: 'idle' | 'play' | 'suspended' = 'idle';
  private bed: GainNode | null = null;
  private sources: AudioScheduledSourceNode[] = [];
  private hums: OscillatorNode[] = [];

  constructor(
    private ctx: AudioContext,
    private dest: GainNode,
  ) {}

  play(): void {
    if (this.dead || this.phase === 'play') return;
    if (this.phase === 'suspended' && this.bed) {
      this.phase = 'play';
      const now = this.ctx.currentTime;
      this.bed.gain.cancelScheduledValues(now);
      this.bed.gain.setValueAtTime(Math.max(0.0001, this.bed.gain.value), now);
      this.bed.gain.exponentialRampToValueAtTime(1, now + 0.08);
      return;
    }
    this.silence(0.03);
    this.start();
    this.phase = 'play';
  }

  suspend(): void {
    if (this.dead || this.phase !== 'play' || !this.bed) return;
    this.phase = 'suspended';
    const now = this.ctx.currentTime;
    this.bed.gain.cancelScheduledValues(now);
    this.bed.gain.setValueAtTime(Math.max(0.0001, this.bed.gain.value), now);
    this.bed.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
  }

  end(): void {
    if (this.dead || this.phase === 'idle') return;
    const tail = this.phase === 'suspended' ? 0.06 : LASER_TAIL;
    this.phase = 'idle';
    this.powerDown(tail);
    this.dead = true;
  }

  private start(): void {
    const now = this.ctx.currentTime;
    const bed = this.ctx.createGain();
    bed.gain.setValueAtTime(1, now);
    bed.connect(this.dest);
    this.bed = bed;

    const charge = this.ctx.createGain();
    charge.gain.setValueAtTime(0.0001, now);
    charge.gain.exponentialRampToValueAtTime(0.32, now + LASER_CHARGE * 0.72);
    charge.gain.exponentialRampToValueAtTime(0.0001, now + LASER_CHARGE + 0.08);
    charge.connect(bed);
    this.voice(180, 760, 'sine', 0.7, charge, now, LASER_CHARGE);
    this.voice(90, 380, 'sawtooth', 0.28, charge, now, LASER_CHARGE);

    const sustain = this.ctx.createGain();
    sustain.gain.setValueAtTime(0.0001, now);
    sustain.gain.exponentialRampToValueAtTime(1, now + LASER_CHARGE + 0.05);
    sustain.connect(bed);

    this.hum(92, 0.16, sustain, now);
    this.hum(184.6, 0.07, sustain, now);

    const buzzFilter = this.ctx.createBiquadFilter();
    buzzFilter.type = 'lowpass';
    buzzFilter.frequency.setValueAtTime(480, now);
    buzzFilter.Q.setValueAtTime(3.2, now);
    const buzzAmp = this.ctx.createGain();
    buzzAmp.gain.setValueAtTime(0.11, now);
    buzzFilter.connect(buzzAmp);
    buzzAmp.connect(sustain);
    const buzz = this.osc(61, 'sawtooth', now);
    buzz.connect(buzzFilter);
    this.wobble(buzz.frequency, 7, 14, now);

    const noiseAmp = this.ctx.createGain();
    noiseAmp.gain.setValueAtTime(0.05, now);
    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.setValueAtTime(1700, now);
    band.Q.setValueAtTime(0.7, now);
    band.connect(noiseAmp);
    noiseAmp.connect(sustain);
    const noise = this.ctx.createBufferSource();
    noise.buffer = crackleBuffer(this.ctx);
    noise.loop = true;
    noise.connect(band);
    noise.start(now);
    this.sources.push(noise);
    this.wobble(noiseAmp.gain, 0.035, 31, now);
  }

  private voice(from: number, to: number, type: Tone, gain: number, dest: GainNode, now: number, dur: number): void {
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(gain, now);
    amp.connect(dest);
    const osc = this.osc(from, type, now);
    osc.frequency.exponentialRampToValueAtTime(to, now + dur);
    osc.connect(amp);
    this.hums.push(osc);
  }

  private hum(freq: number, gain: number, dest: GainNode, now: number): void {
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(gain, now);
    amp.connect(dest);
    const osc = this.osc(freq, 'sine', now);
    osc.connect(amp);
    this.hums.push(osc);
  }

  private osc(freq: number, type: Tone, now: number): OscillatorNode {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.start(now);
    this.sources.push(osc);
    return osc;
  }

  private wobble(param: AudioParam, depth: number, rate: number, now: number): void {
    const lfo = this.ctx.createOscillator();
    const amount = this.ctx.createGain();
    lfo.frequency.setValueAtTime(rate, now);
    amount.gain.setValueAtTime(depth, now);
    lfo.connect(amount);
    amount.connect(param);
    lfo.start(now);
    this.sources.push(lfo);
  }

  private powerDown(seconds: number): void {
    const now = this.ctx.currentTime;
    const end = now + Math.max(0.03, seconds);
    if (this.bed) {
      this.bed.gain.cancelScheduledValues(now);
      this.bed.gain.setValueAtTime(Math.max(0.0001, this.bed.gain.value), now);
      this.bed.gain.exponentialRampToValueAtTime(0.0001, end);
    }
    for (const hum of this.hums) {
      try {
        hum.frequency.cancelScheduledValues(now);
        hum.frequency.setValueAtTime(Math.max(40, hum.frequency.value), now);
        hum.frequency.exponentialRampToValueAtTime(46, end);
      } catch {
        // A finished oscillator no longer accepts automation.
      }
    }
    this.silence(seconds);
    this.bed = null;
    this.hums = [];
  }

  private silence(seconds: number): void {
    const when = this.ctx.currentTime + Math.max(0.02, seconds);
    for (const source of this.sources) {
      try {
        source.stop(when);
      } catch {
        // Already stopped.
      }
    }
    this.sources = [];
  }
}

function crackleBuffer(ctx: AudioContext): AudioBuffer {
  const length = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let brown = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    brown = brown * 0.86 + white * 0.14;
    let sample = brown;
    if (Math.random() < 0.003) sample += white * 1.6;
    data[i] = Math.max(-1, Math.min(1, sample));
  }
  return buffer;
}

export const audio = new ArcadeAudio();

export async function loadAudio(store: { getItem(key: string): Promise<string | null> }): Promise<AudioSettings> {
  const settings = parseAudioSettings(await store.getItem(AUDIO_KEY));
  audio.applySettings(settings);
  return settings;
}

export async function saveAudio(
  store: { setItem(key: string, value: string): Promise<void> },
  settings: AudioSettings,
): Promise<void> {
  audio.applySettings(settings);
  await store.setItem(AUDIO_KEY, JSON.stringify(settings));
}
