# Improvement Plan 3 - Dragon Quest RPG

## Todo

- [x] 1. Release-Kontext pruefen: Git-Root, develop-Branch und GitHub-Pages-Weg klaeren.
- [x] 2. Bestehende Combat-, Path-, Renderer- und Teststruktur analysieren.
- [x] 3. Adaptives Pfad-Balancing fuer Low-HP, Low-Mana und Boss-Prep einfuehren.
- [x] 4. Route-Synergy-Bonus fuer abwechslungsreiche Entscheidungen implementieren.
- [x] 5. Pfadboard um Empfehlung, Danger-Level und Decision-Hints erweitern.
- [x] 6. CombatPanel um taktische Empfehlung und Incoming-Damage-Vorschau erweitern.
- [x] 7. Kampf-Stage mit Wetter-, Status- und Skill-Aura aufwerten.
- [x] 8. Run-Cockpit um Momentum/Empfehlungswerte erweitern.
- [x] 9. Handbuchtexte fuer neue Synergy-, Prep- und Advisor-Systeme ergaenzen.
- [x] 10. Test-Hooks um neue Gameplay-Telemetrie erweitern.
- [x] 11. Unit-Tests fuer neue Kernlogik und UI-Erwartungen anpassen.
- [x] 12. Build/Test/Browser-Check ausfuehren.
- [ ] 13. Auf develop pushen und GitHub Pages releasen. Blockiert: dieser Ordner ist kein Git-Checkout und es gibt keinen auffindbaren passenden GitHub-Remote.

## Umsetzungsidee

Die naechste Runde soll nicht nur mehr Effekte addieren, sondern die Entscheidungen lesbarer machen. Das Spiel bekommt deshalb zwei Advisor-Schichten: eine fuer Routenwahl und eine fuer den naechsten Kampfschritt. Parallel werden die Pfade adaptiver, damit knappe Runs mehr Rettungsfenster sehen, ohne dass gute Runs trivial werden.
