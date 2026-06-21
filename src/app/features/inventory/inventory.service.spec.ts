import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { GameState } from '../game-state/game-state.service';
import { Inventory } from './inventory.service';

describe('Inventory', () => {
  let service: Inventory;
  let gameState: GameState;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Inventory);
    gameState = TestBed.inject(GameState);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('cleanses status through the shop action', () => {
    gameState.updatePlayer((player) => ({
      ...player,
      gold: 100,
      hp: 40,
      statusEffect: { type: 'poison', rounds: 2, damagePerRound: 4 },
    }));

    service.buyCleanse();

    expect(gameState.player().gold).toBe(25);
    expect(gameState.player().hp).toBe(50);
    expect(gameState.player().statusEffect).toBeNull();
  });

  it('buys resolve capacity up to the cap', () => {
    gameState.updatePlayer((player) => ({
      ...player,
      gold: 200,
      resolve: 1,
      maxResolve: 3,
    }));

    service.buyResolveCapacity();

    expect(gameState.player().gold).toBe(60);
    expect(gameState.player().maxResolve).toBe(4);
    expect(gameState.player().resolve).toBe(2);
  });

  it('accepts the next contract through inventory', () => {
    gameState.updatePlayer((player) => ({
      ...player,
      activeContract: {
        type: 'pathfinder',
        title: 'Done',
        description: 'Done',
        progress: 1,
        target: 1,
        rewardGold: 10,
        rewardResolve: 1,
        completed: true,
      },
    }));

    service.acceptNextContract();

    expect(gameState.player().activeContract.completed).toBe(false);
    expect(gameState.player().activeContract.type).not.toBe('pathfinder');
  });

  it('grants relics only once', () => {
    const relic = service.lootRelics[0];

    expect(service.grantRelic(relic, 'Test')).toBe(true);
    expect(service.grantRelic(relic, 'Test')).toBe(false);
    expect(gameState.player().ownedRelics.length).toBe(1);
    expect(gameState.player().dragonShards).toBe(2);
  });

  it('spends shards on tonics and prep utilities', () => {
    gameState.updatePlayer((player) => ({
      ...player,
      dragonShards: 8,
      hp: 60,
      mana: 30,
      level: 2,
      resolve: 0,
    }));

    service.brewDragonTonic();
    service.buyPrepCache();

    expect(gameState.player().dragonShards).toBe(0);
    expect(gameState.player().potions).toBe(4);
    expect(gameState.player().resolve).toBe(1);
    expect(gameState.activeBlessingCount()).toBeGreaterThan(0);
  });

  it('uses shards for contract intel and blessing infusions', () => {
    gameState.updatePlayer((player) => ({
      ...player,
      dragonShards: 6,
      mana: 20,
      hp: 50,
      statusEffect: { type: 'poison', rounds: 2, damagePerRound: 4 },
      activeContract: {
        type: 'pathfinder',
        title: 'Kartograph',
        description: 'Routes',
        progress: 0,
        target: 2,
        rewardGold: 10,
        rewardResolve: 1,
        completed: false,
      },
    }));

    service.buyContractIntel();
    service.buyBlessingInfusion();

    expect(gameState.player().dragonShards).toBe(0);
    expect(gameState.player().activeContract.progress).toBe(1);
    expect(gameState.player().statusEffect).toBeNull();
    expect(gameState.activeBlessingCount()).toBeGreaterThan(0);
  });

  it('rerolls level up choices with shards', () => {
    gameState.levelUpChoices.set([
      { id: 'attack', title: 'Klinge scharfen', description: '+4 Angriff' },
      { id: 'defense', title: 'Deckung halten', description: '+3 Verteidigung' },
      { id: 'crit', title: 'Schwachpunkt', description: '+5% Krit' },
    ]);
    gameState.updatePlayer((player) => ({
      ...player,
      dragonShards: 4,
    }));

    service.rerollLevelUpChoices();

    expect(gameState.player().dragonShards).toBe(0);
    expect(gameState.levelUpChoices().length).toBe(3);
  });

  it('converts duplicate pet and item loot into resources', () => {
    gameState.updatePlayer((player) => ({
      ...player,
      ownedPets: [...service.lootPets],
      ownedItems: [...service.lootItems],
      gold: 0,
    }));

    const randomSpy = vi
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.9)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0);

    service.awardLoot({
      id: 'bat-test',
      name: 'Bat',
      role: 'swift',
      attack: 10,
      gold: 10,
      xp: 10,
      icon: 'B',
      sprite: undefined,
      assetUrl: '',
      level: 2,
      elite: false,
      hp: 10,
      maxHp: 10,
      isBoss: false,
    });
    service.awardLoot({
      id: 'slime-test',
      name: 'Slime',
      role: 'swift',
      attack: 8,
      gold: 8,
      xp: 8,
      icon: 'S',
      sprite: undefined,
      assetUrl: '',
      level: 2,
      elite: false,
      hp: 10,
      maxHp: 10,
      isBoss: false,
    });

    expect(gameState.player().dragonShards).toBe(1);
    expect(gameState.player().gold).toBeGreaterThanOrEqual(22);
    randomSpy.mockRestore();
  });
});
