import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PathBoard } from './path-board';

describe('PathBoard', () => {
  let component: PathBoard;
  let fixture: ComponentFixture<PathBoard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PathBoard],
    }).compileComponents();

    fixture = TestBed.createComponent(PathBoard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
