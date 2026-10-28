import { DialogFocus } from '../../../features/a11y/dialog-focus';
import { ChangeDetectionStrategy, Component, HostListener, inject, output } from '@angular/core';

import { SettingsService } from '../../game-state/settings.service';
import { TutorialService } from '../../game-state/tutorial.service';

/** Accessibility and effect toggles; closes on Escape. */
@Component({
  imports: [DialogFocus],
  selector: 'app-settings-panel',
  templateUrl: './settings-panel.html',
  styleUrl: './settings-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPanel {
  protected readonly settings = inject(SettingsService);
  protected readonly tutorial = inject(TutorialService);
  readonly closed = output<void>();

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.closed.emit();
  }
}
