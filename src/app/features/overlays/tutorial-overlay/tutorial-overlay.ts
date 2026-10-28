import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { TutorialService } from '../../game-state/tutorial.service';

/** Step-by-step onboarding dialog. */
@Component({
  selector: 'app-tutorial-overlay',
  templateUrl: './tutorial-overlay.html',
  styleUrl: './tutorial-overlay.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TutorialOverlay {
  protected readonly tutorial = inject(TutorialService);
}
