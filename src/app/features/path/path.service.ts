import { computed, Injectable, inject, signal } from '@angular/core';
import {
  RunEncounterService,
  MerchantOffer,
} from '../encounters/run-encounter.service';
import { GameState } from '../game-state/game-state.service';
import { blessingLabel, mergeBlessing, spendBlessing } from '../game-state/run-blessings';
import { Player, RouteHistoryType } from '../inventory/player.model';
import { Inventory } from '../inventory/inventory.service';
import {
  randomMissingRelic,
  relicRiposteStart,
  relicPrepFocusBonus,
  relicRestHealBonus,
  RUN_RELICS,
} from '../inventory/relics';
import { MiniGameService, MiniGameType } from '../minigames/mini-game.service';
import { routeSynergyBonus } from './path-advisor';
import { PathBranch, PathSegment, type PathWeather } from './path-segment.model';
import { createEnemy } from './enemy-blueprints';
import { EventApi, EventInfo, pickEvent } from './event-library';
import {
  adaptSegmentToPlayerState,
  createPathSegment,
  isBossPrepDepth,
  weatherForBranch,
} from './path-generator';
import {
  applyFortuneReward,
  createMerchantOffers,
  randomBlessing,
  resolveEventOutcome,
  routeResultLabel,
  shardChanceForLuck,
} from './path-rewards';

export { hydrateEnemyVisuals } from './enemy-blueprints';
export { hydratePathVisuals, adaptSegmentToPlayerState } from './path-generator';

export type { PathWeather };

@Injectable({
  providedIn: 'root',
})
export class Path {
  private readonly gameState = inject(GameState);
  private readonly encounters = inject(RunEncounterService);
  private readonly inventory = inject(Inventory);
  private readonly miniGameService = inject(MiniGameService);

  readonly segments = signal<PathSegment[]>([createPathSegment(0, 1), createPathSegment(1, 1)]);
  readonly currentDepth = signal(0);
  readonly weather = signal<PathWeather>('clear');

  readonly currentSegment = computed(() => this.segments()[this.currentDepth()] ?? null);
  readonly visibleSegments = computed(() => {
    const segments = this.segments();
    const windowSize = 5;
    const start = Math.min(
      Math.max(0, this.currentDepth() - 1),
      Math.max(0, segments.length - (windowSize + 1)),
    );

    return segments.slice(start, start + windowSize).map((segment, offset) => ({
      index: start + offset,
      segment,
    }));
  });

  setWeather(weather: PathWeather): void {
    this.weather.set(weather);
  }

