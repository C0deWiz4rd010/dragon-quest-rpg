import { DialogFocus } from '../../features/a11y/dialog-focus';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RunEncounterService } from './run-encounter.service';

@Component({
  imports: [DialogFocus],
  selector: 'app-run-encounter-overlay',
  standalone: true,
  templateUrl: './run-encounter-overlay.html',
  styleUrl: './run-encounter-overlay.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RunEncounterOverlay {
  protected readonly encounters = inject(RunEncounterService);
  protected readonly activeEncounter = this.encounters.activeEncounter;
}
