import { computed, Injectable, inject, signal } from '@angular/core';
import { roleLootMultiplier } from '../combat/combat-rules';
import { Enemy } from '../combat/enemy.model';
import { createLevelUpChoices, GameState } from '../game-state/game-state.service';
import { blessingLabel } from '../game-state/run-blessings';
import { Item } from './item.model';
import { Pet } from './pet.model';
import { Player } from './player.model';
import { Relic } from './relic.model';
import { randomMissingRelic, RUN_RELICS } from './relics';

export interface LootToast {
  name: string;
  icon: string;
  kind: 'item' | 'pet' | 'relic';
}

@Injectable({
  providedIn: 'root',
})
export class Inventory {
  private readonly gameState = inject(GameState);

  readonly lastLoot = signal<LootToast | null>(null);
  private lootToastTimer: ReturnType<typeof setTimeout> | null = null;

  readonly lootItems = LOOT_ITEMS;
  readonly lootPets = LOOT_PETS;
  readonly lootRelics = RUN_RELICS;

  readonly ownedEquipment = computed(() => this.gameState.player().ownedItems);
  readonly ownedPets = computed(() => this.gameState.player().ownedPets);
  readonly ownedRelics = computed(() => this.gameState.player().ownedRelics);
  readonly equippedItems = computed(() => {
    const player = this.gameState.player();

    return [player.equippedWeapon, player.equippedArmor, player.equippedRing].filter((item): item is Item => !!item);
  });

  buyPotion(): void {
    this.buy(
      50,
      (player) => ({
        ...player,
        potions: player.potions + 1,
      }),
      'Heiltrank gekauft.',
    );
  }

  buyAttack(): void {
    this.buy(
      100,
      (player) => ({
        ...player,
        attackBonus: player.attackBonus + 5,
      }),
      'Angriff dauerhaft verbessert.',
    );
  }

  buyDefense(): void {
    this.buy(
      100,
      (player) => ({
        ...player,
        defenseBonus: player.defenseBonus + 3,
      }),
      'Verteidigung dauerhaft verbessert.',
    );
  }

  buyFocus(): void {
    this.buy(
      80,
      (player) => ({
        ...player,
        mana: Math.min(player.maxMana, player.mana + 30),
        skillCooldown: Math.max(0, player.skillCooldown - 2),
      }),
      'Fokuskristall gekauft: Mana und Drachenklaue erholen sich.',
    );
  }

  buyCleanse(): void {
    if (!this.gameState.player().statusEffect) {
      this.gameState.addLog('Kein Statuseffekt aktiv, Reinigung gespart.', 'event');
      return;
    }

    this.buy(
      75,
      (player) => ({
        ...player,
        hp: Math.min(player.maxHp, player.hp + 10),
        statusEffect: null,
      }),
      'Reinigung gekauft: Status entfernt und +10 HP.',
    );
  }

  buyResolveCapacity(): void {
    const player = this.gameState.player();

    if (player.maxResolve >= 5) {
      this.gameState.addLog('Resolve-Kapazitaet ist bereits am Limit.', 'event');
      return;
    }

    this.buy(
      140,
      (current) => ({
        ...current,
        maxResolve: current.maxResolve + 1,
        resolve: Math.min(current.maxResolve + 1, current.resolve + 1),
      }),
      'Resolve-Kapazitaet erweitert und +1 Resolve aufgefuellt.',
    );
  }

  brewDragonTonic(): void {
    this.spendShards(
      3,
      (player) => ({
        ...player,
        hp: Math.min(player.maxHp, player.hp + 12),
        mana: Math.min(player.maxMana, player.mana + 16),
        potions: player.potions + 1,
      }),
      'Drachentonikum gebraut: +1 Trank, +12 HP, +16 Mana.',
    );
  }

  rerollLevelUpChoices(): void {
    if (!this.gameState.levelUpChoices().length) {
      this.gameState.addLog('Kein Level-Up-Fenster aktiv fuer einen Reroll.', 'event');
      return;
    }

    this.spendShards(
      4,
      (player) => player,
      'Level-Up-Auswahl per Dragon Shards neu gemischt.',
      () => {
        const currentIds = this.gameState.levelUpChoices().map((choice) => choice.id);
        this.gameState.levelUpChoices.set(createLevelUpChoices(currentIds));
      },
    );
  }

  buyPrepCache(): void {
    this.spendShards(
      5,
      (player) => ({
        ...player,
        resolve: Math.min(player.maxResolve, player.resolve + 1),
      }),
      'Boss-Prep-Cache geoeffnet: +1 Resolve und frischer Segen.',
      () => {
        const blessingType = this.gameState.player().statusEffect ? 'ward' : this.gameState.player().mana < this.gameState.player().maxMana * 0.5 ? 'focus' : 'battle';
        this.gameState.grantBlessing(blessingType, 2, 'Prep-Cache');
      },
    );
  }

