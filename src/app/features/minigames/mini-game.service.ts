import { Injectable, signal } from '@angular/core';

export type MiniGameType = 'reaction' | 'memory' | 'precision' | 'typing' | 'sums';

export interface MiniGameResult {
  won: boolean;
  score: number; // 0–100
}

export interface ActiveMiniGame {
  type: MiniGameType;
  /** Route depth; deeper routes make the game harder. */
  depth: number;
  onComplete: (result: MiniGameResult) => void;
}

@Injectable({ providedIn: 'root' })
export class MiniGameService {
  readonly activeGame = signal<ActiveMiniGame | null>(null);

  launch(type: MiniGameType, onComplete: (result: MiniGameResult) => void, depth = 0): void {
    this.activeGame.set({ type, depth, onComplete });
  }

  complete(result: MiniGameResult): void {
    const game = this.activeGame();
    this.activeGame.set(null);
    if (game) {
      game.onComplete(result);
    }
  }
}
