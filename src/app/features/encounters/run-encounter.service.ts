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

@Injectable({
  providedIn: 'root',
})
export class RunEncounterService {
  readonly activeEncounter = signal<MerchantEncounter | null>(null);

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

  resolve(offerId: string | null): void {
    const encounter = this.activeEncounter();
    this.activeEncounter.set(null);

    if (!encounter) {
      return;
    }

    const offer = encounter.offers.find((entry) => entry.id === offerId) ?? null;
    encounter.onResolve(offer);
  }
}
