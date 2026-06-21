import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Combat } from '../combat/combat.service';
import { GameState } from '../game-state/game-state.service';
import { blessingDescription, blessingLabel } from '../game-state/run-blessings';
import { Path } from '../path/path.service';
import { StorageService } from '../persistence/storage.service';
import { Inventory } from './inventory.service';

@Component({
  selector: 'app-inventory-panel',
  imports: [MatButtonModule],
  templateUrl: './inventory-panel.html',
  styleUrl: './inventory-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryPanel {
  protected readonly combat = inject(Combat);
  protected readonly gameState = inject(GameState);
  protected readonly inventory = inject(Inventory);
  protected readonly storage = inject(StorageService);
  private readonly path = inject(Path);

  protected blessingLabel = blessingLabel;
  protected blessingDescription = blessingDescription;

  protected resetRun(): void {
    this.gameState.reset();
    this.path.reset();
  }
}
