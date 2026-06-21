import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  viewChild,
} from '@angular/core';

type Three = typeof import('three');

/**
 * Real-time 3D backdrop for the start screen — an "arcane dragon hoard":
 * a slowly tumbling cluster of faceted crystals lit by three orbiting jewel
 * lights, with a rising ember particle simulation and a drifting dust field.
 * Three.js is loaded with a dynamic import so it lands in a lazy chunk and
 * never weighs down the initial bundle. Honours prefers-reduced-motion.
 */
@Component({
  selector: 'app-splash-background',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<canvas #canvas class="splash-3d-canvas"></canvas>',
  styles: [
    `
      :host {
        display: block;
        inset: 0;
        position: absolute;
        z-index: 0;
      }
      .splash-3d-canvas {
        display: block;
        height: 100%;
        opacity: 0;
        transition: opacity 1.1s ease;
        width: 100%;
      }
      .splash-3d-canvas.ready {
        opacity: 1;
      }
    `,
  ],
})
export class SplashBackground implements OnDestroy {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  private frame = 0;
  private disposed = false;
  private cleanup: Array<() => void> = [];
  private renderer?: import('three').WebGLRenderer;

  constructor() {
    afterNextRender(() => {
      void this.init();
    });
  }

  ngOnDestroy(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.cleanup.forEach((fn) => fn());
    this.cleanup = [];
    this.renderer?.dispose();
  }

