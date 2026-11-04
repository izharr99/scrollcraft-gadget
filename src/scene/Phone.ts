import * as THREE from 'three';
import type { LayerId } from '../types';
import { PT_H, PT_W } from './screenUI';

/** Bezel around the display, identical on all four sides. */
const BEZEL = 0.045;
const SCREEN_W = 1.4;
const SCREEN_H = (SCREEN_W * PT_H) / PT_W;

/** Physical-ish dimensions in scene units (roughly 1 unit = 5 cm). */
export const DIM = { w: SCREEN_W + BEZEL * 2, h: SCREEN_H + BEZEL * 2, d: 0.16, r: 0.24 };

interface Layer {
  id: LayerId;
  object: THREE.Object3D;
  /** z offset when assembled and fully exploded. */
  z0: number;
  z1: number;
  /** Local point used to anchor the HTML spec callout. */
  anchor: THREE.Vector3;
}

function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  // Continuous-curvature-ish corners: cubic handles at 0.55r read softer than quadratic ones.
  const k = 0.45 * r;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.bezierCurveTo(x + w - k, y, x + w, y + k, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.bezierCurveTo(x + w, y + h - k, x + w - k, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.bezierCurveTo(x + k, y + h, x, y + h - k, x, y + h - r);
  s.lineTo(x, y + r);
  s.bezierCurveTo(x, y + k, x + k, y, x + r, y);
  return s;
}

/** Extruded rounded slab. `bevelSegments: 1` gives a crisp chamfer instead of a pillowy edge. */
function slab(w: number, h: number, r: number, depth: number, bevel = 0, curve = 24, bevelSegments = 1): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(roundedRect(w - bevel * 2, h - bevel * 2, Math.max(0.001, r - bevel)), {
    depth: Math.max(0.0001, depth - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments,
    curveSegments: curve,
  });
  g.center();
  return g;
}

/** Vertical two-stop gradient used as the back-glass colour map (supports gradient finishes). */
export class FinishGradient {
  readonly canvas = document.createElement('canvas');
  readonly texture: THREE.CanvasTexture;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas.width = 4;
    this.canvas.height = 256;
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    // Extrude caps use shape-space UVs, so map the phone's footprint onto 0..1.
    this.texture.repeat.set(1 / DIM.w, 1 / DIM.h);
    this.texture.offset.set(0.5, 0.5);
  }

  set(top: string, bottom: string): void {
    const g = this.ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, 0, 4, 256);
    this.texture.needsUpdate = true;
  }
}

/**
 * Procedurally modelled premium phone: flat chamfered titanium band, uniform thin bezels,
 * satin back glass with optional gradient + iridescence, and a raised camera plateau with
 * stepped lens assemblies. Six separable layers let the scroll timeline explode it.
 */
export class Phone {
  readonly group = new THREE.Group();
  readonly layers: Layer[] = [];
  /** Titanium band. */
  readonly bodyMaterial: THREE.MeshPhysicalMaterial;
  /** Satin back glass (colour comes from `gradient`). */
  readonly backMaterial: THREE.MeshPhysicalMaterial;
  readonly accentMaterial: THREE.MeshStandardMaterial;
  readonly gradient = new FinishGradient();
  readonly screenTexture: THREE.CanvasTexture;
  private explodeAmount = -1;

