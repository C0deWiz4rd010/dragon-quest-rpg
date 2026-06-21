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
import { Application, Graphics } from 'pixi.js';
import { isHeadlessCanvas } from '../../pixi/headless-canvas';

/** PixiJS-Canvas für das Präzisions-Minigame:
 *  zeigt einen pulsierenden roten Kreis, der sich bewegt.
 *  Klick auf den Kreis → dotClicked output. */
@Component({
  selector: 'app-precision-canvas',
  standalone: true,
  imports: [],
  template: '<canvas #canvas (click)="onCanvasClick($event)"></canvas>',
  styles: [
    `
      :host {
        display: block;
        cursor: crosshair;
        width: 100%;
      }
      canvas {
        border-radius: 8px;
        display: block;
        height: 180px;
        width: 100%;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrecisionCanvas {
  readonly dotX = input.required<number>();
  readonly dotY = input.required<number>();
  readonly done = input<boolean>(false);
  readonly dotClicked = output<void>();

  @ViewChild('canvas') private canvasRef!: ElementRef<HTMLCanvasElement>;
  private readonly destroyRef = inject(DestroyRef);

  private app: Application | null = null;
  private dotGraphic: Graphics | null = null;
  private glowGraphic: Graphics | null = null;
  private ticker = 0;
  private W = 300;
  private readonly H = 180;
  /** Dot-Radius in Pixeln – für Klick-Erkennung */
  private readonly DOT_R = 18;

  constructor() {
    // Dot-Position aktualisieren
    effect(() => {
      const x = this.dotX();
      const y = this.dotY();
      if (this.dotGraphic && this.glowGraphic && !this.done()) {
        const px = this.W * (x / 100);
        const py = this.H * (y / 100);
        this.dotGraphic.x = px;
        this.dotGraphic.y = py;
        this.glowGraphic.x = px;
        this.glowGraphic.y = py;
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
    this.W = canvas.clientWidth || 300;

    this.app = new Application();
    await this.app.init({
      canvas,
      width: this.W,
      height: this.H,
      background: 0x060a14,
      antialias: true,
      resolution: window.devicePixelRatio ?? 1,
      autoDensity: true,
    });

    this.destroyRef.onDestroy(() => {
      this.app?.destroy(false, { children: true });
      this.app = null;
    });

    // Glow-Ring
    this.glowGraphic = new Graphics();
    // Dot
    this.dotGraphic = new Graphics();
    this.dotGraphic.circle(0, 0, this.DOT_R).fill({ color: 0xff2244, alpha: 1 });
    this.dotGraphic.circle(0, 0, this.DOT_R + 4).stroke({ color: 0xff5577, alpha: 0.5, width: 2 });

    this.app.stage.addChild(this.glowGraphic, this.dotGraphic);

    // Initial position
    const px = this.W * (this.dotX() / 100);
    const py = this.H * (this.dotY() / 100);
    this.dotGraphic.x = px;
    this.dotGraphic.y = py;
    this.glowGraphic.x = px;
    this.glowGraphic.y = py;

    this.app.ticker.add(() => this.onTick());
  }

  private onTick(): void {
    if (!this.dotGraphic || !this.glowGraphic || this.done()) return;
    this.ticker++;

    // Pulsing scale
    const pulse = 0.85 + Math.sin(this.ticker * 0.08) * 0.15;
    this.dotGraphic.scale.set(pulse);

    // Outer glow ring
    this.glowGraphic.clear();
    const glowAlpha = 0.15 + Math.sin(this.ticker * 0.06) * 0.1;
    this.glowGraphic.circle(0, 0, this.DOT_R * 2.2).fill({ color: 0xff2244, alpha: glowAlpha });
  }

  protected onCanvasClick(event: MouseEvent): void {
    if (!this.app || this.done()) return;
    const rect = (event.target as HTMLCanvasElement).getBoundingClientRect();
    const clickX = (event.clientX - rect.left) * (this.W / rect.width);
    const clickY = (event.clientY - rect.top) * (this.H / rect.height);

    if (!this.dotGraphic) return;
    const dx = clickX - this.dotGraphic.x;
    const dy = clickY - this.dotGraphic.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= this.DOT_R * 1.5) {
      this.dotClicked.emit();
    }
  }
}
