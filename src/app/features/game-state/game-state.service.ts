import { computed, Injectable, signal } from '@angular/core';
import { Enemy } from '../combat/enemy.model';
import {
  Player,
  RouteHistoryEntry,
  RunBlessingType,
  RunContract,
  RunContractType,
} from '../inventory/player.model';
import {
  relicAttackBonus,
  relicCritBonus,
  relicDefenseBonus,
  relicWardChargeBonus,
} from '../inventory/relics';
import { GameLogEntry, GameLogType } from '../log/game-log-entry.model';
import { blessingLabel, getBlessingCharges, mergeBlessing } from './run-blessings';

export type LevelUpChoiceId = 'attack' | 'defense' | 'crit' | 'mana' | 'heal';

export interface LevelUpChoice {
  id: LevelUpChoiceId;
  title: string;
  description: string;
}

@Injectable({
  providedIn: 'root',
})
export class GameState {
  readonly player = signal<Player>(createInitialPlayer());
  readonly enemy = signal<Enemy | null>(null);
  readonly gameActive = signal(true);
  readonly selectedBranchId = signal<string | null>(null);
  readonly levelUpChoices = signal<LevelUpChoice[]>([]);
  readonly logs = signal<GameLogEntry[]>([
    createLogEntry('Wähle einen Pfad und beginne deine Reise.', 'normal'),
  ]);

  readonly playerAttack = computed(() => {
    const player = this.player();
    return (
      player.baseAttack +
      player.attackBonus +
      (player.equippedWeapon?.attackBonus ?? 0) +
      petBonus(player, 'attack') +
      relicAttackBonus(player)
    );
  });

  readonly playerDefense = computed(() => {
    const player = this.player();
    return (
      player.baseDefense +
      player.defenseBonus +
      (player.equippedArmor?.defenseBonus ?? 0) +
      petBonus(player, 'defense') +
      relicDefenseBonus(player)
    );
  });

  readonly playerCritChance = computed(() => {
    const player = this.player();
    return (
      player.baseCrit +
      player.critBonus +
      (player.equippedRing?.critBonus ?? 0) +
      petBonus(player, 'crit') +
      relicCritBonus(player)
    );
  });

  readonly playerLuck = computed(() => this.player().luck + petBonus(this.player(), 'luck'));

  readonly xpForNextLevel = computed(() =>
    Math.floor(100 * Math.pow(1.2, this.player().level - 1)),
  );

  readonly playerXpPercent = computed(() => {
    const player = this.player();
    return Math.round((player.xp / this.xpForNextLevel()) * 100);
  });

  readonly playerHpPercent = computed(() => {
    const player = this.player();
    return Math.round((player.hp / player.maxHp) * 100);
  });

  readonly playerManaPercent = computed(() => {
    const player = this.player();
    return Math.round((player.mana / player.maxMana) * 100);
  });

  readonly enemyHpPercent = computed(() => {
    const enemy = this.enemy();
    return enemy ? Math.round((enemy.hp / enemy.maxHp) * 100) : 0;
  });

  readonly canUseSkill = computed(() => {
    const player = this.player();
    return (
      this.gameActive() &&
      !!this.enemy() &&
      player.hp > 0 &&
      player.mana >= 30 &&
      player.skillCooldown === 0
    );
  });

  readonly canHeal = computed(() => {
    const player = this.player();
    return this.gameActive() && player.hp > 0 && player.hp < player.maxHp && player.mana >= 20;
  });

  readonly canUsePotion = computed(() => {
    const player = this.player();
    return (
      this.gameActive() &&
      player.hp > 0 &&
      (player.hp < player.maxHp || !!player.statusEffect) &&
      player.potions > 0
    );
  });

  readonly canUseResolve = computed(() => {
    const player = this.player();
    return this.gameActive() && !!this.enemy() && player.hp > 0 && player.resolve > 0;
  });

  readonly contractProgressPercent = computed(() => {
    const contract = this.player().activeContract;
    return Math.min(100, Math.round((contract.progress / contract.target) * 100));
  });

  readonly activeBlessingCount = computed(() =>
    this.player().activeBlessings.reduce((sum, blessing) => sum + blessing.charges, 0),
  );

  readonly bossPrepScore = computed(() => {
    const player = this.player();
    const hpPrep = player.hp / player.maxHp >= 0.75 ? 12 : player.hp / player.maxHp >= 0.55 ? 7 : 0;
    const manaPrep =
      player.mana / player.maxMana >= 0.7 ? 10 : player.mana / player.maxMana >= 0.45 ? 5 : 0;
    const resolvePrep = player.resolve * 16;
    const potionPrep = Math.min(18, player.potions * 7);
    const relicPrep = Math.min(26, player.ownedRelics.length * 9);
    const blessingPrep = Math.min(20, this.activeBlessingCount() * 4);
    const shardPrep = Math.min(14, player.dragonShards * 2);
    const elitePrep = Math.min(12, player.eliteKills * 3);

    return Math.min(
      100,
      hpPrep +
        manaPrep +
        resolvePrep +
        potionPrep +
        relicPrep +
        blessingPrep +
        shardPrep +
        elitePrep,
    );
  });

