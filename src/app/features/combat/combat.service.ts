import { Injectable, inject, signal } from '@angular/core';
import {
  elementWeaknessMultiplier,
  executeDamageMultiplier,
  enemyPhasePressure,
  overkillReward,
  riposteDamageMultiplier,
  roleFollowUpChance,
  roleGuardMultiplier,
  roleAttackMultiplier,
  statusFromThreat,
  tickStatusEffect,
  weatherCombatModifiers,
} from './combat-rules';
import { createLevelUpChoices, GameState, LevelUpChoiceId } from '../game-state/game-state.service';
import { getBlessingCharges, spendBlessing } from '../game-state/run-blessings';
import { Inventory } from '../inventory/inventory.service';
import { relicManaRegenBonus, relicSpecialDamageMultiplier } from '../inventory/relics';
import { Path } from '../path/path.service';
import { Enemy } from './enemy.model';

export type CombatAnimationTarget = 'hero' | 'enemy';
export type CombatAnimationType = 'attack' | 'hit' | 'crit' | 'heal' | 'death' | 'skill';

export interface CombatAnimation {
  id: number;
  target: CombatAnimationTarget;
  type: CombatAnimationType;
}

export interface FloatingCombatText {
  id: number;
  target: CombatAnimationTarget;
  text: string;
  tone: 'damage' | 'heal' | 'crit' | 'mana';
}

@Injectable({
  providedIn: 'root',
})
export class Combat {
  private readonly gameState = inject(GameState);
  private readonly inventory = inject(Inventory);
  private readonly path = inject(Path);
  private animationId = 0;

  readonly animation = signal<CombatAnimation | null>(null);
  readonly floatingText = signal<FloatingCombatText | null>(null);

  attack(): void {
    const enemy = this.gameState.enemy();
    const player = this.gameState.player();

    if (!this.canTakeCombatAction(player.hp)) {
      return;
    }

    if (!enemy) {
      this.gameState.addLog('Kein Gegner aktiv. Wahle einen Kampfpfad.', 'damage');
      return;
    }

    const modifiers = weatherCombatModifiers(this.path.weather());
    const critChance = Math.max(0, this.gameState.playerCritChance() + modifiers.playerCritDelta);
    const isCritFromFever = player.comboFever;
    const isCrit = isCritFromFever || Math.random() * 100 < critChance;
    const combo = player.combo + 1;
    const battleUsed = getBlessingCharges(player.activeBlessings, 'battle') > 0;
    const riposteCharges = player.riposteCharges;
    const riposteMultiplier = riposteDamageMultiplier(riposteCharges);
    const baseDamage = calculateDamage(this.gameState.playerAttack(), isCrit);
    const damage = Math.floor(
      baseDamage *
        (1 + Math.max(0, combo - 1) * 0.12) *
        (battleUsed ? 1.22 : 1) *
        riposteMultiplier,
    );
    const manaBurst = combo >= 3 ? 6 : 2;
    const skillResetAt8 = combo >= 8 && player.skillCooldown > 0;

    this.animate('hero', 'attack');

    this.gameState.updatePlayer((current) => ({
      ...current,
      activeBlessings: battleUsed
        ? spendBlessing(current.activeBlessings, 'battle').blessings
        : current.activeBlessings,
      combo,
      mana: Math.min(current.maxMana, current.mana + manaBurst),
      maxCombo: Math.max(current.maxCombo, combo),
      riposteCharges: 0,
      comboFever: combo === 5,
      skillCooldown: skillResetAt8 ? 0 : current.skillCooldown,
    }));

    if (isCritFromFever) {
      this.gameState.addLog('Combo Fever entlaedt sich: garantierter Krit!', 'achievement');
    }
    if (combo === 5) {
      this.gameState.addLog('Combo Fever! Naechster Angriff garantiert kritisch.', 'achievement');
    }
    if (skillResetAt8) {
      this.gameState.addLog('Perfekte Combo! Drachenklaue sofort bereit.', 'achievement');
    }

    this.damageEnemy(
      damage,
      `${isCrit ? `Kritischer Treffer fur ${damage} Schaden.` : `Du triffst fur ${damage} Schaden.`}${isCritFromFever ? ' Fever-Krit!' : ''}${battleUsed ? ' Kampfrausch legt nach.' : ''}${riposteCharges ? ` Riposte entlaedt ${riposteCharges} Ladung${riposteCharges === 1 ? '' : 'en'}.` : ''}`,
      isCrit,
      'attack',
    );
  }

