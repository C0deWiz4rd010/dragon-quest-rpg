import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { AchievementService } from '../../game-state/achievement.service';
import { Inventory } from '../../inventory/inventory.service';
import { StorageService } from '../../persistence/storage.service';

/** Transient notifications for loot drops and unlocked achievements. */
@Component({
  selector: 'app-toast-layer',
  templateUrl: './toast-layer.html',
  styleUrl: './toast-layer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastLayer {
  protected readonly inventory = inject(Inventory);
  protected readonly achievements = inject(AchievementService);
  protected readonly storage = inject(StorageService);
}
