import { Player } from './player.model';
import { Relic, RelicId } from './relic.model';

export const RUN_RELICS: Relic[] = [
  {
    id: 'wyrmfang-seal',
    name: 'Wyrmfang Sigil',
    icon: 'WF',
    desc: '+5 ATK und Drachenklaue trifft haerter.',
  },
  {
    id: 'aegis-feather',
    name: 'Aegis Feather',
    icon: 'AG',
    desc: '+4 DEF und Schutzquellen werden stabiler.',
  },
  {
    id: 'oracle-lens',
    name: 'Oracle Lens',
    icon: 'OL',
    desc: '+7% Krit und bessere Boss-Vorbereitung.',
  },
  {
    id: 'gilded-compass',
    name: 'Gilded Compass',
    icon: 'GC',
    desc: 'Mehr Gold aus Schrein-, Schatz- und Prep-Routen.',
  },
  {
    id: 'embersigil',
    name: 'Ember Sigil',
    icon: 'ES',
    desc: 'Mehr Manafluss und staerkere Rastpunkte.',
  },
];

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
