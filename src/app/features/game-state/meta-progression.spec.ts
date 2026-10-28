import { TestBed } from '@angular/core/testing';

import { ACHIEVEMENTS } from './achievement.service';
import { GameState } from './game-state.service';
import {
  ACHIEVEMENT_STORAGE_KEY,
  activeMetaPerks,
  applyMetaPerks,
  loadUnlockedAchievementIds,
  META_PERKS,
} from './meta-progression';

describe('meta progression', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  afterEach(() => localStorage.clear());

  it('only references achievements that exist', () => {
    const ids = new Set(ACHIEVEMENTS.map((achievement) => achievement.id));

    for (const perk of META_PERKS) {
      expect(ids.has(perk.achievementId), perk.achievementId).toBe(true);
    }
    expect(ids.size).toBe(ACHIEVEMENTS.length);
  });

  it('applies only perks for unlocked achievements', () => {
    const base = TestBed.inject(GameState).player();
    const boosted = applyMetaPerks(base, new Set(['boss-slayer', 'slayer-50', 'unknown']));

    expect(boosted.gold).toBe(base.gold + 40);
    expect(boosted.potions).toBe(base.potions + 1);
    expect(boosted.baseCrit).toBe(base.baseCrit);
    expect(applyMetaPerks(base, new Set())).toEqual(base);
    expect(activeMetaPerks(new Set(['boss-slayer']))).toHaveLength(1);
  });

  it('keeps hp in step with max hp perks', () => {
    const base = TestBed.inject(GameState).player();
    const boosted = applyMetaPerks(base, new Set(['level-10']));

    expect(boosted.maxHp).toBe(base.maxHp + 10);
    expect(boosted.hp).toBe(base.hp + 10);
  });

  it('survives broken storage content', () => {
    localStorage.setItem(ACHIEVEMENT_STORAGE_KEY, '{oops');
    expect(loadUnlockedAchievementIds().size).toBe(0);

    localStorage.setItem(ACHIEVEMENT_STORAGE_KEY, JSON.stringify(['a', 3, null, 'b']));
    expect([...loadUnlockedAchievementIds()]).toEqual(['a', 'b']);
  });

  it('starts a fresh run with earned perks and announces them', () => {
    localStorage.setItem(ACHIEVEMENT_STORAGE_KEY, JSON.stringify(['boss-slayer']));
    const state = TestBed.inject(GameState);
    const before = state.player().gold;

    state.reset();

    expect(state.player().gold).toBe(before + 40);
    expect(state.logs().some((entry) => entry.message.includes('Meta-Boni'))).toBe(true);
  });

  it('unlocks class-specific boss achievements only for that class', () => {
    const base = TestBed.inject(GameState).player();
    const warriorKill = { ...base, bossKilled: true, characterClass: 'warrior' as const };
    const check = (id: string) => ACHIEVEMENTS.find((a) => a.id === id)!.check(warriorKill);

    expect(check('boss-warrior')).toBe(true);
    expect(check('boss-mage')).toBe(false);
    expect(check('ng-boss')).toBe(false);
  });
});
