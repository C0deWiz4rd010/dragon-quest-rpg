export type ItemType = 'weapon' | 'armor' | 'ring';
export type ItemRarity = 'common' | 'rare' | 'legendary';
export type ItemElement = 'fire' | 'ice' | 'lightning' | 'shadow' | 'holy';

export interface Item {
  id: string;
  name: string;
  type: ItemType;
  attackBonus: number;
  defenseBonus: number;
  critBonus: number;
  manaBonus: number;
  icon: string;
  desc: string;
  rarity?: ItemRarity;
  element?: ItemElement;
  setBonus?: string;
}
