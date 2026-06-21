import { UnitSprite } from '../assets/asset-catalog';
import { RelicId } from '../inventory/relic.model';
import type { EnemyRole } from '../combat/enemy.model';
import type { PathWeather } from './path.service';

export type PathBranchType =
  | 'fight'
  | 'treasure'
  | 'event'
  | 'rest'
  | 'minigame'
  | 'merchant'
  | 'forge'
  | 'sanctuary'
  | 'boss';
export type PathBranchModifier = 'ambush' | 'blessing' | 'cache' | 'curse' | 'focus';
export type PathBiome = 'ember' | 'grove' | 'ruin' | 'frost' | 'storm' | 'sanctum';

export interface PathBranch {
  id: string;
  type: PathBranchType;
  name: string;
  icon: string;
  assetUrl?: string;
  sprite?: UnitSprite;
  description: string;
  threat: number;
  riskLabel?: string;
  rewardHint?: string;
  weatherPreview?: PathWeather;
  biome?: PathBiome;
  enemyRole?: EnemyRole;
  modifier?: PathBranchModifier;
  modifierHint?: string;
  eliteRoute?: boolean;
  guaranteedRelicId?: RelicId;
  completed: boolean;
  locked?: boolean;
  enemyId?: string;
  reward?: {
    gold: number;
    potions: number;
  };
}

export interface PathSegment {
  id: string;
  depth: number;
  branches: PathBranch[];
  cleared: boolean;
}
