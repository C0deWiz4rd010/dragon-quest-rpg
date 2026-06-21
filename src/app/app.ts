import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { GamePage } from './pages/game/game-page';
import { SplashScreen } from './features/splash/splash-screen';
import { StorageService } from './features/persistence/storage.service';

@Component({
  selector: 'app-root',
  imports: [GamePage, SplashScreen],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly storage = inject(StorageService);

  protected readonly showSplash = signal(true);

  protected onSplashStart(action: 'new' | 'load'): void {
    if (action === 'load') {
      this.storage.load();
    }
    this.showSplash.set(false);
  }
}
