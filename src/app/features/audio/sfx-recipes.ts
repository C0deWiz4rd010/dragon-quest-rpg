/**
 * Pure, data-only description of every sound in the game. The AudioService turns these
 * recipes into WebAudio nodes; keeping them as data makes them testable without a browser.
 */

export type SfxName =
  | 'ui'
  | 'attack'
  | 'hit'
  | 'crit'
  | 'skill'
  | 'heal'
  | 'guard'
  | 'potion'
  | 'playerHit'
  | 'death'
  | 'levelUp'
  | 'loot'
  | 'achievement'
  | 'status'
  | 'stun'
  | 'encounter'
  | 'elite'
  | 'boss'
  | 'step'
  | 'minigameWin'
  | 'victory'
  | 'defeat';

export type Waveform = 'sine' | 'square' | 'sawtooth' | 'triangle';

export interface ToneEvent {
  kind: 'tone';
  wave: Waveform;
  freq: number;
  /** Optional pitch the tone glides to over its duration. */
  freqEnd?: number;
  /** Seconds after the sound starts. */
  at: number;
  dur: number;
  gain: number;
}

export interface NoiseEvent {
  kind: 'noise';
  at: number;
  dur: number;
  gain: number;
  /** High-pass cutoff in Hz; higher = airier "swish", lower = thud. */
  cutoff: number;
}

export type SfxEvent = ToneEvent | NoiseEvent;

const tone = (
  wave: Waveform,
  freq: number,
  at: number,
  dur: number,
  gain: number,
  freqEnd?: number,
): ToneEvent => ({ kind: 'tone', wave, freq, freqEnd, at, dur, gain });

const noise = (at: number, dur: number, gain: number, cutoff: number): NoiseEvent => ({
  kind: 'noise',
  at,
  dur,
  gain,
  cutoff,
});

/** Notes of a rising arpeggio, `step` seconds apart. */
function arpeggio(wave: Waveform, freqs: number[], step: number, dur: number, gain: number): ToneEvent[] {
  return freqs.map((freq, index) => tone(wave, freq, index * step, dur, gain));
}

export const SFX_RECIPES: Record<SfxName, SfxEvent[]> = {
  ui: [tone('sine', 760, 0, 0.035, 0.07)],
  attack: [noise(0, 0.09, 0.22, 2400), tone('triangle', 320, 0, 0.1, 0.12, 140)],
  hit: [tone('square', 190, 0, 0.12, 0.16, 80), noise(0, 0.07, 0.14, 900)],
  crit: [
    tone('square', 240, 0, 0.14, 0.18, 90),
    noise(0, 0.08, 0.18, 1400),
    tone('triangle', 880, 0.03, 0.14, 0.14, 1320),
    tone('sine', 1760, 0.1, 0.18, 0.09),
  ],
  skill: [
    tone('sawtooth', 180, 0, 0.38, 0.13, 900),
    tone('sine', 1200, 0.18, 0.22, 0.1, 1600),
    noise(0.05, 0.3, 0.1, 3000),
  ],
  heal: arpeggio('sine', [523.25, 659.25, 783.99, 1046.5], 0.085, 0.2, 0.13),
  guard: [tone('triangle', 660, 0, 0.06, 0.14), tone('square', 330, 0.02, 0.12, 0.09)],
  potion: [tone('sine', 420, 0, 0.11, 0.13, 760), tone('sine', 520, 0.12, 0.11, 0.13, 900)],
  playerHit: [tone('sawtooth', 130, 0, 0.18, 0.18, 55), noise(0, 0.1, 0.16, 500)],
  death: [tone('sawtooth', 420, 0, 0.5, 0.16, 50), noise(0.02, 0.35, 0.14, 600)],
  levelUp: [
    ...arpeggio('square', [523.25, 659.25, 783.99, 1046.5, 1318.5], 0.09, 0.16, 0.1),
    tone('triangle', 1046.5, 0.45, 0.5, 0.12),
  ],
  loot: [tone('sine', 1318.5, 0, 0.09, 0.12), tone('sine', 1760, 0.08, 0.18, 0.12)],
  achievement: arpeggio('triangle', [783.99, 987.77, 1174.66], 0.11, 0.3, 0.14),
  status: [tone('sawtooth', 300, 0, 0.22, 0.1, 150), tone('square', 150, 0.05, 0.2, 0.08, 120)],
  stun: [
    tone('square', 1000, 0, 0.05, 0.1),
    tone('square', 1400, 0.06, 0.05, 0.1),
    tone('square', 1000, 0.12, 0.05, 0.1),
  ],
  encounter: [tone('triangle', 196, 0, 0.14, 0.1, 160)],
  elite: [tone('sawtooth', 110, 0, 0.35, 0.12, 90), tone('triangle', 220, 0.1, 0.3, 0.09)],
  boss: [
    tone('sawtooth', 55, 0, 0.9, 0.2, 48),
    tone('sawtooth', 110, 0.05, 0.85, 0.12, 96),
    noise(0, 0.6, 0.12, 300),
    tone('square', 220, 0.5, 0.4, 0.08, 165),
  ],
  step: [tone('triangle', 330, 0, 0.05, 0.05), tone('triangle', 247, 0.06, 0.06, 0.05)],
  minigameWin: arpeggio('square', [659.25, 880, 1318.5], 0.08, 0.14, 0.1),
  victory: [
    ...arpeggio('square', [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568], 0.12, 0.2, 0.11),
    tone('triangle', 1046.5, 0.75, 0.9, 0.14),
    tone('triangle', 784, 0.75, 0.9, 0.1),
  ],
  defeat: [
    ...arpeggio('triangle', [440, 392, 349.23, 293.66], 0.22, 0.4, 0.14),
    tone('sawtooth', 110, 0.8, 0.9, 0.12, 70),
  ],
};