  constructor(screenCanvas: HTMLCanvasElement, lowDetail: boolean, maxAnisotropy = 8) {
    const { w, h, d, r } = DIM;
    const curve = lowDetail ? 16 : 32;

    this.bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: '#8a8794',
      metalness: 1,
      roughness: 0.32,
      clearcoat: 0.6,
      clearcoatRoughness: 0.12,
    });
    this.backMaterial = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      map: this.gradient.texture,
      metalness: 0.05,
      roughness: 0.5,
      clearcoat: 1,
      clearcoatRoughness: 0.28,
      iridescence: 0.55,
      iridescenceIOR: 1.45,
      iridescenceThicknessMinimum: 180,
      iridescenceThicknessMaximum: 520,
      sheen: 0.35,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color('#ffffff'),
    });
    this.accentMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.15, roughness: 0.4 });
    const black = new THREE.MeshPhysicalMaterial({ color: '#030304', roughness: 0.08, metalness: 0, clearcoat: 1 });
    const steel = new THREE.MeshPhysicalMaterial({ color: '#b9bcc4', metalness: 1, roughness: 0.16 });
    const darkSteel = new THREE.MeshPhysicalMaterial({ color: '#2a2b30', metalness: 1, roughness: 0.35 });
    const lensGlass = new THREE.MeshPhysicalMaterial({
      color: '#04060b',
      metalness: 0,
      roughness: 0.02,
      clearcoat: 1,
      clearcoatRoughness: 0,
      iridescence: 1,
      iridescenceIOR: 1.8,
      iridescenceThicknessMinimum: 250,
      iridescenceThicknessMaximum: 600,
    });

    // 1. Frame + back: flat titanium band with a chamfer, inset back glass, buttons
    const back = new THREE.Group();
    back.add(new THREE.Mesh(slab(w, h, r, d, 0.012, curve, 1), this.bodyMaterial));
    const backGlass = new THREE.Mesh(slab(w - 0.05, h - 0.05, r - 0.025, 0.012, 0.003, curve, 2), this.backMaterial);
    backGlass.position.z = -d / 2 + 0.003;
    back.add(backGlass);
    const btnGeo = new THREE.BoxGeometry(0.022, 1, 0.07);
    const buttons: [number, number, number][] = [
      [w / 2 + 0.006, 0.5, 0.46],
      [w / 2 + 0.006, -0.35, 0.28],
      [-w / 2 - 0.006, 0.9, 0.3],
      [-w / 2 - 0.006, 0.52, 0.3],
      [-w / 2 - 0.006, 1.22, 0.14],
    ];
    for (const [bx, by, bh] of buttons) {
      const b = new THREE.Mesh(btnGeo, this.bodyMaterial);
      b.scale.y = bh;
      b.position.set(bx, by, 0);
      back.add(b);
    }
    this.addLayer('back', back, 0, -0.95, new THREE.Vector3(w / 2, -h * 0.3, 0));

    // 2. Camera plateau with three stepped lens assemblies, flash and sensor
    const cam = new THREE.Group();
    const pw = 0.72;
    const plateau = new THREE.Mesh(slab(pw, pw, 0.2, 0.035, 0.008, curve, 2), this.backMaterial);
    cam.add(plateau);
    const seg = lowDetail ? 32 : 64;
    const housingGeo = new THREE.CylinderGeometry(0.135, 0.14, 0.05, seg);
    const bezelGeo = new THREE.TorusGeometry(0.118, 0.012, 12, seg);
    // Shallow spherical cap: radius 0.47, ~0.105 base radius, ~0.012 rise.
    const glassGeo = new THREE.SphereGeometry(0.47, seg, 8, 0, Math.PI * 2, 0, 0.225);
    const innerGeo = new THREE.TorusGeometry(0.06, 0.006, 8, seg);
    const lensPos: [number, number][] = [
      [-0.155, 0.155],
      [-0.155, -0.155],
      [0.155, 0.0],
    ];
    for (const [lx, ly] of lensPos) {
      const housing = new THREE.Mesh(housingGeo, darkSteel);
      housing.rotation.x = Math.PI / 2;
      housing.position.set(lx, ly, -0.035);
      const bez = new THREE.Mesh(bezelGeo, steel);
      bez.position.set(lx, ly, -0.06);
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.112, seg), black);
      face.rotation.y = Math.PI;
      face.position.set(lx, ly, -0.0605);
      const dome = new THREE.Mesh(glassGeo, lensGlass);
      dome.rotation.x = -Math.PI / 2;
      dome.position.set(lx, ly, -0.0725 + 0.47);
      const inner = new THREE.Mesh(innerGeo, darkSteel);
      inner.position.set(lx, ly, -0.064);
      cam.add(housing, bez, face, dome, inner);
    }
    const flash = new THREE.Mesh(new THREE.CircleGeometry(0.038, 32), new THREE.MeshStandardMaterial({ color: '#f3ead7', roughness: 0.3 }));
    flash.rotation.y = Math.PI;
    flash.position.set(0.17, 0.2, -0.0185);
    const sensor = new THREE.Mesh(new THREE.CircleGeometry(0.03, 32), black);
    sensor.rotation.y = Math.PI;
    sensor.position.set(0.17, -0.2, -0.0185);
    cam.add(flash, sensor);
    cam.position.set(-w / 2 + 0.44, h / 2 - 0.44, 0);
    const camZ = -d / 2 - 0.016;
    this.addLayer('camera', cam, camZ, camZ - 1.55, new THREE.Vector3(-w / 2 + 0.08, h / 2 - 0.44, 0));

    // 3. Battery (hidden inside the body until exploded)
    const battery = new THREE.Group();
    const cell = new THREE.Mesh(
      slab(w * 0.76, h * 0.46, 0.06, 0.06, 0.01, curve, 2),
      new THREE.MeshPhysicalMaterial({ color: '#2a2c33', metalness: 0.7, roughness: 0.45 }),
    );
    const label = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.6, 0.05), this.accentMaterial);
    label.position.set(0, h * 0.15, 0.031);
    battery.add(cell, label);
    battery.position.y = -h * 0.17;
    this.addLayer('battery', battery, 0, -0.3, new THREE.Vector3(w * 0.38, -h * 0.17, 0));

    // 4. Logic board + chip
    const board = new THREE.Group();
    board.add(
      new THREE.Mesh(
        slab(w * 0.84, h * 0.32, 0.08, 0.025, 0, curve),
        new THREE.MeshStandardMaterial({ color: '#13201c', roughness: 0.7, metalness: 0.2 }),
      ),
    );
    const chip = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.04), steel);
    chip.position.set(0.12, 0, 0.03);
    const core = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), this.accentMaterial);
    core.position.set(0.12, 0, 0.051);
    board.add(chip, core);
    for (let i = 0; i < 7; i++) {
      const comp = new THREE.Mesh(new THREE.BoxGeometry(0.08 + (i % 3) * 0.04, 0.06, 0.025), black);
      comp.position.set(-0.45 + (i % 3) * 0.13, -0.32 + Math.floor(i / 3) * 0.2, 0.024);
      board.add(comp);
    }
    board.position.y = h * 0.27;
    this.addLayer('chip', board, 0, 0.3, new THREE.Vector3(w * 0.42, h * 0.27, 0));

    // 5. Display: black panel with the live screen inset by a uniform bezel
    const display = new THREE.Group();
    display.add(new THREE.Mesh(slab(w - 0.012, h - 0.012, r - 0.006, 0.008, 0, curve), black));
    this.screenTexture = new THREE.CanvasTexture(screenCanvas);
    this.screenTexture.colorSpace = THREE.SRGBColorSpace;
    this.screenTexture.anisotropy = maxAnisotropy;
    this.screenTexture.generateMipmaps = true;
    this.screenTexture.minFilter = THREE.LinearMipmapLinearFilter;
    this.screenTexture.magFilter = THREE.LinearFilter;
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(SCREEN_W, SCREEN_H),
      new THREE.MeshBasicMaterial({ map: this.screenTexture, transparent: true, toneMapped: false }),
    );
    screen.position.z = 0.0045;
    display.add(screen);
    const dispZ = d / 2 + 0.002;
    this.addLayer('display', display, dispZ, dispZ + 0.85, new THREE.Vector3(w / 2 - 0.05, -h * 0.05, 0));

    // 6. Cover glass: nearly invisible, but catches HDRI reflections
    const glass = new THREE.Mesh(
      slab(w - 0.01, h - 0.01, r - 0.005, 0.01, 0.003, curve, 2),
      new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        metalness: 0,
        roughness: 0.03,
        transparent: true,
        opacity: 0.08,
        clearcoat: 1,
        clearcoatRoughness: 0.02,
        depthWrite: false,
      }),
    );
    glass.renderOrder = 2;
    const glassZ = d / 2 + 0.012;
    this.addLayer('glass', glass, glassZ, glassZ + 1.5, new THREE.Vector3(w / 2 - 0.02, h * 0.42, 0));

    this.setExplode(0);
  }

  /** Apply a finish: frame metal tint, gradient back glass and small accent parts. */
  setFinish(top: string, bottom: string, frame: string, accent: string): void {
    this.gradient.set(top, bottom);
    this.bodyMaterial.color.set(frame);
    this.accentMaterial.color.set(accent);
    this.accentMaterial.emissive.set(accent);
  }

  private addLayer(id: LayerId, object: THREE.Object3D, z0: number, z1: number, anchor: THREE.Vector3) {
    object.position.z = z0;
    this.group.add(object);
    this.layers.push({ id, object, z0, z1, anchor });
  }

  /** 0 = assembled, 1 = fully exploded. */
  setExplode(t: number): void {
    if (t === this.explodeAmount) return;
    this.explodeAmount = t;
    const e = t * t * (3 - 2 * t);
    for (const l of this.layers) l.object.position.z = l.z0 + (l.z1 - l.z0) * e;
  }

  /** World-space anchor for a layer's callout, accounting for the explode offset. */
  anchorWorld(id: LayerId, out: THREE.Vector3): THREE.Vector3 {
    const l = this.layers.find((x) => x.id === id);
    if (!l) return out.set(0, 0, 0);
    out.set(l.anchor.x, l.anchor.y, l.object.position.z);
    return this.group.localToWorld(out);
  }
}
