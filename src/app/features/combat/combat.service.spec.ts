import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { GameState } from '../game-state/game-state.service';
import { Combat } from './combat.service';

describe('Combat', () => {
  let service: Combat;
  let gameState: GameState;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Combat);
    gameState = TestBed.inject(GameState);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('uses resolve as a no-counterattack panic action', () => {
    gameState.updatePlayer((player) => ({
      ...player,
      hp: 20,
      mana: 10,
      resolve: 1,
      skillCooldown: 3,
      statusEffect: { type: 'burn', rounds: 2, damagePerRound: 8 },
    }));
    gameState.setEnemy({
      id: 'enemy-1',
      name: 'Swift Test',
      role: 'swift',
      hp: 40,
      maxHp: 40,
      attack: 999,
      gold: 0,
      xp: 0,
      icon: 'S',
      level: 1,
      elite: false,
      weakness: 'lightning',
      telegraphedAbility: null,
    });

    service.useResolve();

    expect(gameState.player().resolve).toBe(0);
    expect(gameState.player().hp).toBeGreaterThan(20);
    expect(gameState.player().mana).toBeGreaterThan(10);
    expect(gameState.player().skillCooldown).toBeLessThan(3);
    expect(gameState.player().statusEffect).toBeNull();
    expect(gameState.player().guarding).toBe(true);
  });

  it('boosts attacks with battle blessings and consumes the charge', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    gameState.updatePlayer((player) => ({
      ...player,
      activeBlessings: [{ type: 'battle', charges: 1 }],
    }));
    gameState.setEnemy({
      id: 'enemy-2',
      name: 'Bruiser Test',
      role: 'bruiser',
      hp: 80,
      maxHp: 80,
      attack: 8,
      gold: 0,
      xp: 0,
      icon: 'B',
      level: 1,
      elite: false,
      weakness: 'ice',
      telegraphedAbility: null,
    });

    service.attack();

    expect(gameState.enemy()?.hp).toBe(51);
    expect(gameState.player().activeBlessings.length).toBe(0);
    randomSpy.mockRestore();
  });

  it('uses ward and focus blessings during the enemy exchange', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    gameState.updatePlayer((player) => ({
      ...player,
      mana: 20,
      skillCooldown: 3,
      activeBlessings: [
        { type: 'ward', charges: 1 },
        { type: 'focus', charges: 1 },
      ],
    }));
    gameState.setEnemy({
      id: 'enemy-3',
      name: 'Hexer Test',
      role: 'hexer',
      hp: 90,
      maxHp: 90,
      attack: 15,
      gold: 0,
      xp: 0,
      icon: 'H',
      level: 1,
      elite: false,
      weakness: 'fire',
      telegraphedAbility: null,
    });

    service.guard();

    expect(gameState.player().statusEffect).toBeNull();
    expect(gameState.player().skillCooldown).toBe(0);
    expect(gameState.player().mana).toBe(54);
    expect(gameState.player().activeBlessings.length).toBe(0);
    randomSpy.mockRestore();
  });

  it('builds riposte charges from guarded enemy hits', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    gameState.setEnemy({
      id: 'enemy-4',
      name: 'Guard Test',
      role: 'swift',
      hp: 90,
      maxHp: 90,
      attack: 10,
      gold: 0,
      xp: 0,
      icon: 'G',
      level: 1,
      elite: false,
      weakness: 'lightning',
      telegraphedAbility: null,
    });

    service.guard();

    expect(gameState.player().riposteCharges).toBeGreaterThan(0);
    expect(gameState.player().perfectGuards).toBeGreaterThan(0);
    expect(gameState.logs().some((entry) => entry.message.includes('Riposte'))).toBe(true);
    randomSpy.mockRestore();
  });

  it('spends riposte charges on the next attack', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    gameState.updatePlayer((player) => ({
      ...player,
      riposteCharges: 2,
    }));
    gameState.setEnemy({
      id: 'enemy-5',
      name: 'Riposte Target',
      role: 'bruiser',
      hp: 120,
      maxHp: 120,
      attack: 1,
      gold: 0,
      xp: 0,
      icon: 'R',
      level: 1,
      elite: false,
      weakness: 'ice',
      telegraphedAbility: null,
    });

    service.attack();

    expect(gameState.player().riposteCharges).toBe(0);
    expect(gameState.logs().some((entry) => entry.message.includes('Riposte entlaedt'))).toBe(true);
    randomSpy.mockRestore();
  });

  it('tracks overkill rewards from oversized kill damage', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    gameState.updatePlayer((player) => ({
      ...player,
      mana: 40,
    }));
    gameState.setEnemy({
      id: 'enemy-6',
      name: 'Overkill Target',
      role: 'elite',
      hp: 1,
      maxHp: 100,
      attack: 1,
      gold: 10,
      xp: 1,
      icon: 'O',
      level: 1,
      elite: true,
      weakness: 'shadow',
      telegraphedAbility: null,
    });

    service.attack();

    expect(gameState.enemy()).toBeNull();
    expect(gameState.player().totalOverkillDamage).toBeGreaterThan(0);
    expect(gameState.player().overkillStreak).toBe(1);
    expect(gameState.logs().some((entry) => entry.message.includes('Overkill'))).toBe(true);
    randomSpy.mockRestore();
  });
});