  readonly bossPrepLabel = computed(() => {
    const score = this.bossPrepScore();

    if (score >= 80) return 'Boss bereit';
    if (score >= 60) return 'Sehr stabil';
    if (score >= 40) return 'Aufbauen';
    return 'Wacklig';
  });

  readonly dragonRank = computed(() => {
    const player = this.player();
    const score =
      player.level * 9 +
      player.completedPaths * 2 +
      player.ownedRelics.length * 10 +
      this.activeBlessingCount() * 3 +
      player.dragonShards * 2 +
      player.eliteKills * 4;

    if (score >= 120) return 'Mythisch';
    if (score >= 90) return 'Drakonisch';
    if (score >= 60) return 'Erprobt';
    if (score >= 35) return 'Wachsend';
    return 'Frisch';
  });

  readonly runGrade = computed(() => {
    const player = this.player();
    const score =
      (player.bossKilled ? 45 : 0) +
      Math.min(20, player.level * 2) +
      Math.min(15, player.completedPaths) +
      Math.min(10, player.eliteKills * 2) +
      Math.min(10, this.bossPrepScore() / 10) +
      Math.min(10, player.dragonShards);

    if (score >= 85) return 'S';
    if (score >= 70) return 'A';
    if (score >= 55) return 'B';
    if (score >= 40) return 'C';
    return 'D';
  });

  readonly runOutcome = computed(() => {
    const player = this.player();

    if (this.gameActive()) {
      return null;
    }

    return player.bossKilled ? 'victory' : 'defeat';
  });

  addLog(message: string, type: GameLogType = 'normal'): void {
    this.logs.update((entries) => [...entries.slice(-49), createLogEntry(message, type)]);
  }

  addDragonShards(amount: number, source?: string): void {
    if (amount <= 0) {
      return;
    }

    this.updatePlayer((player) => ({
      ...player,
      dragonShards: player.dragonShards + amount,
    }));
    this.addLog(`${source ? `${source}: ` : ''}+${amount} Dragon Shards.`, 'achievement');
  }

  blessingCharges(type: RunBlessingType): number {
    return getBlessingCharges(this.player().activeBlessings, type);
  }

  grantBlessing(type: RunBlessingType, charges = 1, source?: string): void {
    const totalCharges = charges + (type === 'ward' ? relicWardChargeBonus(this.player()) : 0);
    this.updatePlayer((player) => ({
      ...player,
      activeBlessings: mergeBlessing(player.activeBlessings, type, totalCharges),
    }));

    this.addLog(
      `${source ? `${source}: ` : ''}${blessingLabel(type)} aktiviert (${totalCharges} ${totalCharges === 1 ? 'Ladung' : 'Ladungen'}).`,
      'achievement',
    );
  }

  updatePlayer(update: (player: Player) => Player): void {
    this.player.update((player) => update({ ...player }));
  }

  recordRouteHistory(entry: RouteHistoryEntry): void {
    this.updatePlayer((player) => ({
      ...player,
      routeHistory: [entry, ...player.routeHistory].slice(0, 8),
    }));
  }

  updateEnemy(update: (enemy: Enemy) => Enemy): void {
    this.enemy.update((enemy) => (enemy ? update({ ...enemy }) : enemy));
  }

  setEnemy(enemy: Enemy | null): void {
    this.enemy.set(enemy ? { ...enemy, maxHp: enemy.maxHp || enemy.hp } : null);
  }

  advanceContract(type: RunContractType, amount = 1): void {
    const contract = this.player().activeContract;

    if (contract.completed || contract.type !== type) {
      return;
    }

    this.updatePlayer((player) => {
      const nextProgress = Math.min(
        player.activeContract.target,
        player.activeContract.progress + amount,
      );
      const completed = nextProgress >= player.activeContract.target;

      return {
        ...player,
        gold: completed ? player.gold + player.activeContract.rewardGold : player.gold,
        resolve: completed
          ? Math.min(player.maxResolve, player.resolve + player.activeContract.rewardResolve)
          : player.resolve,
        completedContracts: completed ? player.completedContracts + 1 : player.completedContracts,
        contractStreak: completed ? player.contractStreak + 1 : player.contractStreak,
        activeContract: {
          ...player.activeContract,
          progress: nextProgress,
          completed,
        },
      };
    });

    if (this.player().activeContract.completed) {
      this.addLog(
        `Auftrag abgeschlossen: ${contract.title}. +${contract.rewardGold} Gold, +${contract.rewardResolve} Resolve.`,
        'achievement',
      );
    }
  }

