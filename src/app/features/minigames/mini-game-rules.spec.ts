import { TestBed } from '@angular/core/testing';

import { MiniGameService } from './mini-game.service';
import {
  generateSums,
  memoryScore,
  miniGameDifficulty,
  reactionScore,
  timeScore,
} from './mini-game-rules';

describe('mini-game rules', () => {
  it('gets harder with depth but stays within fair bounds', () => {
    const early = miniGameDifficulty(0);
    const late = miniGameDifficulty(40);

    expect(late.memoryLength).toBeGreaterThan(early.memoryLength);
    expect(late.typingSeconds).toBeLessThan(early.typingSeconds);
    expect(late.reactionLimitMs).toBeLessThan(early.reactionLimitMs);
    expect(late.memoryLength).toBeLessThanOrEqual(7);
    expect(late.precisionSeconds).toBeGreaterThanOrEqual(2);
    expect(late.precisionMoveMs).toBeGreaterThanOrEqual(380);
    expect(late.typingSeconds).toBeGreaterThanOrEqual(7);
    expect(late.reactionLimitMs).toBeGreaterThanOrEqual(450);
    expect(miniGameDifficulty(-5)).toEqual(early);
  });

  it('scores faster finishes higher and losses as zero', () => {
    expect(timeScore(true, 10, 10)).toBe(100);
    expect(timeScore(true, 0, 10)).toBe(60);
    expect(timeScore(true, 5, 10)).toBe(80);
    expect(timeScore(false, 10, 10)).toBe(0);
    expect(timeScore(true, 99, 10)).toBe(100);
  });

  it('rewards longer memory sequences and faster reactions', () => {
    expect(memoryScore(true, 4)).toBe(70);
    expect(memoryScore(true, 7)).toBe(100);
    expect(memoryScore(false, 7)).toBe(20);
    expect(reactionScore(100, 700)).toBeGreaterThan(reactionScore(500, 700));
    expect(reactionScore(700, 700)).toBe(0);
  });

  it('generates solvable sums with non-negative answers', () => {
    const sums = generateSums(50, 20);

    expect(sums).toHaveLength(50);
    for (const sum of sums) {
      expect(Number.isInteger(sum.answer)).toBe(true);
      expect(sum.answer).toBeGreaterThanOrEqual(0);
      expect(sum.text).toMatch(/^\d+ [+−×] \d+$/);
    }
  });

  it('is deterministic for a fixed random source', () => {
    expect(generateSums(3, 0, () => 0)).toEqual(generateSums(3, 0, () => 0));
  });
});

describe('MiniGameService', () => {
  it('passes depth and completes with a result', () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(MiniGameService);
    let received: { won: boolean; score: number } | null = null;

    service.launch('sums', (result) => (received = result), 12);

    expect(service.activeGame()?.depth).toBe(12);
    expect(service.activeGame()?.type).toBe('sums');

    service.complete({ won: true, score: 88 });

    expect(received).toEqual({ won: true, score: 88 });
    expect(service.activeGame()).toBeNull();
  });
});
