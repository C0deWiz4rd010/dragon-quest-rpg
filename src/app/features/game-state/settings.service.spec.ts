import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { SettingsService, prefersReducedMotion } from './settings.service';

describe('SettingsService', () => {
  function mockReducedMotion(matches: boolean): void {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({ matches: matches && query.includes('reduce'), media: query })),
    );
  }

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('starts with animations off when the OS asks for reduced motion', () => {
    mockReducedMotion(true);

    expect(prefersReducedMotion()).toBe(true);
    expect(TestBed.inject(SettingsService).animations()).toBe(false);
  });

  it('keeps animations on by default and respects an explicit saved choice', () => {
    mockReducedMotion(false);
    expect(TestBed.inject(SettingsService).animations()).toBe(true);

    TestBed.resetTestingModule();
    mockReducedMotion(true);
    localStorage.setItem('dragonQuestRpgSettings', JSON.stringify({ animations: true }));

    expect(TestBed.inject(SettingsService).animations()).toBe(true);
  });

  it('toggles root classes for colour-blind and high-contrast modes', () => {
    mockReducedMotion(false);
    const settings = TestBed.inject(SettingsService);

    settings.toggleColorBlind();
    settings.toggleHighContrast();
    TestBed.tick();

    expect(document.documentElement.classList.contains('dq-colorblind')).toBe(true);
    expect(document.documentElement.classList.contains('dq-high-contrast')).toBe(true);

    settings.toggleColorBlind();
    TestBed.tick();

    expect(document.documentElement.classList.contains('dq-colorblind')).toBe(false);
  });

  it('persists the new settings', () => {
    mockReducedMotion(false);
    const settings = TestBed.inject(SettingsService);

    settings.toggleColorBlind();
    settings.setMusicVolume(0.2);
    TestBed.tick();

    const saved = JSON.parse(localStorage.getItem('dragonQuestRpgSettings') ?? '{}');

    expect(saved.colorBlind).toBe(true);
    expect(saved.musicVolume).toBe(0.2);
  });

  it('tolerates unavailable matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);

    expect(prefersReducedMotion()).toBe(false);
  });
});