  chooseBranch(branch: PathBranch): void {
    if (
      !this.gameState.gameActive() ||
      branch.completed ||
      branch.locked ||
      this.gameState.enemy()
    ) {
      return;
    }

    this.gameState.selectedBranchId.set(branch.id);
    this.lockBranchChoice(branch.id);
    this.weather.set(branch.weatherPreview ?? weatherForBranch(branch.type));
    this.applyBranchModifier(branch);

    if (branch.type === 'fight' || branch.type === 'boss') {
      const enemy = createEnemy(
        branch.enemyId ?? 'slime',
        this.gameState.player().level,
        branch.type === 'boss',
        branch.threat,
        this.gameState.player().newGamePlus ?? 0,
      );
      this.gameState.setEnemy(enemy);
      const riposteStart = relicRiposteStart(this.gameState.player());
      if (riposteStart > 0) {
        this.gameState.updatePlayer((player) => ({
          ...player,
          riposteCharges: Math.min(3, player.riposteCharges + riposteStart),
        }));
      }
      this.gameState.addLog(
        `${branch.name}: ${enemy.name} stellt sich dir in den Weg.${branch.eliteRoute ? ' Elite-Beute und Relic-Chance steigen.' : ''}`,
        branch.eliteRoute ? 'achievement' : 'event',
      );
      return;
    }

    if (branch.type === 'treasure') {
      const reward = branch.reward ?? { gold: 35, potions: 0 };
      const routeLuck = this.gameState.playerLuck();
      const luckyGold = Math.floor(routeLuck * 1.5);
      const shardBonus =
        Math.random() < shardChanceForLuck(routeLuck, 0.08)
          ? routeLuck >= 12 && Math.random() > 0.65
            ? 2
            : 1
          : 0;
      let fortuneUsed = false;
      let bonusGold = 0;
      let bonusPotion = 0;
      this.gameState.updatePlayer((player) => ({
        ...player,
        ...applyFortuneReward(
          player,
          reward.gold + luckyGold,
          reward.potions,
          1,
          (used, gold, potions) => {
            fortuneUsed = used;
            bonusGold = gold;
            bonusPotion = potions;
          },
        ),
      }));
      if (shardBonus > 0) {
        this.gameState.addDragonShards(shardBonus, branch.name);
      }
      this.gameState.addLog(
        `Schatz geborgen: +${reward.gold + luckyGold + bonusGold} Gold${
          reward.potions + bonusPotion ? `, +${reward.potions + bonusPotion} Trank` : ''
        }${shardBonus ? `, +${shardBonus} Shard${shardBonus === 1 ? '' : 's'}` : ''}${fortuneUsed ? ' durch Glueckssegen veredelt.' : '.'}`,
        'heal',
      );
      if (branch.guaranteedRelicId || (branch.name === 'Reliktkammer' && Math.random() > 0.72)) {
        this.grantRouteRelic(branch, 'Reliktkammer');
      }
      this.completeSelectedBranch();
      return;
    }

    if (branch.type === 'rest') {
      const routeLuck = this.gameState.playerLuck();
      const potionFound = Math.random() > Math.max(0.42, 0.7 - routeLuck * 0.02) ? 1 : 0;
      const grantedBlessing =
        Math.random() > Math.max(0.28, 0.58 - routeLuck * 0.02)
          ? randomBlessing(['focus', 'vigor'])
          : null;
      const rechargeTarget =
        [...this.gameState.player().activeBlessings].sort(
          (left, right) => left.charges - right.charges,
        )[0]?.type ?? null;
      const rechargedBlessing =
        rechargeTarget && Math.random() < shardChanceForLuck(routeLuck, 0.16)
          ? rechargeTarget
          : null;
      let vigorUsed = false;

      this.gameState.updatePlayer((player) => {
        const vigor = spendBlessing(player.activeBlessings, 'vigor');
        const blessings = rechargedBlessing
          ? mergeBlessing(vigor.blessings, rechargedBlessing, 1)
          : vigor.blessings;
        vigorUsed = vigor.consumed;

        return {
          ...player,
          activeBlessings: blessings,
          hp: Math.min(
            player.maxHp,
            player.hp +
              Math.floor(player.maxHp * 0.45) +
              relicRestHealBonus(player) +
              (vigor.consumed ? 16 : 0),
          ),
          mana: player.maxMana,
          skillCooldown: 0,
          potions: player.potions + potionFound,
          resolve: Math.min(player.maxResolve, player.resolve + (vigor.consumed ? 1 : 0)),
          statusEffect: null,
        };
      });
      this.gameState.addLog(
        `Lagerfeuer: HP erholt, Mana voll aufgefrischt${potionFound ? ' und ein Trank gefunden' : ''}${
          vigorUsed ? ' Lebenskern vertieft die Rast.' : ''
        }${rechargedBlessing ? ` ${blessingLabel(rechargedBlessing)} wird am Feuer aufgefrischt.` : ''}.`,
        'heal',
      );
      if (grantedBlessing) {
        this.gameState.grantBlessing(grantedBlessing.type, grantedBlessing.charges, 'Lagerfeuer');
      }
      this.completeSelectedBranch();
      return;
    }

    if (branch.type === 'minigame') {
      const types: MiniGameType[] = ['reaction', 'memory', 'precision', 'typing'];
      const type = types[Math.floor(Math.random() * types.length)];

      this.miniGameService.launch(type, (result) => {
        const routeLuck = this.gameState.playerLuck();
        const depthBonus = Math.floor(this.currentDepth() * 6);
        const gold = result.won
          ? 35 +
            depthBonus +
            Math.floor(result.score * 0.4) +
            Math.floor(routeLuck * 1.6) +
            Math.floor(Math.random() * 20)
          : 8 + Math.floor(routeLuck * 0.8) + Math.floor(Math.random() * 8);
        const mana = result.won ? 20 + Math.floor(Math.random() * 15) : 5;
        const potion = result.won && (result.score > 84 || routeLuck >= 10) ? 1 : 0;
        const shardBonus =
          result.won && result.score >= 90
            ? 2
            : result.won &&
                result.score >= 78 &&
                Math.random() < shardChanceForLuck(routeLuck, 0.12)
              ? 1
              : 0;
        const extra = result.won ? ` +${gold} Gold, +${mana} Mana.` : ` Trostpreis: +${gold} Gold.`;

        this.gameState.updatePlayer((player) => ({
          ...player,
          ...applyFortuneReward(player, gold, potion, 0, () => undefined),
          mana: Math.min(player.maxMana, player.mana + mana),
          miniGamesWon: player.miniGamesWon + (result.won ? 1 : 0),
        }));
        if (result.won && result.score >= 86) {
          const blessing = randomBlessing(
            result.score > 94 ? ['battle', 'focus'] : ['focus', 'fortune'],
          );
          this.gameState.grantBlessing(blessing.type, blessing.charges, branch.name);
        }
        if (shardBonus > 0) {
          this.gameState.addDragonShards(shardBonus, branch.name);
        }
        this.gameState.addLog(
          result.won
            ? `${branch.name} gemeistert!${extra}${potion ? ' Bonus: +1 Trank.' : ''}${shardBonus ? ` +${shardBonus} Shard${shardBonus === 1 ? '' : 's'}.` : ''}`
            : `${branch.name} misslungen.${extra}`,
          result.won ? 'achievement' : 'event',
        );
        this.completeSelectedBranch();
      });
      return;
    }

    if (branch.type === 'merchant') {
      const offers = createMerchantOffers(this.gameState.player(), branch.name);
      this.encounters.launchMerchant(
        branch.name,
        'Waehle genau ein Angebot fuer den naechsten Boss- oder Ressourcenplan.',
        offers,
        this.gameState.player().gold,
        (offer) => {
          if (!offer) {
            this.gameState.addLog(`${branch.name}: Du ziehst ohne Handel weiter.`, 'event');
            this.completeSelectedBranch();
            return;
          }

          this.applyMerchantOffer(branch.name, offer);
          this.completeSelectedBranch();
        },
      );
      return;
    }

    if (branch.type === 'forge') {
      const source = 'Schmiede';
      const p0 = this.gameState.player();
      const hasWeapon = !!p0.equippedWeapon;
      const hasArmor = !!p0.equippedArmor;
      const canTransmute = p0.gold >= 60;

      this.encounters.launchDilemma({
        source,
        subtitle: 'Der Schmied bietet dir drei Handwerke an.',
        flavor: 'Funken sprühen über den Amboss. Wähle, was du schmieden willst.',
        icon: '🔨',
        choices: [
          {
            id: 'upgrade',
            title: 'Ausrüstung schärfen',
            description: 'Verstärke Waffe und Rüstung dauerhaft.',
            tone: 'reward',
            rewardLabel: hasWeapon || hasArmor ? '+4 ATK, +4 DEF' : '+3 ATK, +3 DEF',
          },
          {
            id: 'transmute',
            title: 'Gold zu Splittern',
            description: 'Schmelze 60 Gold zu 3 Dragon Shards ein.',
            tone: 'risk',
            riskLabel: '−60 Gold',
            rewardLabel: '+3 Dragon Shards',
            disabled: !canTransmute,
          },
          {
            id: 'synthesis',
            title: 'Runen-Synthese',
            description: 'Feine Klingenschärfe für kritische Treffer.',
            tone: 'reward',
            rewardLabel: '+6% Krit, +18 Mana',
          },
        ],
        onResolve: (choiceId) => {
          if (choiceId === 'transmute' && canTransmute) {
            this.gameState.updatePlayer((p) => ({ ...p, gold: p.gold - 60 }));
            this.gameState.addDragonShards(3, source);
            this.gameState.addLog(
              `${source}: 60 Gold zu 3 Dragon Shards transmutiert.`,
              'achievement',
            );
          } else if (choiceId === 'synthesis') {
            this.gameState.updatePlayer((p) => ({
              ...p,
              critBonus: p.critBonus + 6,
              mana: Math.min(p.maxMana, p.mana + 18),
            }));
            this.gameState.addLog(`${source}: Runen-Synthese — +6% Krit, +18 Mana.`, 'achievement');
          } else {
            const atk = hasWeapon ? 4 : 3;
            const def = hasArmor ? 4 : 3;
            this.gameState.updatePlayer((p) => ({
              ...p,
              attackBonus: p.attackBonus + atk,
              defenseBonus: p.defenseBonus + def,
            }));
            this.gameState.addLog(
              `${source}: Ausrüstung geschärft — +${atk} ATK, +${def} DEF.`,
              'achievement',
            );
          }
          this.gameState.addDragonShards(1, branch.name);
          this.completeSelectedBranch();
        },
      });
      return;
    }

    if (branch.type === 'sanctuary') {
      const blessing = randomBlessing(['ward', 'focus', 'vigor']);

      this.gameState.updatePlayer((player) => ({
        ...player,
        hp: Math.min(player.maxHp, player.hp + 18 + Math.floor(player.maxHp * 0.12)),
        mana: Math.min(player.maxMana, player.mana + 20),
        resolve: Math.min(player.maxResolve, player.resolve + 1),
        statusEffect: null,
      }));
      this.gameState.addLog(
        'Sanktuarium: Du reinigst den Lauf und fuellst Resolve wieder auf.',
        'heal',
      );
      this.gameState.grantBlessing(
        blessing.type,
        blessing.charges + relicPrepFocusBonus(this.gameState.player()),
        branch.name,
      );
      this.gameState.addDragonShards(2, branch.name);
      this.completeSelectedBranch();
      return;
    }

    // Event nodes are now interactive risk/reward dilemmas.
    this.launchEventDilemma(branch);
  }

