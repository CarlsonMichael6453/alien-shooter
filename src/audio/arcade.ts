/**
 * Original music and sound effects, synthesized in the browser with WebAudio.
 * There are no sampled recordings and no third-party audio files.
 */

export interface AudioSettings {
  music: number;
  sfx: number;
  musicOn: boolean;
  sfxOn: boolean;
}

export const DEFAULT_AUDIO: AudioSettings = { music: 0.7, sfx: 0.85, musicOn: true, sfxOn: true };
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
    };
  } catch {
    return { ...DEFAULT_AUDIO };
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

type Tone = 'square' | 'sawtooth' | 'triangle' | 'sine';

class ArcadeAudio {
  settings: AudioSettings = { ...DEFAULT_AUDIO };
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private nextBeat = 0;
  private step = 0;
  private sector = -1;
  private boss = false;
  private unlocked = false;

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
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    this.unlocked = true;
  }

  applySettings(next: AudioSettings): void {
    this.settings = {
      music: clamp01(next.music),
      sfx: clamp01(next.sfx),
      musicOn: next.musicOn,
      sfxOn: next.sfxOn,
    };
    this.pushGains();
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
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

  shoot(): void {
    this.tone(640, 0.06, 'square', 0.35, 0.45);
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

  power(kind: string): void {
    if (kind === 'shield') this.tone(480, 0.18, 'sine', 0.4, 1.6);
    else if (kind === 'warp') this.tone(300, 0.3, 'sawtooth', 0.3, 0.5);
    else if (kind === 'wingman') this.tone(660, 0.1, 'square', 0.3, 1.5);
    else if (kind === 'missiles') this.tone(440, 0.16, 'sawtooth', 0.32, 1.7);
    else this.tone(880, 0.1, 'square', 0.28, 1.2);
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

  tickMusic(sector: number, boss: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.unlocked || !this.settings.musicOn) return;
    if (sector !== this.sector || boss !== this.boss) {
      this.sector = sector;
      this.boss = boss;
      this.step = 0;
    }
    const roots = [196, 220, 247, 174.6, 233.1];
    const root = (boss ? 146.8 : roots[((sector % 5) + 5) % 5]) * (boss ? 1 : 1);
    const scale = boss ? [0, 3, 5, 6, 7, 10] : [0, 2, 4, 7, 9];
    const interval = boss ? 0.16 : 0.24;
    while (this.nextBeat < ctx.currentTime + 0.35) {
      const degree = scale[this.step % scale.length];
      const freq = root * 2 ** (degree / 12) * (this.step % 8 === 0 ? 0.5 : 1);
      this.tone(freq, boss ? 0.12 : 0.16, boss ? 'sawtooth' : 'triangle', this.step % 4 === 0 ? 0.7 : 0.4, 1, 'music');
      if (this.step % 2 === 0) this.tone(boss ? 90 : 70, 0.05, 'square', 0.25, 0.5, 'music');
      this.nextBeat += interval;
      this.step += 1;
    }
  }
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
