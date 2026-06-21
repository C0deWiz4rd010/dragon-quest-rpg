import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CombatPanel } from '../../features/combat/combat-panel';
import { RunEncounterOverlay } from '../../features/encounters/run-encounter-overlay';
import { GameState } from '../../features/game-state/game-state.service';
import { Inventory } from '../../features/inventory/inventory.service';
import { InventoryPanel } from '../../features/inventory/inventory-panel';
import { EventLog } from '../../features/log/event-log';
import { MiniGameOverlay } from '../../features/minigames/mini-game-overlay';
import { PathBoard } from '../../features/path/path-board';
import { routeSynergyPreview } from '../../features/path/path-advisor';
import { Path, PathWeather } from '../../features/path/path.service';
import { StorageService } from '../../features/persistence/storage.service';
import { PixiBackground } from '../../features/pixi/pixi-background/pixi-background';

export type MobileTab = 'combat' | 'path' | 'supply' | 'log';

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => Promise<void>;
  }
}

@Component({
  selector: 'app-game-page',
  imports: [
    CombatPanel,
    EventLog,
    InventoryPanel,
    PathBoard,
    MiniGameOverlay,
    PixiBackground,
    RunEncounterOverlay,
  ],
  templateUrl: './game-page.html',
  styleUrl: './game-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GamePage {
  protected readonly gameState = inject(GameState);
  protected readonly path = inject(Path);
  protected readonly inventory = inject(Inventory);
  private readonly storage = inject(StorageService);
  protected readonly handbookOpen = signal(false);
  protected readonly mobileTab = signal<MobileTab>('combat');
  protected readonly savedAt = signal<string | null>(null);
  protected readonly player = computed(() => this.gameState.player());
  protected readonly weatherOptions: PathWeather[] = [
    'clear',
    'rain',
    'fog',
    'snow',
    'ash',
    'storm',
    'glow',
  ];
  protected readonly runStatus = computed(() => {
    if (!this.gameState.gameActive()) {
      return this.player().bossKilled ? 'Sieg gesichert' : 'Run beendet';
    }

    return this.gameState.enemy() ? 'Gefecht aktiv' : 'Pfadwahl bereit';
  });
  protected readonly bossCountdown = computed(() => 5 - (this.path.currentDepth() % 5));
  protected readonly pressureScore = computed(() => {
    const player = this.player();
    const enemy = this.gameState.enemy();
    const hpDanger = Math.max(0, 100 - this.gameState.playerHpPercent());
    const enemyDanger = enemy
      ? Math.min(35, enemy.attack + (enemy.role === 'boss' ? 18 : enemy.role === 'elite' ? 12 : 0))
      : 0;
    const statusDanger = player.statusEffect ? 18 : 0;
    const bossDanger = this.bossCountdown() === 5 ? 12 : Math.max(0, 8 - this.bossCountdown() * 2);

    return Math.min(100, Math.round(hpDanger * 0.45 + enemyDanger + statusDanger + bossDanger));
  });
  protected readonly pressureLabel = computed(() => {
    const score = this.pressureScore();

    if (score >= 75) return 'Kritisch';
    if (score >= 50) return 'Hoch';
    if (score >= 25) return 'Mittel';
    return 'Stabil';
  });
  protected readonly bossForecast = computed(() => {
    if (this.bossCountdown() > 2) {
      return 'Prep-Fenster offen';
    }

    if (this.gameState.bossPrepScore() >= 70) {
      return 'Finale fast gesetzt';
    }

    return 'Noch Ressourcen nachziehen';
  });
  protected readonly runDirective = computed(() => {
    const player = this.player();

    if (this.gameState.enemy()) {
      if (player.riposteCharges >= 2) {
        return { title: 'Riposte entladen', detail: 'Angriff oder Drachenklaue spielen' };
      }

      return { title: 'Gefecht lesen', detail: 'Intent und Incoming pruefen' };
    }

    if (player.hp / player.maxHp < 0.42) {
      return { title: 'Stabilisieren', detail: 'Sichere Route oder Haendler suchen' };
    }

    if (this.bossCountdown() <= 2 && this.gameState.bossPrepScore() < 65) {
      return { title: 'Prep suchen', detail: 'Schrein, Schmiede oder Elite planen' };
    }

    if (routeSynergyPreview(player).includes('bereit')) {
      return { title: 'Synergy offen', detail: 'Dritten Routentyp waehlen' };
    }

    return { title: 'Tempo halten', detail: 'Reward und Auftrag verbinden' };
  });
  protected readonly comboLevel = computed(() => {
    const combo = this.player().combo;
    if (combo >= 8) return 'ultra';
    if (combo >= 5) return 'fever';
    if (combo >= 3) return 'hot';
    if (combo > 0) return 'warm';
    return 'none';
  });

  protected readonly quickStats = computed(() => {
    const player = this.player();

    return [
      {
        label: 'Kampfkraft',
        value: this.gameState.playerAttack() + this.gameState.playerDefense(),
        detail: `ATK ${this.gameState.playerAttack()} / DEF ${this.gameState.playerDefense()}`,
      },
      {
        label: 'Kampfkunst',
        value:
          player.riposteCharges > 0
            ? `Riposte ${player.riposteCharges}`
            : `${player.perfectGuards} Guard`,
        detail: `${player.perfectGuards} perfekte, ${player.totalOverkillDamage} Overkill`,
      },
      {
        label: 'Ressourcen',
        value: `${player.gold}g`,
        detail: `${player.potions} Traenke, ${player.resolve}/${player.maxResolve} Resolve, ${player.dragonShards} Shards, Rang ${this.gameState.dragonRank()}`,
      },
      {
        label: 'Fortschritt',
        value: `Tiefe ${this.path.currentDepth() + 1}`,
        detail: `${player.completedPaths} Pfade, Serie ${player.routeStreak}, Note ${this.gameState.runGrade()}`,
      },
      {
        label: 'Bossprep',
        value: `${this.gameState.bossPrepScore()}%`,
        detail: this.gameState.bossPrepLabel(),
      },
      {
        label: 'Druck',
        value: `${this.pressureScore()}%`,
        detail: `${this.pressureLabel()} / ${this.bossForecast()}`,
      },
      {
        label: 'Auftrag',
        value: player.activeContract.completed
          ? 'Fertig'
          : `${player.activeContract.progress}/${player.activeContract.target}`,
        detail: `${player.activeContract.title}, Serie ${player.contractStreak}`,
      },
      {
        label: 'Fokus',
        value: this.runDirective().title,
        detail: this.runDirective().detail,
      },
    ];
  });

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }

    window.render_game_to_text = () => this.renderGameToText();
    window.advanceTime = (ms: number) =>
      new Promise((resolve) => window.setTimeout(resolve, Math.max(0, ms)));

    // Auto-save on every player state change (debounced to depth changes)
    effect(() => {
      const depth = this.path.currentDepth();
      if (depth > 0) {
        this.saveGame();
      }
    });
  }

  protected saveGame(): void {
    this.storage.save();
    this.savedAt.set(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
  }

  protected setWeather(mode: PathWeather): void {
    this.path.setWeather(mode);
  }

  protected resetRun(): void {
    this.gameState.reset();
    this.path.reset();
  }

  protected weatherLabel(): string {
    return this.weatherLabelFor(this.path.weather());
  }

  protected weatherLabelFor(mode: PathWeather): string {
    switch (mode) {
      case 'rain':
        return '🌧 Regen';
      case 'fog':
        return '🌫 Nebel';
      case 'snow':
        return '❄ Schnee';
      case 'ash':
        return '🌋 Asche';
      case 'storm':
        return '⛈ Sturm';
      case 'glow':
        return '✨ Aura';
      default:
        return '☀ Klar';
    }
  }

  protected weatherColorFor(mode: PathWeather): string {
    switch (mode) {
      case 'rain': return 'weather-rain';
      case 'fog': return 'weather-fog';
      case 'snow': return 'weather-snow';
      case 'ash': return 'weather-ash';
      case 'storm': return 'weather-storm';
      case 'glow': return 'weather-glow';
      default: return 'weather-clear';
    }
  }

  protected bossCountdownClass = computed(() => {
    const n = this.bossCountdown();
    if (n === 1) return 'imminent';
    if (n <= 2) return 'close';
    return '';
  });

  private renderGameToText(): string {
    const player = this.player();
    const enemy = this.gameState.enemy();
    const status = player.statusEffect
      ? `${player.statusEffect.type}:${player.statusEffect.rounds}x${player.statusEffect.damagePerRound}`
      : 'none';

    return [
      `status=${this.runStatus()}`,
      `level=${player.level}`,
      `hp=${player.hp}/${player.maxHp}`,
      `mana=${player.mana}/${player.maxMana}`,
      `combo=${player.combo}`,
      `riposte=${player.riposteCharges}`,
      `perfectGuards=${player.perfectGuards}`,
      `overkill=${player.totalOverkillDamage}`,
      `overkillStreak=${player.overkillStreak}`,
      `gold=${player.gold}`,
      `dragonShards=${player.dragonShards}`,
      `dragonRank=${this.gameState.dragonRank()}`,
      `runGrade=${this.gameState.runGrade()}`,
      `potions=${player.potions}`,
      `resolve=${player.resolve}/${player.maxResolve}`,
      `depth=${this.path.currentDepth() + 1}`,
      `pressure=${this.pressureScore()}%`,
      `bossPrep=${this.gameState.bossPrepScore()}%`,
      `routeStreak=${player.routeStreak}`,
      `contract=${player.activeContract.type}:${player.activeContract.progress}/${player.activeContract.target}:${player.activeContract.completed}`,
      `completedContracts=${player.completedContracts}`,
      `contractStreak=${player.contractStreak}`,
      `blessings=${player.activeBlessings.map((blessing) => `${blessing.type}:${blessing.charges}`).join(',') || 'none'}`,
      `relics=${player.ownedRelics.map((relic) => relic.id).join(',') || 'none'}`,
      `routeHistory=${player.routeHistory.map((entry) => `${entry.depth}:${entry.label}:${entry.result}`).join(' | ') || 'none'}`,
      `directive=${this.runDirective().title}:${this.runDirective().detail}`,
      `routeSynergy=${routeSynergyPreview(player)}`,
      `biomes=${
        this.path
          .currentSegment()
          ?.branches.map((branch) => `${branch.name}:${branch.biome ?? 'none'}`)
          .join(' | ') ?? 'none'
      }`,
      `advisor=${
        this.path
          .currentSegment()
          ?.branches.map(
            (branch) => `${branch.name}:${branch.type}:${branch.threat}:${branch.biome ?? 'none'}`,
          )
          .join(' | ') ?? 'none'
      }`,
      `weather=${this.path.weather()}`,
      `statusEffect=${status}`,
      `enemy=${enemy ? `${enemy.name}:${enemy.role}:${enemy.hp}/${enemy.maxHp}` : 'none'}`,
      `logs=${this.gameState
        .logs()
        .map((entry) => entry.message)
        .slice(-5)
        .join(' | ')}`,
    ].join('\n');
  }
}