  /** Standard (low-variance) event outcome — used when the player declines the gamble. */
  private applyOmenOutcome(branch: PathBranch): void {
    const outcome = resolveEventOutcome(this.currentDepth(), this.gameState.playerLuck());
    let fortuneUsed = false;
    let bonusGold = 0;
    let bonusPotion = 0;
    let vigorUsed = false;

    this.gameState.updatePlayer((player) => {
      const vigor =
        outcome.hp > 0
          ? spendBlessing(player.activeBlessings, 'vigor')
          : { blessings: player.activeBlessings, consumed: false };
      vigorUsed = vigor.consumed;
      const fortuneState = applyFortuneReward(
        { ...player, activeBlessings: vigor.blessings },
        outcome.gold,
        outcome.potions,
        0,
        (used, gold, potions) => {
          fortuneUsed = used;
          bonusGold = gold;
          bonusPotion = potions;
        },
      );

      return {
        ...player,
        ...fortuneState,
        mana: Math.min(player.maxMana, player.mana + outcome.mana),
        hp: Math.min(player.maxHp, player.hp + outcome.hp + (vigor.consumed ? 14 : 0)),
        resolve: Math.min(player.maxResolve, player.resolve + (vigor.consumed ? 1 : 0)),
      };
    });
    this.gameState.addLog(outcome.message, outcome.type);
    if (fortuneUsed) {
      this.gameState.addLog(
        `Glueckssegen verstaerkt das Ereignis um +${bonusGold} Gold${bonusPotion ? ` und +${bonusPotion} Trank` : ''}.`,
        'achievement',
      );
    }
    if (vigorUsed) {
      this.gameState.addLog('Lebenskern nutzt das Ereignis fuer zusaetzliche Erholung.', 'heal');
    }
    if (outcome.blessing) {
      this.gameState.grantBlessing(outcome.blessing.type, outcome.blessing.charges, 'Runenschrein');
    }
    if (outcome.shards) {
      this.gameState.addDragonShards(outcome.shards, branch.name);
    }
    if (outcome.relic) {
      this.grantRouteRelic({ ...branch, guaranteedRelicId: outcome.relic.id }, 'Runenschrein');
    }
  }

