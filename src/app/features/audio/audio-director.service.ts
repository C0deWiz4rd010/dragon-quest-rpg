import { Injectable, effect, inject } from '@angular/core';

import { Combat, type CombatAnimation } from '../combat/combat.service';
import { AchievementService } from '../game-state/achievement.service';
import { GameState } from '../game-state/game-state.service';
import { Inventory } from '../inventory/inventory.service';
import { Path } from '../path/path.service';
import { AudioService } from './audio.service';
import type { MusicTheme, SfxName } from './sfx-recipes';

/** Maps a combat animation onto the sound that should accompany it. */
export function sfxForAnimation(animation: Pick<CombatAnimation, 'target' | 'type'>): SfxName | null {
  const { target, type } = animation;

  switch (type) {
    case 'attack':
      return 'attack';
    case 'skill':
      return 'skill';
    case 'guard':
      return 'guard';
    case 'heal':
      return 'heal';
    case 'death':
      return 'death';
    case 'crit':
      return target === 'hero' ? 'playerHit' : 'crit';
    case 'hit':
      return target === 'hero' ? 'playerHit' : 'hit';
  }
}

/**
 * Listens to game state and triggers sounds and music, so gameplay code never has to know
 * about audio. Instantiated once by the game page.
 */
@Injectable({ providedIn: 'root' })
export class AudioDirector {
  private readonly audio = inject(AudioService);
  private readonly gameState = inject(GameState);
  private readonly combat = inject(Combat);
  private readonly inventory = inject(Inventory);
  private readonly achievements = inject(AchievementService);
  private readonly path = inject(Path);

  constructor() {
    let lastAnimationId = -1;
    effect(() => {
      const animation = this.combat.animation();

      if (!animation || animation.id === lastAnimationId) return;
      lastAnimationId = animation.id;

      const sfx = sfxForAnimation(animation);
      if (sfx) this.audio.play(sfx);
    });

    let level = this.gameState.player().level;
    effect(() => {
      const next = this.gameState.player().level;
      if (next > level) this.audio.play('levelUp');
      level = next;
    });

    let miniGamesWon = this.gameState.player().miniGamesWon;
    effect(() => {
      const next = this.gameState.player().miniGamesWon;
      if (next > miniGamesWon) this.audio.play('minigameWin');
      miniGamesWon = next;
    });

    let hadStatus = !!this.gameState.player().statusEffect;
    effect(() => {
      const has = !!this.gameState.player().statusEffect;
      if (has && !hadStatus) this.audio.play('status');
      hadStatus = has;
    });

    let enemyId = this.gameState.enemy()?.id ?? null;
    let wasStunned = false;
    effect(() => {
      const enemy = this.gameState.enemy();
      const id = enemy?.id ?? null;

      if (enemy && id !== enemyId) {
        this.audio.play(enemy.isBoss ? 'boss' : enemy.elite ? 'elite' : 'encounter');
      }
      enemyId = id;

      const stunned = (enemy?.stunnedRounds ?? 0) > 0;
      if (stunned && !wasStunned) this.audio.play('stun');
      wasStunned = stunned;
    });

    let depth = this.path.currentDepth();
    effect(() => {
      const next = this.path.currentDepth();
      if (next > depth) this.audio.play('step');
      depth = next;
    });

    effect(() => {
      if (this.inventory.lastLoot()) this.audio.play('loot');
    });

    effect(() => {
      if (this.achievements.recentUnlock()) this.audio.play('achievement');
    });

    effect(() => {
      const outcome = this.gameState.runOutcome();
      if (outcome) this.audio.play(outcome === 'victory' ? 'victory' : 'defeat');
    });

    effect(() => this.audio.setMusic(this.musicTheme()));

    if (typeof document !== 'undefined') {
      document.addEventListener('click', this.onClick, true);
    }
  }

  /** Boss fights get their own driving theme; otherwise the route's biome decides. */
  private musicTheme(): MusicTheme {
    if (this.gameState.enemy()?.isBoss) {
      return 'boss';
    }

    return this.path.activeBiome() ?? 'grove';
  }

  /** Soft click for buttons, except in the combat panel where actions have their own sounds. */
  private readonly onClick = (event: MouseEvent): void => {
    const target = event.target;

    if (!(target instanceof Element)) return;

    const button = target.closest('button');

    if (!button || button.closest('app-combat-panel') || button.disabled) return;

    this.audio.play('ui');
  };
}
