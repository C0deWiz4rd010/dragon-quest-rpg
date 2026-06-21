import {
  enemyPhasePressure,
  enemyIntentPreview,
  executeDamageMultiplier,
  overkillReward,
  riposteDamageMultiplier,
  roleFollowUpChance,
  roleGuardMultiplier,
  roleLootMultiplier,
  statusFromThreat,
  tickStatusEffect,
  weatherCombatModifiers,
} from './combat-rules';

describe('combat rules', () => {
  it('applies and expires status damage', () => {
    const tick = tickStatusEffect(20, { type: 'poison', rounds: 1, damagePerRound: 6 });

    expect(tick.hp).toBe(14);
    expect(tick.damage).toBe(6);
    expect(tick.nextEffect).toBeNull();
    expect(tick.expired).toBe(true);
  });

  it('can kill the player through status damage', () => {
    const tick = tickStatusEffect(5, { type: 'burn', rounds: 2, damagePerRound: 8 });

    expect(tick.hp).toBe(0);
    expect(tick.nextEffect?.rounds).toBe(1);
  });

  it('maps weather to tactical combat modifiers', () => {
    expect(weatherCombatModifiers('rain').manaRegenDelta).toBe(5);
    expect(weatherCombatModifiers('storm').enemyMissChance).toBe(0.25);
    expect(weatherCombatModifiers('snow').playerDefenseDelta).toBe(3);
    expect(weatherCombatModifiers('ash').burnChance).toBe(0.15);
    expect(weatherCombatModifiers('glow').playerCritDelta).toBe(5);
    expect(weatherCombatModifiers('fog').enemyCritDelta).toBe(-10);
  });

  it('creates role and weather status threats without stacking', () => {
    expect(statusFromThreat('hexer', 'clear', null, () => 0.01)?.type).toBe('poison');
    expect(statusFromThreat('swift', 'ash', null, () => 0.01)?.type).toBe('burn');
    expect(
      statusFromThreat('hexer', 'ash', { type: 'burn', rounds: 1, damagePerRound: 4 }, () => 0),
    ).toBeNull();
  });

  it('rewards elite roles more than safe roles', () => {
    expect(roleLootMultiplier('elite')).toBeGreaterThan(roleLootMultiplier('swift'));
  });

  it('gives execute damage only in low enemy hp windows', () => {
    expect(executeDamageMultiplier(41)).toBe(1);
    expect(executeDamageMultiplier(40)).toBe(1.18);
    expect(executeDamageMultiplier(25)).toBe(1.35);
  });

  it('scales riposte and overkill rewards from timing windows', () => {
    expect(riposteDamageMultiplier(0)).toBe(1);
    expect(riposteDamageMultiplier(3)).toBeGreaterThan(1.5);
    expect(overkillReward(0, 'swift').gold).toBe(0);
    expect(overkillReward(30, 'elite').dragonShards).toBeGreaterThan(0);
  });

  it('raises pressure in late elite and boss phases', () => {
    expect(enemyPhasePressure('boss', 65).tone).toBe('calm');
    expect(enemyPhasePressure('boss', 55).label).toContain('Drachenzorn');
    expect(enemyPhasePressure('boss', 25).tone).toBe('enraged');
    expect(enemyPhasePressure('elite', 40).attackMultiplier).toBeGreaterThan(1);
  });

  it('varies guard and follow-up pressure by enemy role', () => {
    expect(roleGuardMultiplier('bruiser', true)).toBeGreaterThan(
      roleGuardMultiplier('swift', true),
    );
    expect(roleGuardMultiplier('boss', false)).toBe(1);
    expect(roleFollowUpChance('swift')).toBeGreaterThan(0);
    expect(roleFollowUpChance('hexer')).toBe(0);
  });

  it('describes enemy intent from role and weather', () => {
    expect(enemyIntentPreview('swift', 'clear')).toContain('Nachschlag');
    expect(enemyIntentPreview('bruiser', 'clear')).toContain('Deckung');
    expect(enemyIntentPreview('hexer', 'ash')).toContain('Brand');
    expect(enemyIntentPreview('boss', 'storm')).toContain('Sturm');
  });
});
