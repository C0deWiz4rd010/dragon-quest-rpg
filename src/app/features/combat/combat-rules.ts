import { StatusEffect } from '../inventory/player.model';
import type { PathWeather } from '../path/path.service';
import type { EnemyElement, EnemyRole } from './enemy.model';

export interface WeatherCombatModifiers {
  playerCritDelta: number;
  enemyCritDelta: number;
  enemyMissChance: number;
  playerDefenseDelta: number;
  manaRegenDelta: number;
  burnChance: number;
}

export interface EnemyPhasePressure {
  attackMultiplier: number;
  label: string;
  tone: 'calm' | 'heated' | 'enraged';
}

export interface OverkillReward {
  dragonShards: number;
  gold: number;
  mana: number;
}

export function weatherCombatModifiers(weather: PathWeather): WeatherCombatModifiers {
  return {
    playerCritDelta: weather === 'glow' ? 5 : weather === 'fog' ? -10 : 0,
    enemyCritDelta: weather === 'fog' ? -10 : 0,
    enemyMissChance: weather === 'storm' ? 0.25 : 0,
    playerDefenseDelta: weather === 'snow' ? 3 : 0,
    manaRegenDelta: weather === 'rain' ? 5 : 0,
    burnChance: weather === 'ash' ? 0.15 : 0,
  };
}

export function roleAttackMultiplier(role: EnemyRole): number {
  switch (role) {
    case 'bruiser':
      return 1.12;
    case 'swift':
      return 0.9;
    case 'hexer':
      return 0.95;
    case 'elite':
      return 1.18;
    case 'boss':
      return 1.25;
    default:
      return 1;
  }
}

export function roleStatusChance(role: EnemyRole): number {
  switch (role) {
    case 'hexer':
      return 0.22;
    case 'elite':
      return 0.16;
    case 'boss':
      return 0.18;
    default:
      return 0;
  }
}

export function roleLootMultiplier(role: EnemyRole): number {
  switch (role) {
    case 'swift':
      return 1.08;
    case 'bruiser':
      return 1.16;
    case 'hexer':
      return 1.2;
    case 'elite':
      return 1.42;
    case 'boss':
      return 2.4;
    default:
      return 1;
  }
}

export function roleGuardMultiplier(role: EnemyRole, guarding: boolean): number {
  if (!guarding) {
    return 1;
  }

  switch (role) {
    case 'bruiser':
      return 0.62;
    case 'elite':
      return 0.56;
    case 'boss':
      return 0.58;
    default:
      return 0.45;
  }
}

export function roleFollowUpChance(role: EnemyRole): number {
  switch (role) {
    case 'swift':
      return 0.18;
    case 'elite':
      return 0.12;
    case 'boss':
      return 0.14;
    default:
      return 0;
  }
}

export function executeDamageMultiplier(enemyHpPercent: number): number {
  if (enemyHpPercent <= 25) {
    return 1.35;
  }

  if (enemyHpPercent <= 40) {
    return 1.18;
  }

  return 1;
}

export function riposteDamageMultiplier(charges: number): number {
  return 1 + Math.min(3, Math.max(0, charges)) * 0.18;
}

export function enemyPhasePressure(role: EnemyRole, enemyHpPercent: number): EnemyPhasePressure {
  if (role === 'boss') {
    if (enemyHpPercent <= 30) {
      return { attackMultiplier: 1.22, label: 'Finale Wut', tone: 'enraged' };
    }

    if (enemyHpPercent <= 60) {
      return { attackMultiplier: 1.1, label: 'Drachenzorn', tone: 'heated' };
    }
  }

  if (role === 'elite' && enemyHpPercent <= 45) {
    return { attackMultiplier: 1.12, label: 'Elite-Druck', tone: 'heated' };
  }

  return { attackMultiplier: 1, label: 'Normal', tone: 'calm' };
}

export function overkillReward(overkillDamage: number, role: EnemyRole): OverkillReward {
  if (overkillDamage <= 0) {
    return { dragonShards: 0, gold: 0, mana: 0 };
  }

  const roleBonus = role === 'boss' ? 2 : role === 'elite' ? 1 : 0;
  const tier = Math.min(3, Math.floor(overkillDamage / 18));

  return {
    dragonShards: overkillDamage >= 24 ? Math.min(3, 1 + roleBonus) : 0,
    gold: 8 + tier * 6 + roleBonus * 10,
    mana: 8 + tier * 4 + roleBonus * 4,
  };
}

export function enemyIntentPreview(role: EnemyRole, weather: PathWeather): string {
  if (weather === 'storm') {
    return 'Unsicherer Angriff, Sturm kann verfehlen';
  }

  if (weather === 'ash') {
    return 'Angriff mit Brand-Risiko';
  }

  switch (role) {
    case 'swift':
      return 'Schneller Angriff, Chance auf Nachschlag';
    case 'bruiser':
      return 'Schwerer Angriff, bricht Deckung teilweise';
    case 'hexer':
      return 'Hexer-Druck, Gift-Risiko';
    case 'elite':
      return 'Elite-Angriff mit Status- und Nachschlagrisiko';
    case 'boss':
      return 'Boss-Angriff mit hohem Druck';
    default:
      return 'Standardangriff';
  }
}

export function statusFromThreat(
  role: EnemyRole,
  weather: PathWeather,
  existing: StatusEffect | null,
  roll: () => number = Math.random,
): StatusEffect | null {
  if (existing) {
    return null;
  }

  const modifiers = weatherCombatModifiers(weather);

  if (modifiers.burnChance > 0 && roll() < modifiers.burnChance) {
    return { type: 'burn', rounds: 3, damagePerRound: 8 };
  }

  if (roll() < roleStatusChance(role)) {
    return role === 'hexer'
      ? { type: 'poison', rounds: 4, damagePerRound: 6 }
      : { type: 'burn', rounds: 3, damagePerRound: 7 };
  }

  return null;
}

export function elementWeaknessMultiplier(
  enemyWeakness: EnemyElement | null,
  attackElement: EnemyElement,
): number {
  if (!enemyWeakness || enemyWeakness !== attackElement) return 1;
  return 1.25;
}

export function weaknessLabel(element: EnemyElement): string {
  switch (element) {
    case 'fire': return 'Feuer';
    case 'ice': return 'Eis';
    case 'lightning': return 'Blitz';
    case 'shadow': return 'Schatten';
  }
}

export function tickStatusEffect(
  hp: number,
  effect: StatusEffect | null,
): { hp: number; nextEffect: StatusEffect | null; damage: number; expired: boolean } {
  if (!effect || effect.rounds <= 0) {
    return { hp, nextEffect: null, damage: 0, expired: false };
  }

  const nextHp = Math.max(0, hp - effect.damagePerRound);
  const nextEffect = effect.rounds > 1 ? { ...effect, rounds: effect.rounds - 1 } : null;

  return {
    hp: nextHp,
    nextEffect,
    damage: effect.damagePerRound,
    expired: nextEffect === null,
  };
}
