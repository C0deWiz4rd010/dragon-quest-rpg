import type { AttackElement } from '../combat/combat-rules';
import type { PathWeather } from '../path/path-segment.model';
import { Player } from './player.model';
import { Relic, RelicBiome, RelicId } from './relic.model';

/**
 * Numeric effects a relic grants while owned. Every relic effect lives here so the
 * description, the behaviour and the tests share one source of truth.
 */
export interface RelicEffects {
  attack?: number;
  defense?: number;
  /** Crit chance in percent points. */
  crit?: number;
  /** One-time bonus applied to max mana when the relic is found. */
  maxMana?: number;
  manaRegen?: number;
  restHeal?: number;
  /** Extra gold on shrine, treasure and prep rewards. */
  gold?: number;
  /** Additive bonus to Drachenklaue damage (0.12 = +12%). */
  specialDamage?: number;
  wardCharges?: number;
  prepFocus?: number;
  /** Widens the execute window by this many enemy-HP percent points. */
  executeWindow?: number;
  /** Riposte charges granted at the start of every fight. */
  riposteStart?: number;
  overkillShards?: number;
  /** Extra attack per active combo step. */
  comboAttack?: number;
  /** Extra damage multiplier (0.05 = +5%) when hitting an elemental weakness. */
  weaknessDamage?: number;
  /** Extra damage multiplier for attacks of the given element. */
  elementDamage?: Partial<Record<AttackElement, number>>;
  /** Fraction by which poison damage is reduced (0.5 = half). */
  poisonResist?: number;
  /** Extra mana per round during storms. */
  stormMana?: number;
  /** Extra gold for every swift enemy defeated. */
  swiftGold?: number;
  /** HP restored whenever you guard. */
  guardHeal?: number;
}

export interface RelicDefinition extends Relic {
  effects: RelicEffects;
}

