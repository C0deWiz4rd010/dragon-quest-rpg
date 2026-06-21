import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GamePage } from './game-page';

describe('GamePage', () => {
  let component: GamePage;
  let fixture: ComponentFixture<GamePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GamePage],
    }).compileComponents();

    fixture = TestBed.createComponent(GamePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders cockpit dashboard chips and mobile navigation', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.cockpit-bar')).toBeTruthy();
    expect(compiled.querySelectorAll('.dashboard-chip').length).toBe(8);
    expect(compiled.querySelectorAll('.mobile-tabs button').length).toBe(4);
  });

  it('registers game testing hooks', async () => {
    expect(window.render_game_to_text?.()).toContain('level=1');
    expect(window.render_game_to_text?.()).toContain('pressure=');
    expect(window.render_game_to_text?.()).toContain('routeStreak=0');
    expect(window.render_game_to_text?.()).toContain('resolve=');
    expect(window.render_game_to_text?.()).toContain('riposte=0');
    expect(window.render_game_to_text?.()).toContain('perfectGuards=0');
    expect(window.render_game_to_text?.()).toContain('overkill=0');
    expect(window.render_game_to_text?.()).toContain('overkillStreak=0');
    expect(window.render_game_to_text?.()).toContain('dragonShards=0');
    expect(window.render_game_to_text?.()).toContain('dragonRank=');
    expect(window.render_game_to_text?.()).toContain('runGrade=');
    expect(window.render_game_to_text?.()).toContain('bossPrep=');
    expect(window.render_game_to_text?.()).toContain('contract=');
    expect(window.render_game_to_text?.()).toContain('completedContracts=');
    expect(window.render_game_to_text?.()).toContain('contractStreak=');
    expect(window.render_game_to_text?.()).toContain('blessings=none');
    expect(window.render_game_to_text?.()).toContain('relics=none');
    expect(window.render_game_to_text?.()).toContain('routeHistory=none');
    expect(window.render_game_to_text?.()).toContain('directive=');
    expect(window.render_game_to_text?.()).toContain('routeSynergy=');
    expect(window.render_game_to_text?.()).toContain('biomes=');
    expect(window.render_game_to_text?.()).toContain('advisor=');
    await expect(window.advanceTime?.(0)).resolves.toBeUndefined();
  });
});
