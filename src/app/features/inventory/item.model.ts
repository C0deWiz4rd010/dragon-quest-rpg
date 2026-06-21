export type ItemType = 'weapon' | 'armor' | 'ring';

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
}
