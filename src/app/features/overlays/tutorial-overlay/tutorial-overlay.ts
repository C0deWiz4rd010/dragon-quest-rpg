import { DialogFocus } from '../../../features/a11y/dialog-focus';
import { ChangeDetectionStrategy, Component, HostListener, inject } from '@angular/core';

import { TutorialService } from '../../game-state/tutorial.service';

/** Step-by-step onboarding dialog. */
@Component({
  imports: [DialogFocus],
  selector: 'app-tutorial-overlay',
  templateUrl: './tutorial-overlay.html',
  styleUrl: './tutorial-overlay.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TutorialOverlay {
  protected readonly tutorial = inject(TutorialService);

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.tutorial.active()) {
      this.tutorial.finish();
    }
  }
}
