import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { StorageService, SaveSlot, SlotInfo } from '../persistence/storage.service';
import { SplashBackground } from './splash-background/splash-background';
import { CHARACTER_CLASSES, CharacterClassId, getCharacterClass } from '../game-state/character-classes';

export interface SplashStartEvent {
  action: 'new' | 'load';
  characterClass?: CharacterClassId;
  slot?: SaveSlot;
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

  protected readonly classes = CHARACTER_CLASSES;
  protected readonly selectedClass = signal<CharacterClassId>('warrior');
  protected readonly slots = computed<SlotInfo[]>(() => {
    this.storage.slotRevision(); // refresh after imports and deletions
    return this.detectSlots();
  });
  protected readonly hasSave = computed(() => this.slots().length > 0);
  protected readonly pendingDelete = signal<SaveSlot | null>(null);
  protected readonly message = signal<string | null>(null);

  protected selectClass(id: CharacterClassId): void {
    this.selectedClass.set(id);
  }

  protected startNew(): void {
    this.start.emit({ action: 'new', characterClass: this.selectedClass() });
  }

  protected loadSlot(slot: SaveSlot): void {
    this.start.emit({ action: 'load', slot });
  }

  protected askDelete(slot: SaveSlot): void {
    this.pendingDelete.set(slot);
  }

  protected confirmDelete(slot: SaveSlot): void {
    this.storage.deleteSlot(slot);
    this.pendingDelete.set(null);
    this.message.set(`Slot ${slot} gelöscht.`);
  }

  /** Imports a save file into the first empty slot. */
  protected async importFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) {
      return;
    }

    const free = ([1, 2, 3] as SaveSlot[]).find((slot) => !this.storage.hasSlot(slot));

    if (!free) {
      this.message.set('Alle Slots sind belegt – lösche zuerst einen Spielstand.');
      return;
    }

    const result = this.storage.importText(free, await file.text());
    this.message.set(result.ok ? `Spielstand in Slot ${free} importiert.` : result.error);
  }

  protected classLabel(id: string | undefined): string {
    return getCharacterClass(id as CharacterClassId)?.name ?? 'Held';
  }

  protected formatSaved(iso: string): string {
    if (!iso) {
      return '';
    }
    try {
      return new Date(iso).toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }

  private detectSlots(): SlotInfo[] {
    const result: SlotInfo[] = [];
    for (const slot of [1, 2, 3] as SaveSlot[]) {
      const info = this.storage.slotInfo(slot);
      if (info) {
        result.push(info);
      }
    }
    return result;
  }
}
