import { Player } from '../inventory/player.model';

export interface Skill {
  id: string;
  name: string;
  icon: string;
  description: string;
  attackPct?: number;
  defensePct?: number;
  critFlat?: number;
  lifestealPct?: number;
  xpPct?: number;
  goldPct?: number;
}

export const SKILLS: Skill[] = [
  {
    id: 'berserker',
    name: 'Berserker',
    icon: '🪓',
    description: '+12% Angriff.',
    attackPct: 0.12,
  },
  {
    id: 'ironhide',
    name: 'Eisenhaut',
    icon: '🛡',
    description: '+15% Verteidigung.',
    defensePct: 0.15,
  },
  {
    id: 'deadeye',
    name: 'Scharfschütze',
    icon: '🎯',
    description: '+8 Kritchance.',
    critFlat: 8,
  },
  {
    id: 'vampirism',
    name: 'Blutdurst',
    icon: '🩸',
    description: 'Lebensraub 10% des Schadens.',
    lifestealPct: 0.1,
  },
  {
    id: 'scholar',
    name: 'Gelehrter',
    icon: '📚',
    description: '+20% XP.',
    xpPct: 0.2,
  },
  {
    id: 'treasurehunter',
    name: 'Schatzjäger',
    icon: '💰',
    description: '+20% Gold.',
    goldPct: 0.2,
  },
  {
    id: 'duelist',
    name: 'Duellant',
    icon: '⚔',
    description: '+8% Angriff, +5 Krit.',
    attackPct: 0.08,
    critFlat: 5,
  },
  {
    id: 'guardian',
    name: 'Wächter',
    icon: '🏰',
    description: '+10% Verteidigung, Lebensraub 5%.',
    defensePct: 0.1,
    lifestealPct: 0.05,
  },
  {
    id: 'assassin',
    name: 'Meuchler',
    icon: '🗡',
    description: '+12 Krit, +5% Angriff.',
    critFlat: 12,
    attackPct: 0.05,
  },
  {
    id: 'warlord',
    name: 'Kriegsherr',
    icon: '👑',
    description: '+15% Angriff, −5% Verteidigung.',
    attackPct: 0.15,
    defensePct: -0.05,
  },
  {
    id: 'sage',
    name: 'Weiser',
    icon: '🔮',
    description: '+15% XP, +10% Gold.',
    xpPct: 0.15,
    goldPct: 0.1,
  },
  {
    id: 'reaper',
    name: 'Schnitter',
    icon: '💀',
    description: 'Lebensraub 15%.',
    lifestealPct: 0.15,
  },
];

export function getSkill(id: string): Skill | undefined {
  return SKILLS.find((skill) => skill.id === id);
}

export function learnedSkills(player: Player): Skill[] {
  return (player.learnedSkills ?? [])
    .map((id) => getSkill(id))
    .filter((skill): skill is Skill => !!skill);
}

type SkillNumericKey = 'attackPct' | 'defensePct' | 'critFlat' | 'lifestealPct' | 'xpPct' | 'goldPct';

function sum(player: Player, key: SkillNumericKey): number {
  return learnedSkills(player).reduce((total, skill) => total + (skill[key] ?? 0), 0);
}

export function skillAttackMultiplier(player: Player): number {
  return 1 + sum(player, 'attackPct');
}

export function skillDefenseMultiplier(player: Player): number {
  return 1 + sum(player, 'defensePct');
}

export function skillCritFlat(player: Player): number {
  return sum(player, 'critFlat');
}

export function skillLifestealPct(player: Player): number {
  return sum(player, 'lifestealPct');
}

export function skillXpMultiplier(player: Player): number {
  return 1 + sum(player, 'xpPct');
}

export function skillGoldMultiplier(player: Player): number {
  return 1 + sum(player, 'goldPct');
}

/** Picks a random skill the player has not learned yet, or undefined if all are learned. */
export function rollUnlearnedSkill(player: Player): Skill | undefined {
  const owned = new Set(player.learnedSkills ?? []);
  const pool = SKILLS.filter((skill) => !owned.has(skill.id));
  if (!pool.length) {
    return undefined;
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Skills each class gravitates towards; they show up three times as often. */
const CLASS_AFFINITY: Record<string, string[]> = {
  warrior: ['berserker', 'ironhide', 'warlord', 'guardian'],
  mage: ['scholar', 'sage', 'reaper', 'vampirism'],
  rogue: ['deadeye', 'assassin', 'treasurehunter', 'duelist'],
  paladin: ['ironhide', 'guardian', 'vampirism', 'sage'],
};

/** Rolls up to `count` distinct unlearned skills, favouring the player's class. */
export function rollSkillChoices(player: Player, count = 3): string[] {
  const owned = new Set(player.learnedSkills ?? []);
  const favoured = new Set(CLASS_AFFINITY[player.characterClass ?? ''] ?? []);
  const pool = SKILLS.filter((skill) => !owned.has(skill.id)).map((skill) => ({
    id: skill.id,
    weight: favoured.has(skill.id) ? 3 : 1,
  }));
  const picks: string[] = [];

  while (picks.length < count && pool.length) {
    const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * total;
    let index = pool.findIndex((entry) => (roll -= entry.weight) < 0);

    if (index < 0) {
      index = pool.length - 1;
    }

    picks.push(pool[index].id);
    pool.splice(index, 1);
  }

  return picks;
}
