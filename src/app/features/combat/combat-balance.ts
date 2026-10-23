/** Central tuning knobs for combat. Keep magic numbers here so balance passes touch one file. */
export const COMBAT_BALANCE = {
  /** Damage bonus per combo step after the first hit. */
  comboStep: 0.12,
  /** Combo count that arms the guaranteed-crit Fever. */
  feverCombo: 5,
  /** Combo count that resets the skill cooldown. */
  cooldownResetCombo: 8,
  /** Multiplier from an active Battle blessing. */
  battleBlessing: 1.22,
  /** Multiplier absorbed by an active Ward blessing. */
  wardBlessing: 0.78,
  crit: { playerBase: 0, enemyBase: 10, multiplier: 1.5 },
  special: {
    manaCost: 30,
    cooldown: 3,
    damageMultiplier: 1.55,
    finisherStep: 0.18,
  },
  heal: { manaCost: 20, base: 28, perLevel: 2, vigorBonus: 14 },
  potion: { heal: 50 },
  guard: {
    /** Mana gained by pressing guard (lowered to discourage turtling). */
    manaGain: 8,
    cooldownReduction: 1,
  },
  /** Passive mana recovered after each action. */
  roundRecovery: { attack: 8, guard: 9, heal: 2, potion: 6, skill: 5, resolve: 2 },
  element: { weakness: 1.25, resistance: 0.8 },
  stun: {
    /** Chance for a weakness-hitting special to stun a normal enemy. */
    specialChance: 0.35,
    rounds: 1,
    /** Riposte charges needed for a guaranteed stun from a basic attack. */
    riposteCharges: 3,
  },
  weaken: { attackMultiplier: 0.75 },
  telegraph: {
    /** Bruisers/hexers wind up a heavy move every Nth enemy turn. */
    cycle: 3,
    bruiserMultiplier: 1.6,
    hexerStatusDamageBonus: 2,
  },
} as const;

/** Enemy stat curves and New Game+ scaling. */
export const ENEMY_BALANCE = {
  hpBase: 45,
  hpPerBlueprintLevel: 26,
  hpPerLevelGap: 18,
  attackPerLevelGap: 3,
  goldPerLevelGap: 10,
  xpPerLevelGap: 12,
  newGamePlus: { hp: 0.22, attack: 0.18, reward: 0.15 },
  /** Base HP of each boss before level-gap and New Game+ scaling. */
  bossHp: { boss: 500, 'frost-wyrm': 460, 'storm-titan': 540 } as Record<string, number>,
} as const;
