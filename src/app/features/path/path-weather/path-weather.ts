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
import { isHeadlessCanvas } from '../../pixi/headless-canvas';

interface WeatherParticle {
  g: Graphics;
  vx: number;
  vy: number;
  rotation: number;
  baseAlpha: number;
  life: number;
  maxLife: number;
}

/** PixiJS-Canvas, der Wetter-Partikel über dem Pfadbrett animiert.
 *  Transparent, pointer-events: none → blockiert keine Klicks. */
@Component({
  selector: 'app-path-weather',
  standalone: true,
  imports: [],
  template: '<canvas #canvas></canvas>',
  styles: [
    `
      :host {
        pointer-events: none;
        position: absolute;
        inset: 0;
        z-index: 1;
      }
      canvas {
        display: block;
        width: 100%;
        height: 100%;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PathWeatherCanvas {
  @ViewChild('canvas') private canvasRef!: ElementRef<HTMLCanvasElement>;

  private readonly path = inject(Path);
  private readonly destroyRef = inject(DestroyRef);

  private app: Application | null = null;
  private particles: WeatherParticle[] = [];
  private activeWeather: PathWeather = 'clear';

  constructor() {
    effect(() => {
      const weather = this.path.weather();
      if (this.app && weather !== this.activeWeather) {
        this.activeWeather = weather;
        this.rebuildParticles(weather);
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
    const parent = canvas.parentElement!;
    const W = parent.clientWidth || 600;
    const H = parent.clientHeight || 400;

    this.app = new Application();
    await this.app.init({
      canvas,
      width: W,
      height: H,
      backgroundAlpha: 0,
      antialias: false,
      resolution: 1,
    });

    this.destroyRef.onDestroy(() => {
      this.app?.destroy(false, { children: true });
      this.app = null;
    });

    this.activeWeather = this.path.weather();
    this.rebuildParticles(this.activeWeather);
    this.app.ticker.add(() => this.onTick());
  }

  private rebuildParticles(weather: PathWeather): void {
    if (!this.app) return;
    for (const p of this.particles) {
      if (!p.g.destroyed) {
        this.app.stage.removeChild(p.g);
        p.g.destroy();
      }
    }
    this.particles = [];

    if (weather === 'clear') return;

    const W = this.app.renderer.width;
    const H = this.app.renderer.height;
    const count = this.targetCount(weather);
    for (let i = 0; i < count; i++) {
      this.spawnParticle(weather, W, H, true);
    }
  }

  private targetCount(weather: PathWeather): number {
    switch (weather) {
      case 'storm': return 200;
      case 'rain': return 130;
      case 'snow': return 90;
      case 'ash': return 70;
      case 'glow': return 55;
      case 'fog': return 25;
      default: return 0;
    }
  }

  private spawnParticle(weather: PathWeather, W: number, H: number, scatter = false): void {
    if (!this.app) return;
    const g = new Graphics();
    const x = Math.random() * W;
    const y = scatter ? Math.random() * H : -8;

    switch (weather) {
      case 'rain': {
        g.rect(0, 0, 1.2, 9).fill({ color: 0x7ec8e3, alpha: 0.45 });
        g.x = x; g.y = y;
        this.particles.push({ g, vx: -0.4, vy: 6, rotation: 0, baseAlpha: 0.45, life: scatter ? Math.random() * 80 : 80, maxLife: 80 });
        break;
      }
      case 'storm': {
        g.rect(0, 0, 1.5, 13).fill({ color: 0x93c5fd, alpha: 0.5 });
        g.x = x; g.y = y;
        this.particles.push({ g, vx: -2.2, vy: 9, rotation: 0, baseAlpha: 0.5, life: scatter ? Math.random() * 60 : 60, maxLife: 60 });
        break;
      }
      case 'snow': {
        const r = 1.5 + Math.random() * 2;
        g.circle(0, 0, r).fill({ color: 0xffffff, alpha: 0.65 });
        g.x = x; g.y = y;
        this.particles.push({ g, vx: (Math.random() - 0.5) * 0.5, vy: 0.7 + Math.random() * 0.6, rotation: 0, baseAlpha: 0.65, life: scatter ? Math.random() * 220 : 220, maxLife: 220 });
        break;
      }
      case 'ash': {
        const r = 1 + Math.random() * 1.8;
        g.circle(0, 0, r).fill({ color: 0xaaaaaa, alpha: 0.35 });
        g.x = x; g.y = scatter ? Math.random() * H : -8;
        const rot = (Math.random() - 0.5) * 0.03;
        this.particles.push({ g, vx: (Math.random() - 0.5) * 0.4, vy: 0.4 + Math.random() * 0.35, rotation: rot, baseAlpha: 0.35, life: scatter ? Math.random() * 280 : 280, maxLife: 280 });
        break;
      }
      case 'fog': {
        const r = 24 + Math.random() * 36;
        g.circle(0, 0, r).fill({ color: 0xdde6f0, alpha: 0.05 });
        const fy = scatter ? Math.random() * H : H * 0.4 + (Math.random() - 0.5) * H * 0.5;
        g.x = scatter ? Math.random() * W : -r;
        g.y = fy;
        this.particles.push({ g, vx: 0.25 + Math.random() * 0.2, vy: 0, rotation: 0, baseAlpha: 0.05, life: scatter ? Math.random() * 600 : 600, maxLife: 600 });
        break;
      }
      case 'glow': {
        const r = 2 + Math.random() * 3.5;
        g.circle(0, 0, r).fill({ color: 0xffd966, alpha: 0.85 });
        g.x = x; g.y = scatter ? Math.random() * H : H + 6;
        this.particles.push({ g, vx: (Math.random() - 0.5) * 0.45, vy: -0.9 - Math.random() * 0.9, rotation: 0, baseAlpha: 0.85, life: scatter ? Math.random() * 160 : 160, maxLife: 160 });
        break;
      }
    }
    this.app.stage.addChild(g);
  }

  private onTick(): void {
    if (!this.app || this.activeWeather === 'clear') return;

    const W = this.app.renderer.width;
    const H = this.app.renderer.height;

    for (const p of this.particles) {
      p.g.x += p.vx;
      p.g.y += p.vy;
      if (p.rotation) p.g.rotation += p.rotation;
      p.life--;

      if (this.activeWeather === 'glow') {
        p.g.alpha = p.baseAlpha * (p.life / p.maxLife);
      }

      // Partikel zurücksetzen wenn außerhalb oder Lebensdauer abgelaufen
      if (p.life <= 0 || p.g.y > H + 12 || p.g.y < -40 || p.g.x < -40 || p.g.x > W + 40) {
        switch (this.activeWeather) {
          case 'glow':
            p.g.x = Math.random() * W;
            p.g.y = H + 6;
            break;
          case 'fog':
            p.g.x = -40;
            p.g.y = H * 0.4 + (Math.random() - 0.5) * H * 0.5;
            break;
          default:
            p.g.x = Math.random() * W;
            p.g.y = -8;
        }
        p.life = p.maxLife;
        p.g.alpha = p.baseAlpha;
      }
    }

    // Partikelanzahl auffüllen
    const target = this.targetCount(this.activeWeather);
    while (this.particles.length < target) {
      this.spawnParticle(this.activeWeather, W, H, false);
    }
  }
}
