import { TestBed } from '@angular/core/testing';

import { GameState } from './game-state.service';

describe('GameState', () => {
  let service: GameState;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GameState);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('tracks and rewards the active run contract', () => {
    service.updatePlayer((player) => ({
      ...player,
      gold: 0,
      resolve: 0,
      activeContract: {
        type: 'slayer',
        title: 'Test Contract',
        description: 'Defeat enemies',
        progress: 1,
        target: 2,
        rewardGold: 40,
        rewardResolve: 1,
        completed: false,
      },
    }));

    service.advanceContract('pathfinder');
    expect(service.player().activeContract.progress).toBe(1);

    service.advanceContract('slayer');

    expect(service.player().activeContract.completed).toBe(true);
    expect(service.player().gold).toBe(40);
    expect(service.player().resolve).toBe(1);
    expect(service.player().completedContracts).toBe(1);
    expect(service.player().contractStreak).toBe(1);
  });

  it('accepts a new contract after completion', () => {
    service.updatePlayer((player) => ({
      ...player,
      completedContracts: 2,
      activeContract: {
        type: 'slayer',
        title: 'Finished',
        description: 'Done',
        progress: 1,
        target: 1,
        rewardGold: 10,
        rewardResolve: 1,
        completed: true,
      },
    }));

    service.acceptNextContract();

    expect(service.player().activeContract.completed).toBe(false);
    expect(service.player().activeContract.progress).toBe(0);
    expect(service.player().activeContract.type).not.toBe('slayer');
  });

  it('stacks blessing charges and tracks their total', () => {
    service.grantBlessing('focus', 2, 'Test');
    service.grantBlessing('focus', 1, 'Test');
    service.grantBlessing('ward', 2, 'Test');

    expect(service.blessingCharges('focus')).toBe(3);
    expect(service.blessingCharges('ward')).toBe(2);
    expect(service.activeBlessingCount()).toBe(5);
  });

  it('tracks dragon shards, route history and boss prep state', () => {
    service.addDragonShards(4, 'Test');
    service.recordRouteHistory({
      depth: 4,
      label: 'Sanktuarium',
      result: 'Segen',
      type: 'sanctuary',
    });

    service.updatePlayer((player) => ({
      ...player,
      hp: 90,
      mana: 82,
      potions: 2,
      resolve: 2,
    }));

    expect(service.player().dragonShards).toBe(4);
    expect(service.player().routeHistory.length).toBe(1);
    expect(service.bossPrepScore()).toBeGreaterThan(40);
    expect(service.bossPrepLabel()).toBe('Sehr stabil');
    expect(service.dragonRank()).toBe('Frisch');
    expect(service.runGrade()).toBe('D');
  });

  it('factors pet luck into rank-oriented run metrics', () => {
    service.updatePlayer((player) => ({
      ...player,
      level: 9,
      completedPaths: 12,
      eliteKills: 4,
      dragonShards: 8,
      bossKilled: true,
      activeBlessings: [{ type: 'focus', charges: 2 }],
      ownedRelics: [{ id: 'oracle-lens', name: 'Oracle Lens', icon: 'Lens', desc: '+1' }],
      activePet: {
        id: 'clover',
        name: 'Clover',
        icon: 'Stars',
        bonusType: 'luck',
        bonusValue: 3,
        desc: '+3 Glueck',
      },
    }));

    expect(service.playerLuck()).toBe(8);
    expect(service.dragonRank()).toBe('Mythisch');
    expect(service.runGrade()).toBe('S');
  });
});