  specialAttack(): void {
    if (!this.gameState.canUseSkill()) {
      this.gameState.addLog('Drachenklaue ist noch nicht bereit oder Mana fehlt.', 'damage');
      return;
    }

    const enemy = this.gameState.enemy();
    const player = this.gameState.player();
    const combo = player.combo;
    const battleUsed = this.gameState.blessingCharges('battle') > 0;
    const riposteCharges = player.riposteCharges;
    const finisherBonus = 1 + Math.max(0, combo - 1) * 0.18;
    const executeBonus = enemy
      ? executeDamageMultiplier(Math.round((enemy.hp / enemy.maxHp) * 100))
      : 1;
    const weaknessBonus = enemy ? elementWeaknessMultiplier(enemy.weakness, 'fire') : 1;

    this.gameState.updatePlayer((player) => ({
      ...player,
      activeBlessings: battleUsed
        ? spendBlessing(player.activeBlessings, 'battle').blessings
        : player.activeBlessings,
      mana: player.mana - 30,
      totalManaUsed: player.totalManaUsed + 30,
      skillCooldown: 3,
      combo: 0,
      maxCombo: Math.max(player.maxCombo, combo),
      riposteCharges: 0,
      comboFever: false,
    }));

    const damage = calculateDamage(
      Math.floor(
        this.gameState.playerAttack() *
          1.55 *
          finisherBonus *
          executeBonus *
          weaknessBonus *
          (battleUsed ? 1.22 : 1) *
          riposteDamageMultiplier(riposteCharges) *
          relicSpecialDamageMultiplier(this.gameState.player()),
      ),
      false,
    );
    const executeText = executeBonus > 1 ? ' Execute-Fenster genutzt.' : '';
    const weaknessText = weaknessBonus > 1 ? ' Schwachpunkt getroffen!' : '';
    const riposteText = riposteCharges
      ? ` Riposte verstaerkt den Finisher (${riposteCharges}x).`
      : '';
    this.animate('hero', 'skill');
    this.showFloatingText('enemy', `-${damage}`, 'mana');
    this.damageEnemy(
      damage,
      `Drachenklaue entladt ${combo > 1 ? `deine ${combo}x Combo` : 'rohe Energie'} fur ${damage} Schaden.${executeText}${weaknessText}${battleUsed ? ' Kampfrausch treibt den Finisher weiter.' : ''}${riposteText}`,
      false,
      'skill',
    );
  }

  heal(): void {
    if (!this.gameState.canHeal()) {
      this.gameState.addLog('Heilen ist gerade nicht moglich.', 'damage');
      return;
    }

    const hadStatus = !!this.gameState.player().statusEffect;

    let vigorUsed = false;
    this.gameState.updatePlayer((player) => {
      const vigor = spendBlessing(player.activeBlessings, 'vigor');
      vigorUsed = vigor.consumed;
      const healed = Math.min(
        28 + player.level * 2 + (vigor.consumed ? 14 : 0),
        player.maxHp - player.hp,
      );

      return {
        ...player,
        activeBlessings: vigor.blessings,
        hp: player.hp + healed,
        guarding: true,
        mana: player.mana - 20,
        totalManaUsed: player.totalManaUsed + 20,
        combo: 0,
        resolve: Math.min(player.maxResolve, player.resolve + (vigor.consumed ? 1 : 0)),
        statusEffect: null,
      };
    });
    this.animate('hero', 'heal');
    this.showFloatingText('hero', '+HP', 'heal');
    this.gameState.addLog(
      hadStatus
        ? `Heilung reinigt den Statuseffekt und gibt Schutz fur den nachsten Treffer${vigorUsed ? '. Lebenskern verdichtet die Erholung' : ''}.`
        : `Du wirkst Heilung und erhaltst kurz Schutz fur den nachsten Treffer${vigorUsed ? '. Lebenskern fuellt Resolve mit auf' : ''}.`,
      'heal',
    );
    this.afterPlayerAction('heal');
  }

  guard(): void {
    const player = this.gameState.player();

    if (!this.canTakeCombatAction(player.hp) || !this.gameState.enemy()) {
      return;
    }

    this.gameState.updatePlayer((current) => ({
      ...current,
      guarding: true,
      mana: Math.min(current.maxMana, current.mana + 12),
      skillCooldown: Math.max(0, current.skillCooldown - 1),
      combo: 0,
      comboFever: false,
    }));
    this.animate('hero', 'skill');
    this.showFloatingText('hero', 'Guard', 'mana');
    this.gameState.addLog(
      'Du gehst in Deckung, tankst Mana und beschleunigst die Drachenklaue.',
      'event',
    );
    this.afterPlayerAction('guard');
  }

