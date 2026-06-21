import { computed, Injectable, inject, signal } from '@angular/core';
import { assets } from '../assets/asset-catalog';
import { roleLootMultiplier } from '../combat/combat-rules';
import { Enemy, EnemyElement, EnemyRole } from '../combat/enemy.model';
import {
  RunEncounterService,
  MerchantOffer,
  DilemmaChoice,
} from '../encounters/run-encounter.service';
import { GameState } from '../game-state/game-state.service';
import { blessingLabel, mergeBlessing, spendBlessing } from '../game-state/run-blessings';
import { Player, RouteHistoryType, RunBlessingType } from '../inventory/player.model';
import { Inventory } from '../inventory/inventory.service';
import { RelicId } from '../inventory/relic.model';
import {
  randomMissingRelic,
  relicGoldBonus,
  relicPrepFocusBonus,
  relicRestHealBonus,
  RUN_RELICS,
} from '../inventory/relics';
import { MiniGameService, MiniGameType } from '../minigames/mini-game.service';
import { routeSynergyBonus } from './path-advisor';
import { PathBranch, PathBranchModifier, PathSegment, type PathBiome } from './path-segment.model';

export type PathWeather = 'clear' | 'rain' | 'fog' | 'snow' | 'ash' | 'storm' | 'glow';

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
      );
      this.gameState.setEnemy(enemy);
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
      const forgedPlayer = this.gameState.player();
      const attackBoost =
        (forgedPlayer.equippedWeapon ? 2 : 0) +
        (!forgedPlayer.equippedWeapon && !forgedPlayer.equippedArmor ? 2 : 0);
      const defenseBoost =
        (forgedPlayer.equippedArmor ? 2 : 0) +
        (!forgedPlayer.equippedWeapon && !forgedPlayer.equippedArmor ? 1 : 0);
      const critBoost = forgedPlayer.equippedRing ? 4 : 0;

      this.gameState.updatePlayer((player) => ({
        ...player,
        attackBonus: player.attackBonus + attackBoost,
        defenseBonus: player.defenseBonus + defenseBoost,
        critBonus: player.critBonus + critBoost,
        mana: Math.min(player.maxMana, player.mana + 12),
      }));
      this.gameState.addLog(
        `Schmiede: +${attackBoost} ATK, +${defenseBoost} DEF, +${critBoost}% Krit und etwas Mana-Tempo.`,
        'achievement',
      );
      this.gameState.addDragonShards(1, branch.name);
      this.completeSelectedBranch();
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
    const biome = branch.biome ?? 'ruin';
    const goldBase = 30 + depth * 6 + Math.floor(luck * 1.4);

    const hurt = (frac: number) =>
      this.gameState.updatePlayer((p) => ({
        ...p,
        hp: Math.max(1, p.hp - Math.floor(p.maxHp * frac)),
      }));

    const archetypes = ['shrine', 'coin', 'cache'] as const;
    const kind = archetypes[Math.floor(Math.random() * archetypes.length)];

    const effects: Record<string, () => void> = {};
    const choices: DilemmaChoice[] = [];
    let icon = '🔮';
    let source = 'Runenschrein';
    let flavor = '';

    if (kind === 'shrine') {
      icon = '⛩';
      source = 'Verfluchter Schrein';
      flavor = 'Ein verfallener Schrein pulsiert mit dunkler Macht — sein Segen hat einen Preis.';
      choices.push(
        {
          id: 'risk',
          title: 'Blut opfern',
          description: 'Lege die Hand auf den Altar und gib Lebenskraft hin.',
          tone: 'risk',
          riskLabel: 'Risiko: -18% HP',
          rewardLabel: 'Relikt + Shard',
        },
        {
          id: 'reward',
          title: 'Andächtig beten',
          description: 'Ehre den Schrein ohne Opfer.',
          tone: 'reward',
          rewardLabel: 'Segen + Heilung',
        },
      );
      effects['risk'] = () => {
        hurt(0.18);
        this.grantRouteRelic({ ...branch, guaranteedRelicId: undefined }, source);
        this.gameState.addDragonShards(1, source);
        this.gameState.addLog(
          `${source}: Du opferst Lebenskraft — der Altar gewährt ein Relikt und einen Shard.`,
          'achievement',
        );
      };
      effects['reward'] = () => {
        const blessing = randomBlessing(['ward', 'focus']);
        this.gameState.updatePlayer((p) => ({
          ...p,
          hp: Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.15)),
          mana: Math.min(p.maxMana, p.mana + 14),
        }));
        this.gameState.grantBlessing(blessing.type, blessing.charges, source);
        this.gameState.addLog(
          `${source}: Dein Gebet bringt ${blessingLabel(blessing.type)} und etwas Heilung.`,
          'heal',
        );
      };
    } else if (kind === 'coin') {
      icon = '🪙';
      source = 'Gauklermünze';
      flavor = 'Ein Geist wirft dir eine schimmernde Münze zu. Versuchst du dein Glück?';
      const winChance = Math.min(72, 52 + Math.floor(luck * 0.9));
      choices.push(
        {
          id: 'risk',
          title: 'Münze werfen',
          description: 'Alles oder nichts — der Geist liebt Mut.',
          tone: 'risk',
          chance: winChance,
          riskLabel: 'Verlust: -30% Gold',
          rewardLabel: `+${goldBase * 2} Gold + Shard`,
        },
        {
          id: 'reward',
          title: 'Sicher tauschen',
          description: 'Nimm den garantierten kleinen Gewinn.',
          tone: 'reward',
          rewardLabel: `+${Math.floor(goldBase * 0.8)} Gold, +1 Trank`,
        },
      );
      effects['risk'] = () => {
        if (Math.random() * 100 < winChance) {
          this.gameState.updatePlayer((p) => ({ ...p, gold: p.gold + goldBase * 2 }));
          this.gameState.addDragonShards(1, source);
          this.gameState.addLog(
            `${source}: Die Münze fällt günstig! +${goldBase * 2} Gold und ein Shard.`,
            'achievement',
          );
        } else {
          this.gameState.updatePlayer((p) => ({ ...p, gold: Math.floor(p.gold * 0.7) }));
          this.gameState.addLog(`${source}: Pech — der Geist nimmt 30% deines Goldes.`, 'damage');
        }
      };
      effects['reward'] = () => {
        this.gameState.updatePlayer((p) => ({
          ...p,
          gold: p.gold + Math.floor(goldBase * 0.8),
          potions: p.potions + 1,
        }));
        this.gameState.addLog(
          `${source}: Sicherer Tausch — +${Math.floor(goldBase * 0.8)} Gold und ein Trank.`,
          'heal',
        );
      };
    } else {
      icon = '📦';
      source = 'Uralter Hort';
      flavor = 'Eine versiegelte Truhe summt vor Energie. Das Schloss könnte eine Falle sein.';
      choices.push(
        {
          id: 'risk',
          title: 'Gewaltsam öffnen',
          description: 'Brich das Siegel auf — egal, was lauert.',
          tone: 'risk',
          riskLabel: 'Risiko: -12% HP',
          rewardLabel: `+${goldBase + 20} Gold, Trank, Relikt-Chance`,
        },
        {
          id: 'reward',
          title: 'Mechanik studieren',
          description: 'Entschärfe die Falle mit Bedacht.',
          tone: 'reward',
          rewardLabel: 'Fokus-Segen + Mana',
        },
      );
      effects['risk'] = () => {
        hurt(0.12);
        this.gameState.updatePlayer((p) => ({
          ...p,
          gold: p.gold + goldBase + 20,
          potions: p.potions + 1,
        }));
        if (Math.random() < 0.45) {
          this.grantRouteRelic({ ...branch, guaranteedRelicId: undefined }, source);
        }
        this.gameState.addDragonShards(1, source);
        this.gameState.addLog(
          `${source}: Eine Falle schnappt zu, doch der Hort ist reich — +${goldBase + 20} Gold und mehr.`,
          'achievement',
        );
      };
      effects['reward'] = () => {
        const blessing = randomBlessing(['focus', 'fortune']);
        this.gameState.updatePlayer((p) => ({
          ...p,
          mana: Math.min(p.maxMana, p.mana + 20),
        }));
        this.gameState.grantBlessing(blessing.type, blessing.charges, source);
        this.gameState.addLog(
          `${source}: Sorgfalt zahlt sich aus — ${blessingLabel(blessing.type)} und Mana.`,
          'event',
        );
      };
    }

    this.encounters.launchDilemma({
      source,
      subtitle: '',
      flavor,
      icon,
      biome,
      choices,
      onResolve: (choiceId) => {
        const effect = choiceId ? effects[choiceId] : null;
        if (effect) {
          effect();
        } else {
          this.gameState.addLog(`${source}: Du ziehst vorsichtig weiter.`, 'event');
          this.applyOmenOutcome(branch);
        }
        this.completeSelectedBranch();
      },
    });
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
        randomMissingRelic(player) ??
        RUN_RELICS[Math.floor(Math.random() * RUN_RELICS.length)] ??
        null)
      : (randomMissingRelic(player) ??
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

const ENEMY_BLUEPRINTS: Record<
  string,
  Omit<Enemy, 'id' | 'hp' | 'maxHp' | 'weakness' | 'telegraphedAbility'>
> = {
  slime: {
    name: 'Schleimling',
    role: 'swift',
    attack: 10,
    gold: 20,
    xp: 25,
    icon: 'S',
    sprite: assets.units.slime,
    assetUrl: assets.units.slime.idle,
    level: 1,
    elite: false,
  },
  bat: {
    name: 'Vampirfledermaus',
    role: 'swift',
    attack: 16,
    gold: 32,
    xp: 42,
    icon: 'B',
    sprite: assets.units.bat,
    assetUrl: assets.units.bat.idle,
    level: 2,
    elite: false,
  },
  skeleton: {
    name: 'Knochenwache',
    role: 'hexer',
    attack: 21,
    gold: 55,
    xp: 75,
    icon: 'K',
    sprite: assets.units.skeleton,
    assetUrl: assets.units.skeleton.idle,
    level: 3,
    elite: false,
  },
  knight: {
    name: 'Verfluchter Ritter',
    role: 'bruiser',
    attack: 30,
    gold: 95,
    xp: 130,
    icon: 'R',
    sprite: assets.units.knight,
    assetUrl: assets.units.knight.idle,
    level: 4,
    elite: false,
  },
  wyvern: {
    name: 'Junger Drache',
    role: 'bruiser',
    attack: 44,
    gold: 145,
    xp: 210,
    icon: 'D',
    sprite: assets.units.wyvern,
    assetUrl: assets.units.wyvern.idle,
    level: 5,
    elite: false,
  },
  ancient: {
    name: 'Uralter Drache',
    role: 'elite',
    attack: 58,
    gold: 240,
    xp: 330,
    icon: 'A',
    sprite: assets.units.ancient,
    assetUrl: assets.units.ancient.idle,
    level: 7,
    elite: true,
  },
  boss: {
    name: 'Drachenkonig',
    role: 'boss',
    attack: 72,
    gold: 600,
    xp: 800,
    icon: 'DK',
    sprite: assets.units.boss,
    assetUrl: assets.units.boss.idle,
    level: 8,
    elite: false,
    isBoss: true,
  },
};

export function hydrateEnemyVisuals(enemy: Enemy | null): Enemy | null {
  if (!enemy) {
    return null;
  }

  const key = Object.keys(ENEMY_BLUEPRINTS).find((enemyId) => {
    const blueprint = ENEMY_BLUEPRINTS[enemyId];

    return (
      blueprint.name === enemy.name ||
      enemy.assetUrl === blueprint.assetUrl ||
      enemy.icon === blueprint.icon
    );
  });
  const blueprint = key ? ENEMY_BLUEPRINTS[key] : ENEMY_BLUEPRINTS['slime'];

  return {
    ...enemy,
    role: enemy.role ?? blueprint.role,
    assetUrl: enemy.assetUrl ?? blueprint.assetUrl,
    sprite: enemy.sprite ?? blueprint.sprite,
    weakness: enemy.weakness ?? weaknessForRole(enemy.role ?? blueprint.role),
    telegraphedAbility: enemy.telegraphedAbility ?? null,
  };
}

export function hydratePathVisuals(segments: PathSegment[]): PathSegment[] {
  return segments.map((segment) => ({
    ...segment,
    branches: segment.branches.map((branch) => {
      const blueprint = branch.enemyId
        ? (ENEMY_BLUEPRINTS[branch.enemyId] ?? ENEMY_BLUEPRINTS['slime'])
        : null;
      const weatherPreview = branch.weatherPreview ?? weatherForBranch(branch.type);

      return {
        ...branch,
        assetUrl: branch.assetUrl ?? blueprint?.assetUrl,
        sprite: branch.sprite ?? blueprint?.sprite,
        enemyRole: branch.enemyRole ?? blueprint?.role,
        weatherPreview,
        biome: branch.biome ?? biomeForBranch(branch.type, weatherPreview),
        riskLabel: branch.riskLabel ?? riskLabel(branch.threat, blueprint?.role),
        rewardHint: branch.rewardHint ?? rewardHint(branch.type, branch.threat, blueprint?.role),
        modifier: branch.modifier,
        modifierHint: branch.modifierHint ?? modifierHint(branch.modifier),
      };
    }),
  }));
}

export function adaptSegmentToPlayerState(
  segment: PathSegment,
  player: Player,
  bossPrepScore: number,
): PathSegment {
  if (
    segment.depth === 0 ||
    isBossPrepDepth(segment.depth) ||
    segment.branches.some((branch) => branch.type === 'boss')
  ) {
    return segment;
  }

  const hasType = (...types: PathBranch['type'][]) =>
    segment.branches.some((branch) => types.includes(branch.type));
  const hpPercent = player.hp / player.maxHp;
  const manaPercent = player.mana / player.maxMana;
  const bossSoon = segment.depth % 5 >= 3 && bossPrepScore < 60;
  const replaceIndex = highestThreatBranchIndex(segment.branches);
  let replacement: PathBranch | null = null;

  if (hpPercent < 0.42 && !hasType('rest', 'sanctuary', 'merchant')) {
    replacement = createRestBranch(
      segment.depth,
      replaceIndex,
      'Notlager',
      'Adaptive Rettungsroute fuer knappe HP, Mana und Cooldown.',
      'Adaptiv: HP, Mana, Cooldown',
    );
  } else if (bossSoon && !hasType('sanctuary', 'merchant', 'forge')) {
    replacement = createSanctuaryBranch(
      segment.depth,
      replaceIndex,
      'Prep-Schrein',
      'Adaptive Bossvorbereitung mit Segen, Resolve und Reinigung.',
      'Adaptiv: Boss-Prep',
    );
  } else if (
    (manaPercent < 0.35 || player.skillCooldown > 2) &&
    !hasType('rest', 'forge', 'merchant')
  ) {
    replacement = createForgeBranch(
      segment.depth,
      replaceIndex,
      'Fokus-Schmiede',
      'Adaptive Tempo-Route fuer Mana, Cooldown und direkte Werte.',
      'Adaptiv: Tempo',
    );
  }

  if (!replacement) {
    return segment;
  }

  return {
    ...segment,
    branches: segment.branches.map((branch, index) =>
      index === replaceIndex ? withBranchMetadata(replacement) : branch,
    ),
  };
}

function createPathSegment(depth: number, playerLevel: number): PathSegment {
  if (isBossPrepDepth(depth)) {
    return createBossPrepSegment(depth, playerLevel);
  }

  const branchCount = depth === 0 ? 2 : Math.min(4, 2 + Math.floor(Math.random() * 3));
  const branches = Array.from({ length: branchCount }, (_, index) =>
    createBranch(depth, index, playerLevel),
  );

  if (depth === 1 && !branches.some((branch) => branch.type === 'minigame')) {
    branches[branches.length - 1] = createMiniGameBranch(depth, branches.length - 1);
  }

  if (depth > 0 && depth % 5 === 0) {
    branches[0] = {
      id: `path-${depth}-boss`,
      type: 'boss',
      name: 'Thronsaal',
      icon: 'DK',
      assetUrl: assets.nodes.boss,
      description: 'Ein schwerer Kampf mit hoher Belohnung.',
      threat: 5,
      riskLabel: riskLabel(5, 'boss'),
      rewardHint: rewardHint('boss', 5, 'boss'),
      weatherPreview: weatherForBranch('boss'),
      enemyRole: 'boss',
      modifier: 'focus',
      modifierHint: modifierHint('focus'),
      completed: false,
      enemyId: 'boss',
    };
  }

  return {
    id: `segment-${depth}`,
    depth,
    branches: branches.map(withBranchMetadata),
    cleared: false,
  };
}

function createBranch(depth: number, index: number, playerLevel: number): PathBranch {
  const roll = Math.random();

  if (roll > 0.82 && depth > 0) {
    return createMiniGameBranch(depth, index);
  }

  if (roll > 0.78 && depth > 2) {
    return createEliteBranch(depth, index);
  }

  if (roll > 0.76) {
    return {
      id: `path-${depth}-${index}`,
      type: 'treasure',
      name: 'Reliktkammer',
      icon: 'C',
      assetUrl: assets.nodes.treasure,
      description: 'Sichere Beute, aber der Lauf wird tiefer.',
      threat: 1,
      riskLabel: riskLabel(1),
      rewardHint: `Sicher: ${30 + depth * 12}+ Gold${depth > 2 ? ' und Relic-Chance' : ''}`,
      weatherPreview: weatherForBranch('treasure'),
      modifier: branchModifier(1, 'treasure'),
      completed: false,
      reward: {
        gold: 30 + depth * 12 + Math.floor(Math.random() * 25),
        potions: Math.random() > 0.72 ? 1 : 0,
      },
    };
  }

  if (roll > 0.68) {
    return {
      id: `path-${depth}-${index}`,
      type: 'rest',
      name: 'Lagerfeuer',
      icon: 'Camp',
      assetUrl: assets.nodes.camp,
      description: 'Rastplatz fur Heilung, Mana und einen ruhigen Reset.',
      threat: 0,
      riskLabel: riskLabel(0),
      rewardHint: 'Stabil: HP, Mana, Cooldown',
      weatherPreview: weatherForBranch('rest'),
      modifier: branchModifier(0, 'rest'),
      completed: false,
    };
  }

  if (roll > 0.6) {
    return {
      id: `path-${depth}-${index}`,
      type: 'event',
      name: 'Runenschrein',
      icon: 'R',
      assetUrl: assets.nodes.shrine,
      description: 'Unberechenbares Ereignis mit Ressourcen oder Erholung.',
      threat: 0,
      riskLabel: riskLabel(0),
      rewardHint: 'Variabel: Gold oder Erholung',
      weatherPreview: weatherForBranch('event'),
      modifier: branchModifier(0, 'event'),
      completed: false,
    };
  }

  if (roll > 0.52 && depth > 0) {
    return {
      id: `path-${depth}-${index}`,
      type: 'merchant',
      name: 'Trosshaendler',
      icon: 'G',
      assetUrl: assets.nodes.merchant,
      description: 'Passt seine Ware an deinen aktuellen Run-Zustand an.',
      threat: 0,
      riskLabel: riskLabel(0),
      rewardHint: 'Wahl: Tempo, Sustain oder Relic',
      weatherPreview: weatherForBranch('merchant'),
      modifier: branchModifier(0, 'merchant'),
      completed: false,
    };
  }

  if (roll > 0.44 && depth > 1) {
    return {
      id: `path-${depth}-${index}`,
      type: 'forge',
      name: 'Feldschmiede',
      icon: 'F',
      assetUrl: assets.nodes.forge,
      description: 'Schaerft deine Ausruestung direkt im Run.',
      threat: 1,
      riskLabel: riskLabel(1),
      rewardHint: 'Tempo: direkte Kampfwerte',
      weatherPreview: weatherForBranch('forge'),
      modifier: branchModifier(1, 'forge'),
      completed: false,
    };
  }

  if (roll > 0.36 && depth > 1) {
    return {
      id: `path-${depth}-${index}`,
      type: 'sanctuary',
      name: 'Sanktuarium',
      icon: 'S',
      assetUrl: assets.nodes.sanctuary,
      description: 'Klare den Fluss des Runs, tanke Resolve und sichere dir einen Segen.',
      threat: 0,
      riskLabel: riskLabel(0),
      rewardHint: 'Segen, Resolve, Reinigung',
      weatherPreview: weatherForBranch('sanctuary'),
      modifier: branchModifier(0, 'sanctuary'),
      completed: false,
    };
  }

  const enemyPool = Object.entries(ENEMY_BLUEPRINTS)
    .filter(([, enemy]) => !enemy.isBoss && enemy.level <= Math.min(7, playerLevel + depth + 1))
    .map(([id]) => id);
  const enemyId = enemyPool[Math.floor(Math.random() * enemyPool.length)] ?? 'slime';
  const role = ENEMY_BLUEPRINTS[enemyId].role;
  const threat = ENEMY_BLUEPRINTS[enemyId].elite ? 4 : Math.min(4, ENEMY_BLUEPRINTS[enemyId].level);

  return {
    id: `path-${depth}-${index}`,
    type: 'fight',
    name: depth > 3 && Math.random() > 0.75 ? 'Elite-Begegnung' : 'Monsterpfad',
    icon: ENEMY_BLUEPRINTS[enemyId].icon,
    assetUrl: ENEMY_BLUEPRINTS[enemyId].assetUrl,
    sprite: ENEMY_BLUEPRINTS[enemyId].sprite,
    description: describeFightPath(enemyId, depth),
    threat,
    riskLabel: riskLabel(threat, role),
    rewardHint: rewardHint('fight', threat, role),
    weatherPreview: weatherForBranch('fight'),
    enemyRole: role,
    modifier: branchModifier(threat, 'fight'),
    completed: false,
    enemyId,
  };
}

function highestThreatBranchIndex(branches: PathBranch[]): number {
  if (!branches.length) {
    return 0;
  }

  return Math.max(
    0,
    branches.reduce(
      (bestIndex, branch, index) =>
        branch.threat > branches[bestIndex].threat ? index : bestIndex,
      0,
    ),
  );
}

function createRestBranch(
  depth: number,
  index: number,
  name = 'Lagerfeuer',
  description = 'Rastplatz fur Heilung, Mana und einen ruhigen Reset.',
  reward = 'Stabil: HP, Mana, Cooldown',
): PathBranch {
  return {
    id: `path-${depth}-${index}-rest`,
    type: 'rest',
    name,
    icon: 'Camp',
    assetUrl: assets.nodes.camp,
    description,
    threat: 0,
    riskLabel: riskLabel(0),
    rewardHint: reward,
    weatherPreview: weatherForBranch('rest'),
    modifier: branchModifier(0, 'rest'),
    completed: false,
  };
}

function createForgeBranch(
  depth: number,
  index: number,
  name = 'Feldschmiede',
  description = 'Schaerft deine Ausruestung direkt im Run.',
  reward = 'Tempo: direkte Kampfwerte',
): PathBranch {
  return {
    id: `path-${depth}-${index}-forge`,
    type: 'forge',
    name,
    icon: 'F',
    assetUrl: assets.nodes.forge,
    description,
    threat: 1,
    riskLabel: riskLabel(1),
    rewardHint: reward,
    weatherPreview: weatherForBranch('forge'),
    modifier: branchModifier(1, 'forge'),
    completed: false,
  };
}

function createSanctuaryBranch(
  depth: number,
  index: number,
  name = 'Sanktuarium',
  description = 'Klaert den Fluss des Runs, tankt Resolve und sichert dir einen Segen.',
  reward = 'Segen, Resolve, Reinigung',
): PathBranch {
  return {
    id: `path-${depth}-${index}-sanctuary`,
    type: 'sanctuary',
    name,
    icon: 'S',
    assetUrl: assets.nodes.sanctuary,
    description,
    threat: 0,
    riskLabel: riskLabel(0),
    rewardHint: reward,
    weatherPreview: weatherForBranch('sanctuary'),
    modifier: branchModifier(0, 'sanctuary'),
    completed: false,
  };
}

function createMiniGameBranch(depth: number, index: number): PathBranch {
  const miniGames = [
    {
      description: 'Kurzer Reflex-Test mit direkter Belohnung.',
      icon: 'R',
      name: 'Reflexprobe',
    },
    {
      description: 'Merk dir das Muster und sichere dir Extra-Ressourcen.',
      icon: 'M',
      name: 'Merkspiel',
    },
    {
      description: 'Präzisionspfad mit kleiner Bonuskiste.',
      icon: 'P',
      name: 'Präzisionslauf',
    },
    {
      description: 'Schnelltippen für einen sauberen Tempo-Bonus.',
      icon: 'T',
      name: 'Tastentest',
    },
  ] as const;
  const miniGame = miniGames[Math.floor(Math.random() * miniGames.length)] ?? miniGames[0];

  return {
    id: `path-${depth}-${index}`,
    type: 'minigame',
    name: miniGame.name,
    icon: miniGame.icon,
    description: miniGame.description,
    threat: 1,
    riskLabel: riskLabel(1),
    rewardHint: 'Skill: Gold, Mana, Bonuschance',
    weatherPreview: weatherForBranch('minigame'),
    modifier: branchModifier(1, 'minigame'),
    completed: false,
  };
}

function createEliteBranch(depth: number, index: number): PathBranch {
  return {
    id: `path-${depth}-${index}`,
    type: 'fight',
    name: 'Elite-Jagd',
    icon: 'A',
    assetUrl: ENEMY_BLUEPRINTS['ancient'].assetUrl,
    sprite: ENEMY_BLUEPRINTS['ancient'].sprite,
    description: 'Ein harter Elite-Pfad fuer Prep, Relics und massiven Reward.',
    threat: 4,
    riskLabel: riskLabel(4, 'elite'),
    rewardHint: 'Elite: Relic-Chance, Resolve und Boss-Prep',
    weatherPreview: weatherForBranch('fight'),
    enemyRole: 'elite',
    modifier: branchModifier(4, 'fight'),
    eliteRoute: true,
    completed: false,
    enemyId: 'ancient',
  };
}

function weaknessForRole(role: EnemyRole): EnemyElement {
  switch (role) {
    case 'bruiser': return 'ice';
    case 'swift': return 'lightning';
    case 'hexer': return 'fire';
    case 'elite': return 'shadow';
    case 'boss': return 'shadow';
  }
}

function createEnemy(enemyId: string, playerLevel: number, forceBoss = false, threat = 1): Enemy {
  const blueprint = ENEMY_BLUEPRINTS[forceBoss ? 'boss' : enemyId] ?? ENEMY_BLUEPRINTS['slime'];
  const scaling = Math.max(0, playerLevel - blueprint.level);
  const maxHp = (forceBoss ? 500 : 45 + blueprint.level * 26) + scaling * 18;
  const rewardScale = roleLootMultiplier(blueprint.role) + Math.max(0, threat - 1) * 0.08;

  return {
    ...blueprint,
    id: `${enemyId}-${crypto.randomUUID()}`,
    hp: maxHp,
    maxHp,
    attack: blueprint.attack + scaling * 3,
    gold: Math.floor((blueprint.gold + scaling * 10) * rewardScale),
    xp: Math.floor((blueprint.xp + scaling * 12) * rewardScale),
    weakness: weaknessForRole(blueprint.role),
    telegraphedAbility: null,
  };
}

function withBranchMetadata(branch: PathBranch): PathBranch {
  const weatherPreview = branch.weatherPreview ?? weatherForBranch(branch.type);

  return {
    ...branch,
    weatherPreview,
    biome: branch.biome ?? biomeForBranch(branch.type, weatherPreview),
    modifierHint: branch.modifierHint ?? modifierHint(branch.modifier),
  };
}

function biomeForBranch(type: PathBranch['type'], weather: PathWeather): PathBiome {
  if (type === 'boss' || type === 'sanctuary') {
    return 'sanctum';
  }

  if (type === 'forge' || weather === 'ash') {
    return 'ember';
  }

  if (weather === 'storm') {
    return 'storm';
  }

  if (weather === 'snow') {
    return 'frost';
  }

  if (type === 'rest' || weather === 'rain' || weather === 'glow') {
    return 'grove';
  }

  return 'ruin';
}

function weatherForBranch(type: PathBranch['type']): PathWeather {
  if (type === 'fight') {
    return Math.random() > 0.5 ? 'rain' : 'ash';
  }

  if (type === 'boss') {
    return 'storm';
  }

  if (type === 'forge') {
    return Math.random() > 0.5 ? 'ash' : 'snow';
  }

  if (type === 'merchant') {
    return 'clear';
  }

  if (type === 'sanctuary') {
    return 'glow';
  }

  if (type === 'rest') {
    return 'glow';
  }

  if (type === 'event') {
    return 'fog';
  }

  if (type === 'minigame') {
    return 'glow';
  }

  return 'snow';
}

function branchModifier(threat: number, type: PathBranch['type']): PathBranchModifier | undefined {
  const roll = Math.random();

  if (type === 'boss') return 'focus';
  if (type === 'rest') return roll > 0.45 ? 'blessing' : undefined;
  if (type === 'sanctuary') return roll > 0.45 ? 'blessing' : 'focus';
  if (type === 'merchant') return roll > 0.5 ? 'cache' : 'blessing';
  if (type === 'forge') return roll > 0.48 ? 'focus' : 'cache';
  if (type === 'treasure') return roll > 0.42 ? 'cache' : undefined;
  if (type === 'event') return roll > 0.62 ? 'curse' : roll > 0.28 ? 'blessing' : undefined;
  if (type === 'minigame') return roll > 0.5 ? 'focus' : 'cache';
  if (threat >= 4) return roll > 0.55 ? 'ambush' : roll > 0.22 ? 'focus' : undefined;
  if (threat >= 2) return roll > 0.62 ? 'ambush' : roll > 0.36 ? 'cache' : undefined;

  return roll > 0.7 ? 'cache' : undefined;
}

function modifierHint(modifier: PathBranchModifier | undefined): string | undefined {
  switch (modifier) {
    case 'ambush':
      return 'Mod: Hinterhalt';
    case 'blessing':
      return 'Mod: Segen';
    case 'cache':
      return 'Mod: Vorrat';
    case 'curse':
      return 'Mod: Fluch';
    case 'focus':
      return 'Mod: Fokus';
    default:
      return undefined;
  }
}

function riskLabel(threat: number, role?: EnemyRole): string {
  if (role === 'boss') return 'Bossrisiko';
  if (role === 'elite' || threat >= 4) return 'Hohes Risiko';
  if (threat >= 2) return 'Taktisches Risiko';
  if (threat === 1) return 'Niedriges Risiko';
  return 'Sicher';
}

function rewardHint(type: PathBranch['type'], threat: number, role?: EnemyRole): string {
  if (type === 'boss') return 'Boss: sehr viel XP/Gold';
  if (type === 'fight') {
    const multiplier = role ? roleLootMultiplier(role) + Math.max(0, threat - 1) * 0.08 : 1;
    return `${roleLabel(role)}: ${Math.round(multiplier * 100)}% Reward`;
  }
  if (type === 'treasure') return 'Sicherer Goldfund';
  if (type === 'rest') return 'Heilung und Tempo';
  if (type === 'merchant') return 'Adaptive Versorgung';
  if (type === 'forge') return 'Direkte Kampfwerte';
  if (type === 'sanctuary') return 'Blessing und Resolve';
  if (type === 'minigame') return 'Skill-Bonus';
  return 'Unbekannter Ausgang';
}

function roleLabel(role?: EnemyRole): string {
  switch (role) {
    case 'bruiser':
      return 'Bruiser';
    case 'swift':
      return 'Swift';
    case 'hexer':
      return 'Hexer';
    case 'elite':
      return 'Elite';
    case 'boss':
      return 'Boss';
    default:
      return 'Route';
  }
}

function resolveEventOutcome(
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

function describeFightPath(enemyId: string, depth: number): string {
  const enemy = ENEMY_BLUEPRINTS[enemyId] ?? ENEMY_BLUEPRINTS['slime'];
  const risk = depth > 3 || enemy.elite ? 'hohem Druck' : 'kontrollierbarem Risiko';

  return `${enemy.name} wartet hier mit ${risk}, XP und Gold.`;
}

function createBossPrepSegment(depth: number, playerLevel: number): PathSegment {
  return {
    id: `segment-${depth}`,
    depth,
    branches: (
      [
        {
          id: `path-${depth}-elite`,
          type: 'fight',
          name: 'Elite-Jagd',
          icon: 'A',
          assetUrl: ENEMY_BLUEPRINTS['ancient'].assetUrl,
          sprite: ENEMY_BLUEPRINTS['ancient'].sprite,
          description: 'Ein uralter Drache bewacht seltene Prep-Beute vor dem Boss.',
          threat: 4,
          riskLabel: riskLabel(4, 'elite'),
          rewardHint: 'Elite: Relic-Chance und Resolve',
          weatherPreview: 'ash',
          enemyRole: 'elite',
          modifier: 'focus',
          modifierHint: modifierHint('focus'),
          eliteRoute: true,
          completed: false,
          enemyId: 'ancient',
        },
        {
          id: `path-${depth}-merchant`,
          type: 'merchant',
          name: 'Vorhut-Haendler',
          icon: 'G',
          assetUrl: assets.nodes.merchant,
          description: 'Letzte Einkaeufe und taktische Auswahl vor dem Boss.',
          threat: 0,
          riskLabel: riskLabel(0),
          rewardHint: 'Wahl: Boss-Prep',
          weatherPreview: 'clear',
          modifier: 'cache',
          modifierHint: modifierHint('cache'),
          completed: false,
        },
        {
          id: `path-${depth}-forge`,
          type: 'forge',
          name: 'Feldschmiede',
          icon: 'F',
          assetUrl: assets.nodes.forge,
          description: 'Direkte Werte fuer die naechste Bossphase.',
          threat: 1,
          riskLabel: riskLabel(1),
          rewardHint: 'Prep: direkte Stats',
          weatherPreview: 'snow',
          modifier: 'focus',
          modifierHint: modifierHint('focus'),
          completed: false,
        },
        {
          id: `path-${depth}-sanctuary`,
          type: 'sanctuary',
          name: 'Boss-Sanktuarium',
          icon: 'S',
          assetUrl: assets.nodes.sanctuary,
          description: 'Reinigt den Run und fuellt Blessings sowie Resolve vor dem Finale.',
          threat: 0,
          riskLabel: riskLabel(0),
          rewardHint: 'Prep: Blessing und Resolve',
          weatherPreview: 'glow',
          modifier: 'blessing',
          modifierHint: modifierHint('blessing'),
          completed: false,
        },
      ] satisfies PathBranch[]
    ).map(withBranchMetadata),
    cleared: false,
  };
}

function isBossPrepDepth(depth: number): boolean {
  return depth > 0 && depth % 5 === 4;
}

function randomBlessing(pool: RunBlessingType[]): { type: RunBlessingType; charges: number } {
  const type = pool[Math.floor(Math.random() * pool.length)] ?? pool[0] ?? 'focus';
  const charges = type === 'ward' ? 2 : Math.random() > 0.7 ? 3 : 2;

  return { type, charges };
}

function applyFortuneReward(
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

function effectivePlayerLuck(player: Player): number {
  return player.luck + (player.activePet?.bonusType === 'luck' ? player.activePet.bonusValue : 0);
}

function shardChanceForLuck(luck: number, baseChance: number): number {
  return Math.min(0.48, baseChance + luck * 0.015);
}

function createMerchantOffers(player: Player, source: string): MerchantOffer[] {
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

function routeResultLabel(branch: PathBranch): string {
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
