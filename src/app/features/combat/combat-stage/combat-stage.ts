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
  ColorMatrixFilter,
  Container,
  Graphics,
  Sprite,
  Text,
  TextStyle,
  Texture,
} from 'pixi.js';
import { assets, attackSheetFor } from '../../assets/asset-catalog';
import type { UnitSprite } from '../../assets/asset-catalog';
import { Combat, type CombatAnimation, type FloatingCombatText } from '../combat.service';
import { type AttackElement, enemyPhasePressure } from '../combat-rules';
import type { Enemy } from '../enemy.model';
import { GameState } from '../../game-state/game-state.service';
import { SettingsService } from '../../game-state/settings.service';
import { PixiAssets } from '../../pixi/pixi.service';
import { isHeadlessCanvas } from '../../pixi/headless-canvas';
import { Path } from '../../path/path.service';
import type { PathBiome } from '../../path/path-segment.model';

interface FloatingTextNode {
  node: Text;
  vy: number;
  life: number;
  maxLife: number;
  /** Initial scale for a quick "pop" on criticals. */
  pop: number;
}

interface ParticleNode {
  g: Graphics;
  vx: number;
  vy: number;
  life: number;
}

/** Time-based tween driven by the Pixi ticker so animations pause with the canvas. */
interface Tween {
  elapsed: number;
  duration: number;
  update: (progress: number) => void;
  done?: () => void;
}

interface FighterFrames {
  idle: Texture[];
  attack: Texture[] | null;
}

const HERO_X = 0.26;
const ENEMY_X = 0.74;
const BASE_SCALE = 1.6;
const GROUND_Y = 0.47;

const ELEMENT_COLORS: Record<AttackElement, number> = {
  fire: 0xff7a2b,
  ice: 0x7dd3fc,
  lightning: 0xfde047,
  shadow: 0xa855f7,
  holy: 0xfff3b0,
  none: 0xfb7185,
};

/** Biome flavour for the ground props drawn behind the fighters. */
const DECOR: Record<PathBiome, { kind: 'rock' | 'bush'; tint: number }> = {
  ember: { kind: 'rock', tint: 0xff9a6a },
  grove: { kind: 'bush', tint: 0xffffff },
  ruin: { kind: 'rock', tint: 0xb9b0a8 },
  frost: { kind: 'rock', tint: 0xbfe6ff },
  storm: { kind: 'rock', tint: 0x9aa6b8 },
  sanctum: { kind: 'rock', tint: 0xfff0b8 },
};