  usePotion(): void {
    if (!this.gameState.canUsePotion()) {
      this.gameState.addLog('Kein sinnvoller Trankeinsatz moglich.', 'damage');
      return;
    }

    const hadStatus = !!this.gameState.player().statusEffect;

    this.gameState.updatePlayer((player) => ({
      ...player,
      hp: Math.min(player.maxHp, player.hp + 50),
      potions: player.potions - 1,
      combo: 0,
      statusEffect: null,
    }));
    this.animate('hero', 'heal');
    this.showFloatingText('hero', '+50', 'heal');
    this.gameState.addLog(
      hadStatus
        ? 'Heiltrank getrunken. +50 HP und Status gereinigt.'
        : 'Heiltrank getrunken. +50 HP.',
      'heal',
    );
    this.afterPlayerAction('potion');
  }

  chooseLevelUp(choiceId: LevelUpChoiceId): void {
    this.gameState.updatePlayer((player) => {
      if (choiceId === 'attack') {
        return { ...player, attackBonus: player.attackBonus + 4 };
      }

      if (choiceId === 'defense') {
        return { ...player, defenseBonus: player.defenseBonus + 3 };
      }

      if (choiceId === 'crit') {
        return { ...player, critBonus: player.critBonus + 5 };
      }

      if (choiceId === 'mana') {
        return { ...player, maxMana: player.maxMana + 12, mana: player.maxMana + 12 };
      }

      return { ...player, hp: player.maxHp };
    });
    this.gameState.levelUpChoices.set([]);
    this.gameState.addLog('Level-Up-Bonus gewahlt.', 'heal');
  }

  private damageEnemy(
    damage: number,
    message: string,
    isCrit: boolean,
    action: 'attack' | 'skill',
  ): void {
    const enemy = this.gameState.enemy();

    if (!enemy) {
      return;
    }

    // Elite shield blocks a portion of player's attack
    const shield = enemy.telegraphedAbility?.shieldMultiplier;
    const actualDamage = shield !== undefined ? Math.max(1, Math.floor(damage * shield)) : damage;
    const shieldBlocked = shield !== undefined;

    const overkillDamage = Math.max(0, actualDamage - enemy.hp);
    const hp = Math.max(0, enemy.hp - actualDamage);

    // Check telegraph thresholds (only when no active telegraph and enemy survives the hit)
    const noneActive = !enemy.telegraphedAbility;
    const crossesBossThreshold =
      noneActive &&
      enemy.role === 'boss' &&
      hp > 0 &&
      enemy.hp / enemy.maxHp >= 0.5 &&
      hp / enemy.maxHp < 0.5;
    const crossesEliteThreshold =
      noneActive &&
      enemy.role === 'elite' &&
      hp > 0 &&
      enemy.hp / enemy.maxHp >= 0.45 &&
      hp / enemy.maxHp < 0.45;

    this.gameState.updateEnemy((current) => ({
      ...current,
      hp,
      telegraphedAbility: shieldBlocked
        ? null
        : crossesBossThreshold
          ? { name: 'Drachenzorn', damageMultiplier: 1.75 }
          : crossesEliteThreshold
            ? { name: 'Eliteschild', shieldMultiplier: 0.45 }
            : current.telegraphedAbility,
    }));

    this.animate('enemy', hp === 0 ? 'death' : isCrit ? 'crit' : 'hit');
    this.showFloatingText('enemy', `-${actualDamage}`, isCrit ? 'crit' : 'damage');

    if (shieldBlocked) {
      this.gameState.addLog(
        `Eliteschild absorbiert Schaden! Nur ${actualDamage} von ${damage} kommen durch.`,
        'event',
      );
    }
    this.gameState.addLog(message, hp === 0 ? 'heal' : 'damage');

    if (crossesBossThreshold) {
      this.gameState.addLog(
        'Der Drachenkoenig bereitet DRACHENZORN vor! Naechster Angriff sehr gefaehrlich – Deckung empfohlen!',
        'damage',
      );
    }
    if (crossesEliteThreshold) {
      this.gameState.addLog(
        'Der Elite-Kaempfer beschwort ELITESCHILD! Dein naechster Treffer wird abgeblockt.',
        'event',
      );
    }

    if (hp === 0) {
      this.defeatEnemy(enemy, overkillDamage);
      return;
    }

    this.afterPlayerAction(action);
  }