export const RUN_RELICS: RelicDefinition[] = [
  {
    id: 'wyrmfang-seal',
    name: 'Wyrmfang Sigil',
    icon: 'WF',
    desc: '+5 ATK und Drachenklaue +12% Schaden.',
    biome: 'ember',
    synergy: 'drake-talisman',
    effects: { attack: 5, specialDamage: 0.12 },
  },
  {
    id: 'aegis-feather',
    name: 'Aegis Feather',
    icon: 'AG',
    desc: '+4 DEF und Aegis-Segen mit +1 Ladung.',
    biome: 'sanctum',
    synergy: 'bastion-core',
    effects: { defense: 4, wardCharges: 1 },
  },
  {
    id: 'oracle-lens',
    name: 'Oracle Lens',
    icon: 'OL',
    desc: '+7% Krit und +1 Fokus bei der Boss-Vorbereitung.',
    biome: 'ruin',
    synergy: 'celestial-lens',
    effects: { crit: 7, prepFocus: 1 },
  },
  {
    id: 'gilded-compass',
    name: 'Gilded Compass',
    icon: 'GC',
    desc: '+22 Gold aus Schrein-, Schatz- und Prep-Routen.',
    biome: 'grove',
    synergy: 'dusk-medallion',
    effects: { gold: 22 },
  },
  {
    id: 'embersigil',
    name: 'Ember Sigil',
    icon: 'ES',
    desc: '+6 Mana pro Runde und Rastpunkte heilen +12 HP.',
    biome: 'ember',
    synergy: 'tempest-seal',
    effects: { manaRegen: 6, restHeal: 12 },
  },
  {
    id: 'storm-signet',
    name: 'Storm Signet',
    icon: 'SS',
    desc: '+6% Krit.',
    biome: 'storm',
    synergy: 'twin-fang',
    effects: { crit: 6 },
  },
  {
    id: 'frozen-crest',
    name: 'Frozen Crest',
    icon: 'FC',
    desc: '+5 DEF und +15% Eisschaden.',
    biome: 'frost',
    effects: { defense: 5, elementDamage: { ice: 0.15 } },
  },
  {
    id: 'shadow-mantle',
    name: 'Shadow Mantle',
    icon: 'SM',
    desc: 'Execute-Fenster oeffnet 10% frueher (bei 50% und 35% Gegner-HP).',
    biome: 'ruin',
    effects: { executeWindow: 10 },
  },
  {
    id: 'grove-charm',
    name: 'Grove Charm',
    icon: 'GR',
    desc: 'Rastpunkte heilen +8 HP, Gift wirkt nur halb so stark.',
    biome: 'grove',
    effects: { restHeal: 8, poisonResist: 0.5 },
  },
  {
    id: 'ruin-ward',
    name: 'Ruin Ward',
    icon: 'RW',
    desc: '+1 Riposte-Ladung zu Beginn jedes Kampfes.',
    biome: 'ruin',
    effects: { riposteStart: 1 },
  },
  {
    id: 'sanctum-orb',
    name: 'Sanctum Orb',
    icon: 'SO',
    desc: '+10 Max-Mana und Drachenklaue +8% Schaden.',
    biome: 'sanctum',
    effects: { maxMana: 10, specialDamage: 0.08 },
  },
  {
    id: 'void-fragment',
    name: 'Void Fragment',
    icon: 'VF',
    desc: 'Overkill gewaehrt +1 Dragon Shard.',
    biome: 'ruin',
    effects: { overkillShards: 1 },
  },
  {
    id: 'tempest-seal',
    name: 'Tempest Seal',
    icon: 'TS',
    desc: '+6 Mana pro Runde bei Sturmwetter.',
    biome: 'storm',
    synergy: 'embersigil',
    effects: { stormMana: 6 },
  },
  {
    id: 'drake-talisman',
    name: 'Drake Talisman',
    icon: 'DT',
    desc: '+15% Feuerschaden.',
    biome: 'ember',
    synergy: 'wyrmfang-seal',
    effects: { elementDamage: { fire: 0.15 } },
  },
  {
    id: 'dusk-medallion',
    name: 'Dusk Medallion',
    icon: 'DM',
    desc: '+12 Gold fuer jeden flinken Gegner, den du besiegst.',
    biome: 'storm',
    synergy: 'gilded-compass',
    effects: { swiftGold: 12 },
  },
  {
    id: 'twin-fang',
    name: 'Twin Fang',
    icon: 'TF',
    desc: '+3 ATK pro aktiver Combo-Stufe.',
    biome: 'grove',
    synergy: 'storm-signet',
    effects: { comboAttack: 3 },
  },
  {
    id: 'bastion-core',
    name: 'Bastion Core',
    icon: 'BC',
    desc: '+8 DEF und +6 HP bei jeder Deckung.',
    biome: 'sanctum',
    synergy: 'aegis-feather',
    effects: { defense: 8, guardHeal: 6 },
  },
  {
    id: 'celestial-lens',
    name: 'Celestial Lens',
    icon: 'CL',
    desc: '+5% Schaden, wenn du eine Elementschwaeche triffst.',
    biome: 'sanctum',
    synergy: 'oracle-lens',
    effects: { weaknessDamage: 0.05 },
  },
];

const SYNERGY_PAIRS: [RelicId, RelicId][] = [
  ['wyrmfang-seal', 'drake-talisman'],
  ['oracle-lens', 'celestial-lens'],
  ['aegis-feather', 'bastion-core'],
  ['embersigil', 'tempest-seal'],
  ['gilded-compass', 'dusk-medallion'],
  ['storm-signet', 'twin-fang'],
];

type NumericEffect = Exclude<keyof RelicEffects, 'elementDamage'>;

/** Looks up the canonical definition so old saves without `effects` still work. */
export function relicDefinition(relicId: RelicId): RelicDefinition | undefined {
  return RUN_RELICS.find((relic) => relic.id === relicId);
}

function ownedEffects(player: Player): RelicEffects[] {
  return player.ownedRelics.flatMap((relic) => relicDefinition(relic.id)?.effects ?? []);
}

