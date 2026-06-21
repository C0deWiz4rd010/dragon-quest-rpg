import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { MiniGameService, MiniGameType } from './mini-game.service';
import { PrecisionCanvas } from './precision-canvas/precision-canvas';
import { ReactionCanvas } from './reaction-canvas/reaction-canvas';

export const MEMORY_COLORS = [
  { id: 'red', color: '#ff5252', label: '🔴' },
  { id: 'blue', color: '#3a6ea5', label: '🔵' },
  { id: 'green', color: '#7ec850', label: '🟢' },
  { id: 'yellow', color: '#ffd966', label: '🟡' },
] as const;

export type MemoryColorId = (typeof MEMORY_COLORS)[number]['id'];

const TYPING_SENTENCES = [
  'Der Drachenkönig erwartet seine Herausforderer',
  'Mit Mut und Stärke trotze ich jedem Feind',
  'Gold und Ruhm winken dem tapferen Helden',
  'Das Schwert blitzt im Licht der Feuerflammen',
  'Kein Monster kann mein Abenteuer stoppen',
];

type ReactionPhase = 'waiting' | 'ready' | 'tooEarly' | 'done';
type MemoryPhase = 'showing' | 'input' | 'result';

@Component({
  selector: 'app-mini-game-overlay',
  standalone: true,
  imports: [PrecisionCanvas, ReactionCanvas],
  templateUrl: './mini-game-overlay.html',
  styleUrl: './mini-game-overlay.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MiniGameOverlay implements OnDestroy {
  protected readonly svc = inject(MiniGameService);
  protected readonly activeGame = this.svc.activeGame;

  // ---- Reaction ----
  protected readonly reactionPhase = signal<ReactionPhase>('waiting');
  protected readonly reactionMs = signal(0);
  private reactionStart = 0;
  private reactionTimer: ReturnType<typeof setTimeout> | null = null;

  // ---- Memory ----
  protected readonly memoryColors = MEMORY_COLORS;
  protected readonly memorySequence = signal<MemoryColorId[]>([]);
  protected readonly memoryShowIdx = signal(-1);
  protected readonly memoryPlayerInput = signal<MemoryColorId[]>([]);
  protected readonly memoryPhase = signal<MemoryPhase>('showing');
  protected readonly memoryWon = signal<boolean | null>(null);
  private memoryTimer: ReturnType<typeof setInterval> | null = null;

  // ---- Precision ----
  protected readonly precisionDot = signal({ x: 30, y: 30 });
  protected readonly precisionTimeLeft = signal(3);
  protected readonly precisionDone = signal(false);
  protected readonly precisionWon = signal(false);
  private precisionMoveTimer: ReturnType<typeof setInterval> | null = null;
  private precisionCountTimer: ReturnType<typeof setInterval> | null = null;

  // ---- Typing ----
  protected readonly typingTarget = signal('');
  protected readonly typingInput = signal('');
  protected readonly typingTimeLeft = signal(10);
  protected readonly typingDone = signal(false);
  protected readonly typingWon = signal(false);
  private typingTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      const game = this.svc.activeGame();
      if (!game) return;
      untracked(() => this.startGame(game.type));
    });
  }

  private startGame(type: MiniGameType): void {
    this.clearAll();
    switch (type) {
      case 'reaction':
        this.startReaction();
        break;
      case 'memory':
        this.startMemory();
        break;
      case 'precision':
        this.startPrecision();
        break;
      case 'typing':
        this.startTyping();
        break;
    }
  }

  // ================================ REACTION ================================
  private startReaction(): void {
    this.reactionPhase.set('waiting');
    this.reactionMs.set(0);
    const delay = 1500 + Math.random() * 2000;
    this.reactionTimer = setTimeout(() => {
      this.reactionPhase.set('ready');
      this.reactionStart = Date.now();
    }, delay);
  }

  protected onReactionClick(): void {
    const phase = this.reactionPhase();
    if (phase === 'done' || phase === 'tooEarly') return;

    if (phase === 'waiting') {
      if (this.reactionTimer) {
        clearTimeout(this.reactionTimer);
        this.reactionTimer = null;
      }
      this.reactionPhase.set('tooEarly');
      return;
    }

    if (phase === 'ready') {
      const ms = Date.now() - this.reactionStart;
      this.reactionMs.set(ms);
      this.reactionPhase.set('done');
    }
  }

  protected reactionLabel(): string {
    const ms = this.reactionMs();
    if (ms < 250) return 'Unglaublich! 🔥';
    if (ms < 400) return 'Blitzschnell! ⚡';
    if (ms < 600) return 'Gut! 👍';
    if (ms < 800) return 'Knapp bestanden!';
    return 'Zu langsam 😅';
  }

  protected submitReaction(): void {
    const phase = this.reactionPhase();
    if (phase === 'tooEarly') {
      this.svc.complete({ won: false, score: 0 });
      return;
    }
    const ms = this.reactionMs();
    const won = ms < 700;
    const score = won ? Math.max(0, Math.round((700 - ms) / 7)) : 0;
    this.svc.complete({ won, score });
  }

  protected retryReaction(): void {
    this.startReaction();
  }

  // ================================ MEMORY ================================
  private startMemory(): void {
    const sequence = Array.from(
      { length: 4 },
      () => MEMORY_COLORS[Math.floor(Math.random() * MEMORY_COLORS.length)].id,
    );
    this.memorySequence.set(sequence);
    this.memoryShowIdx.set(0);
    this.memoryPlayerInput.set([]);
    this.memoryPhase.set('showing');
    this.memoryWon.set(null);

    let idx = 0;
    this.memoryTimer = setInterval(() => {
      idx++;
      if (idx >= sequence.length) {
        clearInterval(this.memoryTimer!);
        this.memoryTimer = null;
        this.memoryShowIdx.set(-1);
        this.memoryPhase.set('input');
      } else {
        this.memoryShowIdx.set(idx);
      }
    }, 900);
  }

  protected onMemoryColorClick(colorId: MemoryColorId): void {
    if (this.memoryPhase() !== 'input') return;
    const input: MemoryColorId[] = [...this.memoryPlayerInput(), colorId];
    this.memoryPlayerInput.set(input);

    const seq = this.memorySequence();
    if (input[input.length - 1] !== seq[input.length - 1]) {
      this.memoryPhase.set('result');
      this.memoryWon.set(false);
      return;
    }
    if (input.length === seq.length) {
      this.memoryPhase.set('result');
      this.memoryWon.set(true);
    }
  }

  protected submitMemory(): void {
    const won = this.memoryWon() === true;
    this.svc.complete({ won, score: won ? 80 : 20 });
  }

  // ================================ PRECISION ================================
  private startPrecision(): void {
    this.precisionDone.set(false);
    this.precisionWon.set(false);
    this.precisionTimeLeft.set(3);
    this.moveDot();

    this.precisionMoveTimer = setInterval(() => this.moveDot(), 600);

    this.precisionCountTimer = setInterval(() => {
      const t = this.precisionTimeLeft() - 1;
      this.precisionTimeLeft.set(t);
      if (t <= 0) {
        this.clearPrecisionTimers();
        if (!this.precisionDone()) {
          this.precisionDone.set(true);
          this.precisionWon.set(false);
        }
      }
    }, 1000);
  }

  private moveDot(): void {
    this.precisionDot.set({
      x: 5 + Math.random() * 74,
      y: 5 + Math.random() * 68,
    });
  }

  private clearPrecisionTimers(): void {
    if (this.precisionMoveTimer) {
      clearInterval(this.precisionMoveTimer);
      this.precisionMoveTimer = null;
    }
    if (this.precisionCountTimer) {
      clearInterval(this.precisionCountTimer);
      this.precisionCountTimer = null;
    }
  }

  protected onDotClick(event: MouseEvent): void {
    event.stopPropagation();
    if (this.precisionDone()) return;
    this.clearPrecisionTimers();
    this.precisionDone.set(true);
    this.precisionWon.set(true);
  }

  /** Aufgerufen vom PrecisionCanvas wenn der Punkt getroffen wird. */
  protected onDotClickFromCanvas(): void {
    if (this.precisionDone()) return;
    this.clearPrecisionTimers();
    this.precisionDone.set(true);
    this.precisionWon.set(true);
  }

  protected submitPrecision(): void {
    this.svc.complete({ won: this.precisionWon(), score: this.precisionWon() ? 75 : 0 });
  }

  // ================================ TYPING ================================
  private startTyping(): void {
    this.typingTarget.set(TYPING_SENTENCES[Math.floor(Math.random() * TYPING_SENTENCES.length)]);
    this.typingInput.set('');
    this.typingTimeLeft.set(10);
    this.typingDone.set(false);
    this.typingWon.set(false);

    this.typingTimer = setInterval(() => {
      const t = this.typingTimeLeft() - 1;
      this.typingTimeLeft.set(t);
      if (t <= 0) {
        clearInterval(this.typingTimer!);
        this.typingTimer = null;
        if (!this.typingDone()) {
          this.typingDone.set(true);
          this.typingWon.set(false);
        }
      }
    }, 1000);
  }

  protected onTypingInput(event: Event): void {
    if (this.typingDone()) return;
    const value = (event.target as HTMLInputElement).value;
    this.typingInput.set(value);
    if (value === this.typingTarget()) {
      if (this.typingTimer) {
        clearInterval(this.typingTimer);
        this.typingTimer = null;
      }
      this.typingDone.set(true);
      this.typingWon.set(true);
    }
  }

  protected submitTyping(): void {
    this.svc.complete({ won: this.typingWon(), score: this.typingWon() ? 90 : 0 });
  }

  // ================================ SHARED ================================
  protected skipGame(): void {
    this.svc.complete({ won: false, score: 0 });
  }

  private clearAll(): void {
    if (this.reactionTimer) {
      clearTimeout(this.reactionTimer);
      this.reactionTimer = null;
    }
    if (this.memoryTimer) {
      clearInterval(this.memoryTimer);
      this.memoryTimer = null;
    }
    this.clearPrecisionTimers();
    if (this.typingTimer) {
      clearInterval(this.typingTimer);
      this.typingTimer = null;
    }
  }

  ngOnDestroy(): void {
    this.clearAll();
  }
}
