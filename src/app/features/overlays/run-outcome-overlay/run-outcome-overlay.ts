import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';

import { GameState } from '../../game-state/game-state.service';
import { Path } from '../../path/path.service';

/** Victory / defeat summary shown when a run ends. */
@Component({
  selector: 'app-run-outcome-overlay',
  templateUrl: './run-outcome-overlay.html',
  styleUrl: './run-outcome-overlay.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RunOutcomeOverlay {
  protected readonly gameState = inject(GameState);
  protected readonly path = inject(Path);
  protected readonly player = computed(() => this.gameState.player());

  readonly restart = output<void>();
  readonly newGamePlus = output<void>();
}