  /**
   * Risk/reward map mechanic: event nodes present a themed dilemma with a
   * high-variance "risk" choice, a steady "reward" choice, and a safe decline
   * (which falls back to the standard omen outcome). Effects reuse the existing
   * reward/blessing/relic helpers so balance stays consistent with the rest of
   * the run economy.
   */
  private launchEventDilemma(branch: PathBranch): void {
    const depth = this.currentDepth();
    const luck = this.gameState.playerLuck();
    const event = pickEvent(branch.biome, depth);
    const info: EventInfo = {
      depth,
      luck,
      goldBase: 30 + depth * 6 + Math.floor(luck * 1.4),
      player: this.gameState.player(),
      odds: (base, cap) => Math.min(cap, base + Math.floor(luck * 0.9)),
    };
    const choices = event.choices(info);
    const api = this.createEventApi(branch, event.source);

    this.encounters.launchDilemma({
      source: event.source,
      subtitle: '',
      flavor: event.flavor,
      icon: event.icon,
      biome: branch.biome ?? 'ruin',
      choices,
      onResolve: (choiceId) => {
        const choice = choices.find((entry) => entry.id === choiceId);

        if (choice) {
          choice.apply(api);
        } else {
          this.gameState.addLog(`${event.source}: Du ziehst vorsichtig weiter.`, 'event');
          this.applyOmenOutcome(branch);
        }
        this.completeSelectedBranch();
      },
    });
  }

