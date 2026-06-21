import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CombatPanel } from './combat-panel';

describe('CombatPanel', () => {
  let component: CombatPanel;
  let fixture: ComponentFixture<CombatPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CombatPanel],
    }).compileComponents();

    fixture = TestBed.createComponent(CombatPanel);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
