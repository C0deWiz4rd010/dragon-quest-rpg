import { ErrorHandler, inject, Injectable } from '@angular/core';

import { GameState } from './features/game-state/game-state.service';

/** Surfaces unexpected runtime errors in the event log instead of failing silently. */
@Injectable()
export class AppErrorHandler implements ErrorHandler {
  private readonly gameState = inject(GameState);
  private lastMessage = '';

  handleError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);

    console.error(error);

    if (message === this.lastMessage) {
      return;
    }

    this.lastMessage = message;
    this.gameState.addLog('Unerwarteter Fehler – der Spielstand bleibt erhalten.', 'damage');
  }
}
