export type PetBonusType = 'attack' | 'defense' | 'crit' | 'manaReg' | 'luck';
export type PetTrigger = 'onCrit' | 'onKill' | 'onAttack' | 'onGuard' | 'onLowHp';

export interface PetAbility {
  trigger: PetTrigger;
  label: string;
  heal?: number;
  mana?: number;
  shard?: number;
  cooldownReduce?: number;
  riposteCharge?: number;
}

export interface Pet {
  id: string;
  name: string;
  icon: string;
  bonusType: PetBonusType;
  bonusValue: number;
  desc: string;
  activeAbility?: PetAbility;
}
