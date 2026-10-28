import { effect, Injectable, signal } from '@angular/core';

export type FontScale = 'sm' | 'md' | 'lg';

interface SettingsState {
  particles: boolean;
  animations: boolean;
  screenShake: boolean;
  sound: boolean;
  sfxVolume: number;
  musicVolume: number;
  highContrast: boolean;
  fontScale: FontScale;
}

const STORAGE_KEY = 'dragonQuestRpgSettings';

const DEFAULTS: SettingsState = {
  particles: true,
  animations: true,
  screenShake: true,
  sound: true,
  sfxVolume: 0.7,
  musicVolume: 0.35,
  highContrast: false,
  fontScale: 'md',
};

const FONT_SCALE_VALUE: Record<FontScale, string> = {
  sm: '0.92',
  md: '1',
  lg: '1.1',
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly initial = this.load();

  readonly particles = signal(this.initial.particles);
  readonly animations = signal(this.initial.animations);
  readonly screenShake = signal(this.initial.screenShake);
  readonly sound = signal(this.initial.sound);
  readonly sfxVolume = signal(this.initial.sfxVolume);
  readonly musicVolume = signal(this.initial.musicVolume);
  readonly highContrast = signal(this.initial.highContrast);
  readonly fontScale = signal<FontScale>(this.initial.fontScale);

  constructor() {
    effect(() => {
      const state: SettingsState = {
        particles: this.particles(),
        animations: this.animations(),
        screenShake: this.screenShake(),
        sound: this.sound(),
        sfxVolume: this.sfxVolume(),
        musicVolume: this.musicVolume(),
        highContrast: this.highContrast(),
        fontScale: this.fontScale(),
      };
      this.apply(state);
      this.persist(state);
    });
  }

  toggleParticles(): void {
    this.particles.update((value) => !value);
  }

  toggleAnimations(): void {
    this.animations.update((value) => !value);
  }

  toggleScreenShake(): void {
    this.screenShake.update((value) => !value);
  }

  toggleSound(): void {
    this.sound.update((value) => !value);
  }

  setSfxVolume(value: number): void {
    this.sfxVolume.set(clampVolume(value));
  }

  setMusicVolume(value: number): void {
    this.musicVolume.set(clampVolume(value));
  }

  toggleHighContrast(): void {
    this.highContrast.update((value) => !value);
  }

  setFontScale(scale: FontScale): void {
    this.fontScale.set(scale);
  }

  private apply(state: SettingsState): void {
    if (typeof document === 'undefined') {
      return;
    }
    const root = document.documentElement;
    root.classList.toggle('dq-no-particles', !state.particles);
    root.classList.toggle('dq-reduce-motion', !state.animations);
    root.classList.toggle('dq-high-contrast', state.highContrast);
    root.style.setProperty('--dq-font-scale', FONT_SCALE_VALUE[state.fontScale]);
  }

  private load(): SettingsState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { ...DEFAULTS };
      }
      const parsed = JSON.parse(raw) as Partial<SettingsState>;
      return {
        particles: parsed.particles ?? DEFAULTS.particles,
        animations: parsed.animations ?? DEFAULTS.animations,
        screenShake: parsed.screenShake ?? DEFAULTS.screenShake,
        sound: parsed.sound ?? DEFAULTS.sound,
        sfxVolume: clampVolume(parsed.sfxVolume ?? DEFAULTS.sfxVolume),
        musicVolume: clampVolume(parsed.musicVolume ?? DEFAULTS.musicVolume),
        highContrast: parsed.highContrast ?? DEFAULTS.highContrast,
        fontScale: parsed.fontScale ?? DEFAULTS.fontScale,
      };
    } catch {
      return { ...DEFAULTS };
    }
  }

  private persist(state: SettingsState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable — ignore */
    }
  }
}

function clampVolume(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}
