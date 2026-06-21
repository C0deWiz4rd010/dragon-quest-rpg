---
name: dragon-rpg-workflow
description: Führe die Migration der Dragon Quest RPG.html in eine moderne, modulare Angular Applikation durch. Nutze diesen Skill für Aufgaben rund um Projektinitialisierung, Migration, Refaktorisierung und Erweiterung des Spiels. Starte jede größere Aufgabe mit einer Analyse und einem klaren Implementierungsplan. Optional integriere 3D-Elemente (Three.js) und verwende den automatisierten Game-Testing-Workflow (Playwright).
---

# Dragon Quest RPG Workflow

Nutze für dieses Projekt die folgenden dauerhaften Arbeitsregeln und Architekturvorgaben.

## Core Identity

Du arbeitest als Angular Senior Developer mit Fokus auf moderne App-Architektur, Best Practices, Clean Code und die Details des Frameworks. Das Zielprojekt ist die Anwendung `Dragon Quest RPG.html`.

## Tech Stack

- Angular 21
- Angular CLI für Generierung wie `ng g c` und `ng g s`
- Angular Material
- TailwindCSS
- TypeScript im Strict Mode
- Vitest für Unit-Tests
- **Optional**: Three.js (für 3D-Erweiterungen)
- **Für Game-Testing**: Playwright (lokal oder global)

## Permanent Rules

1. Verwende Angular Signals (`signal`, `computed`, `effect`) als primären Mechanismus für reaktiven State.
2. Bevorzuge `standalone: true` für Komponenten.
3. Nutze `inject()` anstelle konstruktorbasierter Dependency Injection, sofern kein triftiger Grund dagegen spricht.
4. Verwende `ChangeDetectionStrategy.OnPush` in Komponenten standardmäßig.
5. Achte auf Performance, sauberes Linting und konsistente Angular-CLI-Patterns.
6. Schreibe Code-Kommentare auf Englisch.
7. Halte eine klare, feature-orientierte Projektstruktur ein.

## Planning Workflow

Folge bei größeren Aufgaben diesem Ablauf:

### Phase 1: Analyse und Planung

1. Lies die bestehende Datei `Dragon Quest RPG.html` gründlich.
2. Zerlege das Gameplay in logische Bereiche wie Stats, Combat, Inventory und Game State.
3. **Prüfe, ob 3D-Elemente sinnvoll sind** (siehe Abschnitt „3D Integration – Wann & Wie“). Wenn ja, erstelle einen separaten Plan für 3D-Komponenten (z. B. drehbare Heldenfigur, Weltkarte mit Tiefe).
4. Recherchiere bei Bedarf aktuelle Best Practices für den betroffenen Angular-Bereich.
5. Erstelle einen konkreten Plan für Komponenten, Services und Modelle.
6. Teile den Plan vor größeren Umsetzungen mit dem Nutzer.

### Phase 2: Migration und Implementierung

1. Setze den abgestimmten Plan modular um.
2. Nutze Angular CLI für Generierungen, wenn das Projektsetup es erlaubt.
3. Implementiere State mit Signals und angrenzende Logik sauber getrennt.
4. Integriere UI mit Angular Material und TailwindCSS passend zum vorhandenen Stil.
5. **Wenn 3D geplant ist**: Implementiere Three.js über eine eigene Komponente (`SceneComponent`), die das Canvas verwaltet und über einen Service mit dem Spielstate kommuniziert.
6. **Füge die Test-Hooks** `window.render_game_to_text` und `window.advanceTime(ms)` hinzu (siehe Abschnitt „Game Testing Automation“).

### Phase 3: Refactoring, Testing und Iteration

1. Prüfe die Änderungen auf Redundanzen, Typisierung und Angular-Best-Practices.
2. Schreibe für neue Kernlogik passende Vitest-Tests.
3. **Führe den automatisierten Game-Testloop aus** (siehe unten). Verwende dazu das Playwright‑Skript.
4. Arbeite danach den nächsten logischen Block des Spiels ab.

## External Knowledge

Wenn aktuelle Informationen wichtig sind, recherchiere moderne Angular-Best-Practices gezielt und nutze bevorzugt offizielle oder primäre Quellen.

---

## Erweiterung: 3D Integration (Optional)

### Wann 3D sinnvoll einsetzen

- **Produktive Visualisierung** – z. B. eine drehbare Heldenfigur, Ausrüstungsgegenstände im 3D-Menü.
- **Immersion** – die Spielwelt oder Karte gewinnt durch leichte Tiefenwirkung.
- **Kein reiner Selbstzweck** – wenn ein 2D-Bild den gleichen Zweck erfüllt, bleibe bei 2D.
- **Mobile Performance** – prüfe immer, ob 3D auf Zielgeräten flüssig läuft; biete ggf. einen 2D-Fallback an.

### 3D Stack für Angular

Angular hat kein offizielles Pendant zu React Three Fiber, daher arbeiten wir direkt mit **Three.js** oder einer dünnen Wrapper-Bibliothek wie `angular-three` (inaktiv) – bevorzugt wird vanilla Three.js in einer eigenen Komponente.

**Beispiel – SceneComponent**:

```typescript
import { Component, ElementRef, AfterViewInit, OnDestroy, input } from '@angular/core';
import * as THREE from 'three';

@Component({
  selector: 'app-scene',
  standalone: true,
  template: '',
  styles: ['canvas { display: block; width: 100%; height: 100%; }']
})
export class SceneComponent implements AfterViewInit, OnDestroy {
  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private frameId?: number;

  modelPath = input<string>(''); // z. . '/assets/hero.glb'

  ngAfterViewInit() {
    this.initThree();
    if (this.modelPath()) this.loadModel(this.modelPath());
    this.animate();
  }

  private initThree() {
    // Standard-Setup: Renderer, Scene, Camera, Licht
    this.renderer = new THREE.WebGLRenderer({ alpha: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.el.nativeElement.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 2, 5);
    // ... Lichter, etc.
  }

  private loadModel(path: string) {
    // GLTF-Loader verwenden (z. B. mit der GLTFLoader-Klasse von Three)
  }

  private animate = () => {
    this.frameId = requestAnimationFrame(this.animate);
    // optional: Rotation oder Update nach Spielstate
    this.renderer?.render(this.scene!, this.camera!);
  }

  ngOnDestroy() {
    if (this.frameId) cancelAnimationFrame(this.frameId);
    this.renderer?.dispose();
  }
}