import { ChangeDetectionStrategy, Component, HostListener, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { blessingLabel } from '../game-state/run-blessings';
import { CombatStage } from './combat-stage/combat-stage';
import { GameState } from '../game-state/game-state.service';
import { Path } from '../path/path.service';
import { Combat } from './combat.service';
import { EnemyElement, EnemyRole, TelegraphedAbility } from './enemy.model';
import {
  elementWeaknessMultiplier,
  enemyIntentPreview,
  enemyPhasePressure,
  riposteDamageMultiplier,
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

  protected statusIcon(type: 'poison' | 'burn'): string {
    return type === 'poison' ? 'Gift' : 'Brand';
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
    const comboBonus = 1 + Math.max(0, combo - 1) * 0.12;
    const spread = Math.max(1, atk - 5);
    const low = Math.max(1, Math.floor(5 * comboBonus));
    const high = Math.floor((4 + spread) * comboBonus);
    return `~${low}–${high} DMG`;
  }

  protected specialPreview(): string {
    const atk = this.gameState.playerAttack();
    const combo = this.gameState.player().combo;
    const finisherBonus = 1 + Math.max(0, combo - 1) * 0.18;
    const enemy = this.gameState.enemy();
    const weakBonus = enemy ? elementWeaknessMultiplier(enemy.weakness, 'fire') : 1;
    const base = Math.floor(atk * 1.55 * finisherBonus * weakBonus);
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

  protected enemyWeakness(): EnemyElement | null {
    return this.gameState.enemy()?.weakness ?? null;
  }

  protected isWeaknessExploitable(): boolean {
    return this.gameState.enemy()?.weakness === 'fire';
  }

  protected weaknessElementLabel(): string {
    const w = this.gameState.enemy()?.weakness;
    return w ? weaknessLabel(w) : '';
  }

  protected weaknessIcon(): string {
    switch (this.gameState.enemy()?.weakness) {
      case 'fire': return '🔥';
      case 'ice': return '❄';
      case 'lightning': return '⚡';
      case 'shadow': return '◆';
      default: return '';
    }
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
    return 'Gefaehrliche Aktion vorbereitet!';
  }
}
