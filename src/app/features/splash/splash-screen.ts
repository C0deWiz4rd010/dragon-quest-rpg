import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
  signal,
} from '@angular/core';
import { StorageService } from '../persistence/storage.service';
import { SplashBackground } from './splash-background/splash-background';
import { CHARACTER_CLASSES, CharacterClassId } from '../game-state/character-classes';

export interface SplashStartEvent {
  action: 'new' | 'load';
  characterClass?: CharacterClassId;
}

@Component({
  selector: 'app-splash-screen',
  standalone: true,
  imports: [SplashBackground],
  templateUrl: './splash-screen.html',
  styleUrl: './splash-screen.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SplashScreen {
  readonly start = output<SplashStartEvent>();

  private readonly storage = inject(StorageService);

  protected readonly hasSave = signal(this.detectSave());
  protected readonly classes = CHARACTER_CLASSES;
  protected readonly selectedClass = signal<CharacterClassId>('warrior');

  protected selectClass(id: CharacterClassId): void {
    this.selectedClass.set(id);
  }

  protected startNew(): void {
    this.start.emit({ action: 'new', characterClass: this.selectedClass() });
  }

  protected loadGame(): void {
    this.start.emit({ action: 'load' });
  }

  private detectSave(): boolean {
    try {
      return !!localStorage.getItem('dragonQuestRpgSave');
    } catch {
      return false;
    }
  }
}
