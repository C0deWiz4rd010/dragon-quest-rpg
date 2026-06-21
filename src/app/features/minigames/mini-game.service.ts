import { Injectable, signal } from '@angular/core';

export type MiniGameType = 'reaction' | 'memory' | 'precision' | 'typing';

export interface MiniGameResult {
  won: boolean;
  score: number; // 0–100
}

export interface ActiveMiniGame {
  type: MiniGameType;
  onComplete: (result: MiniGameResult) => void;
}

@Injectable({ providedIn: 'root' })
export class MiniGameService {
  readonly activeGame = signal<ActiveMiniGame | null>(null);

  launch(type: MiniGameType, onComplete: (result: MiniGameResult) => void): void {
    this.activeGame.set({ type, onComplete });
  }

  complete(result: MiniGameResult): void {
    const game = this.activeGame();
    this.activeGame.set(null);
    if (game) {
      game.onComplete(result);
    }
  }
}
