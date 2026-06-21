import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  QueryList,
  ViewChild,
  ViewChildren,
  computed,
  effect,
  inject,
} from '@angular/core';
import { GameState } from '../game-state/game-state.service';
import { adviseBranch, routeSynergyPreview, type BranchAdvice } from './path-advisor';
import {
  PathBranch,
  PathBranchModifier,
  PathBranchType,
  type PathBiome,
} from './path-segment.model';
import { Path, PathWeather } from './path.service';
import { PathWeatherCanvas } from './path-weather/path-weather';

@Component({
  selector: 'app-path-board',
  imports: [PathWeatherCanvas],
  templateUrl: './path-board.html',
  styleUrl: './path-board.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PathBoard {
  protected readonly gameState = inject(GameState);
  protected readonly path = inject(Path);
  @ViewChild('routeViewport') private routeViewport?: ElementRef<HTMLElement>;
  @ViewChildren('segmentEl') private segmentElements?: QueryList<ElementRef<HTMLElement>>;

  /**
   * Best choosable branch at the current station, ranked by advisor score.
   * Drives the "Empfohlen" highlight so the next move always reads clearly —
   * decision support without changing the underlying mechanics.
   */
  protected readonly recommendedBranchId = computed<string | null>(() => {
    if (this.gameState.enemy() || !this.gameState.gameActive()) {
      return null;
    }

    const segment = this.path.currentSegment();
    if (!segment) {
      return null;
    }

    let bestId: string | null = null;
    let bestScore = -Infinity;
    for (const branch of segment.branches) {
      if (branch.completed || branch.locked) {
        continue;
      }
      const score = this.branchAdvice(branch).score;
      if (score > bestScore) {
        bestScore = score;
        bestId = branch.id;
      }
    }

    return bestId;
  });

  constructor() {
    effect(() => {
      this.path.currentDepth();
      this.path.visibleSegments();
      setTimeout(() => this.scrollActiveDepthIntoView(), 0);
    });
  }

  protected weatherLabel(): string {
    return this.weatherLabelFor(this.path.weather());
  }

  protected weatherLabelFor(weather: PathWeather | undefined): string {
    const labels = {
      ash: 'Asche',
      clear: 'Klar',
      fog: 'Nebel',
      glow: 'Licht',
      rain: 'Regen',
      snow: 'Schnee',
      storm: 'Sturm',
    } as const;

    return labels[weather ?? 'clear'];
  }

  protected modifierLabel(modifier: PathBranchModifier | undefined): string | null {
    switch (modifier) {
      case 'ambush':
        return 'Hinterhalt';
      case 'blessing':
        return 'Segen';
      case 'cache':
        return 'Vorrat';
      case 'curse':
        return 'Fluch';
      case 'focus':
        return 'Fokus';
      default:
        return null;
    }
  }

  protected biomeLabel(biome: PathBiome | undefined): string {
    switch (biome) {
      case 'ember':
        return 'Glutherd';
      case 'grove':
        return 'Hain';
      case 'ruin':
        return 'Ruine';
      case 'frost':
        return 'Frost';
      case 'storm':
        return 'Sturmgrat';
      case 'sanctum':
        return 'Sanctum';
      default:
        return 'Wildnis';
    }
  }

  protected branchTypeLabel(type: PathBranchType): string {
    switch (type) {
      case 'fight':
        return 'Kampf';
      case 'treasure':
        return 'Schatz';
      case 'event':
        return 'Ereignis';
      case 'rest':
        return 'Rast';
      case 'minigame':
        return 'Game';
      case 'merchant':
        return 'Haendler';
      case 'forge':
        return 'Schmiede';
      case 'sanctuary':
        return 'Segen';
      case 'boss':
        return 'Boss';
    }
  }

  protected branchAdvice(branch: PathBranch): BranchAdvice {
    return adviseBranch(
      branch,
      this.gameState.player(),
      this.path.currentDepth(),
      this.gameState.bossPrepScore(),
    );
  }

  protected routeAdvisorSummary(): string {
    const player = this.gameState.player();

    if (player.hp / player.maxHp < 0.42) {
      return 'Stabilisieren: sichere Pfade priorisieren';
    }

    if (5 - (this.path.currentDepth() % 5) <= 2 && this.gameState.bossPrepScore() < 65) {
      return 'Boss naht: Prep-Pfad suchen';
    }

    return `Synergy ${routeSynergyPreview(player)}`;
  }

  protected contractHint(branch: PathBranch): string | null {
    const contract = this.gameState.player().activeContract;

    if (contract.completed) {
      return 'Auftrag bereit';
    }

    if (contract.type === 'slayer' && (branch.type === 'fight' || branch.type === 'boss')) {
      return '+Kopfgeld';
    }

    if (contract.type === 'pathfinder') {
      return '+Karte';
    }

    if (contract.type === 'conserver' && branch.type !== 'fight' && branch.type !== 'boss') {
      return '+Disziplin';
    }

    return null;
  }

  private scrollActiveDepthIntoView(): void {
    const viewport = this.routeViewport?.nativeElement;
    const currentDepth = this.path.currentDepth();
    const segment = this.segmentElements?.find(
      (entry) => Number(entry.nativeElement.dataset['segmentIndex']) === currentDepth,
    )?.nativeElement;

    if (!viewport || !segment) {
      return;
    }

    if (typeof segment.scrollIntoView === 'function') {
      segment.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }
}
