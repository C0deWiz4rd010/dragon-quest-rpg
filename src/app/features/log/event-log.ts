import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { GameState } from '../game-state/game-state.service';

type LogFilter = 'all' | 'combat' | 'progress';

@Component({
  selector: 'app-event-log',
  imports: [],
  templateUrl: './event-log.html',
  styleUrl: './event-log.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventLog {
  protected readonly gameState = inject(GameState);
  protected readonly filter = signal<LogFilter>('all');
  protected readonly filteredLogs = computed(() => {
    const filter = this.filter();
    const logs = this.gameState.logs();
    if (filter === 'all') {
      return logs;
    }
    if (filter === 'combat') {
      return logs.filter((entry) => entry.type === 'damage' || entry.type === 'critical');
    }
    return logs.filter((entry) => entry.type === 'event' || entry.type === 'achievement' || entry.type === 'heal');
  });
  protected readonly latestLogId = computed(() => this.gameState.logs().at(-1)?.id ?? null);

  @ViewChild('entriesEl') private entriesEl?: ElementRef<HTMLElement>;

  protected setFilter(filter: LogFilter): void {
    this.filter.set(filter);
  }

  constructor() {
    effect(() => {
      this.filteredLogs(); // subscribe to changes
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
