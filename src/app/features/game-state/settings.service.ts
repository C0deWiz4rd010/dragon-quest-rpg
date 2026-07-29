import { effect, Injectable, signal } from '@angular/core';

export type FontScale = 'sm' | 'md' | 'lg';

interface SettingsState {
  particles: boolean;
  animations: boolean;
  highContrast: boolean;
  fontScale: FontScale;
}

const STORAGE_KEY = 'dragonQuestRpgSettings';

const DEFAULTS: SettingsState = {
  particles: true,
  animations: true,
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
  readonly highContrast = signal(this.initial.highContrast);
  readonly fontScale = signal<FontScale>(this.initial.fontScale);

  constructor() {
    effect(() => {
      const state: SettingsState = {
        particles: this.particles(),
        animations: this.animations(),
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
