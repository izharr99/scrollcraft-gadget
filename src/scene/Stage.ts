import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Phone } from './Phone';
import { PoseTrack, POSE_KEYS, type Pose } from './poses';
import { ScreenPainter } from './screenUI';
import type { Content, Finish, LayerId } from '../types';

export interface StageOptions {
  mobile: boolean;
  reduced: boolean;
}

/**
 * Owns the WebGL renderer, the phone and the scroll-driven pose. main.ts calls
 * `frame()` from the GSAP ticker; nothing here touches the DOM outside the canvas.
 */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  readonly phone: Phone;
  readonly track = new PoseTrack();
  readonly pose: Pose = { x: 0, y: 0, s: 1, rx: 0, ry: 0, rz: 0, explode: 0, vis: 1, lock: 1, feed: 0 };
  private target: Pose = { ...this.pose };
  private painter: ScreenPainter;
  private rim: THREE.PointLight;
  private accent = new THREE.Color();
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
    const finish = content.colors.finishes[0] ?? { name: '', body: '#2b2d33', accent: '#7c9cff' };
    this.accentHex = finish.accent;
    this.accent.set(finish.accent);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !opts.mobile,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.mobile ? 1.5 : 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const key = new THREE.DirectionalLight('#ffffff', 1.6);
    key.position.set(3, 4, 5);
    this.rim = new THREE.PointLight(finish.accent, 18, 12, 1.6);
    this.rim.position.set(-3, 1.5, -2.5);
    this.scene.add(key, this.rim);

    this.painter = new ScreenPainter(content.screen.ui, opts.mobile ? 384 : 480);
    this.phone = new Phone(this.painter.canvas, finish.body, finish.accent, opts.mobile);
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

  /** Load-in animation, 0..1, multiplied over the scroll pose. */
  setIntro(v: number): void {
    this.intro = v;
  }

  setFinish(f: Finish, amount: number, from: Finish): void {
    const body = new THREE.Color(from.body).lerp(new THREE.Color(f.body), amount);
    const acc = new THREE.Color(from.accent).lerp(new THREE.Color(f.accent), amount);
    this.phone.bodyMaterial.color.copy(body);
    this.phone.accentMaterial.color.copy(acc);
    this.phone.accentMaterial.emissive.copy(acc);
    this.rim.color.copy(acc);
    this.accent.copy(acc);
    this.accentHex = `#${acc.getHexString()}`;
  }

  /** Advance one frame. Returns the current pose so DOM layers can sync to it. */
  frame(scrollY: number, time: number, dt: number): Pose {
    if (this.opts.reduced) {
      Object.assign(this.target, { x: 0, y: 0, s: this.mobile ? 0.8 : 1, rx: 0.05, ry: -0.35, rz: 0, explode: 0, vis: 1, lock: 0, feed: 0.15 });
      Object.assign(this.pose, this.target);
    } else {
      this.track.sample(scrollY, this.target);
      // Frame-rate independent damping layered on top of Lenis for a weighty feel.
      const k = 1 - Math.exp(-dt * 9);
      for (const key of POSE_KEYS) this.pose[key] += (this.target[key] - this.pose[key]) * k;
      // Feed and explode read better without extra lag.
      this.pose.feed = this.target.feed;
    }

    const p = this.pose;
    const vis = p.vis * this.intro;
    this.canvas.style.opacity = vis.toFixed(3);
    if (vis < 0.005) return p;

    const g = this.phone.group;
    const float = this.opts.reduced ? 0 : Math.sin(time * 0.9) * 0.035;
    g.position.set(p.x, p.y + float - (1 - this.intro) * 0.8, 0);
    g.rotation.set(p.rx, p.ry + (1 - this.intro) * 0.6, p.rz);
    g.scale.setScalar(p.s);
    this.phone.setExplode(Math.min(1, Math.max(0, p.explode)));

    this.painter.draw({ lock: p.lock, feed: p.feed, t: time, accent: this.accentHex });
    this.phone.screenTexture.needsUpdate = true;

    this.renderer.render(this.scene, this.camera);
    return p;
  }

  /** Project a layer anchor to CSS pixels. */
  project(id: LayerId): { x: number; y: number } {
    this.phone.anchorWorld(id, this.tmp).project(this.camera);
    return {
      x: (this.tmp.x * 0.5 + 0.5) * window.innerWidth,
      y: (-this.tmp.y * 0.5 + 0.5) * window.innerHeight,
    };
  }
}