  useResolve(): void {
    if (!this.gameState.canUseResolve()) {
      this.gameState.addLog('Resolve ist nicht bereit oder kein Gegner aktiv.', 'damage');
      return;
    }

    this.gameState.updatePlayer((player) => ({
      ...player,
      resolve: Math.max(0, player.resolve - 1),
      hp: Math.min(player.maxHp, player.hp + 22 + player.level * 2),
      mana: Math.min(player.maxMana, player.mana + 24),
      guarding: true,
      combo: 0,
      skillCooldown: Math.max(0, player.skillCooldown - 2),
      statusEffect: null,
    }));
    this.animate('hero', 'heal');
    this.showFloatingText('hero', 'Resolve', 'mana');
    this.gameState.addLog(
      'Resolve gezundet: Status weg, HP/Mana stabilisiert, kein Gegenschlag.',
      'heal',
    );
    this.tickRound('resolve');
  }

  private afterPlayerAction(action: 'attack' | 'skill' | 'heal' | 'guard' | 'potion'): void {
    this.enemyAttack();
    this.tickRound(action);
  }

  private enemyAttack(): void {
    const enemy = this.gameState.enemy();
    const player = this.gameState.player();
    const weather = this.path.weather();
    const modifiers = weatherCombatModifiers(weather);
    const wardState = spendBlessing(player.activeBlessings, 'ward');
    const wardUsed = wardState.consumed;

    if (!enemy || enemy.hp <= 0 || player.hp <= 0) {
      return;
    }

    if (Math.random() < modifiers.enemyMissChance) {
      this.gameState.addLog(`${enemy.name} verfehlt dich im Sturm.`, 'event');
      return;
    }

    const enemyCritChance = Math.max(0, 10 + modifiers.enemyCritDelta);
    const isCrit = Math.random() * 100 < enemyCritChance;
    const phase = enemyPhasePressure(enemy.role, Math.round((enemy.hp / enemy.maxHp) * 100));
    const telegraphMultiplier = enemy.telegraphedAbility?.damageMultiplier ?? 1;
    const telegraphedAbilityName = enemy.telegraphedAbility?.name;
    const roleAdjustedAttack = Math.floor(
      enemy.attack * roleAttackMultiplier(enemy.role) * phase.attackMultiplier * telegraphMultiplier,
    );
    const rawDamage = calculateDamage(roleAdjustedAttack, isCrit);
    const guardMultiplier = roleGuardMultiplier(enemy.role, player.guarding);
    const reducedDamage = Math.max(
      1,
      Math.floor(
        rawDamage *
          (1 - (this.gameState.playerDefense() + modifiers.playerDefenseDelta) / 100) *
          guardMultiplier *
          (wardUsed ? 0.78 : 1),
      ),
    );

    const newStatus = statusFromThreat(enemy.role, weather, player.statusEffect);

    this.gameState.updatePlayer((current) => {
      const hp = Math.max(0, current.hp - reducedDamage);

      return {
        ...current,
        activeBlessings: wardState.blessings,
        hp,
        guarding: false,
        combo: 0,
        riposteCharges:
          player.guarding && hp > 0
            ? Math.min(
                3,
                current.riposteCharges +
                  (reducedDamage <= Math.max(4, current.maxHp * 0.08) ? 2 : 1),
              )
            : current.riposteCharges,
        perfectGuards:
          player.guarding && hp > 0 && reducedDamage <= Math.max(4, current.maxHp * 0.08)
            ? current.perfectGuards + 1
            : current.perfectGuards,
        statusEffect:
          wardUsed && newStatus && !player.statusEffect
            ? current.statusEffect
            : (newStatus ?? current.statusEffect),
      };
    });
    this.animate('enemy', 'attack');
    this.animate('hero', 'hit', 120);
    this.showFloatingText('hero', `-${reducedDamage}`, isCrit ? 'crit' : 'damage', 120);

    if (wardUsed && newStatus && !player.statusEffect) {
      this.gameState.addLog(
        'Aegis faengt den Statuseffekt ab und nimmt Druck aus dem Schlag.',
        'heal',
      );
    } else if (newStatus && !player.statusEffect) {
      this.gameState.addLog(
        `${enemy.name} belegt dich mit ${statusLabel(newStatus.type)}: ${newStatus.damagePerRound} Schaden/Runde.`,
        'damage',
      );
    }

    if (telegraphMultiplier > 1) {
      this.gameState.updateEnemy((e) => ({ ...e, telegraphedAbility: null }));
      this.gameState.addLog(
        `${enemy.name} entlaedt ${telegraphedAbilityName} fuer verheerenden Schaden!`,
        'damage',
      );
    }
    this.gameState.addLog(
      isCrit
        ? `${enemy.name} landet einen kritischen Treffer fur ${reducedDamage}.${phase.tone !== 'calm' ? ` ${phase.label} erhoeht den Druck.` : ''}`
        : `${enemy.name} trifft dich fur ${reducedDamage}.${phase.tone !== 'calm' ? ` ${phase.label} erhoeht den Druck.` : ''}`,
      'damage',
    );

    if (player.guarding && this.gameState.player().hp > 0) {
      const gained = this.gameState.player().riposteCharges - player.riposteCharges;
      this.gameState.addLog(
        gained >= 2
          ? 'Perfekte Deckung: +2 Riposte-Ladungen fuer den Konter.'
          : 'Deckung gehalten: +1 Riposte-Ladung bereit.',
        'event',
      );
    }

    if (player.guarding && guardMultiplier > 0.45) {
      this.gameState.addLog(`${enemy.name} durchbricht einen Teil deiner Deckung.`, 'damage');
    }

    const followUpChance = roleFollowUpChance(enemy.role);
    if (followUpChance > 0 && this.gameState.player().hp > 0 && Math.random() < followUpChance) {
      const followUpDamage = Math.max(1, Math.floor(reducedDamage * 0.42));

      this.gameState.updatePlayer((current) => ({
        ...current,
        hp: Math.max(0, current.hp - followUpDamage),
      }));
      this.animate('hero', 'hit', 190);
      this.showFloatingText('hero', `-${followUpDamage}`, 'damage', 190);
      this.gameState.addLog(
        `${enemy.name} setzt mit einem schnellen Nachschlag fur ${followUpDamage} nach.`,
        'damage',
      );
    }

    if (this.gameState.player().hp <= 0) {
      this.gameState.gameActive.set(false);
      this.gameState.addLog(
        'Du bist gefallen. Starte neu, wenn du es nochmal wagen willst.',
        'damage',
      );
    }
  }