/** Sum of one numeric effect across all owned relics. */
export function relicEffectSum(player: Player, key: NumericEffect): number {
  return ownedEffects(player).reduce((total, effects) => total + (effects[key] ?? 0), 0);
}

export function activeSynergyCount(player: Player): number {
  return SYNERGY_PAIRS.filter(([a, b]) => hasRelic(player, a) && hasRelic(player, b)).length;
}

export function relicSynergyAttackMultiplier(player: Player): number {
  return 1 + activeSynergyCount(player) * 0.06;
}

export function hasRelic(player: Player, relicId: RelicId): boolean {
  return player.ownedRelics.some((relic) => relic.id === relicId);
}

export function relicAttackBonus(player: Player): number {
  return relicEffectSum(player, 'attack');
}

export function relicDefenseBonus(player: Player): number {
  return relicEffectSum(player, 'defense');
}

export function relicCritBonus(player: Player): number {
  return relicEffectSum(player, 'crit');
}

export function relicManaRegenBonus(player: Player): number {
  return relicEffectSum(player, 'manaRegen');
}

export function relicGoldBonus(player: Player): number {
  return relicEffectSum(player, 'gold');
}

export function relicSpecialDamageMultiplier(player: Player): number {
  return 1 + relicEffectSum(player, 'specialDamage');
}

export function relicRestHealBonus(player: Player): number {
  return relicEffectSum(player, 'restHeal');
}

export function relicWardChargeBonus(player: Player): number {
  return relicEffectSum(player, 'wardCharges');
}

export function relicPrepFocusBonus(player: Player): number {
  return relicEffectSum(player, 'prepFocus');
}

export function relicExecuteWindowBonus(player: Player): number {
  return relicEffectSum(player, 'executeWindow');
}

export function relicRiposteStart(player: Player): number {
  return relicEffectSum(player, 'riposteStart');
}

export function relicOverkillShards(player: Player): number {
  return relicEffectSum(player, 'overkillShards');
}

export function relicComboAttackBonus(player: Player, combo: number): number {
  return relicEffectSum(player, 'comboAttack') * Math.max(0, combo);
}

export function relicSwiftGoldBonus(player: Player): number {
  return relicEffectSum(player, 'swiftGold');
}

export function relicGuardHeal(player: Player): number {
  return relicEffectSum(player, 'guardHeal');
}

/** Poison damage multiplier (1 = untouched, 0.5 = halved). */
export function relicPoisonMultiplier(player: Player): number {
  return Math.max(0, 1 - relicEffectSum(player, 'poisonResist'));
}

export function relicWeatherManaBonus(player: Player, weather: PathWeather): number {
  return weather === 'storm' ? relicEffectSum(player, 'stormMana') : 0;
}

/**
 * Damage multiplier from relics for an attack of `element`.
 * `hitsWeakness` unlocks weakness-only bonuses such as Celestial Lens.
 */
export function relicDamageMultiplier(
  player: Player,
  element: AttackElement,
  hitsWeakness: boolean,
): number {
  const elementBonus = ownedEffects(player).reduce(
    (total, effects) => total + (effects.elementDamage?.[element] ?? 0),
    0,
  );
  const weaknessBonus = hitsWeakness ? relicEffectSum(player, 'weaknessDamage') : 0;

  return 1 + elementBonus + weaknessBonus;
}

/**
 * Picks a relic the player does not own yet. Relics from `biome` are three times as
 * likely, so each route flavour steers which gear you find.
 */
export function randomMissingRelic(player: Player, biome?: RelicBiome): Relic | null {
  const missing = RUN_RELICS.filter(
    (relic) => !player.ownedRelics.some((ownedRelic) => ownedRelic.id === relic.id),
  );
  const weights = missing.map((relic) => (biome && relic.biome === biome ? 3 : 1));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = Math.random() * total;

  for (const [index, relic] of missing.entries()) {
    roll -= weights[index];

    if (roll < 0) {
      return relic;
    }
  }

  return missing[missing.length - 1] ?? null;
}
