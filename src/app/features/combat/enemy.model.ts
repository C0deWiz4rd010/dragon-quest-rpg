import { UnitSprite } from '../assets/asset-catalog';

export type EnemyRole = 'bruiser' | 'swift' | 'hexer' | 'elite' | 'boss';
export type EnemyElement = 'fire' | 'ice' | 'lightning' | 'shadow';

export interface TelegraphedAbility {
  name: string;
  damageMultiplier?: number;
  shieldMultiplier?: number;
}

export interface Enemy {
  id: string;
  name: string;
  role: EnemyRole;
  hp: number;
  maxHp: number;
  attack: number;
  gold: number;
  xp: number;
  icon: string;
  assetUrl?: string;
  sprite?: UnitSprite;
  level: number;
  elite: boolean;
  isBoss?: boolean;
  weakness: EnemyElement | null;
  telegraphedAbility: TelegraphedAbility | null;
}
