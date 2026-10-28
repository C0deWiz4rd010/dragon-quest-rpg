import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { blessingLabel } from '../game-state/run-blessings';
import { getSkill, Skill } from '../game-state/skills';
import { CombatStage } from './combat-stage/combat-stage';
import { GameState } from '../game-state/game-state.service';
import { Path } from '../path/path.service';
import { Combat } from './combat.service';
import { EnemyElement, EnemyRole, TelegraphedAbility } from './enemy.model';
import { StatusEffectType } from '../inventory/player.model';
import { COMBAT_BALANCE } from './combat-balance';
import {
  attackElementMultiplier,
  elementIcon,
  enemyIntentPreview,
  enemyPhasePressure,
  riposteDamageMultiplier,
  statusLabel,
  weaknessLabel,
} from './combat-rules';
import { incomingDamagePreview, tacticalCombatAdvice } from './combat-advisor';

@Component({
  selector: 'app-combat-panel',
  imports: [MatButtonModule, CombatStage],
  templateUrl: './combat-panel.html',
  styleUrl: './combat-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CombatPanel {
  protected readonly gameState = inject(GameState);
  protected readonly combat = inject(Combat);
  protected readonly path = inject(Path);
  protected readonly blessingLabel = blessingLabel;

  /** Drives a brief "engage" transition each time a fresh enemy appears. */
  protected readonly engaged = signal(false);
  private lastEnemyKey = '';

  /** Visual pip meter for the current combo (8 pips, filled by combo count). */
  protected readonly comboPips = computed(() => {
    const combo = this.gameState.player().combo;
    return Array.from({ length: 8 }, (_, index) => index < combo);
  });

  constructor() {
    effect(() => {
      const enemy = this.gameState.enemy();
      if (!enemy) {
        this.lastEnemyKey = '';
        return;
      }
      const key = `${enemy.name}:${enemy.maxHp}:${enemy.role}`;
      if (key !== this.lastEnemyKey) {
        this.lastEnemyKey = key;
        this.engaged.set(true);
        setTimeout(() => this.engaged.set(false), 720);
      }
    });
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    switch (event.key) {
      case '1':
        this.combat.attack();
        break;
      case '2':
        this.combat.specialAttack();
        break;
      case '3':
        this.combat.heal();
        break;
      case '4':
        this.combat.guard();
        break;
      case '5':
        this.combat.usePotion();
        break;
      case '6':
        this.combat.useResolve();
        break;
    }
  }

  protected statusIcon(type: StatusEffectType): string {
    return statusLabel(type);
  }

  protected weatherBuff(weather: string): string | null {
    switch (weather) {
      case 'rain':
        return 'Regen: +Mana/Runde';
      case 'storm':
        return 'Sturm: 25% Miss';
      case 'snow':
        return 'Schnee: +3 DEF';
      case 'ash':
        return 'Asche: Brand-Risiko';
      case 'glow':
        return 'Licht: +5% Krit';
      case 'fog':
        return 'Nebel: -10% Krit';
      default:
        return null;
    }
  }

  protected finisherPower(): string {
    const player = this.gameState.player();
    const combo = player.combo;

    if (player.guarding) {
      return 'Deckung';
    }

    if (player.riposteCharges > 0) {
      return `Riposte ${player.riposteCharges}x`;
    }

    return combo > 1 ? `${Math.round((1 + (combo - 1) * 0.18) * 100)}% Finisher` : 'Offensiv';
  }

  protected ripostePower(): string {
    const charges = this.gameState.player().riposteCharges;

    return charges > 0
      ? `+${Math.round((riposteDamageMultiplier(charges) - 1) * 100)}% Schaden`
      : 'Blocken laedt';
  }

  protected phasePressure(): string {
    const enemy = this.gameState.enemy();

    if (!enemy) {
      return 'Ruhig';
    }

    return enemyPhasePressure(enemy.role, this.gameState.enemyHpPercent()).label;
  }

  protected phaseTone(): 'calm' | 'heated' | 'enraged' {
    const enemy = this.gameState.enemy();

    if (!enemy) {
      return 'calm';
    }

    return enemyPhasePressure(enemy.role, this.gameState.enemyHpPercent()).tone;
  }

  protected overkillLabel(): string {
    const player = this.gameState.player();

    return player.overkillStreak > 0
      ? `${player.overkillStreak}x Serie`
      : `${player.totalOverkillDamage} Gesamt`;
  }

  protected executeWindow(): string {
    if (!this.gameState.enemy()) {
      return 'Bereit';
    }

    const hpPercent = this.gameState.enemyHpPercent();

    if (hpPercent <= 25) {
      return '+35%';
    }

    if (hpPercent <= 40) {
      return '+18%';
    }

    return 'Warten';
  }

  protected enemyIntent(): string {
    const enemy = this.gameState.enemy();

    return enemy ? enemyIntentPreview(enemy.role, this.path.weather()) : 'Kein Gegner aktiv';
  }

  protected incomingPreview(): string {
    return incomingDamagePreview(
      this.gameState.enemy(),
      this.gameState.playerDefense(),
      this.gameState.player().guarding,
      this.path.weather(),
    ).label;
  }

  protected tacticalAdvice(): string {
    return tacticalCombatAdvice(
      this.gameState.player(),
      this.gameState.enemy(),
      this.gameState.playerDefense(),
      this.gameState.canUseSkill(),
      this.path.weather(),
    ).label;
  }

  protected roleLabel(role: EnemyRole): string {
    switch (role) {
      case 'bruiser':
        return 'Bruiser: Deckungspierce';
      case 'swift':
        return 'Swift: Nachschlag';
      case 'hexer':
        return 'Hexer: Gift-Risiko';
      case 'elite':
        return 'Elite: Reward + Druck';
      case 'boss':
        return 'Boss: Finale';
    }
  }

  protected prepForecast(): string {
    const score = this.gameState.bossPrepScore();

    if (score >= 80) return 'Boss bereit';
    if (score >= 60) return 'Mit Plan spielbar';
    if (score >= 40) return 'Noch Prep holen';
    return 'Sehr duenn';
  }

  protected attackPreview(): string {
    const atk = this.gameState.playerAttack();
    const combo = this.gameState.player().combo + 1;
    const comboBonus = 1 + Math.max(0, combo - 1) * COMBAT_BALANCE.comboStep;
    const spread = Math.max(1, atk - 5);
    const low = Math.max(1, Math.floor(5 * comboBonus));
    const high = Math.floor((4 + spread) * comboBonus);
    return `~${low}–${high} DMG`;
  }

  protected specialPreview(): string {
    const atk = this.gameState.playerAttack();
    const combo = this.gameState.player().combo;
    const finisherBonus = 1 + Math.max(0, combo - 1) * COMBAT_BALANCE.special.finisherStep;
    const enemy = this.gameState.enemy();
    const weakBonus = this.combat.elementMultiplier(enemy);
    const base = Math.floor(atk * COMBAT_BALANCE.special.damageMultiplier * finisherBonus * weakBonus);
    const spread = Math.max(1, base - 5);
    return `~${Math.max(1, base - spread)}–${base} DMG`;
  }

  protected healPreview(): string {
    const player = this.gameState.player();
    const amount = Math.min(28 + player.level * 2, player.maxHp - player.hp);
    return amount > 0 ? `+${amount} HP` : 'HP voll';
  }

  protected resolvePreview(): string {
    const player = this.gameState.player();
    const hp = Math.min(22 + player.level * 2, player.maxHp - player.hp);
    return `+${hp} HP +24 Mana`;
  }

  protected skillChoices(): Skill[] {
    return (this.gameState.player().pendingSkillChoices ?? [])
      .map((id) => getSkill(id))
      .filter((skill): skill is Skill => !!skill);
  }

  protected enemyWeakness(): EnemyElement | null {
    return this.gameState.enemy()?.weakness ?? null;
  }

  protected isWeaknessExploitable(): boolean {
    return attackElementMultiplier(this.gameState.enemy(), this.gameState.playerAttackElement()) > 1;
  }

  protected enemyResistance(): EnemyElement | null {
    return this.gameState.enemy()?.resistance ?? null;
  }

  protected resistanceLabel(): string {
    const r = this.enemyResistance();
    return r ? `${elementIcon(r)} ${weaknessLabel(r)}` : '';
  }

  protected isStunned(): boolean {
    return (this.gameState.enemy()?.stunnedRounds ?? 0) > 0;
  }

  protected attackElementBadge(): string {
    const element = this.gameState.playerAttackElement();
    return element === 'none' ? '' : `${elementIcon(element)} ${weaknessLabel(element)}`;
  }

  protected weaknessElementLabel(): string {
    const w = this.gameState.enemy()?.weakness;
    return w ? weaknessLabel(w) : '';
  }

  protected weaknessIcon(): string {
    return elementIcon(this.gameState.enemy()?.weakness);
  }

  protected telegraphWarning(): TelegraphedAbility | null {
    return this.gameState.enemy()?.telegraphedAbility ?? null;
  }

  protected telegraphDescription(ability: TelegraphedAbility): string {
    if (ability.damageMultiplier) {
      return `Naechster Angriff +${Math.round((ability.damageMultiplier - 1) * 100)}% Schaden! Jetzt decken!`;
    }
    if (ability.shieldMultiplier) {
      return `Schild: naechster Treffer -${Math.round((1 - ability.shieldMultiplier) * 100)}% reduziert. Finisher nutzen!`;
    }
    if (ability.forceStatus) {
      return 'Der naechste Treffer verhaengt garantiert einen Statuseffekt! Deckung hilft.';
    }
    return 'Gefaehrliche Aktion vorbereitet!';
  }
}
