import { Injectable, computed, signal } from '@angular/core';

export interface TutorialStep {
  icon: string;
  title: string;
  body: string;
}

const STORAGE_KEY = 'hasCompletedTutorial';

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    icon: '🐉',
    title: 'Willkommen, Held',
    body: 'Dragon Quest RPG ist ein Roguelite. Kämpfe dich durch Pfade und besiege am Ende den Drachenkönig.',
  },
  {
    icon: '🧭',
    title: 'Der Pfad',
    body: 'Wähle auf dem Pfad-Brett deine Route: Kämpfe, Schätze, Schmieden, Rastplätze und Ereignisse warten.',
  },
  {
    icon: '⚔',
    title: 'Kampf',
    body: 'Greife an, blocke im richtigen Moment für einen perfekten Konter und nutze Fähigkeiten und Tränke weise.',
  },
  {
    icon: '🔗',
    title: 'Combo & Resolve',
    body: 'Aufeinanderfolgende Treffer bauen Combos auf. Resolve rettet dich in brenzligen Situationen.',
  },
  {
    icon: '🎒',
    title: 'Ausrüstung',
    body: 'Rüste Waffen, Rüstung, Ringe, Pets und Relikte aus. Gleiche Element-Sets und Relikt-Synergien geben Boni.',
  },
  {
    icon: '⭐',
    title: 'Level-Up',
    body: 'Beim Aufstieg wählst du einen Bonus. Manchmal erlernst du zusätzlich eine passive Fähigkeit.',
  },
  {
    icon: '🏅',
    title: 'Erfolge',
    body: 'Schalte 30 Erfolge frei — sie bleiben über alle Runs hinweg erhalten.',
  },
  {
    icon: '💾',
    title: 'Speichern',
    body: 'Speichere in einem von 3 Slots und setze deinen Lauf jederzeit fort. Viel Erfolg!',
  },
];

@Injectable({ providedIn: 'root' })
export class TutorialService {
  readonly steps = TUTORIAL_STEPS;
  readonly stepIndex = signal(0);
  readonly active = signal(false);

  readonly currentStep = computed(() => this.steps[this.stepIndex()]);
  readonly isLastStep = computed(() => this.stepIndex() >= this.steps.length - 1);

  maybeStart(): void {
    if (!this.hasCompleted()) {
      this.stepIndex.set(0);
      this.active.set(true);
    }
  }

  open(): void {
    this.stepIndex.set(0);
    this.active.set(true);
  }

  next(): void {
    if (this.isLastStep()) {
      this.finish();
      return;
    }
    this.stepIndex.update((index) => index + 1);
  }

  back(): void {
    this.stepIndex.update((index) => Math.max(0, index - 1));
  }

  finish(): void {
    this.active.set(false);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      /* storage unavailable — ignore */
    }
  }

  private hasCompleted(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }
}
