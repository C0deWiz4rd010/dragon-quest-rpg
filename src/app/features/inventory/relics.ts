import { Player } from './player.model';
import { Relic, RelicId } from './relic.model';

export const RUN_RELICS: Relic[] = [
  {
    id: 'wyrmfang-seal',
    name: 'Wyrmfang Sigil',
    icon: 'WF',
    desc: '+5 ATK und Drachenklaue trifft haerter.',
    biome: 'ember',
    synergy: 'drake-talisman',
  },
  {
    id: 'aegis-feather',
    name: 'Aegis Feather',
    icon: 'AG',
    desc: '+4 DEF und Schutzquellen werden stabiler.',
    biome: 'sanctum',
    synergy: 'bastion-core',
  },
  {
    id: 'oracle-lens',
    name: 'Oracle Lens',
    icon: 'OL',
    desc: '+7% Krit und bessere Boss-Vorbereitung.',
    biome: 'ruin',
    synergy: 'celestial-lens',
  },
  {
    id: 'gilded-compass',
    name: 'Gilded Compass',
    icon: 'GC',
    desc: 'Mehr Gold aus Schrein-, Schatz- und Prep-Routen.',
    biome: 'grove',
    synergy: 'dusk-medallion',
  },
  {
    id: 'embersigil',
    name: 'Ember Sigil',
    icon: 'ES',
    desc: 'Mehr Manafluss und staerkere Rastpunkte.',
    biome: 'ember',
    synergy: 'tempest-seal',
  },
  {
    id: 'storm-signet',
    name: 'Storm Signet',
    icon: 'SS',
    desc: '+6% Krit und Kettentreffer bei Angriffen.',
    biome: 'storm',
    synergy: 'twin-fang',
  },
  {
    id: 'frozen-crest',
    name: 'Frozen Crest',
    icon: 'FC',
    desc: '+5 DEF und verstaerkter Eisschaden.',
    biome: 'frost',
  },
  {
    id: 'shadow-mantle',
    name: 'Shadow Mantle',
    icon: 'SM',
    desc: 'Execute-Fenster oeffnet bereits bei 35% Gegner-HP.',
    biome: 'ruin',
  },
  {
    id: 'grove-charm',
    name: 'Grove Charm',
    icon: 'GR',
    desc: 'Staerkere Rastpunkte und Giftbonus.',
    biome: 'grove',
  },
  {
    id: 'ruin-ward',
    name: 'Ruin Ward',
    icon: 'RW',
    desc: '+1 Deckungsladung pro Kampf.',
    biome: 'ruin',
  },
  {
    id: 'sanctum-orb',
    name: 'Sanctum Orb',
    icon: 'SO',
    desc: '+10 Mana und staerkerer Fertigkeitsschaden.',
    biome: 'sanctum',
  },
  {
    id: 'void-fragment',
    name: 'Void Fragment',
    icon: 'VF',
    desc: 'Overkill gewaehrt +1 Dragon Shard.',
    biome: 'ruin',
  },
  {
    id: 'tempest-seal',
    name: 'Tempest Seal',
    icon: 'TS',
    desc: 'Doppelter Manafluss bei Sturmwetter.',
    biome: 'storm',
    synergy: 'embersigil',
  },
  {
    id: 'drake-talisman',
    name: 'Drake Talisman',
    icon: 'DT',
    desc: '+15% Feuerschaden.',
    biome: 'ember',
    synergy: 'wyrmfang-seal',
  },
  {
    id: 'dusk-medallion',
    name: 'Dusk Medallion',
    icon: 'DM',
    desc: 'Bonus-Gold aus flinken Kills.',
    biome: 'storm',
    synergy: 'gilded-compass',
  },
  {
    id: 'twin-fang',
    name: 'Twin Fang',
    icon: 'TF',
    desc: '+3 ATK pro aktiver Combo-Stufe.',
    biome: 'grove',
    synergy: 'storm-signet',
  },
  {
    id: 'bastion-core',
    name: 'Bastion Core',
    icon: 'BC',
    desc: '+8 DEF und Regeneration bei Deckung.',
    biome: 'sanctum',
    synergy: 'aegis-feather',
  },
  {
    id: 'celestial-lens',
    name: 'Celestial Lens',
    icon: 'CL',
    desc: 'Alle Elementschwaechen +5% Schaden.',
    biome: 'sanctum',
    synergy: 'oracle-lens',
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

export function activeSynergyCount(player: Player): number {
  return SYNERGY_PAIRS.filter(
    ([a, b]) => hasRelic(player, a) && hasRelic(player, b),
  ).length;
}

export function relicSynergyAttackMultiplier(player: Player): number {
  return 1 + activeSynergyCount(player) * 0.06;
}

export function hasRelic(player: Player, relicId: RelicId): boolean {
  return player.ownedRelics.some((relic) => relic.id === relicId);
}

export function relicAttackBonus(player: Player): number {
  return hasRelic(player, 'wyrmfang-seal') ? 5 : 0;
}

export function relicDefenseBonus(player: Player): number {
  return hasRelic(player, 'aegis-feather') ? 4 : 0;
}

export function relicCritBonus(player: Player): number {
  return hasRelic(player, 'oracle-lens') ? 7 : 0;
}

export function relicManaRegenBonus(player: Player): number {
  return hasRelic(player, 'embersigil') ? 6 : 0;
}

export function relicGoldBonus(player: Player): number {
  return hasRelic(player, 'gilded-compass') ? 22 : 0;
}

export function relicSpecialDamageMultiplier(player: Player): number {
  return hasRelic(player, 'wyrmfang-seal') ? 1.12 : 1;
}

export function relicRestHealBonus(player: Player): number {
  return hasRelic(player, 'embersigil') ? 12 : 0;
}

export function relicWardChargeBonus(player: Player): number {
  return hasRelic(player, 'aegis-feather') ? 1 : 0;
}

export function relicPrepFocusBonus(player: Player): number {
  return hasRelic(player, 'oracle-lens') ? 1 : 0;
}

export function randomMissingRelic(player: Player): Relic | null {
  const missing = RUN_RELICS.filter((relic) => !player.ownedRelics.some((ownedRelic) => ownedRelic.id === relic.id));

  return missing[Math.floor(Math.random() * missing.length)] ?? null;
}
