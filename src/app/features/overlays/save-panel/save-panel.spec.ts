import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { GameState } from '../../game-state/game-state.service';
import { downloadTextFile, saveFilename } from '../../persistence/file-io';
import { StorageService } from '../../persistence/storage.service';
import { SavePanel } from './save-panel';

describe('SavePanel', () => {
  function setup() {
    const fixture = TestBed.createComponent(SavePanel);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    return { fixture, el, storage: TestBed.inject(StorageService) };
  }

  const buttonsOf = (el: HTMLElement, slot: number) =>
    Array.from(el.querySelectorAll('section.slot-card')[slot - 1].querySelectorAll('button'));
  const find = (buttons: HTMLButtonElement[], text: string) =>
    buttons.find((button) => button.textContent?.includes(text));

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('shows three slots, marks the active one and offers only save/import when empty', () => {
    const { el } = setup();

    expect(el.querySelectorAll('section.slot-card')).toHaveLength(3);
    expect(el.querySelector('.slot-card.active')?.textContent).toContain('Slot 1');
    expect(el.textContent).toContain('Leer');
    expect(find(buttonsOf(el, 1), 'Laden')).toBeUndefined();
    expect(find(buttonsOf(el, 1), 'Speichern')).toBeDefined();
  });

  it('saves into the active slot at once and updates the list', () => {
    const { fixture, el, storage } = setup();
    TestBed.inject(GameState).reset('paladin');

    find(buttonsOf(el, 1), 'Speichern')!.click();
    fixture.detectChanges();

    expect(storage.hasSlot(1)).toBe(true);
    expect(el.querySelector('.save-message')?.textContent).toContain('Gespeichert in Slot 1');
    expect(el.textContent).toContain('Paladin');
    expect(find(buttonsOf(el, 1), 'Laden')).toBeDefined();
  });

  it('asks before overwriting another occupied slot', () => {
    const { fixture, el, storage } = setup();
    storage.save(2);
    storage.currentSlot.set(1);
    fixture.detectChanges();

    const before = localStorage.getItem('dragonQuestRpgSave_2');
    find(buttonsOf(el, 2), 'Speichern')!.click();
    fixture.detectChanges();

    expect(find(buttonsOf(el, 2), 'Überschreiben?')).toBeDefined();
    expect(localStorage.getItem('dragonQuestRpgSave_2')).toBe(before);

    find(buttonsOf(el, 2), 'Überschreiben?')!.click();
    fixture.detectChanges();

    expect(el.querySelector('.save-message')?.textContent).toContain('Gespeichert in Slot 2');
  });

  it('needs two clicks to delete and can be cancelled', () => {
    const { fixture, el, storage } = setup();
    storage.save(3);
    fixture.detectChanges();

    find(buttonsOf(el, 3), 'Löschen')!.click();
    fixture.detectChanges();
    expect(storage.hasSlot(3)).toBe(true);

    find(buttonsOf(el, 3), 'Abbrechen')!.click();
    fixture.detectChanges();
    expect(find(buttonsOf(el, 3), 'Wirklich löschen?')).toBeUndefined();

    find(buttonsOf(el, 3), 'Löschen')!.click();
    fixture.detectChanges();
    find(buttonsOf(el, 3), 'Wirklich löschen?')!.click();
    fixture.detectChanges();

    expect(storage.hasSlot(3)).toBe(false);
    expect(el.querySelector('.save-message')?.textContent).toContain('Slot 3 gelöscht');
  });

  it('loads a slot and closes the panel', () => {
    const { fixture, el, storage } = setup();
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => closed++);
    storage.save(1);
    fixture.detectChanges();

    find(buttonsOf(el, 1), 'Laden')!.click();

    expect(closed).toBe(1);
  });

  it('exports through a download and reports a blocked download', () => {
    const { fixture, el, storage } = setup();
    storage.save(1);
    fixture.detectChanges();
    const createUrl = vi.fn(() => 'blob:test');
    vi.stubGlobal('URL', { createObjectURL: createUrl, revokeObjectURL: vi.fn() });
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    find(buttonsOf(el, 1), 'Export')!.click();
    fixture.detectChanges();

    expect(createUrl).toHaveBeenCalled();
    expect(clicked).toHaveBeenCalled();
    expect(el.querySelector('.save-message')?.textContent).toContain('exportiert');
    vi.unstubAllGlobals();
  });

  it('closes on Escape', () => {
    const { fixture } = setup();
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => closed++);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(closed).toBe(1);
  });
});

describe('file helpers', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('builds a dated, slot-specific file name', () => {
    expect(saveFilename(2, new Date('2026-10-28T10:00:00Z'))).toBe(
      'dragon-quest-slot-2-2026-10-28.json',
    );
  });

  it('returns false when the browser cannot create the download', () => {
    vi.stubGlobal('URL', {
      createObjectURL: () => {
        throw new Error('blocked');
      },
    });

    expect(downloadTextFile('x.json', '{}')).toBe(false);
  });
});
