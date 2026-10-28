import { Player } from '../inventory/player.model';

export type CharacterClassId = 'warrior' | 'mage' | 'rogue' | 'paladin';

export interface CharacterClass {
  id: CharacterClassId;
  name: string;
  icon: string;
  tagline: string;
  perks: string[];
  /** Unique class mechanic, implemented by the helper functions below. */
  passive: { name: string; description: string };
  /** Applied on top of the base initial player when a run begins. */
  bonus: Partial<
    Pick<
      Player,
      | 'maxHp'
      | 'hp'
      | 'baseAttack'
      | 'baseDefense'
      | 'baseCrit'
      | 'luck'
      | 'maxMana'
      | 'mana'
      | 'maxResolve'
      | 'resolve'
      | 'potions'
      | 'gold'
    >
  >;
}

export const CHARACTER_CLASSES: CharacterClass[] = [
  {
    id: 'warrior',
    name: 'Krieger',
    icon: '⚔',
    tagline: 'Rohe Stärke und Ausdauer.',
    perks: ['+20 Max-HP', '+4 Angriff', '+2 Verteidigung', 'Passiv: Kampfgeist'],
    passive: { name: 'Kampfgeist', description: 'Deckung behaelt deine Combo.' },
    bonus: { maxHp: 20, hp: 20, baseAttack: 4, baseDefense: 2 },
  },
  {
    id: 'mage',
    name: 'Magier',
    icon: '🔮',
    tagline: 'Zerbrechlich, aber verheerend.',
    perks: ['+40 Max-Mana', '+6 Angriff', '−10 Max-HP', 'Passiv: Arkankonzentration'],
    passive: { name: 'Arkankonzentration', description: 'Drachenklaue kostet 8 Mana weniger.' },
    bonus: { maxMana: 40, mana: 40, baseAttack: 6, maxHp: -10, hp: -10 },
  },
  {
    id: 'rogue',
    name: 'Schurke',
    icon: '🗡',
    tagline: 'Kritische Treffer und Glück.',
    perks: ['+10 Krit', '+6 Glück', '+2 Angriff', 'Passiv: Opportunist'],
    passive: { name: 'Opportunist', description: 'Kritische Treffer geben +6 Mana.' },
    bonus: { baseCrit: 10, luck: 6, baseAttack: 2 },
  },
  {
    id: 'paladin',
    name: 'Paladin',
    icon: '🛡',
    tagline: 'Bollwerk mit heiliger Entschlossenheit.',
    perks: ['+25 Max-HP', '+5 Verteidigung', '+1 Resolve', 'Passiv: Heilige Hand'],
    passive: { name: 'Heilige Hand', description: 'Heilen kostet 6 Mana weniger.' },
    bonus: { maxHp: 25, hp: 25, baseDefense: 5, maxResolve: 1, resolve: 1 },
  },
];

export function getCharacterClass(id: CharacterClassId | undefined): CharacterClass | undefined {
  if (!id) {
    return undefined;
  }
  return CHARACTER_CLASSES.find((cls) => cls.id === id);
}

/** Returns a new player with the class bonuses applied additively. */
export function applyCharacterClass(player: Player, id: CharacterClassId): Player {
  const cls = getCharacterClass(id);
  if (!cls) {
    return player;
  }
  const next: Player = { ...player, characterClass: id };
  for (const entry of Object.entries(cls.bonus)) {
    const key = entry[0];
    const value = entry[1] as number;
    (next as unknown as Record<string, number>)[key] =
      (player as unknown as Record<string, number>)[key] + value;
  }
  return next;
}

/** Mana price of Drachenklaue, reduced for mages. */
export function skillManaCost(player: Pick<Player, 'characterClass'>, base: number): number {
  return player.characterClass === 'mage' ? Math.max(1, base - 8) : base;
}

/** Mana price of Heilen, reduced for paladins. */
export function healManaCost(player: Pick<Player, 'characterClass'>, base: number): number {
  return player.characterClass === 'paladin' ? Math.max(1, base - 6) : base;
}

/** Warriors keep their combo when they guard. */
export function guardKeepsCombo(player: Pick<Player, 'characterClass'>): boolean {
  return player.characterClass === 'warrior';
}

/** Mana a rogue regains from landing a critical hit. */
export function critManaRefund(player: Pick<Player, 'characterClass'>): number {
  return player.characterClass === 'rogue' ? 6 : 0;
}
