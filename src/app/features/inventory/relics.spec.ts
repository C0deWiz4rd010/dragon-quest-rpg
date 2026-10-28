import { TestBed } from '@angular/core/testing';

import { GameState } from '../game-state/game-state.service';
import { Player } from './player.model';
import { RelicId } from './relic.model';
import {
  activeSynergyCount,
  randomMissingRelic,
  relicAttackBonus,
  relicComboAttackBonus,
  relicDamageMultiplier,
  relicDefenseBonus,
  relicDefinition,
  relicExecuteWindowBonus,
  relicGuardHeal,
  relicOverkillShards,
  relicPoisonMultiplier,
  relicRiposteStart,
  relicSpecialDamageMultiplier,
  relicSwiftGoldBonus,
  relicWeatherManaBonus,
  RUN_RELICS,
} from './relics';

describe('relics', () => {
  let base: Player;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    base = TestBed.inject(GameState).player();
  });

  function withRelics(...ids: RelicId[]): Player {
    return {
      ...base,
      ownedRelics: ids.map((id) => RUN_RELICS.find((relic) => relic.id === id)!),
    };
  }

  it('gives every relic at least one real effect', () => {
    for (const relic of RUN_RELICS) {
      expect(Object.keys(relic.effects).length, relic.id).toBeGreaterThan(0);
    }
  });

  it('keeps synergy links symmetric and pointing at existing relics', () => {
    for (const relic of RUN_RELICS) {
      if (relic.synergy) {
        expect(relicDefinition(relic.synergy), relic.id).toBeTruthy();
      }
    }
  });

  it('stacks flat stat bonuses across relics', () => {
    const player = withRelics('wyrmfang-seal', 'aegis-feather', 'frozen-crest', 'bastion-core');

    expect(relicAttackBonus(player)).toBe(5);
    expect(relicDefenseBonus(player)).toBe(4 + 5 + 8);
    expect(relicSpecialDamageMultiplier(player)).toBeCloseTo(1.12);
  });

  it('implements the previously dead relic effects', () => {
    expect(relicExecuteWindowBonus(withRelics('shadow-mantle'))).toBe(10);
    expect(relicRiposteStart(withRelics('ruin-ward'))).toBe(1);
    expect(relicOverkillShards(withRelics('void-fragment'))).toBe(1);
    expect(relicComboAttackBonus(withRelics('twin-fang'), 4)).toBe(12);
    expect(relicSwiftGoldBonus(withRelics('dusk-medallion'))).toBe(12);
    expect(relicGuardHeal(withRelics('bastion-core'))).toBe(6);
    expect(relicPoisonMultiplier(withRelics('grove-charm'))).toBe(0.5);
    expect(relicWeatherManaBonus(withRelics('tempest-seal'), 'storm')).toBe(6);
    expect(relicWeatherManaBonus(withRelics('tempest-seal'), 'clear')).toBe(0);
    expect(relicWeatherManaBonus(withRelics(), 'storm')).toBe(0);
  });

  it('boosts matching elements and weakness hits only', () => {
    const player = withRelics('drake-talisman', 'celestial-lens');

    expect(relicDamageMultiplier(player, 'fire', false)).toBeCloseTo(1.15);
    expect(relicDamageMultiplier(player, 'fire', true)).toBeCloseTo(1.2);
    expect(relicDamageMultiplier(player, 'ice', false)).toBe(1);
    expect(relicDamageMultiplier(withRelics(), 'fire', true)).toBe(1);
  });

  it('counts active synergy pairs', () => {
    expect(activeSynergyCount(withRelics('wyrmfang-seal'))).toBe(0);
    expect(activeSynergyCount(withRelics('wyrmfang-seal', 'drake-talisman'))).toBe(1);
  });

  it('never offers owned relics and favours the requested biome', () => {
    const owned = withRelics(...RUN_RELICS.slice(1).map((relic) => relic.id));

    expect(randomMissingRelic(owned)?.id).toBe(RUN_RELICS[0].id);
    expect(randomMissingRelic(withRelics(...RUN_RELICS.map((relic) => relic.id)))).toBeNull();

    const picks = Array.from({ length: 400 }, () => randomMissingRelic(base, 'frost')?.id);
    const frostShare = picks.filter((id) => id === 'frozen-crest').length / picks.length;

    expect(frostShare).toBeGreaterThan(1 / RUN_RELICS.length);
  });
});
