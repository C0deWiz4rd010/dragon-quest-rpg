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
import {
  AnimatedSprite,
  Application,
  Graphics,
  Rectangle,
  Text,
  TextStyle,
  Texture,
} from 'pixi.js';
import { assets } from '../../assets/asset-catalog';
import type { UnitSprite } from '../../assets/asset-catalog';
import { Combat, type CombatAnimation, type FloatingCombatText } from '../combat.service';
import { enemyPhasePressure } from '../combat-rules';
import { GameState } from '../../game-state/game-state.service';
import { PixiAssets } from '../../pixi/pixi.service';
import { isHeadlessCanvas } from '../../pixi/headless-canvas';
import { Path } from '../../path/path.service';

interface FloatingTextNode {
  node: Text;
  vy: number;
  life: number;
  maxLife: number;
}

interface ParticleNode {
  g: Graphics;
  vx: number;
  vy: number;
  life: number;
}

/** Canvas-Schlachtfeld – rendert beide Kämpfer als animierte PixiJS-Sprites
 *  mit HP/Mana/XP-Balken, Floating-Damage-Text und Partikel-Effekten. */
@Component({
  selector: 'app-combat-stage',
  standalone: true,
  imports: [],
  templateUrl: './combat-stage.html',
  styleUrl: './combat-stage.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CombatStage {
  @ViewChild('canvas') private canvasRef!: ElementRef<HTMLCanvasElement>;

  protected readonly gameState = inject(GameState);
  protected readonly path = inject(Path);
  private readonly combat = inject(Combat);
  private readonly pixiAssets = inject(PixiAssets);
  private readonly destroyRef = inject(DestroyRef);

  private app: Application | null = null;
  private heroSprite: AnimatedSprite | null = null;
  private enemySprite: AnimatedSprite | null = null;
  private heroHpBar!: Graphics;
  private heroManaBar!: Graphics;
  private heroXpBar!: Graphics;
  private enemyHpBar!: Graphics;
  private currentEnemySpriteUrl = '';
  private floatingTexts: FloatingTextNode[] = [];
  private particles: ParticleNode[] = [];
  private lastAnimId = -1;
  private lastFtId = -1;
  private W = 0;
  private readonly H = 180;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    // Balken aktualisieren wenn HP/Mana/XP sich ändern
    effect(() => {
      const hp = this.gameState.playerHpPercent();
      const mana = this.gameState.playerManaPercent();
      const xp = this.gameState.playerXpPercent();
      const enemyHp = this.gameState.enemyHpPercent();
      if (!this.app) return;
      this.drawAllBars(hp, mana, xp, enemyHp);
    });

    // Gegner-Sprite tauschen wenn sich der Feind ändert
    effect(() => {
      const enemy = this.gameState.enemy();
      const spriteData: UnitSprite = enemy?.sprite ?? assets.units.slime;
      if (this.app && spriteData.idle !== this.currentEnemySpriteUrl) {
        this.loadEnemySprite(spriteData);
      }
    });

    // Kampf-Animationen (Shake, Flash, Partikel)
    effect(() => {
      const anim = this.combat.animation();
      if (anim && anim.id !== this.lastAnimId && this.app) {
        this.lastAnimId = anim.id;
        this.triggerCombatAnimation(anim);
      }
    });

    // Floating Damage Text
    effect(() => {
      const ft = this.combat.floatingText();
      if (ft && ft.id !== this.lastFtId && this.app) {
        this.lastFtId = ft.id;
        this.spawnFloatingText(ft);
      }
    });

    afterNextRender(async () => {
      await this.initPixi();
    });
  }

  protected enemyPhaseTone(): 'calm' | 'heated' | 'enraged' {
    const enemy = this.gameState.enemy();

    if (!enemy) {
      return 'calm';
    }

    return enemyPhasePressure(enemy.role, this.gameState.enemyHpPercent()).tone;
  }

  protected enemyPhaseLabel(): string {
    const enemy = this.gameState.enemy();

    if (!enemy) {
      return 'Ruhig';
    }

    return enemyPhasePressure(enemy.role, this.gameState.enemyHpPercent()).label;
  }

  private async initPixi(): Promise<void> {
    if (isHeadlessCanvas()) {
      return;
    }

    const canvas = this.canvasRef.nativeElement;
    this.W = canvas.parentElement?.clientWidth ?? 280;

    this.app = new Application();
    await this.app.init({
      canvas,
      width: this.W,
      height: this.H,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio ?? 1,
      autoDensity: true,
    });

    this.destroyRef.onDestroy(() => {
      this.resizeObserver?.disconnect();
      this.app?.destroy(false, { children: true });
      this.app = null;
    });

    await this.loadHeroSprite();
    await this.loadEnemySprite(assets.units.slime);
    this.setupBars();
    this.app.ticker.add(() => this.onTick());

    // Resize canvas when container changes
    this.resizeObserver = new ResizeObserver(() => this.onContainerResize());
    this.resizeObserver.observe(canvas.parentElement!);
  }

  private onContainerResize(): void {
    if (!this.app) return;
    const canvas = this.canvasRef.nativeElement;
    const newW = canvas.parentElement?.clientWidth ?? this.W;
    if (Math.abs(newW - this.W) < 2) return;
    this.W = newW;
    this.app.renderer.resize(newW, this.H);
    this.repositionSprites();
    this.drawAllBars(
      this.gameState.playerHpPercent(),
      this.gameState.playerManaPercent(),
      this.gameState.playerXpPercent(),
      this.gameState.enemyHpPercent(),
    );
  }

  private repositionSprites(): void {
    if (this.heroSprite) {
      this.heroSprite.x = this.W * 0.26;
      this.heroSprite.y = this.H * 0.47;
    }
    if (this.enemySprite) {
      this.enemySprite.x = this.W * 0.74;
      this.enemySprite.y = this.H * 0.47;
    }
  }

  private async loadHeroSprite(): Promise<void> {
    if (!this.app) return;
    const frames = await this.pixiAssets.loadSpriteFrames(
      assets.units.hero.idle,
      assets.units.hero.frames,
    );
    if (this.heroSprite) {
      this.app.stage.removeChild(this.heroSprite);
      this.heroSprite.destroy();
    }
    const s = new AnimatedSprite(frames);
    s.animationSpeed = 0.12;
    s.play();
    s.anchor.set(0.5);
    s.scale.set(2.6);
    s.x = this.W * 0.26;
    s.y = this.H * 0.47;
    this.heroSprite = s;
    this.app.stage.addChildAt(s, 0);
  }

  private async loadEnemySprite(spriteData: UnitSprite): Promise<void> {
    if (!this.app) return;
    this.currentEnemySpriteUrl = spriteData.idle;
    const frames = await this.pixiAssets.loadSpriteFrames(spriteData.idle, spriteData.frames);
    if (this.enemySprite) {
      this.app.stage.removeChild(this.enemySprite);
      this.enemySprite.destroy();
    }
    const s = new AnimatedSprite(frames);
    s.animationSpeed = 0.12;
    s.play();
    s.anchor.set(0.5);
    s.scale.set(-2.6, 2.6); // horizontal gespiegelt
    s.x = this.W * 0.74;
    s.y = this.H * 0.47;
    this.enemySprite = s;
    this.app.stage.addChildAt(s, this.heroSprite ? 1 : 0);
  }

  private setupBars(): void {
    this.heroHpBar = new Graphics();
    this.heroManaBar = new Graphics();
    this.heroXpBar = new Graphics();
    this.enemyHpBar = new Graphics();
    this.app!.stage.addChild(this.heroHpBar, this.heroManaBar, this.heroXpBar, this.enemyHpBar);
    this.drawAllBars(
      this.gameState.playerHpPercent(),
      this.gameState.playerManaPercent(),
      this.gameState.playerXpPercent(),
      this.gameState.enemyHpPercent(),
    );
  }

  private drawAllBars(hpPct: number, manaPct: number, xpPct: number, enemyHpPct: number): void {
    if (!this.heroHpBar) return;
    const pad = 10;
    const halfW = this.W / 2 - pad * 1.5;
    const barH = 6;
    const y0 = this.H - 30;

    this.drawBar(this.heroHpBar, pad, y0, halfW, barH, hpPct, 0x4ade80, 0xff5252, 0x081408);
    this.drawBar(this.heroManaBar, pad, y0 + 9, halfW, barH, manaPct, 0x38bdf8, 0x38bdf8, 0x021420);
    this.drawBar(this.heroXpBar, pad, y0 + 18, halfW, 4, xpPct, 0xc084fc, 0xc084fc, 0x100820);
    this.drawBar(
      this.enemyHpBar,
      this.W / 2 + pad * 0.5,
      y0,
      halfW,
      barH,
      enemyHpPct,
      0xf87171,
      0xff2222,
      0x180404,
    );
  }

  private drawBar(
    g: Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    pct: number,
    colorHigh: number,
    colorLow: number,
    bgColor: number,
  ): void {
    g.clear();
    g.roundRect(x, y, w, h, h / 2).fill({ color: bgColor, alpha: 0.88 });
    g.roundRect(x, y, w, h, h / 2).stroke({ color: 0xffffff, alpha: 0.07, width: 0.5 });
    if (pct > 0) {
      const fillW = Math.max(h, w * (pct / 100));
      g.roundRect(x, y, fillW, h, h / 2).fill({
        color: pct < 30 ? colorLow : colorHigh,
        alpha: 0.95,
      });
    }
  }

  private spawnFloatingText(ft: FloatingCombatText): void {
    if (!this.app) return;
    const colors: Record<string, number> = {
      damage: 0xfb7185,
      heal: 0x4ade80,
      crit: 0xfacc15,
      mana: 0x38bdf8,
    };
    const isCrit = ft.tone === 'crit';
    const style = new TextStyle({
      fontSize: isCrit ? 21 : 15,
      fontWeight: 'bold',
      fontFamily: '"Press Start 2P", monospace, sans-serif',
      fill: colors[ft.tone] ?? 0xffffff,
      dropShadow: { color: 0x000000, blur: 5, distance: 1, alpha: 0.85 },
    });
    const t = new Text({ text: ft.text, style });
    t.anchor.set(0.5);
    t.x = ft.target === 'hero' ? this.W * 0.26 : this.W * 0.74;
    t.y = this.H * 0.32;
    this.app.stage.addChild(t);
    this.floatingTexts.push({ node: t, vy: isCrit ? -2.8 : -2.0, life: 55, maxLife: 55 });
  }

  private triggerCombatAnimation(anim: CombatAnimation): void {
    const sprite = anim.target === 'hero' ? this.heroSprite : this.enemySprite;
    if (!sprite) return;

    const cx = anim.target === 'hero' ? this.W * 0.26 : this.W * 0.74;
    const cy = this.H * 0.47;

    switch (anim.type) {
      case 'hit':
        this.shakeSprite(sprite, 5);
        this.flashTint(sprite, 0xff4444, 140);
        this.spawnParticles(cx, cy, 0xfb7185);
        break;
      case 'attack':
        this.pulseSprite(sprite, 1.22, 110);
        this.spawnParticles(cx, cy, 0xfacc15);
        break;
      case 'crit':
        this.pulseSprite(sprite, 1.4, 160);
        this.flashTint(sprite, 0xfacc15, 220);
        this.spawnParticles(cx, cy, 0xfacc15, 14);
        break;
      case 'heal':
        this.flashTint(sprite, 0x4ade80, 320);
        this.spawnParticles(cx, cy, 0x4ade80);
        break;
      case 'skill':
        this.pulseSprite(sprite, 1.45, 200);
        this.flashTint(sprite, 0x38bdf8, 280);
        this.spawnParticles(cx, cy, 0x38bdf8, 16);
        break;
      case 'death':
        this.fadeSprite(sprite);
        break;
    }
  }

  private shakeSprite(sprite: AnimatedSprite, amount: number): void {
    const ox = sprite.x;
    let n = 0;
    const id = setInterval(() => {
      sprite.x = ox + (Math.random() - 0.5) * amount * 2;
      if (++n >= 10) {
        clearInterval(id);
        sprite.x = ox;
      }
    }, 24);
  }

  private flashTint(sprite: AnimatedSprite, color: number, ms: number): void {
    sprite.tint = color;
    setTimeout(() => {
      if (sprite && !sprite.destroyed) sprite.tint = 0xffffff;
    }, ms);
  }

  private pulseSprite(sprite: AnimatedSprite, scale: number, ms: number): void {
    const sx = sprite.scale.x;
    const sy = sprite.scale.y;
    sprite.scale.set(sx * scale, sy * scale);
    setTimeout(() => {
      if (sprite && !sprite.destroyed) sprite.scale.set(sx, sy);
    }, ms);
  }

  private fadeSprite(sprite: AnimatedSprite): void {
    const id = setInterval(() => {
      sprite.alpha = Math.max(0, sprite.alpha - 0.06);
      if (sprite.alpha <= 0) clearInterval(id);
    }, 25);
  }

  private spawnParticles(cx: number, cy: number, color: number, count = 9): void {
    if (!this.app) return;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 1.5 + Math.random() * 2.5;
      const r = 2 + Math.random() * 3;
      const g = new Graphics();
      g.circle(0, 0, r).fill({ color, alpha: 0.9 });
      g.x = cx;
      g.y = cy;
      this.app.stage.addChild(g);
      this.particles.push({
        g,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        life: 28 + Math.floor(Math.random() * 12),
      });
    }
  }

  private onTick(): void {
    // Floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.node.y += ft.vy;
      ft.life--;
      ft.node.alpha = ft.life / ft.maxLife;
      if (ft.life <= 0) {
        this.app!.stage.removeChild(ft.node);
        ft.node.destroy();
        this.floatingTexts.splice(i, 1);
      }
    }

    // Partikel
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.g.x += p.vx;
      p.g.y += p.vy;
      p.vy += 0.14; // Schwerkraft
      p.life--;
      p.g.alpha = p.life / 28;
      if (p.life <= 0) {
        this.app!.stage.removeChild(p.g);
        p.g.destroy();
        this.particles.splice(i, 1);
      }
    }
  }
}