// ───────────── Procedural music ─────────────

export type MusicTheme = 'ember' | 'grove' | 'ruin' | 'frost' | 'storm' | 'sanctum' | 'boss';

export interface MusicNote {
  wave: Waveform;
  freq: number;
  /** Beats after the step start. */
  at: number;
  /** Duration in beats. */
  dur: number;
  gain: number;
}

interface ThemeConfig {
  /** Root note in Hz. */
  root: number;
  /** Scale as semitone offsets above the root. */
  scale: number[];
  bpm: number;
  /** Probability of a melody note on each eighth-note step. */
  melodyChance: number;
  melodyWave: Waveform;
}

export const MUSIC_THEMES: Record<MusicTheme, ThemeConfig> = {
  ember: { root: 98, scale: [0, 1, 4, 5, 7, 8, 11], bpm: 84, melodyChance: 0.4, melodyWave: 'square' },
  grove: { root: 130.81, scale: [0, 2, 4, 7, 9], bpm: 72, melodyChance: 0.38, melodyWave: 'triangle' },
  ruin: { root: 110, scale: [0, 2, 3, 5, 7, 8, 10], bpm: 66, melodyChance: 0.3, melodyWave: 'triangle' },
  frost: { root: 146.83, scale: [0, 2, 4, 6, 7, 9, 11], bpm: 60, melodyChance: 0.26, melodyWave: 'sine' },
  storm: { root: 82.41, scale: [0, 3, 5, 7, 10], bpm: 92, melodyChance: 0.42, melodyWave: 'sawtooth' },
  sanctum: { root: 174.61, scale: [0, 2, 4, 7, 9], bpm: 64, melodyChance: 0.34, melodyWave: 'sine' },
  boss: { root: 73.42, scale: [0, 1, 3, 5, 6, 8, 10], bpm: 112, melodyChance: 0.5, melodyWave: 'sawtooth' },
};

const semitone = (root: number, steps: number) => root * Math.pow(2, steps / 12);

/** Seconds per eighth-note step for a theme. */
export function stepSeconds(theme: MusicTheme): number {
  return 60 / MUSIC_THEMES[theme].bpm / 2;
}

/**
 * Notes to play on eighth-note `step` of a theme: a low pulse every bar half, a pad chord
 * at the start of each bar and sparse melody notes drawn from the scale.
 */
export function musicStep(theme: MusicTheme, step: number, random: () => number = Math.random): MusicNote[] {
  const config = MUSIC_THEMES[theme];
  const notes: MusicNote[] = [];
  const inBar = step % 16;

  if (inBar % 8 === 0) {
    const fifth = inBar === 0 ? 0 : 7;
    notes.push({ wave: 'triangle', freq: semitone(config.root / 2, fifth), at: 0, dur: 3.6, gain: 0.5 });
  }

  if (inBar === 0) {
    for (const interval of [0, config.scale[2] ?? 4, config.scale[4] ?? 7]) {
      notes.push({ wave: 'sine', freq: semitone(config.root * 2, interval), at: 0, dur: 7, gain: 0.16 });
    }
  }

  if (random() < config.melodyChance) {
    const degree = Math.floor(random() * config.scale.length);
    const octave = random() < 0.3 ? 4 : 2;
    notes.push({
      wave: config.melodyWave,
      freq: semitone(config.root * octave, config.scale[degree] ?? 0),
      at: 0,
      dur: random() < 0.5 ? 1 : 2,
      gain: 0.22,
    });
  }

  return notes;
}
