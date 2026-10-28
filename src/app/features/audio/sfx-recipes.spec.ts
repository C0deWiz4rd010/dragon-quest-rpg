import {
  MUSIC_THEMES,
  MusicTheme,
  SFX_RECIPES,
  SfxName,
  musicStep,
  stepSeconds,
} from './sfx-recipes';

describe('sfx recipes', () => {
  const names = Object.keys(SFX_RECIPES) as SfxName[];

  it('defines audible, finite events for every sound', () => {
    expect(names.length).toBeGreaterThanOrEqual(20);

    for (const name of names) {
      const events = SFX_RECIPES[name];

      expect(events.length, name).toBeGreaterThan(0);

      for (const event of events) {
        expect(event.dur, name).toBeGreaterThan(0);
        expect(event.dur, name).toBeLessThan(2);
        expect(event.at, name).toBeGreaterThanOrEqual(0);
        expect(event.gain, name).toBeGreaterThan(0);
        expect(event.gain, name).toBeLessThanOrEqual(0.3);

        if (event.kind === 'tone') {
          expect(event.freq, name).toBeGreaterThan(20);
          expect(event.freq, name).toBeLessThan(8000);
          if (event.freqEnd) expect(event.freqEnd, name).toBeGreaterThan(20);
        }
      }
    }
  });

  it('keeps sounds short enough not to blur together', () => {
    for (const name of names) {
      const length = Math.max(...SFX_RECIPES[name].map((event) => event.at + event.dur));
      const limit = name === 'victory' || name === 'defeat' || name === 'boss' ? 2 : 1.2;

      expect(length, name).toBeLessThanOrEqual(limit);
    }
  });
});

describe('procedural music', () => {
  const themes = Object.keys(MUSIC_THEMES) as MusicTheme[];

  it('covers every biome plus the boss theme', () => {
    for (const theme of ['ember', 'grove', 'ruin', 'frost', 'storm', 'sanctum', 'boss']) {
      expect(themes).toContain(theme);
    }
  });

  it('starts each bar with bass and a pad chord', () => {
    for (const theme of themes) {
      const notes = musicStep(theme, 0, () => 0.99);

      expect(notes.filter((note) => note.wave === 'triangle').length, theme).toBeGreaterThanOrEqual(1);
      expect(notes.filter((note) => note.wave === 'sine').length, theme).toBe(3);
    }
  });

  it('is deterministic for a fixed random source and silent between beats without melody', () => {
    expect(musicStep('ruin', 5, () => 0.99)).toEqual([]);
    expect(musicStep('ruin', 3, () => 0.1)).toEqual(musicStep('ruin', 3, () => 0.1));
    expect(musicStep('ruin', 3, () => 0.1).length).toBe(1);
  });

  it('keeps every note within a sane frequency range', () => {
    for (const theme of themes) {
      for (let step = 0; step < 32; step++) {
        for (const note of musicStep(theme, step)) {
          expect(note.freq, theme).toBeGreaterThan(30);
          expect(note.freq, theme).toBeLessThan(2500);
          expect(note.gain, theme).toBeLessThanOrEqual(0.5);
        }
      }
    }
  });

  it('plays the boss theme faster than the calm ones', () => {
    expect(stepSeconds('boss')).toBeLessThan(stepSeconds('frost'));
  });
});
