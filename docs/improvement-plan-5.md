# Improvement Plan 5 — Dragon Quest RPG

Große Erweiterungsrunde mit Fokus auf **Datenbeschaffung / Content**, danach **Mobile-First CSS**,
neue **Game-Systeme** und **UI-Polish**. Nach jedem Schritt: Commit + Push auf `develop`.
Am Ende: Version-Bump.

## Phase A — Content / Datenbeschaffung (Primärfokus)

- [ ] A1 · Enemy-Bestiary auf 25 biome-basierte Varianten erweitern
- [ ] A2 · Item-Pool auf 24 Stücke mit Rarity-Tiers (common/rare/legendary) + Set-Bonus
- [ ] A3 · Pets auf 14 mit aktiven Fähigkeiten (Trigger-basiert)
- [ ] A4 · Relikte auf 18 mit Synergie-Paaren
- [ ] A5 · Event-Bibliothek auf 50+ inkl. NPC-Begegnungen

## Phase B — Mobile-First CSS aller Views

- [ ] B1 · CSS-Token-System (clamp-basierte Space/Font-Scales, 44px Touch-Targets, Hover-Guard)
- [ ] B2 · game-page responsive Tabs + gestapeltes Layout
- [ ] B3 · combat-panel Action-Grid + Touch-Targets
- [ ] B4 · path-board Scroll-Snap + contract-mini Fix
- [ ] B5 · inventory + event-log responsive Grids
- [ ] B6 · minigame Overlay responsive Canvas-Größen

## Phase C — Neue Game-Systeme

- [ ] C1 · 4 Charakterklassen am Run-Start (Warrior/Mage/Rogue/Paladin)
- [ ] C2 · Skill-Unlock-System beim Level-Up
- [ ] C3 · Achievement-System (30 Achievements, localStorage)
- [ ] C4 · Forge-Crafting (Upgrade/Transmute/Synthesis)
- [ ] C5 · 3 Save-Slots + Slot-Picker
- [ ] C6 · Tutorial First-Run-Onboarding

## Phase D — UI/UX-Polish

- [ ] D1 · combat-panel Schwäche-Badge + Combo-Visualizer
- [ ] D2 · path-board Biom-Visuals + Fortschrittsleiste
- [ ] D3 · event-log Filter + Entry-Grouping (Memory-Leak-Fix)
- [ ] D4 · Handbook Bestiary/Codex/Achievement-Galerie
- [ ] D5 · Settings-Panel (Particles/Animations/Font-Size)
- [ ] D6 · New Game+ Modus mit skalierender Schwierigkeit

## Verifikation pro Phase

- `npm run build` fehlerfrei
- `npm.cmd run test -- --watch=false`
- Mobile-Check bei 375px & 768px
- Git: `git add -A && git commit -m "..." && git push origin develop`

## Entscheidungen

- Architektur bleibt (Signals, PixiJS, Standalone Components)
- Kein Audio (keine Assets) — nur Settings-Toggle-Platzhalter
- Pet-Fähigkeiten als passive Modifikatoren im CombatService
- Save-Migration: Slot 1 liest alten Key als Fallback
- Kein Multiplayer / keine externen API-Quellen
