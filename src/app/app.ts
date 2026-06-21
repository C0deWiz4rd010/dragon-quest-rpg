import { ChangeDetectionStrategy, Component } from '@angular/core';
import { GamePage } from './pages/game/game-page';

@Component({
  selector: 'app-root',
  imports: [GamePage],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
