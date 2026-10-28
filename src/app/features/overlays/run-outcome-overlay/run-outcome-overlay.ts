import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';

import { GameState } from '../../game-state/game-state.service';
import { AchievementService } from '../../game-state/achievement.service';
import { CharacterClassId, getCharacterClass } from '../../game-state/character-classes';
import { activeMetaPerks } from '../../game-state/meta-progression';
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
  private readonly achievements = inject(AchievementService);
  protected readonly player = computed(() => this.gameState.player());
  protected readonly className = computed(() => {
    const cls = getCharacterClass(this.player().characterClass as CharacterClassId | undefined);

    return cls ? `${cls.icon} ${cls.name}` : '';
  });
  protected readonly perkCount = computed(
    () => activeMetaPerks(this.achievements.unlocked()).length,
  );

  readonly restart = output<void>();
  readonly newGamePlus = output<void>();
}
