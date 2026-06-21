import type { Player } from '../inventory/player.model';
import { incomingDamagePreview, tacticalCombatAdvice } from './combat-advisor';
import type { Enemy } from './enemy.model';

describe('combat advisor', () => {
  it('estimates guard mitigation for incoming damage', () => {
    const enemy = createEnemy({ role: 'bruiser', attack: 40 });
    const preview = incomingDamagePreview(enemy, 20, false, 'snow');

    expect(preview.rawDamage).toBeGreaterThan(preview.guardDamage);
    expect(preview.label).toContain('DMG');
  });

  it('includes boss phase pressure in incoming previews', () => {
    const enemy = createEnemy({ role: 'boss', hp: 25, maxHp: 100, attack: 40 });
    const preview = incomingDamagePreview(enemy, 20, true, 'clear');

    expect(preview.label).toContain('Finale Wut');
  });

  it('prioritizes resolve when the projected hit is lethal', () => {
    const player = createPlayer({ hp: 8, resolve: 1 });
    const enemy = createEnemy({ attack: 90, role: 'boss' });
    const advice = tacticalCombatAdvice(player, enemy, 5, false, 'clear');

    expect(advice.tone).toBe('recover');
    expect(advice.label).toContain('Resolve');
  });

  it('calls for a finisher when skill is ready and enemy hp is low', () => {
    const player = createPlayer({ mana: 80 });
    const enemy = createEnemy({ hp: 20, maxHp: 100 });
    const advice = tacticalCombatAdvice(player, enemy, 20, true, 'glow');

    expect(advice.tone).toBe('finish');
  });

  it('recommends spending charged riposte windows', () => {
    const player = createPlayer({ riposteCharges: 2, combo: 2 });
    const enemy = createEnemy({ hp: 70, maxHp: 100 });
    const advice = tacticalCombatAdvice(player, enemy, 20, false, 'clear');

    expect(advice.tone).toBe('finish');
    expect(advice.label).toContain('Riposte');
  });
});

function createEnemy(overrides: Partial<Enemy> = {}): Enemy {
  return {
    id: 'enemy-test',
    name: 'Test Enemy',
    role: 'swift',
    hp: 80,
    maxHp: 80,
    attack: 24,
    gold: 0,
    xp: 0,
    icon: 'T',
    level: 1,
    elite: false,
    ...overrides,
  };
}

function createPlayer(overrides: Partial<Player> = {}): Player {
  return {
    statusEffect: null,
    activeBlessings: [],
    level: 1,
    xp: 0,
    maxHp: 100,
    hp: 100,
    baseAttack: 25,
    baseDefense: 10,
    baseCrit: 15,
    luck: 5,
    maxMana: 100,
    mana: 100,
    gold: 150,
    dragonShards: 0,
    potions: 3,
    resolve: 1,
    maxResolve: 3,
    activeContract: {
      type: 'slayer',
      title: 'Kopfgeld',
      description: 'Besiege Gegner.',
      progress: 0,
      target: 3,
      rewardGold: 90,
      rewardResolve: 1,
      completed: false,
    },
    completedContracts: 0,
    contractStreak: 0,
    attackBonus: 0,
    defenseBonus: 0,
    critBonus: 0,
    equippedWeapon: null,
    equippedArmor: null,
    equippedRing: null,
    activePet: null,
    ownedItems: [],
    ownedPets: [],
    ownedRelics: [],
    guarding: false,
    riposteCharges: 0,
    perfectGuards: 0,
    skillCooldown: 0,
    totalKills: 0,
    eliteKills: 0,
    totalOverkillDamage: 0,
    overkillStreak: 0,
    completedPaths: 0,
    routeHistory: [],
    routeStreak: 0,
    bossKilled: false,
    totalManaUsed: 0,
    miniGamesWon: 0,
    combo: 0,
    maxCombo: 0,
    ...overrides,
  };
}
