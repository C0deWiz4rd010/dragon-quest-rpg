import {
  attackElementMultiplier,
  canBeStunned,
  roleTelegraph,
  statusAttackMultiplier,
  statusForRole,
  statusFromThreat,
} from './combat-rules';

describe('elements, statuses and telegraphs', () => {
  const target = { weakness: 'ice', resistance: 'fire' } as const;

  it('boosts weaknesses, dampens resistances and ignores unaligned weapons', () => {
    expect(attackElementMultiplier(target, 'ice')).toBe(1.25);
    expect(attackElementMultiplier(target, 'fire')).toBe(0.8);
    expect(attackElementMultiplier(target, 'lightning')).toBe(1);
    expect(attackElementMultiplier(target, 'none')).toBe(1);
    expect(attackElementMultiplier(null, 'fire')).toBe(1);
  });

  it('lets holy weapons counter shadow-weak enemies', () => {
    expect(attackElementMultiplier({ weakness: 'shadow', resistance: null }, 'holy')).toBe(1.25);
    expect(attackElementMultiplier({ weakness: 'fire', resistance: null }, 'holy')).toBe(1);
  });

  it('assigns role-specific ailments', () => {
    expect(statusForRole('swift', 0).type).toBe('bleed');
    expect(statusForRole('hexer', 0.1).type).toBe('poison');
    expect(statusForRole('hexer', 0.9).type).toBe('weaken');
    expect(statusForRole('boss', 0.1).type).toBe('weaken');
    expect(statusForRole('elite', 0.9).type).toBe('bleed');
    expect(statusFromThreat('swift', 'clear', null, () => 0.01)?.type).toBe('bleed');
  });

  it('weaken lowers attack, other ailments do not', () => {
    expect(statusAttackMultiplier({ type: 'weaken', rounds: 2, damagePerRound: 0 })).toBe(0.75);
    expect(statusAttackMultiplier({ type: 'burn', rounds: 2, damagePerRound: 4 })).toBe(1);
    expect(statusAttackMultiplier(null)).toBe(1);
  });

  it('only normal enemies can be stunned', () => {
    expect(canBeStunned({ role: 'swift' })).toBe(true);
    expect(canBeStunned({ role: 'elite' })).toBe(false);
    expect(canBeStunned({ role: 'boss' })).toBe(false);
  });

  it('winds up heavy moves on the telegraph cycle for bruisers and hexers', () => {
    expect(roleTelegraph({ role: 'bruiser', turn: 2, telegraphedAbility: null })?.name).toBe(
      'Wuchtschlag',
    );
    expect(roleTelegraph({ role: 'hexer', turn: 5, telegraphedAbility: null })?.forceStatus).toBe(
      true,
    );
    expect(roleTelegraph({ role: 'bruiser', turn: 1, telegraphedAbility: null })).toBeNull();
    expect(roleTelegraph({ role: 'swift', turn: 2, telegraphedAbility: null })).toBeNull();
    expect(
      roleTelegraph({ role: 'bruiser', turn: 2, telegraphedAbility: { name: 'x' } }),
    ).toBeNull();
  });
});
