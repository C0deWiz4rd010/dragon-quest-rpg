import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { CharacterClassId } from '../game-state/character-classes';
import { GameState } from '../game-state/game-state.service';
import { createEnemy, ENEMY_BLUEPRINTS } from '../path/enemy-blueprints';
import { Combat } from './combat.service';

/** Deterministic PRNG so balance assertions never flake. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const GEAR_PER_STOP = { attack: 5, defense: 3 };

interface RunResult {
  depth: number;
  won: boolean;
  level: number;
}

const NORMAL_IDS = Object.keys(ENEMY_BLUEPRINTS).filter(
  (id) => !ENEMY_BLUEPRINTS[id].isBoss && !ENEMY_BLUEPRINTS[id].elite,
);
const ELITE_IDS = Object.keys(ENEMY_BLUEPRINTS).filter((id) => ENEMY_BLUEPRINTS[id].elite);
const BOSS_IDS = Object.keys(ENEMY_BLUEPRINTS).filter((id) => ENEMY_BLUEPRINTS[id].isBoss);

describe('balance simulation', () => {
  let combat: Combat;
  let state: GameState;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    TestBed.configureTestingModule({});
    combat = TestBed.inject(Combat);
    state = TestBed.inject(GameState);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  /** A competent but simple bot: heals when low, specials when ready, guards vs. telegraphs. */
  function botTurn(): void {
    const player = state.player();
    const enemy = state.enemy();
    const hpRatio = player.hp / player.maxHp;

    if (hpRatio < 0.3 && player.potions > 0 && state.canUsePotion()) {
      combat.usePotion();
    } else if (hpRatio < 0.45 && state.canHeal()) {
      combat.heal();
    } else if (state.canUseSkill()) {
      combat.specialAttack();
    } else if (enemy?.telegraphedAbility?.damageMultiplier || enemy?.telegraphedAbility?.forceStatus) {
      combat.guard();
    } else {
      combat.attack();
    }
  }

  function pickEnemyId(depth: number, random: () => number): { id: string; boss: boolean } {
    if (depth % 5 === 0) {
      return { id: BOSS_IDS[Math.floor(random() * BOSS_IDS.length)], boss: true };
    }

    const pool = depth >= 3 && random() < 0.3 ? ELITE_IDS : NORMAL_IDS;

    return { id: pool[Math.floor(random() * pool.length)], boss: false };
  }

  function simulateRun(characterClass: CharacterClassId, seed: number, maxDepth = 5): RunResult {
    const random = seeded(seed);
    vi.spyOn(Math, 'random').mockImplementation(random);
    state.reset(characterClass);

    for (let depth = 1; depth <= maxDepth; depth++) {
      const { id, boss } = pickEnemyId(depth, random);
      state.setEnemy(createEnemy(id, state.player().level, boss, 1, 0));

      for (let action = 0; action < 250 && state.enemy() && state.gameActive(); action++) {
        botTurn();
        vi.runAllTimers();
      }

      const alive = state.player().hp > 0 && state.gameActive() !== false;
      const bossBeaten = boss && !state.enemy();

      // Spend pending level-up and skill picks like a player would.
      const choice = state.levelUpChoices()[0];
      if (choice) combat.chooseLevelUp(choice.id);
      const skill = state.player().pendingSkillChoices?.[0];
      if (skill) combat.chooseSkill(skill);

      if (bossBeaten) {
        return { depth, won: true, level: state.player().level };
      }

      if (!alive || state.enemy()) {
        return { depth, won: false, level: state.player().level };
      }

      // Rest stop between fights: partial heal and full mana, like camps on the route.
      // The segment before a boss is always a prep stop (full heal, supplies).
      const bossNext = (depth + 1) % 5 === 0;
      state.updatePlayer((p) => ({
        ...p,
        potions: bossNext ? p.potions + 2 : p.potions,
        // Gear from drops, forges and relics: roughly +5 ATK / +3 DEF per cleared stop.
        attackBonus: p.attackBonus + GEAR_PER_STOP.attack,
        defenseBonus: p.defenseBonus + GEAR_PER_STOP.defense,
        hp: bossNext ? p.maxHp : Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.4)),
        mana: p.maxMana,
        skillCooldown: 0,
        statusEffect: null,
      }));
    }

    return { depth: maxDepth, won: false, level: state.player().level };
  }

  const classes: CharacterClassId[] = ['warrior', 'mage', 'rogue', 'paladin'];

  for (const characterClass of classes) {
    it(`${characterClass}: hard but winnable over 25 seeded runs`, () => {
      const results = Array.from({ length: 25 }, (_, i) => simulateRun(characterClass, 1000 + i));
      const winRate = results.filter((r) => r.won).length / results.length;
      const avgDepth = results.reduce((sum, r) => sum + r.depth, 0) / results.length;

      // Hard but winnable: the bot clears the first boss sometimes, never always.
      expect(avgDepth, `${characterClass} avg depth`).toBeGreaterThan(3.2);
      expect(winRate, `${characterClass} win rate`).toBeGreaterThan(0.03);
      expect(winRate, `${characterClass} win rate`).toBeLessThan(0.75);
    });
  }
});
