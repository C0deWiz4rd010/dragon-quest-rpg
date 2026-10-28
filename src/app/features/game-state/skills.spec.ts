import { TestBed } from '@angular/core/testing';

import { Player } from '../inventory/player.model';
import { GameState } from './game-state.service';
import {
  rollSkillChoices,
  skillAttackMultiplier,
  skillCritFlat,
  skillDefenseMultiplier,
  skillGoldMultiplier,
  skillLifestealPct,
  skillXpMultiplier,
  SKILLS,
} from './skills';

describe('skills', () => {
  let base: Player;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    base = TestBed.inject(GameState).player();
  });

  it('aggregates multipliers from learned skills', () => {
    const player: Player = { ...base, learnedSkills: ['berserker', 'warlord', 'scholar'] };

    expect(skillAttackMultiplier(player)).toBeCloseTo(1.27);
    expect(skillDefenseMultiplier(player)).toBeCloseTo(0.95);
    expect(skillXpMultiplier(player)).toBeCloseTo(1.2);
    expect(skillGoldMultiplier(base)).toBe(1);
    expect(skillCritFlat({ ...base, learnedSkills: ['deadeye', 'assassin'] })).toBe(20);
    expect(skillLifestealPct({ ...base, learnedSkills: ['vampirism', 'reaper'] })).toBeCloseTo(0.25);
  });

  it('offers three distinct unlearned skills', () => {
    const player: Player = { ...base, learnedSkills: ['berserker'] };
    const picks = rollSkillChoices(player);

    expect(picks).toHaveLength(3);
    expect(new Set(picks).size).toBe(3);
    expect(picks).not.toContain('berserker');
  });

  it('offers fewer choices when almost everything is learned', () => {
    const all = SKILLS.map((skill) => skill.id);
    const player: Player = { ...base, learnedSkills: all.slice(0, all.length - 2) };

    expect(rollSkillChoices(player)).toHaveLength(2);
    expect(rollSkillChoices({ ...base, learnedSkills: all })).toEqual([]);
  });

  it('favours class-affine skills', () => {
    const rogue: Player = { ...base, characterClass: 'rogue' };
    const hits = Array.from({ length: 300 }, () => rollSkillChoices(rogue, 1)[0]);
    const affine = hits.filter((id) =>
      ['deadeye', 'assassin', 'treasurehunter', 'duelist'].includes(id),
    ).length;

    expect(affine / hits.length).toBeGreaterThan(4 / SKILLS.length);
  });
});
