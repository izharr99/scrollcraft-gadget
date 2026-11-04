import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { Phone } from './Phone';
import { PoseTrack, POSE_KEYS, type Pose } from './poses';
import { ScreenPainter, PT_W } from './screenUI';
import type { Content, Finish, LayerId } from '../types';

export interface StageOptions {
  mobile: boolean;
  reduced: boolean;
}

/**
 * Owns the WebGL renderer, the phone and the scroll-driven pose. Lit like a studio product
 * shot: soft key light from the front-right casting a shadow onto an invisible paper backdrop.
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
  private backdrop: THREE.Mesh<THREE.PlaneGeometry, THREE.ShadowMaterial>;
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

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.mobile ? 1.75 : 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
    this.scene.environmentIntensity = 0.8;
    // Swap the procedural room for a real studio HDRI (Poly Haven, CC0) once it arrives.
    new HDRLoader().load(
      content.environment.hdri,
      (hdr) => {
        hdr.mapping = THREE.EquirectangularReflectionMapping;
        const env = pmrem.fromEquirectangular(hdr).texture;
        hdr.dispose();
        pmrem.dispose();
        this.scene.environment = env;
        this.scene.environmentRotation.set(0, Math.PI * 0.35, 0);
      },
      undefined,
      () => pmrem.dispose(),
    );

    const key = new THREE.DirectionalLight('#fffaf2', 2.4);
    key.position.set(1.6, 2.6, 12);
    key.castShadow = true;
    key.shadow.mapSize.setScalar(opts.mobile ? 1024 : 2048);
    key.shadow.radius = 18;
    key.shadow.blurSamples = 16;
    key.shadow.bias = -0.0005;
    const sc = key.shadow.camera;
    sc.left = -6;
    sc.right = 6;
    sc.top = 6;
    sc.bottom = -6;
    sc.near = 1;
    sc.far = 30;
    const fill = new THREE.HemisphereLight('#ffffff', '#d9d4c8', 0.6);
    this.scene.add(key, fill);

    // Invisible "paper" that only shows the phone's shadow.
    this.backdrop = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.12 }));
    this.backdrop.position.z = -2.4;
    this.backdrop.receiveShadow = true;
    this.scene.add(this.backdrop);

    // Real panel resolution (1170 px wide on desktop, DPR-scaled and capped on mobile).
    const screenW = opts.mobile ? Math.round(PT_W * Math.min(2, Math.max(1.5, window.devicePixelRatio))) : 1170;
    this.painter = new ScreenPainter(content.screen.ui, screenW);
    this.phone = new Phone(
      this.painter.canvas,
      finish.body,
      finish.accent,
      opts.mobile,
      this.renderer.capabilities.getMaxAnisotropy(),
    );
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

  /** Repaint the screen texture on the next frame (fonts loaded, etc.). */
  refreshScreen(): void {
    this.painter.invalidate();
  }

  /** Load-in animation, 0..1, multiplied over the scroll pose. */
  setIntro(v: number): void {
    this.intro = v;
  }

  setFinish(f: Finish): void {
    this.phone.bodyMaterial.color.set(f.body);
    this.phone.backMaterial.color.set(f.body);
    this.phone.accentMaterial.color.set(f.accent);
    this.phone.accentMaterial.emissive.set(f.accent);
    this.accentHex = f.accent;
  }

  /** Advance one frame. Returns the current pose so DOM layers can sync to it. */
  frame(scrollY: number, time: number, dt: number): Pose {
    if (this.opts.reduced) {
      Object.assign(this.target, { x: 0, y: 0, s: this.mobile ? 0.7 : 0.95, rx: 0.05, ry: -0.35, rz: 0, explode: 0, vis: 1, lock: 0, feed: 0.2 });
      Object.assign(this.pose, this.target);
    } else {
      this.track.sample(scrollY, this.target);
      // Short, firm damping: mechanical rather than floaty.
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

    if (this.painter.draw({ lock: p.lock, feed: p.feed, t: time, accent: this.accentHex })) {
      this.phone.screenTexture.needsUpdate = true;
    }

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
