export type PetBonusType = 'attack' | 'defense' | 'crit' | 'manaReg' | 'luck';

export interface Pet {
  id: string;
  name: string;
  icon: string;
  bonusType: PetBonusType;
  bonusValue: number;
  desc: string;
}
