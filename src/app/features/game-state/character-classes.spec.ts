import {
  applyCharacterClass,
  CHARACTER_CLASSES,
  critManaRefund,
  guardKeepsCombo,
  healManaCost,
  skillManaCost,
} from './character-classes';

describe('character classes', () => {
  it('gives every class a unique passive', () => {
    const names = CHARACTER_CLASSES.map((cls) => cls.passive.name);

    expect(new Set(names).size).toBe(CHARACTER_CLASSES.length);
    expect(CHARACTER_CLASSES.every((cls) => cls.perks.some((perk) => perk.startsWith('Passiv')))).toBe(
      true,
    );
  });

  it('applies class-specific passives only to that class', () => {
    expect(skillManaCost({ characterClass: 'mage' }, 30)).toBe(22);
    expect(skillManaCost({ characterClass: 'warrior' }, 30)).toBe(30);
    expect(healManaCost({ characterClass: 'paladin' }, 20)).toBe(14);
    expect(healManaCost({ characterClass: 'mage' }, 20)).toBe(20);
    expect(guardKeepsCombo({ characterClass: 'warrior' })).toBe(true);
    expect(guardKeepsCombo({ characterClass: 'rogue' })).toBe(false);
    expect(critManaRefund({ characterClass: 'rogue' })).toBe(6);
    expect(critManaRefund({ characterClass: undefined })).toBe(0);
  });

  it('adds class bonuses on top of the base player', () => {
    const base = { maxHp: 100, hp: 100, baseAttack: 25 } as never;
    const warrior = applyCharacterClass(base, 'warrior');

    expect(warrior.maxHp).toBe(120);
    expect(warrior.characterClass).toBe('warrior');
  });
});
