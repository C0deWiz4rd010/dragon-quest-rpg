import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { GamePage } from './pages/game/game-page';
import { SplashScreen, SplashStartEvent } from './features/splash/splash-screen';
import { StorageService } from './features/persistence/storage.service';
import { GameState } from './features/game-state/game-state.service';

@Component({
  selector: 'app-root',
  imports: [GamePage, SplashScreen],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly storage = inject(StorageService);
  private readonly gameState = inject(GameState);

  protected readonly showSplash = signal(true);

  protected onSplashStart(event: SplashStartEvent): void {
    if (event.action === 'load') {
      this.storage.load();
    } else {
      this.gameState.reset(event.characterClass);
    }
    this.showSplash.set(false);
  }
}