import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { GameState } from '../game-state/game-state.service';
import { AudioDirector, sfxForAnimation } from './audio-director.service';
import { AudioService } from './audio.service';

describe('sfxForAnimation', () => {
  it('maps enemy and hero animations to distinct sounds', () => {
    expect(sfxForAnimation({ target: 'enemy', type: 'hit' })).toBe('hit');
    expect(sfxForAnimation({ target: 'hero', type: 'hit' })).toBe('playerHit');
    expect(sfxForAnimation({ target: 'enemy', type: 'crit' })).toBe('crit');
    expect(sfxForAnimation({ target: 'hero', type: 'guard' })).toBe('guard');
    expect(sfxForAnimation({ target: 'hero', type: 'skill' })).toBe('skill');
    expect(sfxForAnimation({ target: 'enemy', type: 'death' })).toBe('death');
  });
});

describe('AudioDirector', () => {
  let play: ReturnType<typeof vi.fn>;
  let setMusic: ReturnType<typeof vi.fn>;
  let state: GameState;

  beforeEach(() => {
    localStorage.clear();
    play = vi.fn();
    setMusic = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: AudioService, useValue: { play, setMusic } }],
    });
    state = TestBed.inject(GameState);
    TestBed.inject(AudioDirector);
    TestBed.tick();
    play.mockClear();
  });

  afterEach(() => localStorage.clear());

  it('starts the neutral theme and switches to boss music for bosses', () => {
    expect(setMusic).toHaveBeenCalledWith('grove');

    state.setEnemy({
      id: 'b',
      name: 'Boss',
      role: 'boss',
      hp: 10,
      maxHp: 10,
      attack: 1,
      gold: 0,
      xp: 0,
      icon: 'B',
      level: 1,
      elite: false,
      isBoss: true,
      weakness: null,
      telegraphedAbility: null,
    });
    TestBed.tick();

    expect(setMusic).toHaveBeenLastCalledWith('boss');
    expect(play).toHaveBeenCalledWith('boss');
  });

  it('plays level-up and status sounds on state changes only', () => {
    state.updatePlayer((player) => ({ ...player, level: player.level + 1 }));
    TestBed.tick();
    expect(play).toHaveBeenCalledWith('levelUp');

    play.mockClear();
    state.updatePlayer((player) => ({ ...player, gold: player.gold + 5 }));
    TestBed.tick();
    expect(play).not.toHaveBeenCalled();

    state.updatePlayer((player) => ({
      ...player,
      statusEffect: { type: 'burn', rounds: 2, damagePerRound: 3 },
    }));
    TestBed.tick();
    expect(play).toHaveBeenCalledWith('status');
  });

  it('plays a soft click for buttons but not inside the combat panel', () => {
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.click();
    expect(play).toHaveBeenCalledWith('ui');

    play.mockClear();
    const panel = document.createElement('app-combat-panel');
    const inner = document.createElement('button');
    panel.appendChild(inner);
    document.body.appendChild(panel);
    inner.click();
    expect(play).not.toHaveBeenCalled();

    button.remove();
    panel.remove();
  });
});