  acceptNextContract(): void {
    const player = this.player();

    if (!player.activeContract.completed || !this.gameActive()) {
      this.addLog('Der aktuelle Auftrag ist noch offen.', 'event');
      return;
    }

    const nextContract = createRunContract(player.completedContracts, player.activeContract.type);
    this.updatePlayer((current) => ({
      ...current,
      activeContract: nextContract,
    }));
    this.addLog(`Neuer Auftrag angenommen: ${nextContract.title}.`, 'event');
  }

  reset(): void {
    this.player.set(createInitialPlayer());
    this.enemy.set(null);
    this.gameActive.set(true);
    this.selectedBranchId.set(null);
    this.levelUpChoices.set([]);
    this.logs.set([
      createLogEntry('Neues Abenteuer gestartet. Wahle deinen ersten Pfad.', 'event'),
    ]);
  }

  restore(
    snapshot: Pick<
      GameStateSnapshot,
      'enemy' | 'gameActive' | 'levelUpChoices' | 'logs' | 'player' | 'selectedBranchId'
    >,
  ): void {
    this.player.set(snapshot.player);
    this.enemy.set(snapshot.enemy);
    this.gameActive.set(snapshot.gameActive);
    this.selectedBranchId.set(snapshot.selectedBranchId);
    this.levelUpChoices.set(snapshot.levelUpChoices);
    this.logs.set(
      snapshot.logs.map((entry) => ({ ...entry, createdAt: new Date(entry.createdAt) })),
    );
  }
}

export interface GameStateSnapshot {
  player: Player;
  enemy: Enemy | null;
  gameActive: boolean;
  selectedBranchId: string | null;
  levelUpChoices: LevelUpChoice[];
  logs: GameLogEntry[];
}

function createInitialPlayer(): Player {
  return {
    level: 1,
    xp: 0,
    activeBlessings: [],
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
    activeContract: createInitialContract(),
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
    skillCooldown: 0,
    totalKills: 0,
    eliteKills: 0,
    perfectGuards: 0,
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
    comboFever: false,
    statusEffect: null,
  };
}

export function createInitialContract(): RunContract {
  return createRunContract(0);
}

export function createRunContract(
  completedContracts: number,
  avoidType?: RunContractType,
): RunContract {
  const tier = Math.floor(completedContracts / 2);
  const contracts: RunContract[] = [
    {
      type: 'slayer',
      title: 'Kopfgeld',
      description: 'Besiege 3 Gegner in diesem Run.',
      progress: 0,
      target: 3 + Math.min(2, tier),
      rewardGold: 90 + tier * 20,
      rewardResolve: 1,
      completed: false,
    },
    {
      type: 'pathfinder',
      title: 'Kartograph',
      description: 'Schliesse 4 Pfadentscheidungen ab.',
      progress: 0,
      target: 4 + Math.min(2, tier),
      rewardGold: 70 + tier * 18,
      rewardResolve: 1,
      completed: false,
    },
    {
      type: 'conserver',
      title: 'Disziplin',
      description: 'Schliesse 3 Etappen mit mindestens 70% HP ab.',
      progress: 0,
      target: 3 + Math.min(2, tier),
      rewardGold: 80 + tier * 18,
      rewardResolve: 1,
      completed: false,
    },
  ];
  const options = avoidType
    ? contracts.filter((contract) => contract.type !== avoidType)
    : contracts;

  return { ...(options[Math.floor(Math.random() * options.length)] ?? contracts[0]) };
}

export function createLevelUpChoices(excludedIds: LevelUpChoiceId[] = []): LevelUpChoice[] {
  const excluded = new Set(excludedIds);
  const choices: LevelUpChoice[] = [
    { id: 'attack', title: 'Klinge scharfen', description: '+4 Angriff' },
    { id: 'defense', title: 'Deckung halten', description: '+3 Verteidigung' },
    { id: 'crit', title: 'Schwachpunkt', description: '+5% Krit' },
    { id: 'mana', title: 'Manafluss', description: '+12 Max-Mana' },
    { id: 'heal', title: 'Zweiter Atem', description: 'Voll heilen' },
  ];
  const filtered = choices.filter((choice) => !excluded.has(choice.id));
  const pool = filtered.length >= 3 ? filtered : choices;

  return pool.sort(() => Math.random() - 0.5).slice(0, 3);
}

function petBonus(
  player: Player,
  bonusType: NonNullable<Player['activePet']>['bonusType'],
): number {
  return player.activePet?.bonusType === bonusType ? player.activePet.bonusValue : 0;
}

function createLogEntry(message: string, type: GameLogType): GameLogEntry {
  return {
    id: crypto.randomUUID(),
    message,
    type,
    createdAt: new Date(),
  };
}
