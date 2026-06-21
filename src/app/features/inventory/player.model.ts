import { Item } from './item.model';
import { Pet } from './pet.model';
import { Relic } from './relic.model';

export type StatusEffectType = 'poison' | 'burn';
export type RunBlessingType = 'battle' | 'ward' | 'focus' | 'fortune' | 'vigor';
export type RouteHistoryType =
  | 'fight'
  | 'treasure'
  | 'event'
  | 'rest'
  | 'minigame'
  | 'merchant'
  | 'forge'
  | 'sanctuary'
  | 'boss';

export interface StatusEffect {
  type: StatusEffectType;
  rounds: number;
  damagePerRound: number;
}

export interface RunBlessing {
  type: RunBlessingType;
  charges: number;
}

export interface RouteHistoryEntry {
  depth: number;
  label: string;
  result: string;
  type: RouteHistoryType;
}

export type RunContractType = 'slayer' | 'pathfinder' | 'conserver';

export interface RunContract {
  type: RunContractType;
  title: string;
  description: string;
  progress: number;
  target: number;
  rewardGold: number;
  rewardResolve: number;
  completed: boolean;
}

export interface Player {
  statusEffect: StatusEffect | null;
  activeBlessings: RunBlessing[];
  level: number;
  xp: number;
  maxHp: number;
  hp: number;
  baseAttack: number;
  baseDefense: number;
  baseCrit: number;
  luck: number;
  maxMana: number;
  mana: number;
  gold: number;
  dragonShards: number;
  potions: number;
  resolve: number;
  maxResolve: number;
  activeContract: RunContract;
  completedContracts: number;
  contractStreak: number;
  attackBonus: number;
  defenseBonus: number;
  critBonus: number;
  equippedWeapon: Item | null;
  equippedArmor: Item | null;
  equippedRing: Item | null;
  activePet: Pet | null;
  ownedItems: Item[];
  ownedPets: Pet[];
  ownedRelics: Relic[];
  guarding: boolean;
  riposteCharges: number;
  skillCooldown: number;
  totalKills: number;
  eliteKills: number;
  perfectGuards: number;
  totalOverkillDamage: number;
  overkillStreak: number;
  completedPaths: number;
  routeHistory: RouteHistoryEntry[];
  routeStreak: number;
  bossKilled: boolean;
  totalManaUsed: number;
  miniGamesWon: number;
  combo: number;
  maxCombo: number;
  comboFever: boolean;
}
