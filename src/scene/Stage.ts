import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { DIM, Phone } from './Phone';
import { PoseTrack, POSE_KEYS, type Pose } from './poses';
import { ScreenPainter, PT_W } from './screenUI';
import type { Content, Finish, LayerId } from '../types';

export interface StageOptions {
  mobile: boolean;
  reduced: boolean;
}

/** Soft rounded-rect shadow baked once into a texture: a clean, artefact-free contact shadow. */
function shadowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  ctx.filter = 'blur(26px)';
  ctx.fillStyle = 'rgba(20,18,16,1)';
  ctx.beginPath();
  ctx.roundRect(58, 70, 140, 372, 34);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Owns the WebGL renderer, the phone and the scroll-driven pose. Lit like a studio product
 * shot: real HDRI reflections, a key light, and a rim light that sweeps across the frame with
 * the hero scroll. The phone floats over paper with a soft contact shadow.
 */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  readonly phone: Phone;
  readonly track = new PoseTrack();
  readonly pose: Pose = { x: 0, y: 0, s: 1, rx: 0, ry: 0, rz: 0, explode: 0, vis: 1, lock: 1, feed: 0, sweep: 0 };
  private target: Pose = { ...this.pose };
  private painter: ScreenPainter;
  private shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private rim: THREE.DirectionalLight;
  private accentHex: string;
  private intro = 0;
  private mobile: boolean;
  private tmp = new THREE.Vector3();

  constructor(
    private canvas: HTMLCanvasElement,
    content: Content,
    private opts: StageOptions,
  ) {
    this.mobile = opts.mobile;
    const finish = content.colors.finishes[0] ?? { name: '', body: '#2b2d33', accent: '#2b2d33' };
    this.accentHex = finish.accent;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.mobile ? 1.75 : 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
    this.scene.environmentIntensity = 0.85;
    // Swap the procedural room for a real studio HDRI (Poly Haven, CC0) once it arrives.
    new HDRLoader().load(
      content.environment.hdri,
      (hdr) => {
        hdr.mapping = THREE.EquirectangularReflectionMapping;
        this.scene.environment = pmrem.fromEquirectangular(hdr).texture;
        this.scene.environmentRotation.set(0, Math.PI * 0.35, 0);
        hdr.dispose();
        pmrem.dispose();
      },
      undefined,
      () => pmrem.dispose(),
    );

    const key = new THREE.DirectionalLight('#fffaf2', 1.8);
    key.position.set(2, 3, 10);
    // Rim light: travels from left to right behind the phone as the hero scrolls.
    this.rim = new THREE.DirectionalLight('#ffffff', 5);
    this.rim.position.set(-8, 3, -2);
    const fill = new THREE.HemisphereLight('#ffffff', '#d9d4c8', 0.5);
    this.scene.add(key, this.rim, this.rim.target, fill);

    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(DIM.w * 1.9, DIM.h * 1.38),
      new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0.2, toneMapped: false }),
    );
    this.shadow.renderOrder = -1;
    this.scene.add(this.shadow);

    // Real panel resolution (1170 px wide on desktop, DPR-scaled and capped on mobile).
    const screenW = opts.mobile ? Math.round(PT_W * Math.min(2, Math.max(1.5, window.devicePixelRatio))) : 1170;
    this.painter = new ScreenPainter(content.screen.ui, screenW);
    // Reduced motion renders on demand only, so repaint when a screen photo arrives.
    if (opts.reduced) this.painter.onImageLoad = () => requestAnimationFrame(() => this.frame(0, 0, 0));
    this.phone = new Phone(this.painter.canvas, opts.mobile, this.renderer.capabilities.getMaxAnisotropy());
    this.setFinish(finish);
    this.scene.add(this.phone.group);

    this.camera.position.set(0, 0, 9.5);
    this.resize();
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.mobile = w < 768;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.track.measure(this.mobile);
  }

  refreshScreen(): void {
    this.painter.invalidate();
  }

  setIntro(v: number): void {
    this.intro = v;
  }

  setFinish(f: Finish): void {
    this.phone.setFinish(f.body, f.bodyEnd ?? f.body, f.frame ?? f.body, f.accent);
    this.accentHex = f.accent;
  }

  frame(scrollY: number, time: number, dt: number): Pose {
    if (this.opts.reduced) {
      Object.assign(this.target, { x: 0, y: 0, s: this.mobile ? 0.7 : 0.95, rx: 0.05, ry: -0.35, rz: 0, explode: 0, vis: 1, lock: 0, feed: 0.2, sweep: 0.6 });
      Object.assign(this.pose, this.target);
    } else {
      this.track.sample(scrollY, this.target);
      const k = 1 - Math.exp(-dt * 16);
      for (const key of POSE_KEYS) this.pose[key] += (this.target[key] - this.pose[key]) * k;
      this.pose.feed = this.target.feed;
    }

    const p = this.pose;
    const vis = p.vis * this.intro;
    this.canvas.style.opacity = vis.toFixed(3);
    if (vis < 0.005) return p;

    const g = this.phone.group;
    g.position.set(p.x, p.y - (1 - this.intro) * 0.6, 0);
    g.rotation.set(p.rx, p.ry + (1 - this.intro) * 0.5, p.rz);
    g.scale.setScalar(p.s);
    this.phone.setExplode(Math.min(1, Math.max(0, p.explode)));

    // Rim sweep: left to right, slightly behind, so the frame edges catch a moving highlight.
    this.rim.position.set(-9 + p.sweep * 18, 3.5, 2);
    this.rim.intensity = 2 + Math.sin(Math.min(1, p.sweep) * Math.PI) * 5;

    // Contact shadow follows the phone on the paper plane, fading when exploded or edge-on.
    const sh = this.shadow;
    const facing = Math.abs(Math.cos(p.ry));
    sh.position.set(p.x + 0.16 * p.s, p.y - 0.22 * p.s, -1.4);
    sh.rotation.z = p.rz;
    sh.scale.set(p.s * (0.35 + 0.65 * facing), p.s, 1);
    sh.material.opacity = 0.2 * (1 - Math.min(1, p.explode * 1.6)) * Math.min(1, 1.6 / Math.max(1, p.s));

    if (this.painter.draw({ lock: p.lock, feed: p.feed, t: time, accent: this.accentHex })) {
      this.phone.screenTexture.needsUpdate = true;
    }
    this.renderer.render(this.scene, this.camera);
    return p;
  }

  project(id: LayerId): { x: number; y: number } {
    this.phone.anchorWorld(id, this.tmp).project(this.camera);
    return {
      x: (this.tmp.x * 0.5 + 0.5) * window.innerWidth,
      y: (-this.tmp.y * 0.5 + 0.5) * window.innerHeight,
    };
  }
}
