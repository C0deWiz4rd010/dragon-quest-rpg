import { Injectable, inject, signal } from '@angular/core';
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

export type SaveSlot = 1 | 2 | 3;

export interface SlotInfo {
  slot: SaveSlot;
  savedAt: string;
  level: number;
  completedPaths: number;
  characterClass?: string;
}

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private readonly gameState = inject(GameState);
  private readonly path = inject(Path);
  private readonly saveKey = 'dragonQuestRpgSave';

  /** The slot most recently saved to or loaded from. */
  readonly currentSlot = signal<SaveSlot>(1);

  private keyFor(slot: SaveSlot): string {
    // Slot 1 keeps the legacy key so old saves migrate seamlessly.
    return slot === 1 ? this.saveKey : `${this.saveKey}_${slot}`;
  }

  /** Writes the current run to a slot. Returns false if storage is unavailable or full. */
  save(slot: SaveSlot = this.currentSlot(), options: { silent?: boolean } = {}): boolean {
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

    try {
      localStorage.setItem(this.keyFor(slot), JSON.stringify(save));
    } catch {
      this.gameState.addLog('Speichern fehlgeschlagen (Speicher voll oder gesperrt).', 'damage');
      return false;
    }

    this.currentSlot.set(slot);
    if (!options.silent) {
      this.gameState.addLog(`Spiel in Slot ${slot} gespeichert.`, 'event');
    }
    return true;
  }

  load(slot: SaveSlot = this.currentSlot()): boolean {
    const raw = this.readRaw(slot);

    if (!raw) {
      this.gameState.addLog('Kein Speicherstand gefunden.', 'damage');
      return false;
    }

    try {
      const parsed: unknown = JSON.parse(raw);

      if (!isLegacySave(parsed)) {
        throw new Error('Invalid save shape');
      }

      const save = migrateSave(parsed, this.gameState.player(), {
        segments: this.path.segments(),
        currentDepth: this.path.currentDepth(),
      });

      this.gameState.restore(save.state);
      this.path.restore(save.path);
      this.currentSlot.set(slot);
      this.gameState.addLog(
        `Spielstand geladen: ${new Date(save.savedAt).toLocaleTimeString()}.`,
        'event',
      );
      return true;
    } catch {
      this.backupCorrupt(slot, raw);
      this.gameState.addLog('Speicherstand beschaedigt – Sicherung wurde angelegt.', 'damage');
      return false;
    }
  }

  private readRaw(slot: SaveSlot): string | null {
    try {
      return localStorage.getItem(this.keyFor(slot));
    } catch {
      return null;
    }
  }

  private backupCorrupt(slot: SaveSlot, raw: string): void {
    try {
      localStorage.setItem(`${this.keyFor(slot)}_corrupt`, raw);
    } catch {
      // Backup is best effort only.
    }
  }

  hasSlot(slot: SaveSlot): boolean {
    try {
      return !!localStorage.getItem(this.keyFor(slot));
    } catch {
      return false;
    }
  }

  slotInfo(slot: SaveSlot): SlotInfo | null {
    try {
      const raw = localStorage.getItem(this.keyFor(slot));
      if (!raw) {
        return null;
      }
      const parsed: unknown = JSON.parse(raw);
      if (!isLegacySave(parsed)) {
        return null;
      }
      const player = parsed.state?.player;
      return {
        slot,
        savedAt: parsed.savedAt ?? '',
        level: player?.level ?? 1,
        completedPaths: player?.completedPaths ?? 0,
        characterClass: player?.characterClass,
      };
    } catch {
      return null;
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Runtime shape check so a parseable but broken save never reaches restore(). */
export function isLegacySave(value: unknown): value is LegacySaveGame {
  if (!isRecord(value)) {
    return false;
  }

  const { state, path } = value;

  if (state !== undefined && !isRecord(state)) {
    return false;
  }

  if (isRecord(state) && state['player'] !== undefined && !isRecord(state['player'])) {
    return false;
  }

  if (path !== undefined && !isRecord(path)) {
    return false;
  }

  if (isRecord(path) && path['segments'] !== undefined && !Array.isArray(path['segments'])) {
    return false;
  }

  return true;
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
