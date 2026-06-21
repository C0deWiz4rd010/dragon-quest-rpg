# Improvement Plan 2 — Dragon Quest RPG

## Analysierte Schwachstellen

| # | Bereich | Problem |
|---|---------|---------|
| 1 | Spielmechanik | Kein Status-Effekt-System → Kämpfe sind reine Schadensrennen |
| 2 | Wetter | Wetter ist rein visuell, hat keinen Gameplay-Einfluss |
| 3 | Zugänglichkeit | Kein Keyboard-Support für Kampfaktionen |
| 4 | UX Feedback-Loop | Loot erscheint nur im Log, kein visueller Dopamin-Hit |
| 5 | Run-Abschluss | Outcome-Panel ist klein/versteckt im Kampf-Panel |
| 6 | Accessibility | `EventLog` hat kein `aria-live` → Screen-Reader blind |

---

## Plan

### #1 – Status-Effekte: Gift & Brand
- **Wo:** `player.model.ts`, `game-state.service.ts`, `combat.service.ts`, `combat-panel.html`
- **Was:**
  - `Player.statusEffect: { type: 'poison' | 'burn'; rounds: number } | null` hinzufügen
  - Feinde können beim Angriff (20 % Chance) Gift oder Brand anlegen
  - In `tickRound()`: DoT-Schaden abziehen + Runden dekrementieren
  - Im Header des Kampf-Panels: kleines Badge `☠ Gift` / `🔥 Brand`

### #2 – Wetter-Kampfboni
- **Wo:** `combat.service.ts` → `tickRound()` + `enemyAttack()`
- **Was:**
  - `rain` → +5 Mana-Regeneration/Runde
  - `storm` → Gegner verfehlen 25 % der Angriffe
  - `snow` → +3 effektive Verteidigung (Schadensreduktion)
  - `ash` → 15 % Chance: Gegnerangriff verursacht Brand-Statuseffekt
  - `glow` → +5 % Krit-Chance (auf dem Spieler-Krit-Wert)
  - `fog` → −10 % Krit-Chance (beide Seiten weniger kritische Treffer)
- **Anzeige:** Wetter-Buff-Badge in `combat-panel.html` (acts-header Bereich)

### #3 – Tastaturkürzel 1-4 für Kampfaktionen
- **Wo:** `combat-panel.ts` + `combat-panel.html`
- **Was:**
  - `@HostListener('window:keydown', ['$event'])` in `CombatPanel`
  - `1` → Angriff, `2` → Drachenklaue, `3` → Heilen, `4` → Deckung
  - Button-Labels zeigen `[1]`, `[2]`, `[3]`, `[4]` als kleine Kürzel

### #4 – Loot-Toast Overlay
- **Wo:** `inventory.service.ts`, `game-page.html`, `game-page.scss`
- **Was:**
  - `lastLoot = signal<{ name: string; icon: string; rarity: string } | null>(null)` im Service
  - In `awardLoot()`: Signal setzen + nach 3 s via `setTimeout` leeren
  - In `game-page.html`: `@if (lastLoot)` → fliegende Karte unten rechts (CSS-Animation slide-in/out)

### #5 – Vollbild Run-Ergebnis-Overlay
- **Wo:** `game-page.html`, `game-page.scss`
- **Was:**
  - Wenn `gameState.runOutcome()` gesetzt → fixed full-screen dimmer + zentrierte Karte
  - Zeigt: Sieg/Niederlage Titel, Level, Kills, Elite-Kills, Gold, Max-Combo, Pfade, Mini-Games
  - Button: Neuer Run → `resetRun()`
  - `outcome-panel` in `combat-panel.html` entfernen (ersetzt)

### #6 – aria-live EventLog
- **Wo:** `event-log.html`
- **Was:** `role="log" aria-live="polite" aria-atomic="false"` auf `.entries`

---

## Umsetzungsreihenfolge
1. `player.model.ts` → StatusEffect-Typ
2. `game-state.service.ts` → createInitialPlayer()
3. `combat.service.ts` → Status + Wetter-Logik
4. `combat-panel.ts` → HostListener Keyboard
5. `combat-panel.html` → Kürzel + Status-Badge + Wetter-Badge
6. `inventory.service.ts` → lastLoot Signal
7. `game-page.html` + `game-page.scss` → Loot-Toast + Run-Ergebnis-Overlay
8. `combat-panel.html` → Outcome-Panel entfernen
9. `event-log.html` → aria-live
10. Build validieren