/** Canvas-Schlachtfeld – rendert beide Kämpfer als animierte PixiJS-Sprites
 *  mit HP/Mana/XP-Balken, Floating-Damage-Text, Angriffs-Sheets und Element-Effekten. */
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
  private readonly settings = inject(SettingsService);
  private readonly pixiAssets = inject(PixiAssets);
  private readonly destroyRef = inject(DestroyRef);

  private app: Application | null = null;
  private heroSprite: AnimatedSprite | null = null;
  private enemySprite: AnimatedSprite | null = null;
  private heroFrames: FighterFrames | null = null;
  private enemyFrames: FighterFrames | null = null;
  private enemyBaseScale = 1;
  private decorLayer: Container | null = null;
  private heroHpBar!: Graphics;
  private heroManaBar!: Graphics;
  private heroXpBar!: Graphics;
  private enemyHpBar!: Graphics;
  private currentEnemyKey = '';
  private enemyLoadToken = 0;
  private floatingTexts: FloatingTextNode[] = [];
  private particles: ParticleNode[] = [];
  private tweens: Tween[] = [];
  private fxCache = new Map<string, Texture[]>();
  private lastAnimId = -1;
  private lastFtId = -1;
  private lastBiome: PathBiome | 'none' = 'none';
  private W = 0;
  private readonly H = 130;
  private stageShakeId: ReturnType<typeof setInterval> | null = null;
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
      const key = enemy?.id ?? 'none';
      if (this.app && key !== this.currentEnemyKey) {
        this.currentEnemyKey = key;
        void this.showEnemy(enemy);
      }
    });

    // Biom-abhängige Bodenprops
    effect(() => {
      const biome = this.biome();
      if (this.app && biome !== this.lastBiome) {
        this.lastBiome = biome;
        void this.renderDecor(biome);
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

  /** Biome of the route the player is currently fighting on. */
  protected biome(): PathBiome | 'none' {
    const branchId = this.gameState.selectedBranchId();
    const segment = this.path.currentSegment();

    return segment?.branches.find((branch) => branch.id === branchId)?.biome ?? 'none';
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
      // Capped: 3x phone screens gain nothing for 130px of pixel art but cost fill rate.
      resolution: Math.min(window.devicePixelRatio ?? 1, 2),
      autoDensity: true,
    });

    this.destroyRef.onDestroy(() => {
      this.resizeObserver?.disconnect();
      if (this.stageShakeId !== null) {
        clearInterval(this.stageShakeId);
        this.stageShakeId = null;
      }
      this.app?.destroy(false, { children: true });
      this.app = null;
    });

    this.decorLayer = new Container();
    this.app.stage.addChild(this.decorLayer);
    await this.loadHeroSprite();
    this.setupBars();
    this.app.ticker.add((ticker) => this.onTick(ticker.deltaMS));

    // Whatever state the game is in right now (restored save, mid-fight) gets drawn.
    this.currentEnemyKey = this.gameState.enemy()?.id ?? 'none';
    await this.showEnemy(this.gameState.enemy(), false);
    this.lastBiome = this.biome();
    await this.renderDecor(this.lastBiome);

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
    void this.renderDecor(this.lastBiome);
    this.drawAllBars(
      this.gameState.playerHpPercent(),
      this.gameState.playerManaPercent(),
      this.gameState.playerXpPercent(),
      this.gameState.enemyHpPercent(),
    );
  }

  private repositionSprites(): void {
    if (this.heroSprite) {
      this.heroSprite.x = this.W * HERO_X;
      this.heroSprite.y = this.H * GROUND_Y;
    }
    if (this.enemySprite) {
      this.enemySprite.x = this.W * ENEMY_X;
      this.enemySprite.y = this.enemyY(this.enemyBaseScale);
    }
  }

  /** Larger enemies sit a little lower so their feet stay on the ground line. */
  private enemyY(scale: number): number {
    return this.H * GROUND_Y + (scale - 1) * 12;
  }

  private async loadFrames(unit: UnitSprite): Promise<FighterFrames> {
    const idle = await this.pixiAssets.loadSpriteFrames(unit.idle, unit.frames);
    const attackUrl = attackSheetFor(unit.idle);
    const attack = attackUrl ? await this.pixiAssets.loadSquareFrames(attackUrl) : null;

    return { idle, attack };
  }

  private async loadHeroSprite(): Promise<void> {
    if (!this.app) return;
    const frames = await this.loadFrames(assets.units.hero);
    if (this.heroSprite) {
      this.app.stage.removeChild(this.heroSprite);
      this.heroSprite.destroy();
    }
    this.heroFrames = frames;
    const s = new AnimatedSprite(frames.idle);
    s.animationSpeed = 0.12;
    s.play();
    s.anchor.set(0.5);
    s.scale.set(BASE_SCALE);
    s.x = this.W * HERO_X;
    s.y = this.H * GROUND_Y;
    this.heroSprite = s;
    this.app.stage.addChild(s);
  }

  /** Shows `enemy` (or hides the sprite when there is none). `animate` plays the entrance. */
  private async showEnemy(enemy: Enemy | null, animate = true): Promise<void> {
    if (!this.app) return;
    const token = ++this.enemyLoadToken;

    if (!enemy) {
      const sprite = this.enemySprite;

      if (sprite && !sprite.destroyed) {
        this.addTween(260, (k) => (sprite.alpha = Math.min(sprite.alpha, 1 - k)));
      }
      return;
    }

    const unit: UnitSprite = enemy.sprite ?? assets.units.slime;
    const frames = await this.loadFrames(unit);

    if (!this.app || token !== this.enemyLoadToken) return; // a newer enemy took over

    if (this.enemySprite) {
      this.app.stage.removeChild(this.enemySprite);
      this.enemySprite.destroy();
    }

    const scale = enemy.scale ?? 1;
    const s = new AnimatedSprite(frames.idle);
    s.animationSpeed = 0.12;
    s.play();
    s.anchor.set(0.5);
    s.scale.set(-BASE_SCALE * scale, BASE_SCALE * scale); // horizontal gespiegelt
    s.x = this.W * ENEMY_X;
    s.y = this.enemyY(scale);

    if (enemy.hue) {
      const filter = new ColorMatrixFilter();
      filter.hue(enemy.hue, false);
      s.filters = [filter];
    }

    this.enemyFrames = frames;
    this.enemyBaseScale = scale;
    this.enemySprite = s;
    this.app.stage.addChild(s);

    if (animate && this.settings.animations()) {
      this.playEntrance(s, enemy);
    }
  }

  private playEntrance(sprite: AnimatedSprite, enemy: Enemy): void {
    const targetX = this.W * ENEMY_X;
    sprite.alpha = 0;
    this.addTween(enemy.isBoss ? 520 : 320, (k) => {
      if (sprite.destroyed) return;
      sprite.alpha = k;
      sprite.x = targetX + (1 - k) * 34;
    });

    if (enemy.isBoss) {
      this.showBanner(enemy.name.toUpperCase(), 0xf87171);
      this.shakeStage(6, 14);
      this.flashScreen(0x7f1d1d, 0.45);
    } else if (enemy.elite) {
      this.showBanner('ELITE', 0xfacc15);
    }
  }

  /** Large centred caption used for boss and elite introductions. */
  private showBanner(text: string, color: number): void {
    if (!this.app) return;
    const banner = new Text({
      text,
      style: new TextStyle({
        fontSize: 17,
        fontWeight: 'bold',
        fontFamily: '"Press Start 2P", monospace, sans-serif',
        fill: color,
        dropShadow: { color: 0x000000, blur: 6, distance: 2, alpha: 0.9 },
        letterSpacing: 2,
      }),
    });
    banner.anchor.set(0.5);
    banner.x = this.W / 2;
    banner.y = this.H * 0.26;
    banner.alpha = 0;
    this.app.stage.addChild(banner);
    this.addTween(
      1500,
      (k) => {
        if (banner.destroyed) return;
        banner.alpha = k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1;
        banner.scale.set(1 + (1 - Math.min(1, k * 4)) * 0.5);
      },
      () => {
        if (!banner.destroyed) banner.destroy();
      },
    );
  }

  /** Ground props behind the fighters, chosen by the route's biome. */
  private async renderDecor(biome: PathBiome | 'none'): Promise<void> {
    const layer = this.decorLayer;
    if (!this.app || !layer) return;

    for (const child of layer.removeChildren()) {
      child.destroy();
    }

    if (biome === 'none') return;

    const { kind, tint } = DECOR[biome];
    const spots = [0.06, 0.4, 0.55, 0.95];

    for (const [index, spot] of spots.entries()) {
      const x = this.W * spot;
      const y = this.H - 38 + (index % 2) * 6;

      if (kind === 'bush') {
        const frames = await this.pixiAssets.loadSquareFrames(
          assets.decor.bushes[index % assets.decor.bushes.length],
        );
        if (!frames || !this.app || layer.destroyed) continue;
        const bush = new AnimatedSprite(frames);
        bush.animationSpeed = 0.06;
        bush.play();
        bush.anchor.set(0.5, 1);
        bush.scale.set(0.5);
        bush.x = x;
        bush.y = y + 10;
        bush.alpha = 0.85;
        layer.addChild(bush);
      } else {
        const texture = await this.pixiAssets.loadTexture(
          assets.decor.rocks[index % assets.decor.rocks.length],
        );
        if (!this.app || layer.destroyed) continue;
        const rock = new Sprite(texture);
        rock.anchor.set(0.5, 1);
        rock.scale.set(index % 2 ? 0.7 : 0.9);
        rock.tint = tint;
        rock.alpha = 0.8;
        rock.x = x;
        rock.y = y + 8;
        layer.addChild(rock);
      }
    }
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
    t.x = (ft.target === 'hero' ? HERO_X : ENEMY_X) * this.W + (Math.random() - 0.5) * 18;
    t.y = this.H * 0.32;
    this.app.stage.addChild(t);
    this.floatingTexts.push({
      node: t,
      vy: isCrit ? -2.8 : -2.0,
      life: 55,
      maxLife: 55,
      pop: isCrit ? 1.7 : 1.25,
    });
  }

  private triggerCombatAnimation(anim: CombatAnimation): void {
    const sprite = anim.target === 'hero' ? this.heroSprite : this.enemySprite;
    if (!sprite) return;

    const cx = (anim.target === 'hero' ? HERO_X : ENEMY_X) * this.W;
    const cy = sprite.y;
    const element = anim.element ?? 'none';
    const tint = ELEMENT_COLORS[element];

    switch (anim.type) {
      case 'hit':
        this.shakeSprite(sprite, 5);
        this.flashTint(sprite, 0xff4444, 140);
        this.spawnParticles(cx, cy, tint);
        this.spawnElementFx(element, cx, cy, false);
        this.shakeStage(4);
        break;
      case 'attack':
        this.playAttack(anim.target, 22);
        this.spawnParticles(cx, cy, 0xfacc15);
        break;
      case 'crit':
        this.pulseSprite(sprite, 1.4, 160);
        this.flashTint(sprite, 0xfacc15, 220);
        this.spawnParticles(cx, cy, 0xfacc15, 14);
        this.spawnElementFx(element, cx, cy, true);
        this.shakeStage(9, 13);
        this.flashScreen(0xfacc15, 0.32);
        break;
      case 'heal':
        this.flashTint(sprite, 0x4ade80, 320);
        this.spawnParticles(cx, cy, 0x4ade80);
        this.flashScreen(0x4ade80, 0.18);
        break;
      case 'skill':
        this.playAttack(anim.target, 34);
        this.flashTint(sprite, 0x38bdf8, 280);
        this.spawnParticles(cx, cy, 0x38bdf8, 16);
        this.shakeStage(7, 11);
        this.flashScreen(0x38bdf8, 0.26);
        break;
      case 'death':
        this.playDeath(sprite);
        this.spawnElementFx(element, cx, cy, true);
        this.shakeStage(11, 16);
        this.flashScreen(0xffffff, 0.4);
        break;
    }
  }

  /** Swaps to the attack sheet (if the unit has one) and lunges towards the opponent. */
  private playAttack(target: 'hero' | 'enemy', lungePx: number): void {
    const sprite = target === 'hero' ? this.heroSprite : this.enemySprite;
    const frames = target === 'hero' ? this.heroFrames : this.enemyFrames;

    if (!sprite || sprite.destroyed || !frames) return;

    if (!this.settings.animations()) return;

    if (frames.attack) {
      const idle = frames.idle;
      sprite.textures = frames.attack;
      sprite.loop = false;
      sprite.animationSpeed = 0.3;
      sprite.onComplete = () => {
        if (sprite.destroyed) return;
        sprite.textures = idle;
        sprite.loop = true;
        sprite.animationSpeed = 0.12;
        sprite.onComplete = undefined;
        sprite.play();
      };
      sprite.gotoAndPlay(0);
    } else {
      this.pulseSprite(sprite, 1.22, 110);
    }

    const direction = target === 'hero' ? 1 : -1;
    const originX = (target === 'hero' ? HERO_X : ENEMY_X) * this.W;
    this.addTween(260, (k) => {
      if (sprite.destroyed) return;
      sprite.x = originX + direction * lungePx * Math.sin(Math.PI * k);
    });
  }

  private playDeath(sprite: AnimatedSprite): void {
    if (!this.settings.animations()) {
      sprite.alpha = 0;
      return;
    }

    const startY = sprite.y;
    const sx = sprite.scale.x;
    const sy = sprite.scale.y;
    this.addTween(520, (k) => {
      if (sprite.destroyed) return;
      sprite.alpha = 1 - k;
      sprite.scale.set(sx, sy * (1 - 0.35 * k));
      sprite.y = startY + 10 * k;
    });
  }

  /** Cached strip of square frames for a particle effect sheet. */
  private async fxFrames(url: string): Promise<Texture[] | null> {
    const cached = this.fxCache.get(url);
    if (cached) return cached;

    const frames = await this.pixiAssets.loadSquareFrames(url);
    if (frames) this.fxCache.set(url, frames);

    return frames;
  }

  /** One-shot animated impact effect, coloured by the attack element. */
  private spawnElementFx(element: AttackElement, x: number, y: number, big: boolean): void {
    if (!this.app || !this.settings.particles()) return;

    const sheet =
      element === 'fire'
        ? assets.fx.fire
        : element === 'none'
          ? assets.fx.dust
          : big
            ? assets.fx.explosionBig
            : assets.fx.explosion;
    const tint = element === 'fire' || element === 'none' ? 0xffffff : ELEMENT_COLORS[element];
    const isSmallSheet = sheet === assets.fx.fire || sheet === assets.fx.dust;
    const scale = (isSmallSheet ? 1.6 : 0.7) * (big ? 1.3 : 1);

    void this.fxFrames(sheet).then((frames) => {
      if (!frames || !this.app) return;
      const fx = new AnimatedSprite(frames);
      fx.anchor.set(0.5);
      fx.x = x;
      fx.y = y;
      fx.scale.set(scale);
      fx.tint = tint;
      fx.blendMode = 'add';
      fx.loop = false;
      fx.animationSpeed = 0.4;
      fx.onComplete = () => {
        if (!fx.destroyed) fx.destroy();
      };
      this.app.stage.addChild(fx);
      fx.play();
    });
  }

  private addTween(duration: number, update: (progress: number) => void, done?: () => void): void {
    this.tweens.push({ elapsed: 0, duration, update, done });
  }

  /** Whole-stage screen shake for heavy impacts (crit, finisher, defeat). */
  private shakeStage(amount: number, ticks = 9): void {
    if (!this.app || !this.settings.screenShake() || !this.settings.animations()) return;
    const stage = this.app.stage;
    if (this.stageShakeId !== null) {
      clearInterval(this.stageShakeId);
    }
    let n = 0;
    this.stageShakeId = setInterval(() => {
      if (!this.app) return;
      const decay = 1 - n / ticks;
      stage.x = (Math.random() - 0.5) * amount * 2 * decay;
      stage.y = (Math.random() - 0.5) * amount * 2 * decay;
      if (++n >= ticks) {
        if (this.stageShakeId !== null) {
          clearInterval(this.stageShakeId);
        }
        this.stageShakeId = null;
        stage.x = 0;
        stage.y = 0;
      }
    }, 22);
  }

  /** Brief full-screen colour flash on impactful actions. */
  private flashScreen(color: number, alpha: number): void {
    if (!this.app || !this.settings.animations()) return;
    const g = new Graphics().rect(-30, -30, this.W + 60, this.H + 60).fill({ color, alpha });
    g.eventMode = 'none';
    this.app.stage.addChild(g);
    this.addTween(
      210,
      (k) => {
        if (!g.destroyed) g.alpha = 1 - k;
      },
      () => {
        if (!g.destroyed) g.destroy();
      },
    );
  }

  private shakeSprite(sprite: AnimatedSprite, amount: number): void {
    if (!this.settings.screenShake() || !this.settings.animations()) return;
    const ox = sprite.x;
    let n = 0;
    const id = setInterval(() => {
      if (sprite.destroyed) {
        clearInterval(id);
        return;
      }
      sprite.x = ox + (Math.random() - 0.5) * amount * 2;
      if (++n >= 10) {
        clearInterval(id);
        sprite.x = ox;
      }
    }, 24);
  }

  private flashTint(sprite: AnimatedSprite, color: number, ms: number): void {
    if (!this.settings.animations()) return;
    sprite.tint = color;
    setTimeout(() => {
      if (sprite && !sprite.destroyed) sprite.tint = 0xffffff;
    }, ms);
  }

  private pulseSprite(sprite: AnimatedSprite, scale: number, ms: number): void {
    if (!this.settings.animations()) return;
    const sx = sprite.scale.x;
    const sy = sprite.scale.y;
    sprite.scale.set(sx * scale, sy * scale);
    setTimeout(() => {
      if (sprite && !sprite.destroyed) sprite.scale.set(sx, sy);
    }, ms);
  }

  private spawnParticles(cx: number, cy: number, color: number, count = 9): void {
    if (!this.app || !this.settings.particles()) return;
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

  private onTick(deltaMS: number): void {
    // Tweens
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tween = this.tweens[i];
      tween.elapsed += deltaMS;
      const k = Math.min(1, tween.elapsed / tween.duration);
      tween.update(k);
      if (k >= 1) {
        tween.done?.();
        this.tweens.splice(i, 1);
      }
    }

    // Floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.node.y += ft.vy;
      ft.life--;
      ft.node.alpha = ft.life / ft.maxLife;
      const age = ft.maxLife - ft.life;
      ft.node.scale.set(age < 8 ? ft.pop - ((ft.pop - 1) * age) / 8 : 1);
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
