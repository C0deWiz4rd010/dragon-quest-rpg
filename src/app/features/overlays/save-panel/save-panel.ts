import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';

import { DialogFocus } from '../../a11y/dialog-focus';
import { CharacterClassId, getCharacterClass } from '../../game-state/character-classes';
import { downloadTextFile, saveFilename } from '../../persistence/file-io';
import { SaveSlot, SlotInfo, StorageService } from '../../persistence/storage.service';

type PendingAction = { slot: SaveSlot; action: 'save' | 'delete' };

interface SlotView {
  slot: SaveSlot;
  info: SlotInfo | null;
  active: boolean;
}

/** Manage the three save slots: save, load, export, import and delete. */
@Component({
  selector: 'app-save-panel',
  imports: [DialogFocus],
  templateUrl: './save-panel.html',
  styleUrl: './save-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SavePanel {
  protected readonly storage = inject(StorageService);

  readonly closed = output<void>();

  protected readonly pending = signal<PendingAction | null>(null);
  protected readonly message = signal<string | null>(null);

  protected readonly slots = computed<SlotView[]>(() => {
    this.storage.slotRevision();
    const current = this.storage.currentSlot();

    return ([1, 2, 3] as SaveSlot[]).map((slot) => ({
      slot,
      info: this.storage.slotInfo(slot),
      active: slot === current,
    }));
  });

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.closed.emit();
  }

  protected className(id: string | undefined): string {
    return getCharacterClass(id as CharacterClassId | undefined)?.name ?? 'Held';
  }

  protected formatSaved(iso: string): string {
    const date = new Date(iso);

    return Number.isNaN(date.getTime())
      ? ''
      : date.toLocaleString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
  }

  protected isPending(slot: SaveSlot, action: PendingAction['action']): boolean {
    const pending = this.pending();

    return pending?.slot === slot && pending.action === action;
  }

  /** Saving over a different, occupied slot needs a second click. */
  protected save(view: SlotView): void {
    if (view.info && !view.active && !this.isPending(view.slot, 'save')) {
      this.pending.set({ slot: view.slot, action: 'save' });
      return;
    }

    this.pending.set(null);
    this.message.set(
      this.storage.save(view.slot)
        ? `Gespeichert in Slot ${view.slot}.`
        : 'Speichern fehlgeschlagen – exportiere den Spielstand als Datei.',
    );
  }

  protected load(slot: SaveSlot): void {
    if (this.storage.load(slot)) {
      this.closed.emit();
    } else {
      this.message.set(`Slot ${slot} konnte nicht geladen werden.`);
    }
  }

  protected export(slot: SaveSlot): void {
    const text = this.storage.exportSlot(slot);

    if (!text) {
      this.message.set(`Slot ${slot} ist leer.`);
      return;
    }

    this.message.set(
      downloadTextFile(saveFilename(slot), text)
        ? `Slot ${slot} wurde als Datei exportiert.`
        : 'Der Download wurde vom Browser blockiert.',
    );
  }

  protected async importFile(slot: SaveSlot, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) {
      return;
    }

    const result = this.storage.importText(slot, await file.text());
    this.message.set(result.ok ? `Spielstand in Slot ${slot} importiert.` : result.error);
  }

  protected remove(slot: SaveSlot): void {
    if (!this.isPending(slot, 'delete')) {
      this.pending.set({ slot, action: 'delete' });
      return;
    }

    this.storage.deleteSlot(slot);
    this.pending.set(null);
    this.message.set(`Slot ${slot} gelöscht.`);
  }

  protected cancel(): void {
    this.pending.set(null);
  }
}