  private tickRound(action: 'attack' | 'skill' | 'heal' | 'guard' | 'potion' | 'resolve'): void {
    const baseRecovery = {
      attack: 8,
      guard: 14,
      heal: 4,
      potion: 6,
      skill: 5,
      resolve: 2,
    } satisfies Record<typeof action, number>;

    const modifiers = weatherCombatModifiers(this.path.weather());
    const playerBeforeTick = this.gameState.player();
    const statusTickType = playerBeforeTick.statusEffect?.type ?? null;
    const statusTick = tickStatusEffect(playerBeforeTick.hp, playerBeforeTick.statusEffect);
    const focusState = spendBlessing(playerBeforeTick.activeBlessings, 'focus');

    this.gameState.updatePlayer((player) => {
      return {
        ...player,
        activeBlessings: focusState.blessings,
        hp: statusTick.hp,
        statusEffect: statusTick.nextEffect,
        mana: Math.min(
          player.maxMana,
          player.mana +
            baseRecovery[action] +
            petManaRegen(player) +
            relicManaRegenBonus(player) +
            modifiers.manaRegenDelta +
            (focusState.consumed ? 8 : 0),
        ),
        skillCooldown: Math.max(0, player.skillCooldown - 1 - (focusState.consumed ? 1 : 0)),
      };
    });

    if (statusTick?.damage) {
      this.showFloatingText('hero', `-${statusTick.damage}`, 'damage');
      this.gameState.addLog(
        `${statusLabel(statusTickType ?? 'burn')} tickt fur ${statusTick.damage}.`,
        'damage',
      );
      if (statusTick.expired) {
        this.gameState.addLog('Der Statuseffekt klingt ab.', 'event');
      }
    }

    if (this.gameState.player().hp <= 0) {
      this.gameState.gameActive.set(false);
      this.gameState.addLog('Du bist durch einen Statuseffekt gefallen.', 'damage');
    }
  }

  private canTakeCombatAction(playerHp: number): boolean {
    return this.gameState.gameActive() && playerHp > 0;
  }

