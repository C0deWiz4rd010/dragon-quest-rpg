import type { Player } from '../inventory/player.model';
import type { PathWeather } from '../path/path.service';
import {
  enemyPhasePressure,
  roleAttackMultiplier,
  roleFollowUpChance,
  roleGuardMultiplier,
  weatherCombatModifiers,
} from './combat-rules';
import type { Enemy } from './enemy.model';

export interface IncomingDamagePreview {
  guardDamage: number;
  label: string;
  rawDamage: number;
  totalWithFollowUp: number;
}

export interface TacticalCombatAdvice {
  label: string;
  tone: 'attack' | 'defend' | 'recover' | 'finish';
}

export function incomingDamagePreview(
  enemy: Enemy | null,
  playerDefense: number,
  guarding: boolean,
  weather: PathWeather,
): IncomingDamagePreview {
  if (!enemy) {
    return {
      guardDamage: 0,
      label: 'Kein Gegenschlag',
      rawDamage: 0,
      totalWithFollowUp: 0,
    };
  }

  const modifiers = weatherCombatModifiers(weather);
  const phase = enemyPhasePressure(enemy.role, Math.round((enemy.hp / enemy.maxHp) * 100));
  const roleAdjustedAttack = Math.floor(
    enemy.attack * roleAttackMultiplier(enemy.role) * phase.attackMultiplier,
  );
  const critBudget = Math.floor(roleAdjustedAttack * (weather === 'fog' ? 0.08 : 0.12));
  const rawDamage = Math.max(
    1,
    Math.floor(
      (roleAdjustedAttack + critBudget) *
        (1 - (playerDefense + modifiers.playerDefenseDelta) / 100),
    ),
  );
  const guardDamage = Math.max(1, Math.floor(rawDamage * roleGuardMultiplier(enemy.role, true)));
  const followUp = Math.floor(rawDamage * 0.42 * roleFollowUpChance(enemy.role));
  const stormText = modifiers.enemyMissChance > 0 ? ', Sturm kann verfehlen' : '';
  const phaseText = phase.tone === 'calm' ? '' : `, ${phase.label}`;

  return {
    guardDamage,
    label: guarding
      ? `~${guardDamage} DMG in Deckung${phaseText}${stormText}`
      : `~${rawDamage + followUp} DMG incoming${phaseText}${stormText}`,
    rawDamage,
    totalWithFollowUp: rawDamage + followUp,
  };
}

export function tacticalCombatAdvice(
  player: Player,
  enemy: Enemy | null,
  playerDefense: number,
  canUseSkill: boolean,
  weather: PathWeather,
): TacticalCombatAdvice {
  if (!enemy) {
    return { label: 'Pfad waehlen', tone: 'attack' };
  }

  const incoming = incomingDamagePreview(enemy, playerDefense, player.guarding, weather);
  const hpAfterHit = player.hp - incoming.totalWithFollowUp;
  const enemyHpPercent = enemy.hp / enemy.maxHp;
  const phase = enemyPhasePressure(enemy.role, Math.round(enemyHpPercent * 100));

  if (canUseSkill && enemyHpPercent <= 0.4) {
    return { label: 'Drachenklaue finisht stark', tone: 'finish' };
  }

  if (hpAfterHit <= 0 && player.resolve > 0) {
    return { label: 'Resolve jetzt nutzen', tone: 'recover' };
  }

  if (player.hp / player.maxHp < 0.35 && (player.mana >= 20 || player.potions > 0)) {
    return { label: 'Heilen oder Trank vorziehen', tone: 'recover' };
  }

  if (player.riposteCharges >= 2 && (canUseSkill || player.combo >= 2)) {
    return { label: 'Riposte jetzt entladen', tone: 'finish' };
  }

  if (phase.tone === 'enraged' && player.riposteCharges === 0) {
    return { label: 'Finale Phase blocken', tone: 'defend' };
  }

  if (
    incoming.totalWithFollowUp > player.maxHp * 0.24 ||
    player.skillCooldown > 1 ||
    player.mana < 30
  ) {
    return { label: 'Deckung baut Tempo', tone: 'defend' };
  }

  return {
    label: player.combo >= 3 ? 'Combo in Finisher wandeln' : 'Druck mit Angriff halten',
    tone: 'attack',
  };
}
