import { MerchantOffer } from '../encounters/run-encounter.service';
import { spendBlessing } from '../game-state/run-blessings';
import { Player, RunBlessingType } from '../inventory/player.model';
import { RelicId } from '../inventory/relic.model';
import { randomMissingRelic, relicGoldBonus, RUN_RELICS } from '../inventory/relics';
import { PathBranch } from './path-segment.model';

export function resolveEventOutcome(
  depth: number,
  luck: number,
): {
  gold: number;
  hp: number;
  mana: number;
  message: string;
  potions: number;
  shards?: number;
  blessing?: { type: RunBlessingType; charges: number };
  relic?: { id: RelicId };
  type: 'event' | 'heal';
} {
  const scaledGold = 18 + depth * 8 + Math.floor(luck * 1.4) + Math.floor(Math.random() * 18);
  const shardReward = Math.random() < shardChanceForLuck(luck, 0.1) ? 1 : 0;
  const roll = Math.random();

  if (roll > 0.78) {
    return {
      gold: scaledGold + 10,
      hp: 0,
      mana: 24,
      message: `Runenschrein aktiviert: +${scaledGold + 10} Gold und +24 Mana.`,
      potions: 0,
      shards: shardReward,
      type: 'event',
    };
  }

  if (roll > 0.56) {
    return {
      gold: Math.floor(scaledGold * 0.5),
      hp: 20 + depth * 3,
      mana: 14,
      message: 'Wanderaltar gefunden: Du sammelst Gold und stabilisierst deine Reserven.',
      potions: 0,
      shards: shardReward > 0 && Math.random() > 0.45 ? shardReward : 0,
      type: 'heal',
    };
  }

  if (roll > 0.28) {
    const blessing = randomBlessing(['fortune', 'focus', 'vigor']);
    const relic =
      depth > 3 && Math.random() > 0.72
        ? (RUN_RELICS[Math.floor(Math.random() * RUN_RELICS.length)] ?? null)
        : null;

    return {
      gold: Math.floor(scaledGold * 0.65),
      hp: 10 + depth * 2,
      mana: 10,
      message: `Runenschrift gelesen: etwas Beute und ein neuer Segen begleiten dich${relic ? ', dazu flackert ein Relic auf' : ''}.`,
      potions: 0,
      shards: shardReward > 0 && Math.random() > 0.35 ? shardReward : 0,
      blessing,
      relic: relic ? { id: relic.id } : undefined,
      type: 'heal',
    };
  }

  return {
    gold: scaledGold,
    hp: 0,
    mana: 8,
    message: `Verlassene Vorratskiste: +${scaledGold} Gold, +8 Mana und +1 Trank.`,
    potions: 1,
    shards: shardReward,
    type: 'event',
  };
}

export function randomBlessing(pool: RunBlessingType[]): {
  type: RunBlessingType;
  charges: number;
} {
  const type = pool[Math.floor(Math.random() * pool.length)] ?? pool[0] ?? 'focus';
  const charges = type === 'ward' ? 2 : Math.random() > 0.7 ? 3 : 2;

  return { type, charges };
}

export function applyFortuneReward(
  player: Player,
  gold: number,
  potions: number,
  extraPotionOnFortune: number,
  onApplied: (used: boolean, goldBonus: number, potionBonus: number) => void,
): Pick<Player, 'activeBlessings' | 'gold' | 'potions'> {
  const fortune = spendBlessing(player.activeBlessings, 'fortune');
  const goldBonus =
    (fortune.consumed ? 25 + effectivePlayerLuck(player) * 2 : 0) + relicGoldBonus(player);
  const potionBonus = fortune.consumed ? extraPotionOnFortune : 0;

  onApplied(fortune.consumed, goldBonus, potionBonus);

  return {
    activeBlessings: fortune.blessings,
    gold: player.gold + gold + goldBonus,
    potions: player.potions + potions + potionBonus,
  };
}

export function effectivePlayerLuck(player: Player): number {
  return player.luck + (player.activePet?.bonusType === 'luck' ? player.activePet.bonusValue : 0);
}

export function shardChanceForLuck(luck: number, baseChance: number): number {
  return Math.min(0.48, baseChance + luck * 0.015);
}

export function createMerchantOffers(player: Player, source: string): MerchantOffer[] {
  const sustainOffer: MerchantOffer = player.statusEffect
    ? {
        id: `${source}-fieldmed`,
        title: 'Feldmedizin',
        description: 'Entfernt Status, heilt und legt eine frische Aegis auf den Run.',
        cost: 80,
        rewardLabel: '+22 HP, Cleanse, Ward',
        kind: 'sustain',
        blessing: { type: 'ward', charges: 2 },
        cleanse: true,
        hp: 22,
      }
    : {
        id: `${source}-rations`,
        title: 'Notfallration',
        description: 'Mehr Sicherheit fuer den naechsten Kampf oder Boss.',
        cost: 90,
        rewardLabel: '+2 Traenke, +18 HP',
        kind: 'sustain',
        hp: 18,
        potions: 2,
      };

  const tempoOffer: MerchantOffer =
    player.mana < player.maxMana * 0.45 || player.skillCooldown > 1
      ? {
          id: `${source}-focus`,
          title: 'Fokusvorrat',
          description: 'Zieht Drachenklaue und Manafenster sofort nach vorne.',
          cost: 70,
          rewardLabel: '+32 Mana, -2 Cooldown, Fokuslicht',
          kind: 'tempo',
          blessing: { type: 'focus', charges: 2 },
          cooldown: 2,
          mana: 32,
        }
      : {
          id: `${source}-sharpen`,
          title: 'Schaerfset',
          description: 'Ein kleiner, sofortiger Frontload fuer den Bosskampf.',
          cost: 110,
          rewardLabel: '+3 ATK, +2 DEF, Kampfrausch',
          kind: 'forge',
          attackBonus: 3,
          blessing: { type: 'battle', charges: 2 },
          defenseBonus: 2,
          mana: 10,
        };

  const relic = randomMissingRelic(player);
  const capstoneOffer: MerchantOffer = relic
    ? {
        id: `${source}-relic`,
        title: relic.name,
        description: `Seltenes Prep-Relic direkt vom Trosshaendler. ${relic.desc}`,
        cost: 140,
        rewardLabel: 'Seltenes Run-Relic',
        kind: 'relic',
        relic,
      }
    : {
        id: `${source}-luck`,
        title: 'Gluecksroute',
        description: 'Ein kleines Gratis-Paket fuer Runs, die schon gut aufgestellt sind.',
        cost: 0,
        rewardLabel: '+12 HP, +8 Mana, Glueckssegen',
        kind: 'blessing',
        blessing: { type: 'fortune', charges: 2 },
        hp: 12,
        mana: 8,
      };

  return [sustainOffer, tempoOffer, capstoneOffer];
}

export function routeResultLabel(branch: PathBranch): string {
  if (branch.eliteRoute) {
    return 'Elite-Prep';
  }

  switch (branch.type) {
    case 'fight':
      return 'Kampfroute';
    case 'treasure':
      return 'Beute';
    case 'event':
      return 'Ereignis';
    case 'rest':
      return 'Erholung';
    case 'minigame':
      return 'Skillcheck';
    case 'merchant':
      return 'Handel';
    case 'forge':
      return 'Werte';
    case 'sanctuary':
      return 'Segen';
    case 'boss':
      return 'Boss';
  }
}