  private defeatEnemy(enemy: Enemy | null, overkillDamage = 0): void {
    if (!enemy) {
      return;
    }

    const overkill = overkillReward(overkillDamage, enemy.role);
    this.gameState.addLog(`${enemy.name} besiegt. +${enemy.gold} Gold, +${enemy.xp} XP.`, 'heal');
    if (overkillDamage > 0) {
      this.gameState.addLog(
        `Overkill +${overkillDamage}: +${overkill.mana} Mana, +${overkill.gold} Gold${overkill.dragonShards ? `, +${overkill.dragonShards} Shard${overkill.dragonShards === 1 ? '' : 's'}` : ''}.`,
        'achievement',
      );
    }
    this.gameState.setEnemy(null);
    this.inventory.awardLoot(enemy);
    const luckShardBonus = enemy.isBoss
      ? Math.floor(this.gameState.playerLuck() / 7)
      : enemy.elite
        ? Math.floor(this.gameState.playerLuck() / 10)
        : 0;

    if (enemy.isBoss) {
      this.gameState.addDragonShards(8 + luckShardBonus, enemy.name);
    } else if (enemy.elite) {
      this.gameState.addDragonShards(4 + luckShardBonus, enemy.name);
    }
    this.gameState.updatePlayer((player) => {
      const resolvePreservedBonus =
        player.resolve === player.maxResolve ? 12 + Math.max(0, enemy.level - 1) * 2 : 0;
      let xp = player.xp + enemy.xp;
      let level = player.level;
      let maxHp = player.maxHp;
      let maxMana = player.maxMana;
      let hp = player.hp;
      let mana = player.mana;
      let leveled = false;

      while (xp >= Math.floor(100 * Math.pow(1.2, level - 1))) {
        xp -= Math.floor(100 * Math.pow(1.2, level - 1));
        level += 1;
        maxHp += 15;
        maxMana += 5;
        hp = maxHp;
        mana = maxMana;
        leveled = true;
        this.gameState.addLog(`Level up! Du erreichst Level ${level}.`, 'heal');
      }

      if (leveled) {
        this.gameState.levelUpChoices.set(createLevelUpChoices());
      }

      return {
        ...player,
        xp,
        level,
        maxHp,
        hp,
        maxMana,
        gold: player.gold + enemy.gold + resolvePreservedBonus + overkill.gold,
        mana: Math.min(maxMana, mana + overkill.mana),
        dragonShards: player.dragonShards + overkill.dragonShards,
        totalKills: player.totalKills + 1,
        eliteKills: player.eliteKills + (enemy.elite ? 1 : 0),
        bossKilled: enemy.isBoss || player.bossKilled,
        combo: 0,
        guarding: false,
        riposteCharges: 0,
        totalOverkillDamage: player.totalOverkillDamage + overkillDamage,
        overkillStreak: overkillDamage > 0 ? player.overkillStreak + 1 : 0,
      };
    });

    if (this.gameState.player().resolve === this.gameState.player().maxResolve) {
      this.gameState.addLog(
        'Resolve konserviert: Bonusgold fur sauberes Ressourcenmanagement.',
        'achievement',
      );
    }

    this.gameState.advanceContract('slayer');
    this.path.completeSelectedBranch();

    if (enemy.isBoss) {
      this.gameState.gameActive.set(false);
      this.gameState.addLog(
        'Der Drachenkonig ist gefallen. Dieser Lauf ist gewonnen.',
        'achievement',
      );
    }
  }

  private animate(target: CombatAnimationTarget, type: CombatAnimationType, delay = 0): void {
    setTimeout(() => {
      const id = ++this.animationId;

      this.animation.set({ id, target, type });
      setTimeout(() => {
        if (this.animation()?.id === id) {
          this.animation.set(null);
        }
      }, 360);
    }, delay);
  }

  private showFloatingText(
    target: CombatAnimationTarget,
    text: string,
    tone: FloatingCombatText['tone'],
    delay = 0,
  ): void {
    setTimeout(() => {
      const id = ++this.animationId;

      this.floatingText.set({ id, target, text, tone });
      setTimeout(() => {
        if (this.floatingText()?.id === id) {
          this.floatingText.set(null);
        }
      }, 620);
    }, delay);
  }
}

function petManaRegen(player: {
  activePet: { bonusType: string; bonusValue: number } | null;
}): number {
  return player.activePet?.bonusType === 'manaReg' ? player.activePet.bonusValue : 0;
}

function calculateDamage(attack: number, isCrit: boolean): number {
  const spread = Math.max(1, attack - 5);
  const damage = Math.floor(Math.random() * spread) + 5;

  return Math.max(1, isCrit ? Math.floor(damage * 1.5) : damage);
}

function statusLabel(type: 'poison' | 'burn'): string {
  return type === 'poison' ? 'Gift' : 'Brand';
}
