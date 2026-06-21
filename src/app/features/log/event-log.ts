import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, computed, effect, inject } from '@angular/core';
import { GameState } from '../game-state/game-state.service';

@Component({
  selector: 'app-event-log',
  imports: [],
  templateUrl: './event-log.html',
  styleUrl: './event-log.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventLog {
  protected readonly gameState = inject(GameState);
  protected readonly latestLogId = computed(() => this.gameState.logs().at(-1)?.id ?? null);

  @ViewChild('entriesEl') private entriesEl?: ElementRef<HTMLElement>;

  constructor() {
    effect(() => {
      this.gameState.logs(); // subscribe to changes
      setTimeout(() => {
        const el = this.entriesEl?.nativeElement;
        const latestEntry = el?.lastElementChild as HTMLElement | null;

        if (el && latestEntry) {
          if (typeof latestEntry.scrollIntoView === 'function') {
            latestEntry.scrollIntoView({ block: 'end' });
          }
          el.scrollTop = el.scrollHeight;
        }
      }, 0);
    });
  }

  protected formatTime(date: Date): string {
    return new Intl.DateTimeFormat('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  protected logIcon(type: string): string {
    switch (type) {
      case 'damage': return '⚔';
      case 'heal': return '✦';
      case 'event': return '◆';
      case 'achievement': return '★';
      case 'critical': return '⚡';
      default: return '·';
    }
  }

  protected logLabel(type: string): string {
    switch (type) {
      case 'damage': return 'Kampf';
      case 'heal': return 'Heilung';
      case 'event': return 'Ereignis';
      case 'achievement': return 'Erfolg';
      case 'critical': return 'Kritisch';
      default: return 'Info';
    }
  }
}
