import { effect, inject, Injectable, signal } from '@angular/core';
import { GameState } from './game-state.service';
import { Player } from '../inventory/player.model';
import { learnedSkills } from './skills';

export interface Achievement {
  id: string;
  name: string;
  icon: string;
  description: string;
  check: (player: Player) => boolean;
}

const STORAGE_KEY = 'dragonQuestRpgAchievements';

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-blood', name: 'Erstes Blut', icon: '🩸', description: 'Besiege deinen ersten Gegner.', check: (p) => p.totalKills >= 1 },
  { id: 'slayer-10', name: 'Schlächter', icon: '⚔', description: 'Besiege 10 Gegner.', check: (p) => p.totalKills >= 10 },
  { id: 'slayer-50', name: 'Kriegsveteran', icon: '🎖', description: 'Besiege 50 Gegner.', check: (p) => p.totalKills >= 50 },
  { id: 'slayer-100', name: 'Legende', icon: '🏆', description: 'Besiege 100 Gegner.', check: (p) => p.totalKills >= 100 },
  { id: 'elite-1', name: 'Elite-Jäger', icon: '💠', description: 'Besiege einen Elite-Gegner.', check: (p) => p.eliteKills >= 1 },
  { id: 'elite-10', name: 'Elite-Bezwinger', icon: '💎', description: 'Besiege 10 Elite-Gegner.', check: (p) => p.eliteKills >= 10 },
  { id: 'boss-slayer', name: 'Drachentöter', icon: '🐉', description: 'Besiege einen Boss.', check: (p) => p.bossKilled },
  { id: 'level-5', name: 'Aufsteiger', icon: '⭐', description: 'Erreiche Level 5.', check: (p) => p.level >= 5 },
  { id: 'level-10', name: 'Meister', icon: '🌟', description: 'Erreiche Level 10.', check: (p) => p.level >= 10 },
  { id: 'level-20', name: 'Großmeister', icon: '✨', description: 'Erreiche Level 20.', check: (p) => p.level >= 20 },
  { id: 'gold-500', name: 'Wohlhabend', icon: '💰', description: 'Besitze 500 Gold.', check: (p) => p.gold >= 500 },
  { id: 'gold-2000', name: 'Schatzmeister', icon: '👑', description: 'Besitze 2000 Gold.', check: (p) => p.gold >= 2000 },
  { id: 'shards-10', name: 'Splitter-Sammler', icon: '🔷', description: 'Sammle 10 Dragon Shards.', check: (p) => p.dragonShards >= 10 },
  { id: 'shards-50', name: 'Drachenhort', icon: '🔶', description: 'Sammle 50 Dragon Shards.', check: (p) => p.dragonShards >= 50 },
  { id: 'paths-5', name: 'Wanderer', icon: '🧭', description: 'Schließe 5 Pfade ab.', check: (p) => p.completedPaths >= 5 },
  { id: 'paths-15', name: 'Pfadfinder', icon: '🗺', description: 'Schließe 15 Pfade ab.', check: (p) => p.completedPaths >= 15 },
  { id: 'combo-5', name: 'Kombinierer', icon: '🔗', description: 'Erreiche eine 5er-Combo.', check: (p) => p.maxCombo >= 5 },
  { id: 'combo-10', name: 'Combo-König', icon: '⛓', description: 'Erreiche eine 10er-Combo.', check: (p) => p.maxCombo >= 10 },
  { id: 'combo-20', name: 'Unaufhaltsam', icon: '💥', description: 'Erreiche eine 20er-Combo.', check: (p) => p.maxCombo >= 20 },
  { id: 'guard-5', name: 'Bollwerk', icon: '🛡', description: 'Lande 5 perfekte Blocks.', check: (p) => p.perfectGuards >= 5 },
  { id: 'guard-25', name: 'Unbezwingbar', icon: '🏰', description: 'Lande 25 perfekte Blocks.', check: (p) => p.perfectGuards >= 25 },
  { id: 'minigame-1', name: 'Spielernatur', icon: '🎲', description: 'Gewinne ein Minispiel.', check: (p) => p.miniGamesWon >= 1 },
  { id: 'minigame-10', name: 'Champion', icon: '🎮', description: 'Gewinne 10 Minispiele.', check: (p) => p.miniGamesWon >= 10 },
  { id: 'skill-1', name: 'Lernbegierig', icon: '📖', description: 'Erlerne eine Fähigkeit.', check: (p) => learnedSkills(p).length >= 1 },
  { id: 'skill-5', name: 'Vielseitig', icon: '📚', description: 'Erlerne 5 Fähigkeiten.', check: (p) => learnedSkills(p).length >= 5 },
  { id: 'relic-3', name: 'Reliktjäger', icon: '🏺', description: 'Sammle 3 Relikte.', check: (p) => p.ownedRelics.length >= 3 },
  { id: 'relic-8', name: 'Kurator', icon: '🗿', description: 'Sammle 8 Relikte.', check: (p) => p.ownedRelics.length >= 8 },
  { id: 'contract-5', name: 'Vertragsprofi', icon: '📜', description: 'Schließe 5 Aufträge ab.', check: (p) => p.completedContracts >= 5 },
  { id: 'contract-15', name: 'Auftragsmeister', icon: '📋', description: 'Schließe 15 Aufträge ab.', check: (p) => p.completedContracts >= 15 },
  { id: 'streak-10', name: 'Glückssträhne', icon: '🔥', description: 'Erreiche eine 10er-Routenserie.', check: (p) => p.routeStreak >= 10 },
];

@Injectable({ providedIn: 'root' })
export class AchievementService {
  private readonly gameState = inject(GameState);

  readonly unlocked = signal<Set<string>>(this.loadUnlocked());
  readonly recentUnlock = signal<Achievement | null>(null);

  readonly all = ACHIEVEMENTS;

  constructor() {
    effect(() => {
      const player = this.gameState.player();
      this.evaluate(player);
    });
  }

  isUnlocked(id: string): boolean {
    return this.unlocked().has(id);
  }

  unlockedCount(): number {
    return this.unlocked().size;
  }

  private evaluate(player: Player): void {
    const current = this.unlocked();
    let changed = false;
    const next = new Set(current);
    for (const achievement of ACHIEVEMENTS) {
      if (!current.has(achievement.id) && achievement.check(player)) {
        next.add(achievement.id);
        changed = true;
        this.recentUnlock.set(achievement);
        this.gameState.addLog(
          `🏅 Erfolg freigeschaltet: ${achievement.icon} ${achievement.name} — ${achievement.description}`,
          'achievement',
        );
      }
    }
    if (changed) {
      this.unlocked.set(next);
      this.persist(next);
      if (this.toastTimer !== null) {
        clearTimeout(this.toastTimer);
      }
      this.toastTimer = setTimeout(() => this.recentUnlock.set(null), 4200);
    }
  }

  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  private loadUnlocked(): Set<string> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return new Set();
      }
      const ids = JSON.parse(raw) as string[];
      return new Set(Array.isArray(ids) ? ids : []);
    } catch {
      return new Set();
    }
  }

  private persist(ids: Set<string>): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
    } catch {
      /* storage unavailable — ignore */
    }
  }
}
