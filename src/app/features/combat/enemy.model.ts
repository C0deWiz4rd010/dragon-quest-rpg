import { UnitSprite } from '../assets/asset-catalog';

export type EnemyRole = 'bruiser' | 'swift' | 'hexer' | 'elite' | 'boss';
export type EnemyElement = 'fire' | 'ice' | 'lightning' | 'shadow';

export interface TelegraphedAbility {
  name: string;
  damageMultiplier?: number;
  shieldMultiplier?: number;
  /** The released attack is guaranteed to inflict a status effect. */
  forceStatus?: boolean;
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
  /** Hue rotation (degrees) that recolours shared sprites so enemies look distinct. */
  hue?: number;
  /** Size multiplier on the battlefield; bosses and elites stand taller. */
  scale?: number;
  sprite?: UnitSprite;
  level: number;
  elite: boolean;
  isBoss?: boolean;
  weakness: EnemyElement | null;
  resistance?: EnemyElement | null;
  /** Rounds the enemy skips its attack for. */
  stunnedRounds?: number;
  /** Enemy attacks performed so far; drives telegraph cycles. */
  turn?: number;
  /** Boss-specific half-health ability; falls back to Drachenzorn. */
  signature?: TelegraphedAbility;
  telegraphedAbility: TelegraphedAbility | null;
}
