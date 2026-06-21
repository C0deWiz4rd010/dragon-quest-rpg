import { Injectable, inject } from '@angular/core';
import {
  createInitialContract,
  GameState,
  GameStateSnapshot,
} from '../game-state/game-state.service';
import { Player } from '../inventory/player.model';
import { hydrateEnemyVisuals, hydratePathVisuals, Path, PathSnapshot } from '../path/path.service';

interface SaveGame {
  version: 3;
  savedAt: string;
  state: GameStateSnapshot;
  path: PathSnapshot;
}

type LegacySaveGame = Partial<Omit<SaveGame, 'version'>> & {
  version?: number;
  state?: Partial<GameStateSnapshot> & {
    player?: Partial<Player>;
  };
};

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private readonly gameState = inject(GameState);
  private readonly path = inject(Path);
  private readonly saveKey = 'dragonQuestRpgSave';

  save(): void {
    const save: SaveGame = {
      version: 3,
      savedAt: new Date().toISOString(),
      state: {
        player: this.gameState.player(),
        enemy: this.gameState.enemy(),
        gameActive: this.gameState.gameActive(),
        selectedBranchId: this.gameState.selectedBranchId(),
        levelUpChoices: this.gameState.levelUpChoices(),
        logs: this.gameState.logs(),
      },
      path: {
        segments: this.path.segments(),
        currentDepth: this.path.currentDepth(),
      },
    };

    localStorage.setItem(this.saveKey, JSON.stringify(save));
    this.gameState.addLog('Spiel gespeichert.', 'event');
  }

  load(): boolean {
    const raw = localStorage.getItem(this.saveKey);

    if (!raw) {
      this.gameState.addLog('Kein Speicherstand gefunden.', 'damage');
      return false;
    }

    try {
      const save = migrateSave(JSON.parse(raw) as LegacySaveGame, this.gameState.player(), {
        segments: this.path.segments(),
        currentDepth: this.path.currentDepth(),
      });

      this.gameState.restore(save.state);
      this.path.restore(save.path);
      this.gameState.addLog(
        `Spielstand geladen: ${new Date(save.savedAt).toLocaleTimeString()}.`,
        'event',
      );
      return true;
    } catch {
      this.gameState.addLog('Speicherstand konnte nicht gelesen werden.', 'damage');
      return false;
    }
  }
}

function migrateSave(
  raw: LegacySaveGame,
  playerFallback: Player,
  pathFallback: PathSnapshot,
): SaveGame {
  return {
    version: 3,
    savedAt: raw.savedAt ?? new Date().toISOString(),
    state: {
      player: normalizePlayer(raw.state?.player, playerFallback),
      enemy: hydrateEnemyVisuals(raw.state?.enemy ?? null),
      gameActive: raw.state?.gameActive ?? true,
      selectedBranchId: raw.state?.selectedBranchId ?? null,
      levelUpChoices: raw.state?.levelUpChoices ?? [],
      logs: raw.state?.logs ?? [],
    },
    path: {
      segments: hydratePathVisuals(
        raw.path?.segments?.length ? raw.path.segments : pathFallback.segments,
      ),
      currentDepth: raw.path?.currentDepth ?? pathFallback.currentDepth,
    },
  };
}

function normalizePlayer(player: Partial<Player> | undefined, fallback: Player): Player {
  return {
    ...fallback,
    ...player,
    activePet: player?.activePet ?? null,
    activeContract: player?.activeContract ?? fallback.activeContract ?? createInitialContract(),
    activeBlessings: player?.activeBlessings ?? [],
    dragonShards: player?.dragonShards ?? 0,
    resolve: player?.resolve ?? fallback.resolve,
    maxResolve: player?.maxResolve ?? fallback.maxResolve,
    completedContracts: player?.completedContracts ?? fallback.completedContracts,
    contractStreak: player?.contractStreak ?? fallback.contractStreak,
    ownedItems: player?.ownedItems ?? [],
    ownedPets: player?.ownedPets ?? [],
    ownedRelics: player?.ownedRelics ?? [],
    routeHistory: player?.routeHistory ?? [],
    riposteCharges: player?.riposteCharges ?? fallback.riposteCharges,
    perfectGuards: player?.perfectGuards ?? fallback.perfectGuards,
    totalOverkillDamage: player?.totalOverkillDamage ?? fallback.totalOverkillDamage,
    overkillStreak: player?.overkillStreak ?? fallback.overkillStreak,
  };
}
