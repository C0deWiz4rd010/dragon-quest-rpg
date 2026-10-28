import { DestroyRef, Injectable, InjectionToken, effect, inject, signal } from '@angular/core';

import { SettingsService } from '../game-state/settings.service';
import {
  MusicTheme,
  SFX_RECIPES,
  SfxEvent,
  SfxName,
  musicStep,
  stepSeconds,
} from './sfx-recipes';

/** Creates the AudioContext; returns null where WebAudio is unavailable (tests, old browsers). */
export const AUDIO_CONTEXT_FACTORY = new InjectionToken<() => AudioContext | null>(
  'AUDIO_CONTEXT_FACTORY',
  {
    providedIn: 'root',
    factory: () => () => {
      const Ctor =
        typeof window === 'undefined'
          ? undefined
          : (window.AudioContext ??
            (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);

      return Ctor ? new Ctor() : null;
    },
  },
);

/** Minimum gap between two plays of the same sound, so rapid events never pile up. */
const MIN_REPEAT_SECONDS = 0.045;
/** How far ahead (seconds) the music scheduler fills the timeline. */
const MUSIC_LOOKAHEAD = 0.7;

/**
 * Synthesised sound effects and generative music. Browsers only allow audio after a user
 * gesture, so the context is created lazily on the first pointer or key press.
 */
@Injectable({ providedIn: 'root' })
export class AudioService {
  private readonly settings = inject(SettingsService);
  private readonly createContext = inject(AUDIO_CONTEXT_FACTORY);

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private readonly lastPlayed = new Map<SfxName, number>();

  private musicTheme: MusicTheme | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private musicStepIndex = 0;
  private musicNextTime = 0;

  /** True once the browser let us create the context (after a user gesture). */
  readonly ready = signal(false);

  constructor() {
    if (typeof window !== 'undefined') {
      const unlock = () => this.unlock();
      window.addEventListener('pointerdown', unlock, { once: true });
      window.addEventListener('keydown', unlock, { once: true });
      document.addEventListener('visibilitychange', this.onVisibility);
    }

    effect(() => {
      // Track every volume signal so changes apply immediately.
      const enabled = this.settings.sound();
      const sfx = this.settings.sfxVolume();
      const music = this.settings.musicVolume();
      this.applyVolumes(enabled, sfx, music);
    });

    inject(DestroyRef).onDestroy(() => {
      this.stopMusic();
      document.removeEventListener('visibilitychange', this.onVisibility);
    });
  }

  /** Creates and resumes the AudioContext. Safe to call repeatedly. */
  unlock(): void {
    if (!this.ctx) {
      const ctx = this.createContext();

      if (!ctx) {
        return;
      }

      this.ctx = ctx;
      this.master = ctx.createGain();
      this.sfxBus = ctx.createGain();
      this.musicBus = ctx.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus.connect(this.master);
      this.master.connect(ctx.destination);
      this.applyVolumes(
        this.settings.sound(),
        this.settings.sfxVolume(),
        this.settings.musicVolume(),
      );
    }

    void this.ctx.resume?.();
    this.ready.set(true);

    if (this.musicTheme) {
      this.startMusicLoop();
    }
  }

  /** Plays a sound effect; silently ignored while muted or before the first gesture. */
  play(name: SfxName): void {
    const ctx = this.ctx;

    if (!ctx || !this.sfxBus || !this.settings.sound() || this.settings.sfxVolume() <= 0) {
      return;
    }

    const now = ctx.currentTime;
    const last = this.lastPlayed.get(name) ?? -1;

    if (now - last < MIN_REPEAT_SECONDS) {
      return;
    }

    this.lastPlayed.set(name, now);

    for (const event of SFX_RECIPES[name]) {
      this.schedule(event, now, this.sfxBus);
    }
  }

  /** Switches the background music; null stops it. */
  setMusic(theme: MusicTheme | null): void {
    if (theme === this.musicTheme) {
      return;
    }

    this.musicTheme = theme;
    this.musicStepIndex = 0;

    if (!theme) {
      this.stopMusic();
    } else if (this.ctx) {
      this.startMusicLoop();
    }
  }

  private applyVolumes(enabled: boolean, sfx: number, music: number): void {
    if (!this.ctx || !this.master || !this.sfxBus || !this.musicBus) {
      return;
    }

    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(enabled ? 1 : 0, t, 0.03);
    this.sfxBus.gain.setTargetAtTime(sfx, t, 0.03);
    this.musicBus.gain.setTargetAtTime(music * 0.5, t, 0.08);
  }

  private schedule(event: SfxEvent, start: number, bus: GainNode): void {
    const ctx = this.ctx;

    if (!ctx) {
      return;
    }

    const at = start + event.at;
    const end = at + event.dur;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, event.gain), at + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    gain.connect(bus);

    if (event.kind === 'tone') {
      const osc = ctx.createOscillator();
      osc.type = event.wave;
      osc.frequency.setValueAtTime(event.freq, at);
      if (event.freqEnd) {
        osc.frequency.exponentialRampToValueAtTime(event.freqEnd, end);
      }
      osc.connect(gain);
      osc.start(at);
      osc.stop(end + 0.02);
      return;
    }

    const source = ctx.createBufferSource();
    source.buffer = this.getNoise(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = event.cutoff;
    source.connect(filter);
    filter.connect(gain);
    source.start(at);
    source.stop(end + 0.02);
  }

  private getNoise(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuffer) {
      const length = Math.floor(ctx.sampleRate * 0.6);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      this.noiseBuffer = buffer;
    }

    return this.noiseBuffer;
  }

  // ───────────── Music ─────────────

  private startMusicLoop(): void {
    this.stopMusic();

    if (!this.ctx || !this.musicTheme) {
      return;
    }

    this.musicNextTime = this.ctx.currentTime + 0.1;
    this.musicTimer = setInterval(() => this.fillMusic(), 220);
    this.fillMusic();
  }

  private stopMusic(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private fillMusic(): void {
    const ctx = this.ctx;
    const theme = this.musicTheme;

    if (!ctx || !theme || !this.musicBus || ctx.state === 'suspended') {
      return;
    }

    const step = stepSeconds(theme);

    while (this.musicNextTime < ctx.currentTime + MUSIC_LOOKAHEAD) {
      if (this.settings.musicVolume() > 0 && this.settings.sound()) {
        for (const note of musicStep(theme, this.musicStepIndex)) {
          this.schedule(
            {
              kind: 'tone',
              wave: note.wave,
              freq: note.freq,
              at: 0,
              dur: note.dur * step * 2,
              gain: note.gain,
            },
            this.musicNextTime + note.at * step * 2,
            this.musicBus,
          );
        }
      }

      this.musicNextTime += step;
      this.musicStepIndex++;
    }
  }

  /** Pauses everything while the tab is hidden to save battery and avoid background noise. */
  private readonly onVisibility = (): void => {
    const ctx = this.ctx;

    if (!ctx) {
      return;
    }

    if (document.hidden) {
      void ctx.suspend?.();
    } else {
      void ctx.resume?.();
    }
  };
}
