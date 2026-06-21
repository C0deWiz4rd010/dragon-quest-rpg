import { Injectable, signal } from '@angular/core';
import { Relic } from '../inventory/relic.model';
import { RunBlessingType } from '../inventory/player.model';

export type MerchantOfferKind = 'sustain' | 'tempo' | 'blessing' | 'relic' | 'forge';

export interface MerchantOffer {
  id: string;
  title: string;
  description: string;
  cost: number;
  rewardLabel: string;
  kind: MerchantOfferKind;
  attackBonus?: number;
  blessing?: { charges: number; type: RunBlessingType };
  cleanse?: boolean;
  cooldown?: number;
  defenseBonus?: number;
  hp?: number;
  mana?: number;
  potions?: number;
  relic?: Relic;
}

export interface MerchantEncounter {
  type: 'merchant';
  currentGold: number;
  source: string;
  subtitle: string;
  offers: MerchantOffer[];
  onResolve: (offer: MerchantOffer | null) => void;
}

export type DilemmaTone = 'risk' | 'reward' | 'safe';

export interface DilemmaChoice {
  id: string;
  title: string;
  description: string;
  /** Short downside line, e.g. "Risiko: -15% HP". */
  riskLabel?: string;
  /** Short upside line, e.g. "Relikt-Chance". */
  rewardLabel: string;
  tone: DilemmaTone;
  /** Odds (0-100) shown as a chance meter when the outcome is a gamble. */
  chance?: number;
  disabled?: boolean;
}

export interface DilemmaEncounter {
  type: 'dilemma';
  source: string;
  subtitle: string;
  flavor: string;
  icon: string;
  biome?: string;
  choices: DilemmaChoice[];
  onResolve: (choiceId: string | null) => void;
}

export type RunEncounter = MerchantEncounter | DilemmaEncounter;

@Injectable({
  providedIn: 'root',
})
export class RunEncounterService {
  readonly activeEncounter = signal<RunEncounter | null>(null);

  launchMerchant(
    source: string,
    subtitle: string,
    offers: MerchantOffer[],
    currentGold: number,
    onResolve: (offer: MerchantOffer | null) => void,
  ): void {
    this.activeEncounter.set({
      type: 'merchant',
      currentGold,
      source,
      subtitle,
      offers,
      onResolve,
    });
  }

  launchDilemma(encounter: Omit<DilemmaEncounter, 'type'>): void {
    this.activeEncounter.set({ type: 'dilemma', ...encounter });
  }

  resolve(id: string | null): void {
    const encounter = this.activeEncounter();
    this.activeEncounter.set(null);

    if (!encounter) {
      return;
    }

    if (encounter.type === 'dilemma') {
      encounter.onResolve(id);
      return;
    }

    const offer = encounter.offers.find((entry) => entry.id === id) ?? null;
    encounter.onResolve(offer);
  }
}