  buyContractIntel(): void {
    const contract = this.gameState.player().activeContract;

    if (contract.completed) {
      this.gameState.addLog('Kein offener Auftrag fuer Vertrags-Intel aktiv.', 'event');
      return;
    }

    this.spendShards(
      2,
      (player) => ({
        ...player,
        mana: Math.min(player.maxMana, player.mana + 10),
      }),
      'Vertrags-Intel gekauft: Auftrag +1 Fortschritt und etwas Mana.',
      () => {
        this.gameState.advanceContract(contract.type);
      },
    );
  }

  buyBlessingInfusion(): void {
    const player = this.gameState.player();
    const blessingType = chooseInfusionBlessing(player);
    const charges = player.activeBlessings.some((blessing) => blessing.type === blessingType) ? 1 : 2;

    this.spendShards(
      4,
      (current) => ({
        ...current,
        hp: Math.min(current.maxHp, current.hp + (blessingType === 'vigor' ? 10 : 4)),
        mana: Math.min(current.maxMana, current.mana + (blessingType === 'focus' ? 16 : 8)),
        resolve: Math.min(current.maxResolve, current.resolve + (blessingType === 'ward' ? 1 : 0)),
        statusEffect: blessingType === 'ward' ? null : current.statusEffect,
      }),
      `Blessing-Infusion aktiviert: ${blessingLabel(blessingType)} mit ${charges} Ladung${charges === 1 ? '' : 'en'}.`,
      () => {
        this.gameState.grantBlessing(blessingType, charges, 'Infusion');
      },
    );
  }

  equip(item: Item): void {
    if (!this.gameState.player().ownedItems.some((ownedItem) => ownedItem.id === item.id)) {
      return;
    }

    this.gameState.updatePlayer((player) => {
      if (item.type === 'weapon') {
        return { ...player, equippedWeapon: item };
      }

      if (item.type === 'armor') {
        return { ...player, equippedArmor: item };
      }

      return { ...player, equippedRing: item };
    });
    this.gameState.addLog(`${item.name} ausgerustet.`, 'event');
  }

  activatePet(pet: Pet): void {
    if (!this.gameState.player().ownedPets.some((ownedPet) => ownedPet.id === pet.id)) {
      return;
    }

    this.gameState.updatePlayer((player) => ({ ...player, activePet: pet }));
    this.gameState.addLog(`${pet.name} begleitet dich jetzt.`, 'event');
  }

  grantRelic(relic: Relic, source: string): boolean {
    if (this.gameState.player().ownedRelics.some((ownedRelic) => ownedRelic.id === relic.id)) {
      this.gameState.addDragonShards(2, `${source} Duplikat-Relic`);
      return false;
    }

    this.gameState.updatePlayer((player) => ({
      ...player,
      ownedRelics: [...player.ownedRelics, relic],
    }));
    this.gameState.addLog(`${source}: ${relic.name} gefunden.`, 'achievement');
    this.showLootToast({ name: relic.name, icon: relic.icon, kind: 'relic' });
    return true;
  }

  awardLoot(enemy: Enemy): void {
    const player = this.gameState.player();
    const roleBonus = Math.max(0, roleLootMultiplier(enemy.role) - 1) * 0.22;
    const lootChance = Math.min(1, enemy.isBoss ? 1 : enemy.elite ? 0.75 : 0.34 + roleBonus);

    if (Math.random() > lootChance) {
      return;
    }

    if ((enemy.elite || enemy.isBoss) && Math.random() > 0.35) {
      const relic = randomMissingRelic(player) ?? randomFrom(this.lootRelics);

      if (relic) {
        this.grantRelic(relic, 'Relic-Loot');
        return;
      }
    }

    const shouldDropPet = Math.random() > 0.72;

    if (shouldDropPet) {
      const pet = randomMissing(this.lootPets, player.ownedPets) ?? randomFrom(this.lootPets);

      if (pet) {
        if (player.ownedPets.some((ownedPet) => ownedPet.id === pet.id)) {
          this.gameState.addDragonShards(1, `${enemy.name} Pet-Duplikat`);
          return;
        }

        this.gameState.updatePlayer((current) => ({ ...current, ownedPets: [...current.ownedPets, pet] }));
        this.gameState.addLog(`Loot: ${pet.name} schliesst sich dir an.`, 'achievement');
        this.showLootToast({ name: pet.name, icon: pet.icon ?? 'P', kind: 'pet' });
      }

      return;
    }

    const item = randomMissing(this.lootItems, player.ownedItems) ?? randomFrom(this.lootItems);

    if (!item) {
      return;
    }

    if (player.ownedItems.some((ownedItem) => ownedItem.id === item.id)) {
      const salvageGold = 18 + Math.max(0, enemy.level - 1) * 4;

      this.gameState.updatePlayer((current) => ({
        ...current,
        gold: current.gold + salvageGold,
      }));
      this.gameState.addLog(`Loot: ${item.name} zerlegt. +${salvageGold} Gold aus Ersatzteilen.`, 'event');
      return;
    }

    this.gameState.updatePlayer((current) => ({
      ...current,
      ownedItems: [...current.ownedItems, item],
      equippedWeapon: item.type === 'weapon' && !current.equippedWeapon ? item : current.equippedWeapon,
      equippedArmor: item.type === 'armor' && !current.equippedArmor ? item : current.equippedArmor,
      equippedRing: item.type === 'ring' && !current.equippedRing ? item : current.equippedRing,
    }));
    this.gameState.addLog(`Loot: ${item.name} gefunden.`, 'achievement');
    this.showLootToast({ name: item.name, icon: item.icon ?? 'I', kind: 'item' });
  }

