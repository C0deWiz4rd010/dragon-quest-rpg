import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  afterNextRender,
  effect,
  inject,
} from '@angular/core';
import { Application, Graphics } from 'pixi.js';
import { Path, type PathWeather } from '../../path/path.service';
import { isHeadlessCanvas } from '../headless-canvas';

interface Ember {
  g: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  wobble: number;
}

/** Fullscreen PixiJS Hintergrund-Canvas mit Ember- und Wetterpartikeln. */
@Component({
  selector: 'app-pixi-background',
  standalone: true,
  imports: [],
  template: '<canvas #canvas></canvas>',
  styles: [
    `
      :host {
        display: block;
        inset: 0;
        pointer-events: none;
        position: fixed;
        z-index: 0;
      }
      canvas {
        display: block;
        height: 100%;
        width: 100%;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PixiBackground {
  @ViewChild('canvas') private canvasRef!: ElementRef<HTMLCanvasElement>;

  private readonly path = inject(Path);
  private readonly destroyRef = inject(DestroyRef);

  private app: Application | null = null;
  private embers: Ember[] = [];

  constructor() {
    // Wetter ändert sich → Ember-Farben und Intensität wechseln
    effect(() => {
      this.path.weather(); // signal dependency
      this.updateEmberColors();
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
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundAlpha: 0,
      antialias: false,
      resolution: 1,
    });

    this.destroyRef.onDestroy(() => {
      this.app?.destroy(false, { children: true });
      this.app = null;
    });

    // Initiale Embers verteilt über die gesamte Höhe
    for (let i = 0; i < 70; i++) {
      this.spawnEmber(true);
    }

    this.app.ticker.add(() => this.onTick());
  }

  private emberConfig(weather: PathWeather): { color: number; alpha: number; size: number; vy: number } {
    switch (weather) {
      case 'glow':   return { color: 0xffd966, alpha: 0.6, size: 2.5, vy: 0.9 };
      case 'ash':    return { color: 0xbbbbbb, alpha: 0.25, size: 1.5, vy: 0.55 };
      case 'storm':  return { color: 0x94a3b8, alpha: 0.15, size: 1.2, vy: 1.1 };
      case 'snow':   return { color: 0xe2eeff, alpha: 0.3, size: 1.8, vy: 0.45 };
      case 'rain':   return { color: 0x7ec8e3, alpha: 0.12, size: 1.2, vy: 0.5 };
      case 'fog':    return { color: 0xdde6f0, alpha: 0.08, size: 2.8, vy: 0.3 };
      default:       return { color: 0xff7722, alpha: 0.5, size: 2.0, vy: 0.75 };
    }
  }

  private spawnEmber(scatter = false): void {
    if (!this.app) return;

    const W = this.app.renderer.width;
    const H = this.app.renderer.height;
    const cfg = this.emberConfig(this.path.weather());

    const size = cfg.size * (0.6 + Math.random() * 0.8);
    const g = new Graphics();
    g.circle(0, 0, size).fill({ color: cfg.color, alpha: cfg.alpha });
    g.x = Math.random() * W;
    g.y = scatter ? Math.random() * H : H + 5;
    this.app.stage.addChild(g);

    const maxLife = 140 + Math.floor(Math.random() * 120);
    this.embers.push({
      g,
      vx: (Math.random() - 0.5) * 0.7,
      vy: -(cfg.vy + Math.random() * 0.6),
      life: scatter ? Math.floor(Math.random() * maxLife) : maxLife,
      maxLife,
      wobble: Math.random() * Math.PI * 2,
    });
  }

  private updateEmberColors(): void {
    // Bestehende Embers löschen und neu aufbauen (Farbwechsel bei Wetter)
    if (!this.app) return;
    for (const e of this.embers) {
      this.app.stage.removeChild(e.g);
      e.g.destroy();
    }
    this.embers = [];
    for (let i = 0; i < 70; i++) {
      this.spawnEmber(true);
    }
  }

  private onTick(): void {
    if (!this.app) return;

    const W = this.app.renderer.width;
    const H = this.app.renderer.height;

    for (let i = this.embers.length - 1; i >= 0; i--) {
      const e = this.embers[i];
      e.wobble += 0.032;
      e.g.x += e.vx + Math.sin(e.wobble) * 0.22;
      e.g.y += e.vy;
      e.life--;
      e.g.alpha = (e.life / e.maxLife) * this.emberConfig(this.path.weather()).alpha;

      if (e.life <= 0 || e.g.y < -10 || e.g.x < -10 || e.g.x > W + 10) {
        this.app.stage.removeChild(e.g);
        e.g.destroy();
        this.embers.splice(i, 1);
      }
    }

    // Anzahl aufrecht erhalten
    while (this.embers.length < 70) {
      this.spawnEmber(false);
    }
  }
}
