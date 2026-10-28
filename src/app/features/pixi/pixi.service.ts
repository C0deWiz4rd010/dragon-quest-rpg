import { Injectable } from '@angular/core';
import { Assets, Rectangle, Texture } from 'pixi.js';

@Injectable({ providedIn: 'root' })
export class PixiAssets {
  /** Load a texture – PixiJS Assets handles caching internally. Pixel art stays crisp. */
  async loadTexture(url: string): Promise<Texture> {
    const texture = await Assets.load<Texture>(url);
    texture.source.scaleMode = 'nearest';

    return texture;
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

  /**
   * Slices a strip of square frames, deriving the frame count from its proportions.
   * Returns null if the sheet cannot be loaded (e.g. not shipped), so callers can fall back.
   */
  async loadSquareFrames(url: string): Promise<Texture[] | null> {
    try {
      const base = await this.loadTexture(url);
      const count = Math.max(1, Math.round(base.width / base.height));

      return await this.loadSpriteFrames(url, count);
    } catch {
      return null;
    }
  }
}
