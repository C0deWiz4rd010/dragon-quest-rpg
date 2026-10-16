import { TestBed } from '@angular/core/testing';

import { GameState } from '../game-state/game-state.service';
import { isLegacySave, StorageService } from './storage.service';

describe('StorageService', () => {
  let service: StorageService;
  let gameState: GameState;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(StorageService);
    gameState = TestBed.inject(GameState);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('round-trips a save through a slot', () => {
    expect(service.save(2)).toBe(true);
    expect(service.hasSlot(2)).toBe(true);
    expect(service.slotInfo(2)?.level).toBe(gameState.player().level);
    expect(service.load(2)).toBe(true);
  });

  it('does not log when saving silently', () => {
    const before = gameState.logs().length;

    service.save(1, { silent: true });

    expect(gameState.logs().length).toBe(before);
  });

  it('returns false instead of throwing when storage is full', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });

    expect(service.save(1)).toBe(false);
  });

  it('loads a minimal legacy save by filling in defaults', () => {
    localStorage.setItem('dragonQuestRpgSave', JSON.stringify({ version: 1 }));

    expect(service.load(1)).toBe(true);
  });

  it('backs up and rejects unparseable saves', () => {
    localStorage.setItem('dragonQuestRpgSave', '{not json');

    expect(service.load(1)).toBe(false);
    expect(localStorage.getItem('dragonQuestRpgSave_corrupt')).toBe('{not json');
  });

  it('rejects saves with a broken shape', () => {
    localStorage.setItem('dragonQuestRpgSave_3', JSON.stringify({ state: { player: 'oops' } }));

    expect(service.load(3)).toBe(false);
    expect(service.slotInfo(3)).toBeNull();
  });

  describe('isLegacySave', () => {
    it('accepts empty and partial objects', () => {
      expect(isLegacySave({})).toBe(true);
      expect(isLegacySave({ state: { player: {} }, path: { segments: [] } })).toBe(true);
    });

    it('rejects non-objects and malformed branches', () => {
      expect(isLegacySave(null)).toBe(false);
      expect(isLegacySave([])).toBe(false);
      expect(isLegacySave({ path: { segments: 'x' } })).toBe(false);
      expect(isLegacySave({ state: 3 })).toBe(false);
    });
  });
});
