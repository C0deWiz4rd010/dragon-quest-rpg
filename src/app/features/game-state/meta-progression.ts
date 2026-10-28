import { Player } from '../inventory/player.model';

/** Storage key shared with the achievement service. */
export const ACHIEVEMENT_STORAGE_KEY = 'dragonQuestRpgAchievements';

export interface MetaPerk {
  /** Achievement that unlocks the perk. */
  achievementId: string;
  label: string;
  apply: (player: Player) => Player;
}

/**
 * Permanent bonuses earned by achievements. They apply at the start of every new run
 * and New Game+ cycle, so long-term play makes the next run a little smoother.
 */
export const META_PERKS: MetaPerk[] = [
  {
    achievementId: 'slayer-50',
    label: 'Kriegsveteran: +1 Starttrank',
    apply: (p) => ({ ...p, potions: p.potions + 1 }),
  },
  {
    achievementId: 'boss-slayer',
    label: 'Drachentöter: +40 Startgold',
    apply: (p) => ({ ...p, gold: p.gold + 40 }),
  },
  {
    achievementId: 'elite-10',
    label: 'Elite-Bezwinger: +1 Max-Resolve',
    apply: (p) => ({ ...p, maxResolve: p.maxResolve + 1, resolve: p.resolve + 1 }),
  },
  {
    achievementId: 'level-10',
    label: 'Meister: +10 Max-HP',
    apply: (p) => ({ ...p, maxHp: p.maxHp + 10, hp: p.hp + 10 }),
  },
  {
    achievementId: 'shards-50',
    label: 'Drachenhort: +3 Startshards',
    apply: (p) => ({ ...p, dragonShards: p.dragonShards + 3 }),
  },
  {
    achievementId: 'combo-20',
    label: 'Unaufhaltsam: +3 Krit',
    apply: (p) => ({ ...p, baseCrit: p.baseCrit + 3 }),
  },
  {
    achievementId: 'ng-3',
    label: 'Ewiger Held: +2 Angriff',
    apply: (p) => ({ ...p, baseAttack: p.baseAttack + 2 }),
  },
];

export function activeMetaPerks(unlocked: ReadonlySet<string>): MetaPerk[] {
  return META_PERKS.filter((perk) => unlocked.has(perk.achievementId));
}

/** Applies every perk the player has earned to a fresh run's starting player. */
export function applyMetaPerks(player: Player, unlocked: ReadonlySet<string>): Player {
  return activeMetaPerks(unlocked).reduce((current, perk) => perk.apply(current), player);
}

/** Reads unlocked achievement ids straight from storage (no service dependency). */
export function loadUnlockedAchievementIds(): Set<string> {
  try {
    const raw = localStorage.getItem(ACHIEVEMENT_STORAGE_KEY);
    const ids: unknown = raw ? JSON.parse(raw) : [];

    return new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}