  /** Bridges event-library effects onto the live game state. */
  private createEventApi(branch: PathBranch, source: string): EventApi {
    const update = (change: (player: Player) => Player) => this.gameState.updatePlayer(change);

    return {
      hurt: (fraction) =>
        update((p) => ({ ...p, hp: Math.max(1, p.hp - Math.floor(p.maxHp * fraction)) })),
      heal: (fraction) =>
        update((p) => ({ ...p, hp: Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * fraction)) })),
      mana: (amount) =>
        update((p) => ({ ...p, mana: Math.max(0, Math.min(p.maxMana, p.mana + amount)) })),
      gold: (amount) => update((p) => ({ ...p, gold: Math.max(0, p.gold + amount) })),
      potions: (amount) => update((p) => ({ ...p, potions: Math.max(0, p.potions + amount) })),
      shards: (amount) => this.gameState.addDragonShards(amount, source),
      resolve: (amount) =>
        update((p) => ({ ...p, resolve: Math.max(0, Math.min(p.maxResolve, p.resolve + amount)) })),
      permanent: (stat, amount) =>
        update((p) => {
          const next = { ...p, [stat]: p[stat] + amount };

          if (stat === 'maxHp') next.hp = p.hp + amount;
          if (stat === 'maxMana') next.mana = p.mana + amount;
          if (stat === 'maxResolve') next.resolve = p.resolve + amount;

          return next;
        }),
      blessing: (pool) => {
        const blessing = randomBlessing(pool);
        this.gameState.grantBlessing(blessing.type, blessing.charges, source);

        return blessingLabel(blessing.type);
      },
      fixedBlessing: (type, charges) => this.gameState.grantBlessing(type, charges, source),
      relic: () => this.grantRouteRelic({ ...branch, guaranteedRelicId: undefined }, source),
      cleanse: () => update((p) => ({ ...p, statusEffect: null })),
      afflict: (effect) =>
        update((p) => ({ ...p, statusEffect: p.statusEffect ?? effect })),
      gamble: (chance) => Math.random() * 100 < chance,
      log: (message, tone = 'event') =>
        this.gameState.addLog(`${source}: ${message}`, tone === 'normal' ? 'normal' : tone),
    };
  }

  completeSelectedBranch(): void {
    const selectedBranchId = this.gameState.selectedBranchId();

    if (!selectedBranchId) {
      return;
    }

    const selectedBranch =
      this.currentSegment()?.branches.find((branch) => branch.id === selectedBranchId) ?? null;
    const synergyBonus = routeSynergyBonus(this.gameState.player(), selectedBranch);

    this.segments.update((segments) =>
      segments.map((segment, index) => {
        if (index !== this.currentDepth()) {
          return segment;
        }

        const branches = segment.branches.map((branch) =>
          branch.id === selectedBranchId ? { ...branch, completed: true } : branch,
        );

        return {
          ...segment,
          branches,
          cleared: branches.some((branch) => branch.id === selectedBranchId && branch.completed),
        };
      }),
    );

    this.gameState.updatePlayer((player) => {
      const nextStreak = player.routeStreak + 1;
      const streakBonus = nextStreak > 0 && nextStreak % 3 === 0;
      const safeCatchUp =
        !!selectedBranch &&
        selectedBranch.type !== 'fight' &&
        selectedBranch.type !== 'boss' &&
        player.hp / player.maxHp < 0.35;

      return {
        ...player,
        completedPaths: player.completedPaths + 1,
        routeStreak: nextStreak,
        hp: safeCatchUp
          ? Math.min(player.maxHp, player.hp + 18 + Math.max(0, selectedBranch.threat) * 2)
          : player.hp,
        potions: safeCatchUp && player.potions === 0 ? 1 : player.potions,
        mana:
          streakBonus || selectedBranch?.eliteRoute
            ? Math.min(
                player.maxMana,
                player.mana +
                  (streakBonus ? 12 : 0) +
                  (selectedBranch?.eliteRoute ? 10 : 0) +
                  synergyBonus.mana,
              )
            : synergyBonus.active
              ? Math.min(player.maxMana, player.mana + synergyBonus.mana)
              : player.mana,
        gold:
          player.gold +
          (streakBonus ? 18 + Math.max(0, selectedBranch?.threat ?? 0) * 4 : 0) +
          (selectedBranch?.eliteRoute ? 26 : 0) +
          synergyBonus.gold,
        dragonShards:
          player.dragonShards + (selectedBranch?.eliteRoute ? 2 : 0) + synergyBonus.dragonShards,
        resolve: Math.min(player.maxResolve, player.resolve + (selectedBranch?.eliteRoute ? 1 : 0)),
      };
    });

    if (this.gameState.player().routeStreak % 3 === 0) {
      this.gameState.addLog(
        'Routenserie! +Mana und Bonusgold fur saubere Entscheidungen.',
        'achievement',
      );
    }

    if (synergyBonus.active) {
      this.gameState.addLog(
        `Routen-Synergy: drei verschiedene Entscheidungen in Folge. +${synergyBonus.gold} Gold, +${synergyBonus.mana} Mana, +${synergyBonus.dragonShards} Shard${synergyBonus.dragonShards === 1 ? '' : 's'}.`,
        'achievement',
      );
    }

    const playerAfterCompletion = this.gameState.player();
    if (
      selectedBranch?.type !== 'fight' &&
      selectedBranch?.type !== 'boss' &&
      playerAfterCompletion.hp / playerAfterCompletion.maxHp < 0.55
    ) {
      this.gameState.addLog('Sichere Route stabilisiert den Lauf mit etwas Erholung.', 'heal');
    }

    if (
      selectedBranch?.type === 'sanctuary' ||
      selectedBranch?.type === 'merchant' ||
      selectedBranch?.type === 'forge'
    ) {
      this.gameState.addLog('Spezialroute verarbeitet: der Run bekommt neue Werkzeuge.', 'event');
    }

    if (selectedBranch?.eliteRoute) {
      this.gameState.addLog(
        'Elite-Pfad gemeistert: Bonusgold, Manafenster, Resolve und Dragon Shards sichern das Boss-Tempo.',
        'achievement',
      );
    }

    if (selectedBranch) {
      this.gameState.recordRouteHistory({
        depth: this.currentDepth() + 1,
        label: selectedBranch.name,
        result: routeResultLabel(selectedBranch),
        type: selectedBranch.type as RouteHistoryType,
      });
    }

    this.gameState.advanceContract('pathfinder');
    if (this.gameState.playerHpPercent() >= 70) {
      this.gameState.advanceContract('conserver');
    }

    this.gameState.selectedBranchId.set(null);
    this.advance();
  }

  reset(): void {
    this.segments.set([createPathSegment(0, 1), this.createAdaptivePathSegment(1)]);
    this.currentDepth.set(0);
    this.weather.set('clear');
  }

  restore(snapshot: PathSnapshot): void {
    this.segments.set(snapshot.segments);
    this.currentDepth.set(snapshot.currentDepth);
  }

  private advance(): void {
    const nextDepth = this.currentDepth() + 1;

    this.currentDepth.set(nextDepth);

    if (isBossPrepDepth(nextDepth)) {
      this.gameState.addLog(
        'Bossvorbereitung: Vor dir liegen Elite-Jagd, Schmiede, Haendler und Sanktuarium.',
        'achievement',
      );
    }

    if (nextDepth >= this.segments().length - 1) {
      this.segments.update((segments) => [
        ...segments,
        this.createAdaptivePathSegment(segments.length),
      ]);
    }
  }

  private createAdaptivePathSegment(depth: number): PathSegment {
    return adaptSegmentToPlayerState(
      createPathSegment(depth, this.gameState.player().level),
      this.gameState.player(),
      this.gameState.bossPrepScore(),
    );
  }

  private lockBranchChoice(branchId: string): void {
    this.segments.update((segments) =>
      segments.map((segment, index) => {
        if (index !== this.currentDepth()) {
          return segment;
        }

        return {
          ...segment,
          branches: segment.branches.map((branch) => ({
            ...branch,
            locked: branch.id !== branchId,
          })),
        };
      }),
    );
  }

  private applyBranchModifier(branch: PathBranch): void {
    if (!branch.modifier || branch.completed || !this.gameState.gameActive()) {
      return;
    }

    if (branch.modifier === 'ambush') {
      this.gameState.updatePlayer((player) => ({
        ...player,
        hp: Math.max(1, player.hp - Math.max(4, 5 + branch.threat * 2)),
      }));
      this.gameState.addLog(
        'Hinterhalt: Du startest angeschlagen, aber die Belohnung steigt.',
        'damage',
      );
      return;
    }

    if (branch.modifier === 'blessing') {
      this.gameState.updatePlayer((player) => ({
        ...player,
        hp: Math.min(player.maxHp, player.hp + 12),
        mana: Math.min(player.maxMana, player.mana + 16),
      }));
      this.gameState.addLog('Segen: HP und Mana stabilisieren sich vor der Etappe.', 'heal');
      return;
    }

    if (branch.modifier === 'cache') {
      this.gameState.updatePlayer((player) => ({
        ...player,
        gold: player.gold + 20 + branch.threat * 5,
      }));
      this.gameState.addLog('Vorratsfund: Bonusgold direkt vor der Entscheidung.', 'event');
      return;
    }

    if (branch.modifier === 'curse') {
      this.gameState.updatePlayer((player) => ({
        ...player,
        statusEffect: player.statusEffect ?? { type: 'poison', rounds: 2, damagePerRound: 4 },
      }));
      this.gameState.addLog('Fluchroute: Ein kurzer Giftfluch liegt auf dem Weg.', 'damage');
      return;
    }

    this.gameState.updatePlayer((player) => ({
      ...player,
      skillCooldown: Math.max(0, player.skillCooldown - 1),
      mana: Math.min(player.maxMana, player.mana + 8),
    }));
    this.gameState.addLog('Fokusroute: Drachenklaue und Mana kommen schneller online.', 'event');
  }

  private applyMerchantOffer(source: string, offer: MerchantOffer): void {
    const player = this.gameState.player();

    if (offer.cost > player.gold) {
      this.gameState.addLog(
        `${source}: Das Angebot waere stark gewesen, aber dir fehlt Gold.`,
        'damage',
      );
      return;
    }

    this.gameState.updatePlayer((current) => ({
      ...current,
      gold: current.gold - offer.cost,
      hp: Math.min(current.maxHp, current.hp + (offer.hp ?? 0)),
      mana: Math.min(current.maxMana, current.mana + (offer.mana ?? 0)),
      potions: current.potions + (offer.potions ?? 0),
      attackBonus: current.attackBonus + (offer.attackBonus ?? 0),
      defenseBonus: current.defenseBonus + (offer.defenseBonus ?? 0),
      skillCooldown: Math.max(0, current.skillCooldown - (offer.cooldown ?? 0)),
      statusEffect: offer.cleanse ? null : current.statusEffect,
    }));

    if (offer.blessing) {
      this.gameState.grantBlessing(offer.blessing.type, offer.blessing.charges, source);
    }
    if (offer.relic) {
      this.inventory.grantRelic(offer.relic, source);
    }

    this.gameState.addLog(
      `${source}: ${offer.title}. ${offer.rewardLabel}.`,
      offer.cost > 0 ? 'event' : 'heal',
    );
  }

  private grantRouteRelic(branch: PathBranch, source: string): void {
    const player = this.gameState.player();
    const relic = branch.guaranteedRelicId
      ? (RUN_RELICS.find((entry) => entry.id === branch.guaranteedRelicId) ??
        randomMissingRelic(player, branch.biome) ??
        RUN_RELICS[Math.floor(Math.random() * RUN_RELICS.length)] ??
        null)
      : (randomMissingRelic(player, branch.biome) ??
        RUN_RELICS[Math.floor(Math.random() * RUN_RELICS.length)] ??
        null);

    if (!relic) {
      return;
    }

    this.inventory.grantRelic(relic, source);
  }
}

export interface PathSnapshot {
  segments: PathSegment[];
  currentDepth: number;
}

export interface PathSnapshot {
  segments: PathSegment[];
  currentDepth: number;
}
