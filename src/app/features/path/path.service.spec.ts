import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { RunEncounterService } from '../encounters/run-encounter.service';
import { GameState } from '../game-state/game-state.service';
import { PathBranch } from './path-segment.model';
import { adaptSegmentToPlayerState, hydratePathVisuals, Path } from './path.service';

describe('Path', () => {
  let service: Path;
  let gameState: GameState;
  let encounters: RunEncounterService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Path);
    gameState = TestBed.inject(GameState);
    encounters = TestBed.inject(RunEncounterService);
    gameState.updatePlayer((player) => ({
      ...player,
      activeContract: {
        ...player.activeContract,
        completed: true,
      },
    }));
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('adds tactical forecast data to generated branches', () => {
    const branches = service.currentSegment()?.branches ?? [];

    expect(branches.length).toBeGreaterThan(0);
    expect(
      branches.every(
        (branch) =>
          !!branch.weatherPreview && !!branch.rewardHint && !!branch.riskLabel && !!branch.biome,
      ),
    ).toBe(true);
    expect(
      branches.filter((branch) => !!branch.modifier).every((branch) => !!branch.modifierHint),
    ).toBe(true);
  });

  it('hydrates legacy branches with stable biome metadata', () => {
    const hydrated = hydratePathVisuals([
      {
        id: 'segment-legacy',
        depth: 0,
        branches: [
          {
            id: 'legacy-forge',
            type: 'forge',
            name: 'Legacy Forge',
            icon: 'F',
            description: 'Old save route',
            threat: 1,
            weatherPreview: 'ash',
            completed: false,
          },
        ],
        cleared: false,
      },
    ]);

    expect(hydrated[0].branches[0].biome).toBe('ember');
    expect(hydrated[0].branches[0].modifierHint).toBeUndefined();
  });

  it('creates role-based combat rewards from risky fight branches', () => {
    const branch: PathBranch = {
      id: 'test-fight',
      type: 'fight',
      name: 'Hexer-Pruefung',
      icon: 'H',
      description: 'Test branch',
      threat: 4,
      weatherPreview: 'ash',
      riskLabel: 'Hohes Risiko',
      rewardHint: 'Hexer: hoher Reward',
      enemyRole: 'hexer',
      completed: false,
      enemyId: 'skeleton',
    };

    service.segments.set([{ id: 'segment-test', depth: 0, branches: [branch], cleared: false }]);
    service.currentDepth.set(0);

    service.chooseBranch(branch);

    expect(service.weather()).toBe('ash');
    expect(gameState.enemy()?.role).toBe('hexer');
    expect(gameState.enemy()?.gold ?? 0).toBeGreaterThan(55);
  });

  it('applies branch modifiers and completes a route once', () => {
    const branch: PathBranch = {
      id: 'test-cache',
      type: 'treasure',
      name: 'Cache',
      icon: 'C',
      description: 'Test cache',
      threat: 2,
      weatherPreview: 'snow',
      riskLabel: 'Niedriges Risiko',
      rewardHint: 'Gold',
      modifier: 'cache',
      modifierHint: 'Mod: Vorrat',
      completed: false,
      reward: { gold: 10, potions: 0 },
    };

    service.segments.set([{ id: 'segment-test', depth: 0, branches: [branch], cleared: false }]);
    service.currentDepth.set(0);

    service.chooseBranch(branch);

    expect(gameState.player().gold).toBe(197);
    expect(gameState.player().completedPaths).toBe(1);
    expect(gameState.player().routeStreak).toBe(1);
    expect(service.currentDepth()).toBe(1);
  });

  it('stabilizes low-hp players on safe routes', () => {
    const branch: PathBranch = {
      id: 'test-safe',
      type: 'treasure',
      name: 'Safe Cache',
      icon: 'C',
      description: 'Test safety',
      threat: 1,
      weatherPreview: 'snow',
      riskLabel: 'Niedriges Risiko',
      rewardHint: 'Gold',
      completed: false,
      reward: { gold: 0, potions: 0 },
    };

    gameState.updatePlayer((player) => ({ ...player, hp: 20, potions: 0 }));
    service.segments.set([{ id: 'segment-test', depth: 0, branches: [branch], cleared: false }]);
    service.currentDepth.set(0);

    service.chooseBranch(branch);

    expect(gameState.player().hp).toBeGreaterThan(20);
    expect(gameState.player().potions).toBe(1);
  });

  it('advances pathfinder contracts when routes complete', () => {
    const branch: PathBranch = {
      id: 'test-contract',
      type: 'treasure',
      name: 'Contract Cache',
      icon: 'C',
      description: 'Test contract',
      threat: 1,
      weatherPreview: 'snow',
      riskLabel: 'Niedriges Risiko',
      rewardHint: 'Gold',
      completed: false,
      reward: { gold: 0, potions: 0 },
    };

    gameState.updatePlayer((player) => ({
      ...player,
      activeContract: {
        type: 'pathfinder',
        title: 'Kartograph',
        description: 'Routes',
        progress: 0,
        target: 1,
        rewardGold: 10,
        rewardResolve: 1,
        completed: false,
      },
    }));
    service.segments.set([{ id: 'segment-test', depth: 0, branches: [branch], cleared: false }]);
    service.currentDepth.set(0);

    service.chooseBranch(branch);

    expect(gameState.player().activeContract.completed).toBe(true);
    expect(gameState.player().gold).toBe(167);
    expect(gameState.player().resolve).toBe(2);
  });

  it('restores the run and grants a blessing at the sanctuary', () => {
    const branch: PathBranch = {
      id: 'test-sanctuary',
      type: 'sanctuary',
      name: 'Sanctuary',
      icon: 'S',
      description: 'Blessing test',
      threat: 0,
      weatherPreview: 'glow',
      riskLabel: 'Sicher',
      rewardHint: 'Blessing',
      completed: false,
    };

    gameState.updatePlayer((player) => ({
      ...player,
      hp: 35,
      mana: 10,
      resolve: 0,
      statusEffect: { type: 'poison', rounds: 2, damagePerRound: 4 },
    }));
    service.segments.set([{ id: 'segment-test', depth: 0, branches: [branch], cleared: false }]);
    service.currentDepth.set(0);

    service.chooseBranch(branch);

    expect(gameState.player().hp).toBeGreaterThan(35);
    expect(gameState.player().mana).toBeGreaterThan(10);
    expect(gameState.player().resolve).toBe(1);
    expect(gameState.player().statusEffect).toBeNull();
    expect(gameState.player().activeBlessings.length).toBeGreaterThan(0);
    expect(gameState.player().dragonShards).toBe(2);
    expect(gameState.player().routeHistory[0]?.label).toBe('Sanctuary');
  });

  it('opens a merchant choice and applies the selected offer', () => {
    const branch: PathBranch = {
      id: 'test-merchant',
      type: 'merchant',
      name: 'Merchant',
      icon: 'M',
      description: 'Merchant test',
      threat: 0,
      weatherPreview: 'clear',
      riskLabel: 'Sicher',
      rewardHint: 'Support',
      completed: false,
    };

    gameState.updatePlayer((player) => ({
      ...player,
      gold: 120,
      mana: 15,
      skillCooldown: 3,
    }));
    service.segments.set([{ id: 'segment-test', depth: 0, branches: [branch], cleared: false }]);
    service.currentDepth.set(0);

    service.chooseBranch(branch);

    expect(encounters.activeEncounter()).toBeTruthy();

    const focusOffer = encounters
      .activeEncounter()
      ?.offers.find((offer) => offer.id.includes('focus'));
    expect(focusOffer).toBeTruthy();

    encounters.resolve(focusOffer?.id ?? null);

    expect(gameState.player().gold).toBe(50);
    expect(gameState.player().mana).toBeGreaterThan(15);
    expect(gameState.player().skillCooldown).toBeLessThan(3);
    expect(gameState.player().activeBlessings.some((blessing) => blessing.type === 'focus')).toBe(
      true,
    );
  });

  it('converts forge routes into direct stat progress', () => {
    const branch: PathBranch = {
      id: 'test-forge',
      type: 'forge',
      name: 'Forge',
      icon: 'F',
      description: 'Forge test',
      threat: 1,
      weatherPreview: 'ash',
      riskLabel: 'Niedriges Risiko',
      rewardHint: 'Stats',
      completed: false,
    };

    service.segments.set([{ id: 'segment-test', depth: 0, branches: [branch], cleared: false }]);
    service.currentDepth.set(0);

    service.chooseBranch(branch);

    expect(gameState.player().attackBonus).toBeGreaterThan(0);
    expect(gameState.player().defenseBonus).toBeGreaterThan(0);
  });

  it('spawns a boss-prep segment before milestone bosses', () => {
    const branch: PathBranch = {
      id: 'advance-prep',
      type: 'treasure',
      name: 'Advance',
      icon: 'A',
      description: 'Advance',
      threat: 0,
      weatherPreview: 'clear',
      riskLabel: 'Sicher',
      rewardHint: 'Advance',
      completed: false,
      reward: { gold: 0, potions: 0 },
    };

    service.segments.set([
      { id: 'segment-0', depth: 0, branches: [branch], cleared: false },
      { id: 'segment-1', depth: 1, branches: [branch], cleared: false },
      { id: 'segment-2', depth: 2, branches: [branch], cleared: false },
      { id: 'segment-3', depth: 3, branches: [branch], cleared: false },
    ]);
    service.currentDepth.set(3);
    gameState.selectedBranchId.set('advance-prep');

    service.completeSelectedBranch();

    expect(service.currentDepth()).toBe(4);
    expect(service.currentSegment()?.branches.some((entry) => entry.type === 'merchant')).toBe(
      true,
    );
    expect(service.currentSegment()?.branches.some((entry) => entry.type === 'sanctuary')).toBe(
      true,
    );
    expect(service.currentSegment()?.branches.some((entry) => entry.eliteRoute)).toBe(true);
    expect(service.currentSegment()?.branches.every((entry) => !!entry.biome)).toBe(true);
  });

  it('adapts generated segments when the player needs recovery', () => {
    const fightBranch: PathBranch = {
      id: 'danger-1',
      type: 'fight',
      name: 'Danger',
      icon: 'D',
      description: 'Danger route',
      threat: 4,
      weatherPreview: 'ash',
      riskLabel: 'Hohes Risiko',
      rewardHint: 'Risk',
      completed: false,
      enemyId: 'skeleton',
    };

    gameState.updatePlayer((player) => ({ ...player, hp: 25, mana: 90 }));
    const adapted = adaptSegmentToPlayerState(
      {
        id: 'segment-danger',
        depth: 2,
        branches: [fightBranch, { ...fightBranch, id: 'danger-2', threat: 3 }],
        cleared: false,
      },
      gameState.player(),
      70,
    );

    expect(adapted.branches.some((branch) => branch.type === 'rest')).toBe(true);
    expect(adapted.branches.some((branch) => branch.rewardHint?.includes('Adaptiv'))).toBe(true);
  });

  it('rewards route synergy for three different route types in a row', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const branch: PathBranch = {
      id: 'test-synergy',
      type: 'treasure',
      name: 'Synergy Cache',
      icon: 'C',
      description: 'Test synergy',
      threat: 1,
      weatherPreview: 'snow',
      riskLabel: 'Niedriges Risiko',
      rewardHint: 'Gold',
      completed: false,
      reward: { gold: 0, potions: 0 },
    };

    gameState.updatePlayer((player) => ({
      ...player,
      mana: 20,
      dragonShards: 0,
      routeHistory: [
        { depth: 2, label: 'Lagerfeuer', result: 'Erholung', type: 'rest' },
        { depth: 1, label: 'Monsterpfad', result: 'Kampfroute', type: 'fight' },
      ],
    }));
    service.segments.set([{ id: 'segment-test', depth: 0, branches: [branch], cleared: false }]);
    service.currentDepth.set(0);

    service.chooseBranch(branch);

    expect(gameState.player().dragonShards).toBe(1);
    expect(gameState.player().mana).toBeGreaterThan(20);
    expect(gameState.logs().some((entry) => entry.message.includes('Routen-Synergy'))).toBe(true);
    randomSpy.mockRestore();
  });
});
