import { TestBed } from '@angular/core/testing';

import { ACHIEVEMENT_STORAGE_KEY } from '../game-state/meta-progression';
import { GameState } from '../game-state/game-state.service';
import { HandbookPanel } from './handbook-panel/handbook-panel';
import { RunOutcomeOverlay } from './run-outcome-overlay/run-outcome-overlay';
import { SettingsPanel } from './settings-panel/settings-panel';
import { SettingsService } from '../game-state/settings.service';
import { TutorialOverlay } from './tutorial-overlay/tutorial-overlay';

describe('overlay components', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  afterEach(() => localStorage.clear());

  it('settings panel toggles settings and closes on Escape', () => {
    const fixture = TestBed.createComponent(SettingsPanel);
    const settings = TestBed.inject(SettingsService);
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => closed++);
    fixture.detectChanges();

    const toggles = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.setting-toggle');
    const before = settings.screenShake();
    expect(toggles.length).toBeGreaterThanOrEqual(4);

    toggles[2].click();
    expect(settings.screenShake()).toBe(!before);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closed).toBe(1);
  });

  it('handbook lists earned meta perks and the achievement grid', () => {
    localStorage.setItem(ACHIEVEMENT_STORAGE_KEY, JSON.stringify(['boss-slayer']));
    const fixture = TestBed.createComponent(HandbookPanel);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Meta-Boni');
    expect(text).toContain('Drachentöter: +40 Startgold');
    expect(text).toContain('Elemente');
    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.achievement-cell').length,
    ).toBeGreaterThan(30);
  });

  it('run outcome overlay renders only after a run ends and emits restart', () => {
    const state = TestBed.inject(GameState);
    const fixture = TestBed.createComponent(RunOutcomeOverlay);
    let restarts = 0;
    fixture.componentInstance.restart.subscribe(() => restarts++);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(state.runOutcome()).toBeNull();
    expect(el.querySelector('.run-outcome-overlay')).toBeNull();

    state.updatePlayer((player) => ({ ...player, hp: 0 }));
    state.gameActive.set(false);
    fixture.detectChanges();

    expect(el.querySelector('.run-outcome-overlay')).not.toBeNull();
    el.querySelector<HTMLButtonElement>('.outcome-restart-btn')!.click();
    expect(restarts).toBe(1);
  });

  it('tutorial overlay is empty while inactive', () => {
    const fixture = TestBed.createComponent(TutorialOverlay);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.tutorial-scrim')).toBeNull();
  });
});
