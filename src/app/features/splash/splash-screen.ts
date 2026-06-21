import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
  signal,
} from '@angular/core';
import { StorageService } from '../persistence/storage.service';

@Component({
  selector: 'app-splash-screen',
  standalone: true,
  templateUrl: './splash-screen.html',
  styleUrl: './splash-screen.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SplashScreen {
  readonly start = output<'new' | 'load'>();

  private readonly storage = inject(StorageService);

  protected readonly hasSave = signal(this.detectSave());

  protected startNew(): void {
    this.start.emit('new');
  }

  protected loadGame(): void {
    this.start.emit('load');
  }

  private detectSave(): boolean {
    try {
      return !!localStorage.getItem('dragonQuestRpgSave');
    } catch {
      return false;
    }
  }
}
