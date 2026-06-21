import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  afterNextRender,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { Application, Graphics, Text, TextStyle } from 'pixi.js';
import { isHeadlessCanvas } from '../../pixi/headless-canvas';

type ReactionPhase = 'waiting' | 'ready' | 'tooEarly' | 'done';

const PHASE_COLOR: Record<ReactionPhase, number> = {
  waiting: 0xb91c1c,
  ready: 0x16a34a,
  tooEarly: 0xb45309,
  done: 0x1d4ed8,
};

const PHASE_LABEL: Record<ReactionPhase, string> = {
  waiting: 'Warte...',
  ready: 'JETZT!',
  tooEarly: 'Zu früh!',
  done: '✓',
};

/** PixiJS-Canvas für das Reaktions-Minigame:
 *  zeigt einen pulsierenden Kreis, der Farbe je Phase ändert.
 *  Klick → clicked output. */
@Component({
  selector: 'app-reaction-canvas',
  standalone: true,
  imports: [],
  template: '<canvas #canvas (click)="clicked.emit()"></canvas>',
  styles: [
    `
      :host {
        display: block;
        cursor: pointer;
        margin: 0 auto;
        width: 160px;
      }
      canvas {
        border-radius: 50%;
        display: block;
        height: 160px;
        width: 160px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReactionCanvas {
  readonly phase = input.required<ReactionPhase>();
  readonly clicked = output<void>();

  @ViewChild('canvas') private canvasRef!: ElementRef<HTMLCanvasElement>;
  private readonly destroyRef = inject(DestroyRef);

  private app: Application | null = null;
  private ring: Graphics | null = null;
  private label: Text | null = null;
  private ticker = 0;
  private readonly SIZE = 160;

  constructor() {
    effect(() => {
      const p = this.phase();
      if (this.ring && this.label) {
        this.updateVisuals(p);
      }
    });

    afterNextRender(async () => {
      await this.initPixi();
    });
  }

  private async initPixi(): Promise<void> {
    if (isHeadlessCanvas()) {
      return;
    }

    const canvas = this.canvasRef.nativeElement;

    this.app = new Application();
    await this.app.init({
      canvas,
      width: this.SIZE,
      height: this.SIZE,
      background: 0x080c18,
      antialias: true,
      resolution: window.devicePixelRatio ?? 1,
      autoDensity: true,
    });

    this.destroyRef.onDestroy(() => {
      this.app?.destroy(false, { children: true });
      this.app = null;
    });

    const cx = this.SIZE / 2;
    const cy = this.SIZE / 2;

    // Outer glow ring
    this.ring = new Graphics();
    this.app.stage.addChild(this.ring);

    // Main circle (static fill drawn once, color via tint)
    const circle = new Graphics();
    circle.circle(cx, cy, 56).fill({ color: 0xffffff, alpha: 1 });
    this.app.stage.addChild(circle);

    // Label text
    this.label = new Text({
      text: PHASE_LABEL[this.phase()],
      style: new TextStyle({
        fontSize: 12,
        fontWeight: 'bold',
        fontFamily: '"Press Start 2P", monospace, sans-serif',
        fill: 0xffffff,
        align: 'center',
        wordWrap: true,
        wordWrapWidth: 100,
      }),
    });
    this.label.anchor.set(0.5);
    this.label.x = cx;
    this.label.y = cy;
    this.app.stage.addChild(this.label);

    // Apply initial phase
    circle.tint = PHASE_COLOR[this.phase()];
    this.updateVisuals(this.phase());

    // Store reference for tinting
    (circle as Graphics & { __main: true }).__main = true;

    this.app.ticker.add(() => this.onTick());
  }

  private updateVisuals(p: ReactionPhase): void {
    if (!this.app || !this.ring || !this.label) return;

    // Update label
    this.label.text = PHASE_LABEL[p];

    // Tint all circle graphics
    for (const child of this.app.stage.children) {
      if (child instanceof Graphics && (child as Graphics & { __main?: boolean }).__main) {
        child.tint = PHASE_COLOR[p];
      }
    }
  }

  private onTick(): void {
    if (!this.ring || !this.app) return;
    this.ticker++;

    const p = this.phase();
    const cx = this.SIZE / 2;
    const cy = this.SIZE / 2;
    const color = PHASE_COLOR[p];

    // Animated glow ring
    const glowAlpha = p === 'ready'
      ? 0.25 + Math.sin(this.ticker * 0.12) * 0.18
      : 0.1 + Math.sin(this.ticker * 0.06) * 0.06;
    const glowR = p === 'ready'
      ? 62 + Math.sin(this.ticker * 0.1) * 6
      : 62;

    this.ring.clear();
    this.ring.circle(cx, cy, glowR).fill({ color, alpha: glowAlpha });
    this.ring.circle(cx, cy, glowR + 8).fill({ color, alpha: glowAlpha * 0.4 });
  }
}
