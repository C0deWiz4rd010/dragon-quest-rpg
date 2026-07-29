import { Player } from '../inventory/player.model';

export type CharacterClassId = 'warrior' | 'mage' | 'rogue' | 'paladin';

export interface CharacterClass {
  id: CharacterClassId;
  name: string;
  icon: string;
  tagline: string;
  perks: string[];
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
    perks: ['+20 Max-HP', '+4 Angriff', '+2 Verteidigung'],
    bonus: { maxHp: 20, hp: 20, baseAttack: 4, baseDefense: 2 },
  },
  {
    id: 'mage',
    name: 'Magier',
    icon: '🔮',
    tagline: 'Zerbrechlich, aber verheerend.',
    perks: ['+40 Max-Mana', '+6 Angriff', '−10 Max-HP'],
    bonus: { maxMana: 40, mana: 40, baseAttack: 6, maxHp: -10, hp: -10 },
  },
  {
    id: 'rogue',
    name: 'Schurke',
    icon: '🗡',
    tagline: 'Kritische Treffer und Glück.',
    perks: ['+10 Krit', '+6 Glück', '+2 Angriff'],
    bonus: { baseCrit: 10, luck: 6, baseAttack: 2 },
  },
  {
    id: 'paladin',
    name: 'Paladin',
    icon: '🛡',
    tagline: 'Bollwerk mit heiliger Entschlossenheit.',
    perks: ['+25 Max-HP', '+5 Verteidigung', '+1 Resolve'],
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
