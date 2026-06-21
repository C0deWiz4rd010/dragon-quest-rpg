# Plan: PixiJS Full UI/UX Overhaul – Dragon Quest RPG

**TL;DR:** PixiJS v8 (WebGL2) wird als Rendering-Backend für alle visuellen Game-Elemente eingeführt. Angular DOM behält alle Buttons, Stats, Logs und Inventory. Die Architektur ist hybrid – Canvas für Sprites/Partikel/Effekte, DOM für reaktive UI-Controls.

---

## Entschiedene Optionen
- **PixiJS v8** (WebGL2, moderne TypeScript API)
- **Full Overhaul**: Combat-Stage + Path-Map + Background-FX + alle Minigames
- **Echte Partikel-Wetter**: 6 Typen (Regen, Nebel, Asche, Schnee, Sturm, Glühen) als `ParticleContainer`

---

## Phase 1 – Setup & Fundament

1. `pixi.js@^8` zu `package.json` hinzufügen
2. `src/app/features/pixi/pixi.service.ts` anlegen – zentraler Asset-Loader-Cache
3. Angular-Integration-Pattern: `afterNextRender()` + `DestroyRef` für alle PixiJS-Komponenten

---

## Phase 2 – Combat Stage

- `src/app/features/combat/combat-stage/combat-stage.ts` – neue standalone Component
- Hero AnimatedSprite (links) + Enemy AnimatedSprite (rechts)
- HP/Mana/XP-Balken als `Graphics`-Rechtecke via `effect()`
- Floating Combat Text: `Text`-Objekte, aufsteigend + alpha-fade
- Hit/Attack/Heal-Partikel: `ParticleContainer`
- `combat-panel.html` – `.portrait-wrap` + `.fighter-bars` durch `<app-combat-stage>` ersetzen

---

## Phase 3 – Path Map

- `src/app/features/path/path-map/path-map.ts` – standalone Component
- Knoten als `Sprite` (tinyDungeon Tiles)
- Verbindungslinien via `Graphics`
- Horizontaler Drag-Scroll
- Aktiver Knoten: GlowFilter / Tint
- **Wetter-Partikel** per `ParticleContainer`:
  - `rain` → schräge Linien-Sprites, blau, schnell
  - `fog` → driftende weiße Alpha-Discs
  - `ash` → graue Flocken mit Rotation
  - `snow` → weiße Punkte
  - `storm` → schnelle Regen + Stage-Shake
  - `glow` → goldene aufsteigende Licht-Partikel
- Klick-Delegation: Canvas-Event → `(branchChosen)` Output → `path.chooseBranch()`
- `path-board.html` – `.route-viewport` durch `<app-path-map>` ersetzen

---

## Phase 4 – Background & Shell FX

- `src/app/features/pixi/pixi-background/pixi-background.ts` – fullscreen Canvas (z-index: 0)
- Ember-Partikel: aufsteigende orange-rote Funken
- Wetterabhängige Intensität
- `game-page.html` – `.ember-layer` durch `<app-pixi-background>` ersetzen

---

## Phase 5 – Minigame Visual Upgrade

- **Precision**: `.precision-area` → PixiJS Canvas, pulsierender Dot mit sin()-Scale
- **Reaction**: `.reaction-circle` → PixiJS Canvas, Radial-Gradient-Glow Rot→Grün
- Memory + Typing: bleiben HTML/DOM

---

## Relevante Dateien

| Datei | Aktion |
|---|---|
| `package.json` | pixi.js v8 hinzufügen |
| `src/app/features/pixi/pixi.service.ts` | NEU – Asset-Loader-Cache |
| `src/app/features/pixi/pixi-background/pixi-background.ts` | NEU – Fullscreen-Hintergrund |
| `src/app/features/combat/combat-stage/combat-stage.ts` | NEU – PixiJS Combat Canvas |
| `src/app/features/combat/combat-panel.html` | `.portrait-wrap` + `.fighter-bars` → `<app-combat-stage>` |
| `src/app/features/combat/combat-panel.ts` | CombatStage import |
| `src/app/features/path/path-map/path-map.ts` | NEU – PixiJS Path Canvas |
| `src/app/features/path/path-board.html` | `.route-viewport` → `<app-path-map>` |
| `src/app/features/path/path-board.ts` | PathMap import + branchChosen handler |
| `src/app/pages/game/game-page.html` | `.ember-layer` → `<app-pixi-background>` |
| `src/app/features/minigames/mini-game-overlay.html` | Precision + Reaction auf Canvas |
| `src/app/features/minigames/mini-game-overlay.ts` | PixiJS Canvas Hooks |

---

## Scope-Grenzen

- Angular Services (`GameState`, `Combat`, `Path`, `Inventory`) werden **nicht angefasst**
- Angular Material Buttons + Text-UI bleiben DOM/Angular
- Event-Log, Inventory-Panel: kein PixiJS
- Kein Three.js / 3D
- Keine neuen Spielmechaniken