  private showLootToast(toast: LootToast): void {
    if (this.lootToastTimer !== null) clearTimeout(this.lootToastTimer);
    this.lastLoot.set(toast);
    this.lootToastTimer = setTimeout(() => this.lastLoot.set(null), 3200);
  }

  isEquipped(item: Item): boolean {
    const player = this.gameState.player();

    return player.equippedWeapon?.id === item.id || player.equippedArmor?.id === item.id || player.equippedRing?.id === item.id;
  }

  isActivePet(pet: Pet): boolean {
    return this.gameState.player().activePet?.id === pet.id;
  }

  acceptNextContract(): void {
    this.gameState.acceptNextContract();
  }

  private buy(cost: number, update: Parameters<GameState['updatePlayer']>[0], successMessage: string): void {
    if (this.gameState.player().gold < cost || !this.gameState.gameActive()) {
      this.gameState.addLog('Nicht genug Gold oder der Lauf ist beendet.', 'damage');
      return;
    }

    this.gameState.updatePlayer((player) => update({ ...player, gold: player.gold - cost }));
    this.gameState.addLog(successMessage, 'heal');
  }

  private spendShards(
    cost: number,
    update: Parameters<GameState['updatePlayer']>[0],
    successMessage: string,
    afterSpend?: () => void,
  ): void {
    if (this.gameState.player().dragonShards < cost || !this.gameState.gameActive()) {
      this.gameState.addLog('Nicht genug Dragon Shards oder der Lauf ist beendet.', 'damage');
      return;
    }

    this.gameState.updatePlayer((player) => update({ ...player, dragonShards: player.dragonShards - cost }));
    afterSpend?.();
    this.gameState.addLog(successMessage, 'achievement');
  }
}

function randomMissing<T extends { id: string }>(options: T[], owned: T[]): T | null {
  const missing = options.filter((option) => !owned.some((ownedOption) => ownedOption.id === option.id));

  return missing[Math.floor(Math.random() * missing.length)] ?? null;
}

function randomFrom<T>(options: T[]): T | null {
  return options[Math.floor(Math.random() * options.length)] ?? null;
}

function chooseInfusionBlessing(player: Player): Player['activeBlessings'][number]['type'] {
  if (player.statusEffect) {
    return 'ward';
  }

  if (player.hp / player.maxHp < 0.55) {
    return 'vigor';
  }

  if (player.mana / player.maxMana < 0.45 || player.skillCooldown > 1) {
    return 'focus';
  }

  if (player.completedPaths > 0 && player.completedPaths % 5 === 4) {
    return 'battle';
  }

  return 'fortune';
}

const LOOT_ITEMS: Item[] = [
  {
    id: 'iron-sword',
    name: 'Eisenschwert',
    type: 'weapon',
    attackBonus: 7,
    defenseBonus: 0,
    critBonus: 0,
    manaBonus: 0,
    icon: 'Sword',
    desc: '+7 ATK',
  },
  {
    id: 'scale-armor',
    name: 'Schuppenpanzer',
    type: 'armor',
    attackBonus: 0,
    defenseBonus: 6,
    critBonus: 0,
    manaBonus: 0,
    icon: 'Armor',
    desc: '+6 DEF',
  },
  {
    id: 'focus-ring',
    name: 'Fokusring',
    type: 'ring',
    attackBonus: 0,
    defenseBonus: 0,
    critBonus: 8,
    manaBonus: 0,
    icon: 'Ring',
    desc: '+8% Crit',
  },
];

const LOOT_PETS: Pet[] = [
  {
    id: 'ember',
    name: 'Ember',
    icon: 'Fire',
    bonusType: 'attack',
    bonusValue: 3,
    desc: '+3 ATK',
  },
  {
    id: 'mistral',
    name: 'Mistral',
    icon: 'Wind',
    bonusType: 'crit',
    bonusValue: 5,
    desc: '+5% Crit',
  },
  {
    id: 'spring',
    name: 'Spring',
    icon: 'Mana',
    bonusType: 'manaReg',
    bonusValue: 4,
    desc: '+4 Mana',
  },
  {
    id: 'bastion',
    name: 'Bastion',
    icon: 'Shield',
    bonusType: 'defense',
    bonusValue: 4,
    desc: '+4 DEF',
  },
  {
    id: 'clover',
    name: 'Clover',
    icon: 'Stars',
    bonusType: 'luck',
    bonusValue: 3,
    desc: '+3 Glueck',
  },
];
