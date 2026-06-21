import { Injectable } from '@angular/core';
import { Assets, Rectangle, Texture } from 'pixi.js';

@Injectable({ providedIn: 'root' })
export class PixiAssets {
  /** Load a texture – PixiJS Assets handles caching internally. */
  async loadTexture(url: string): Promise<Texture> {
    return Assets.load<Texture>(url);
  }

  /** Slice a horizontal sprite strip into individual frame textures. */
  async loadSpriteFrames(url: string, frameCount: number): Promise<Texture[]> {
    const base = await this.loadTexture(url);
    const frameWidth = base.width / frameCount;
    return Array.from(
      { length: frameCount },
      (_, i) =>
        new Texture({
          source: base.source,
          frame: new Rectangle(i * frameWidth, 0, frameWidth, base.height),
        }),
    );
  }
}
