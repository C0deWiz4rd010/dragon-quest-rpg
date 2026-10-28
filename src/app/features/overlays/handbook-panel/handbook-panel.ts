import { ChangeDetectionStrategy, Component, HostListener, computed, inject, output } from '@angular/core';

import { AchievementService } from '../../game-state/achievement.service';
import { activeMetaPerks } from '../../game-state/meta-progression';

/** In-game manual, achievement gallery and the list of active meta perks. */
@Component({
  selector: 'app-handbook-panel',
  templateUrl: './handbook-panel.html',
  styleUrl: './handbook-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HandbookPanel {
  protected readonly achievements = inject(AchievementService);
  protected readonly metaPerks = computed(() => activeMetaPerks(this.achievements.unlocked()));
  readonly closed = output<void>();

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.closed.emit();
  }
}
