import { TestBed } from '@angular/core/testing';

import { GameState } from '../game-state/game-state.service';
import { EVENT_LIBRARY, EventApi, EventInfo, pickEvent } from './event-library';

describe('event library', () => {
  function info(overrides: Partial<EventInfo> = {}): EventInfo {
    const player = TestBed.inject(GameState).player();

    return {
      depth: 5,
      luck: 3,
      goldBase: 60,
      player: { ...player, gold: 500, potions: 3, mana: 100 },
      odds: (base, cap) => Math.min(cap, base + 2),
      ...overrides,
    };
  }

  function recordingApi(gambleResult: boolean): { api: EventApi; calls: string[] } {
    const calls: string[] = [];
    const record =
      (name: string) =>
      (...args: unknown[]) => {
        calls.push(`${name}:${args.join(',')}`);
      };
    const api: EventApi = {
      hurt: record('hurt'),
      heal: record('heal'),
      mana: record('mana'),
      gold: record('gold'),
      potions: record('potions'),
      shards: record('shards'),
      resolve: record('resolve'),
      permanent: record('permanent'),
      blessing: (pool) => {
        calls.push(`blessing:${pool.join('|')}`);
        return 'Segen';
      },
      fixedBlessing: record('fixedBlessing'),
      relic: record('relic'),
      cleanse: record('cleanse'),
      afflict: record('afflict'),
      gamble: () => gambleResult,
      log: record('log'),
    };

    return { api, calls };
  }

  beforeEach(() => TestBed.configureTestingModule({}));

  it('offers at least 30 uniquely identified events', () => {
    expect(EVENT_LIBRARY.length).toBeGreaterThanOrEqual(30);
    expect(new Set(EVENT_LIBRARY.map((event) => event.id)).size).toBe(EVENT_LIBRARY.length);
  });

  it('covers every biome with dedicated events', () => {
    for (const biome of ['ember', 'grove', 'ruin', 'frost', 'storm', 'sanctum'] as const) {
      expect(EVENT_LIBRARY.some((event) => event.biomes?.includes(biome)), biome).toBe(true);
    }
  });

  it('gives each event two well-formed choices that run without errors', () => {
    for (const event of EVENT_LIBRARY) {
      const choices = event.choices(info());

      expect(choices.length, event.id).toBeGreaterThanOrEqual(2);
      expect(new Set(choices.map((choice) => choice.id)).size, event.id).toBe(choices.length);

      for (const choice of choices) {
        expect(choice.title, event.id).toBeTruthy();
        expect(choice.rewardLabel, event.id).toBeTruthy();

        for (const win of [true, false]) {
          const { api, calls } = recordingApi(win);

          expect(() => choice.apply(api), `${event.id}/${choice.id}`).not.toThrow();
          expect(calls.some((call) => call.startsWith('log:')), `${event.id}/${choice.id}`).toBe(
            true,
          );
        }
      }
    }
  });

  it('disables paid choices the player cannot afford', () => {
    const poor = info({ player: { ...info().player, gold: 0, potions: 0, mana: 0 } });
    const disabled = EVENT_LIBRARY.flatMap((event) => event.choices(poor)).filter(
      (choice) => choice.disabled,
    );

    expect(disabled.length).toBeGreaterThan(5);
  });

  it('respects minimum depth when picking', () => {
    for (let i = 0; i < 100; i++) {
      expect(pickEvent(undefined, 0).minDepth ?? 0).toBeLessThanOrEqual(0);
    }
  });

  it('favours events tagged for the current biome', () => {
    const picks = Array.from({ length: 600 }, () => pickEvent('frost', 6));
    const frost = picks.filter((event) => event.biomes?.includes('frost')).length;
    const ember = picks.filter((event) => event.biomes?.includes('ember')).length;

    expect(frost).toBeGreaterThan(ember * 2);
  });
});