  private async init(): Promise<void> {
    const THREE = (await import('three')) as Three;
    if (this.disposed) {
      return;
    }

    const canvas = this.canvasRef().nativeElement;
    const host = canvas.parentElement ?? canvas;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x05070f, 0.085);

    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);
    camera.position.set(0, 0, 8.4);

    // ── Crystal hoard ───────────────────────────────────────────────
    const crystals = new THREE.Group();
    scene.add(crystals);

    const palette = [0xf3cb62, 0xf59e0b, 0x38bdf8, 0xc084fc, 0x4ade80, 0xf87171];
    const geoPool = [
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.OctahedronGeometry(1, 0),
      new THREE.DodecahedronGeometry(1, 0),
    ];

    type Shard = {
      mesh: import('three').Mesh;
      spin: import('three').Vector3;
      floatSeed: number;
      floatAmp: number;
      baseY: number;
    };
    const shards: Shard[] = [];

    const makeShard = (
      radius: number,
      color: number,
      x: number,
      y: number,
      z: number,
      emissive = 0.5,
    ): Shard => {
      const geo = geoPool[Math.floor(Math.random() * geoPool.length)];
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: emissive,
        metalness: 0.7,
        roughness: 0.18,
        flatShading: true,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.scale.setScalar(radius);
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      crystals.add(mesh);
      this.cleanup.push(() => mat.dispose());
      return {
        mesh,
        spin: new THREE.Vector3(
          (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 0.5,
        ),
        floatSeed: Math.random() * Math.PI * 2,
        floatAmp: 0.12 + Math.random() * 0.22,
        baseY: y,
      };
    };

    // Hero shard at centre
    shards.push(makeShard(1.55, 0xf3cb62, 0, 0, 0, 0.85));
    // Orbiting satellites
    const satellites = reduceMotion ? 5 : 9;
    for (let i = 0; i < satellites; i++) {
      const angle = (i / satellites) * Math.PI * 2;
      const dist = 2.8 + Math.random() * 2.4;
      shards.push(
        makeShard(
          0.45 + Math.random() * 0.7,
          palette[i % palette.length],
          Math.cos(angle) * dist,
          (Math.random() - 0.5) * 3.4,
          Math.sin(angle) * dist - 1.5,
        ),
      );
    }
    geoPool.forEach((g) => this.cleanup.push(() => g.dispose()));

    // ── Ember particle simulation ───────────────────────────────────
    const emberCount = reduceMotion ? 350 : 1100;
    const emberPos = new Float32Array(emberCount * 3);
    const emberVel = new Float32Array(emberCount);
    const spread = 16;
    for (let i = 0; i < emberCount; i++) {
      emberPos[i * 3] = (Math.random() - 0.5) * spread;
      emberPos[i * 3 + 1] = (Math.random() - 0.5) * spread;
      emberPos[i * 3 + 2] = (Math.random() - 0.5) * 8 - 2;
      emberVel[i] = 0.004 + Math.random() * 0.014;
    }
    const emberGeo = new THREE.BufferGeometry();
    emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
    const emberMat = new THREE.PointsMaterial({
      color: 0xffb24d,
      size: 0.07,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const embers = new THREE.Points(emberGeo, emberMat);
    scene.add(embers);
    this.cleanup.push(() => {
      emberGeo.dispose();
      emberMat.dispose();
    });

    // ── Drifting dust field ─────────────────────────────────────────
    const dustCount = reduceMotion ? 200 : 600;
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * 28;
      dustPos[i * 3 + 1] = (Math.random() - 0.5) * 22;
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * 14 - 6;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0x9fb4d8,
      size: 0.045,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    scene.add(dust);
    this.cleanup.push(() => {
      dustGeo.dispose();
      dustMat.dispose();
    });

    // ── Lighting ────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0x33425f, 1.1));
    const lights = [
      new THREE.PointLight(0xf3cb62, 90, 40),
      new THREE.PointLight(0x38bdf8, 70, 40),
      new THREE.PointLight(0xf87171, 55, 40),
    ];
    lights.forEach((l) => scene.add(l));

    // ── Parallax pointer ────────────────────────────────────────────
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const onPointer = (e: PointerEvent) => {
      pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('pointermove', onPointer, { passive: true });
    this.cleanup.push(() => window.removeEventListener('pointermove', onPointer));

    // ── Resize ──────────────────────────────────────────────────────
    const resize = () => {
      const w = host.clientWidth || window.innerWidth;
      const h = host.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    this.cleanup.push(() => ro.disconnect());

    canvas.classList.add('ready');

    // ── Render loop ─────────────────────────────────────────────────
    const clock = new THREE.Clock();
    const render = () => {
      if (this.disposed) {
        return;
      }
      const t = clock.getElapsedTime();

      crystals.rotation.y = t * 0.06;
      for (const s of shards) {
        s.mesh.rotation.x += s.spin.x * 0.01;
        s.mesh.rotation.y += s.spin.y * 0.01;
        s.mesh.rotation.z += s.spin.z * 0.01;
        s.mesh.position.y = s.baseY + Math.sin(t * 0.8 + s.floatSeed) * s.floatAmp;
      }

      // Embers rise and recycle
      const pos = emberGeo.attributes['position'] as import('three').BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let i = 0; i < emberCount; i++) {
        arr[i * 3 + 1] += emberVel[i];
        if (arr[i * 3 + 1] > spread / 2) {
          arr[i * 3 + 1] = -spread / 2;
          arr[i * 3] = (Math.random() - 0.5) * spread;
        }
      }
      pos.needsUpdate = true;
      embers.rotation.y = t * 0.02;
      dust.rotation.y = -t * 0.015;

      // Orbiting jewel lights
      lights.forEach((l, i) => {
        const a = t * (0.4 + i * 0.18) + (i * Math.PI * 2) / 3;
        l.position.set(Math.cos(a) * 5, Math.sin(a * 0.8) * 3.5, Math.sin(a) * 5 + 1);
        l.intensity = (i === 0 ? 90 : i === 1 ? 70 : 55) * (0.7 + Math.sin(t * 1.5 + i) * 0.3);
      });

      // Smooth parallax
      pointer.x += (pointer.tx - pointer.x) * 0.04;
      pointer.y += (pointer.ty - pointer.y) * 0.04;
      camera.position.x = pointer.x * 1.4;
      camera.position.y = -pointer.y * 1.0;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      if (!reduceMotion) {
        this.frame = requestAnimationFrame(render);
      }
    };
    render();
  }
}
