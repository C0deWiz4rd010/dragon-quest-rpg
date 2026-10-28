import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { SettingsService } from '../game-state/settings.service';
import { AUDIO_CONTEXT_FACTORY, AudioService } from './audio.service';

class FakeParam {
  value = 0;
  setValueAtTime(value: number) {
    this.value = value;
  }
  exponentialRampToValueAtTime(value: number) {
    this.value = value;
  }
  setTargetAtTime(value: number) {
    this.value = value;
  }
}

class FakeNode {
  readonly gain = new FakeParam();
  readonly frequency = new FakeParam();
  type = '';
  buffer: unknown = null;
  started = 0;
  connect() {
    return this;
  }
  start() {
    this.started++;
  }
  stop() {
    /* nothing to stop in the fake */
  }
}

class FakeContext {
  currentTime = 1;
  state = 'running';
  sampleRate = 8000;
  destination = {};
  readonly gains: FakeNode[] = [];
  readonly oscillators: FakeNode[] = [];
  readonly sources: FakeNode[] = [];
  createGain() {
    const node = new FakeNode();
    this.gains.push(node);
    return node;
  }
  createOscillator() {
    const node = new FakeNode();
    this.oscillators.push(node);
    return node;
  }
  createBufferSource() {
    const node = new FakeNode();
    this.sources.push(node);
    return node;
  }
  createBiquadFilter() {
    return new FakeNode();
  }
  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) };
  }
  resume = vi.fn(() => Promise.resolve());
  suspend = vi.fn(() => Promise.resolve());
}

describe('AudioService', () => {
  let ctx: FakeContext;
  let settings: SettingsService;
  let service: AudioService;

  function setup(factory?: () => unknown): void {
    TestBed.configureTestingModule({
      providers: [{ provide: AUDIO_CONTEXT_FACTORY, useValue: factory ?? (() => ctx) }],
    });
    settings = TestBed.inject(SettingsService);
    service = TestBed.inject(AudioService);
  }

  beforeEach(() => {
    localStorage.clear();
    ctx = new FakeContext();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('stays silent until the first user gesture unlocks audio', () => {
    setup();

    service.play('hit');

    expect(ctx.oscillators).toHaveLength(0);
    expect(service.ready()).toBe(false);
  });

  it('schedules oscillators and noise for a sound after unlock', () => {
    setup();
    service.unlock();

    service.play('crit');

    expect(service.ready()).toBe(true);
    expect(ctx.oscillators.length).toBeGreaterThanOrEqual(3);
    expect(ctx.sources.length).toBeGreaterThanOrEqual(1);
    expect(ctx.oscillators.every((osc) => osc.started === 1)).toBe(true);
  });

  it('does not play while muted or with sfx volume at zero', () => {
    setup();
    service.unlock();

    settings.toggleSound();
    service.play('hit');
    expect(ctx.oscillators).toHaveLength(0);

    settings.toggleSound();
    settings.setSfxVolume(0);
    service.play('hit');
    expect(ctx.oscillators).toHaveLength(0);
  });

  it('throttles rapid repeats of the same sound but not different ones', () => {
    setup();
    service.unlock();

    service.play('hit');
    const afterFirst = ctx.oscillators.length;
    service.play('hit');
    expect(ctx.oscillators).toHaveLength(afterFirst);

    service.play('heal');
    expect(ctx.oscillators.length).toBeGreaterThan(afterFirst);

    const afterHeal = ctx.oscillators.length;
    ctx.currentTime += 0.1;
    service.play('hit');
    expect(ctx.oscillators.length).toBeGreaterThan(afterHeal);
  });

  it('applies volume settings to the buses', () => {
    setup();
    service.unlock();
    settings.setSfxVolume(0.4);
    settings.setMusicVolume(0.8);
    TestBed.tick();

    const values = ctx.gains.map((gain) => gain.gain.value);

    expect(values).toContain(0.4); // sfx bus
    expect(values.some((value) => Math.abs(value - 0.4) < 1e-9)).toBe(true); // music = 0.8 * 0.5
  });

  it('plays generative music once a theme is set and stops when cleared', () => {
    setup();
    service.unlock();

    service.setMusic('ruin');
    const started = ctx.oscillators.length;
    expect(started).toBeGreaterThan(0);

    ctx.currentTime += 5;
    vi.advanceTimersByTime(500);
    expect(ctx.oscillators.length).toBeGreaterThan(started);

    service.setMusic(null);
    const stopped = ctx.oscillators.length;
    ctx.currentTime += 5;
    vi.advanceTimersByTime(1000);
    expect(ctx.oscillators).toHaveLength(stopped);
  });

  it('is a safe no-op when WebAudio is unavailable', () => {
    setup(() => null);

    expect(() => {
      service.unlock();
      service.play('hit');
      service.setMusic('boss');
    }).not.toThrow();
    expect(service.ready()).toBe(false);
  });

  it('clamps persisted volumes', () => {
    setup();

    settings.setSfxVolume(5);
    settings.setMusicVolume(-1);

    expect(settings.sfxVolume()).toBe(1);
    expect(settings.musicVolume()).toBe(0);
  });
});
