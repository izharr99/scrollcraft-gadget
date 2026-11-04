import * as THREE from 'three';
import type { LayerId } from '../types';
import { PT_H, PT_W } from './screenUI';

/** Physical-ish dimensions in scene units (roughly 1 unit = 5 cm). */
export const DIM = { w: 1.5, h: 3.1, d: 0.15, r: 0.22 };

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
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function slab(w: number, h: number, r: number, depth: number, bevel = 0, curve = 16): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(roundedRect(w - bevel * 2, h - bevel * 2, Math.max(0.001, r - bevel)), {
    depth: Math.max(0.0001, depth - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 5,
    curveSegments: curve,
  });
  g.center();
  return g;
}

/**
 * Procedurally modelled phone made of six separable layers so the scroll timeline can
 * "explode" it. No external models: every mesh is built from extruded shapes.
 */
export class Phone {
  readonly group = new THREE.Group();
  readonly layers: Layer[] = [];
  readonly bodyMaterial: THREE.MeshPhysicalMaterial;
  /** Satin (frosted) back glass, tinted with the finish colour. */
  readonly backMaterial: THREE.MeshPhysicalMaterial;
  readonly accentMaterial: THREE.MeshStandardMaterial;
  readonly screenTexture: THREE.CanvasTexture;
  private explodeAmount = -1;

  constructor(
    screenCanvas: HTMLCanvasElement,
    bodyColor: string,
    accent: string,
    lowDetail: boolean,
    maxAnisotropy = 8,
  ) {
    const { w, h, d, r } = DIM;
    const curve = lowDetail ? 10 : 20;

    // Anodised metal frame: full metalness, low roughness, so the HDRI reads as real reflections.
    this.bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: bodyColor,
      metalness: 1,
      roughness: 0.26,
      clearcoat: 0.4,
      clearcoatRoughness: 0.15,
    });
    // Matte etched back glass: dielectric, rough base, glossy clearcoat on top.
    this.backMaterial = new THREE.MeshPhysicalMaterial({
      color: bodyColor,
      metalness: 0,
      roughness: 0.62,
      clearcoat: 1,
      clearcoatRoughness: 0.42,
      sheen: 0.25,
      sheenRoughness: 0.6,
    });
    this.accentMaterial = new THREE.MeshStandardMaterial({
      color: accent,
      emissive: accent,
      emissiveIntensity: 0.25,
      roughness: 0.4,
    });
    const black = new THREE.MeshStandardMaterial({ color: '#050507', roughness: 0.2, metalness: 0.3 });
    const darkMetal = new THREE.MeshPhysicalMaterial({ color: '#6b6e75', metalness: 1, roughness: 0.3 });
    const lensGlass = new THREE.MeshPhysicalMaterial({
      color: '#05070c',
      metalness: 0,
      roughness: 0.02,
      clearcoat: 1,
      clearcoatRoughness: 0,
      iridescence: 0.6,
      iridescenceIOR: 1.6,
    });

    // 1. Back / frame: metal body, inset satin-glass back panel and side buttons
    const back = new THREE.Group();
    back.add(new THREE.Mesh(slab(w, h, r, d, 0.035, curve), this.bodyMaterial));
    const backGlass = new THREE.Mesh(slab(w - 0.07, h - 0.07, r - 0.035, 0.012, 0.004, curve), this.backMaterial);
    backGlass.position.z = -d / 2 + 0.002;
    back.add(backGlass);
    const btnGeo = new THREE.BoxGeometry(0.03, 1, 0.06);
    const buttons: [number, number, number][] = [
      [w / 2 + 0.008, 0.55, 0.42],
      [-w / 2 - 0.008, 0.85, 0.26],
      [-w / 2 - 0.008, 0.5, 0.26],
      [-w / 2 - 0.008, 1.12, 0.12],
    ];
    for (const [bx, by, bh] of buttons) {
      const b = new THREE.Mesh(btnGeo, this.bodyMaterial);
      b.scale.y = bh;
      b.position.set(bx, by, 0);
      back.add(b);
    }
    this.addLayer('back', back, 0, -0.95, new THREE.Vector3(w / 2, -h * 0.3, 0));

    // 2. Camera module, sits on the back face
    const cam = new THREE.Group();
    const plate = new THREE.Mesh(slab(0.66, 0.66, 0.16, 0.05, 0.012, curve), this.backMaterial);
    cam.add(plate);
    const lensGeo = new THREE.CylinderGeometry(0.115, 0.115, 0.05, lowDetail ? 20 : 40);
    const ringGeo = new THREE.TorusGeometry(0.125, 0.018, 8, lowDetail ? 20 : 40);
    const lensPos: [number, number][] = [
      [-0.14, 0.14],
      [-0.14, -0.14],
      [0.15, 0.0],
    ];
    for (const [lx, ly] of lensPos) {
      const lens = new THREE.Mesh(lensGeo, lensGlass);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(lx, ly, -0.03);
      const ring = new THREE.Mesh(ringGeo, darkMetal);
      ring.position.set(lx, ly, -0.055);
      const iris = new THREE.Mesh(new THREE.CircleGeometry(0.05, 32), black);
      iris.rotation.y = Math.PI;
      iris.position.set(lx, ly, -0.0565);
      cam.add(lens, ring, iris);
    }
    const flash = new THREE.Mesh(new THREE.CircleGeometry(0.035, 16), this.accentMaterial);
    flash.position.set(0.16, 0.2, -0.027);
    flash.rotation.y = Math.PI;
    cam.add(flash);
    cam.position.set(-w / 2 + 0.43, h / 2 - 0.43, 0);
    const camZ = -d / 2 - 0.022;
    this.addLayer('camera', cam, camZ, camZ - 1.55, new THREE.Vector3(-w / 2 + 0.1, h / 2 - 0.43, 0));

    // 3. Battery (hidden inside the body until exploded)
    const battery = new THREE.Group();
    const cell = new THREE.Mesh(
      slab(w * 0.76, h * 0.46, 0.06, 0.06, 0.01, curve),
      new THREE.MeshStandardMaterial({ color: '#2a2c33', metalness: 0.6, roughness: 0.5 }),
    );
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.6, 0.05), this.accentMaterial);
    stripe.position.set(0, h * 0.15, 0.031);
    battery.add(cell, stripe);
    battery.position.y = -h * 0.17;
    this.addLayer('battery', battery, 0, -0.3, new THREE.Vector3(w * 0.38, -h * 0.17, 0));

    // 4. Logic board + chip
    const board = new THREE.Group();
    const pcb = new THREE.Mesh(
      slab(w * 0.84, h * 0.32, 0.08, 0.025, 0, curve),
      new THREE.MeshStandardMaterial({ color: '#0e1a17', roughness: 0.7, metalness: 0.2 }),
    );
    board.add(pcb);
    const chip = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.04), darkMetal);
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

    // 5. Display panel + live screen
    const display = new THREE.Group();
    const panel = new THREE.Mesh(slab(w - 0.04, h - 0.04, r - 0.02, 0.01, 0, curve), black);
    display.add(panel);
    this.screenTexture = new THREE.CanvasTexture(screenCanvas);
    this.screenTexture.colorSpace = THREE.SRGBColorSpace;
    this.screenTexture.anisotropy = maxAnisotropy;
    this.screenTexture.generateMipmaps = true;
    this.screenTexture.minFilter = THREE.LinearMipmapLinearFilter;
    this.screenTexture.magFilter = THREE.LinearFilter;
    const sw = w - 0.1;
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(sw, (sw * PT_H) / PT_W),
      new THREE.MeshBasicMaterial({ map: this.screenTexture, transparent: true, toneMapped: false }),
    );
    screen.position.z = 0.0065;
    display.add(screen);
    const dispZ = d / 2 + 0.004;
    this.addLayer('display', display, dispZ, dispZ + 0.85, new THREE.Vector3(w / 2 - 0.05, -h * 0.05, 0));

    // 6. Cover glass
    const glass = new THREE.Mesh(
      slab(w - 0.02, h - 0.02, r - 0.01, 0.012, 0.004, curve),
      new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        metalness: 0,
        roughness: 0.04,
        transparent: true,
        opacity: 0.12,
        clearcoat: 1,
        clearcoatRoughness: 0.02,
        depthWrite: false,
      }),
    );
    glass.renderOrder = 2;
    const glassZ = d / 2 + 0.017;
    this.addLayer('glass', glass, glassZ, glassZ + 1.5, new THREE.Vector3(w / 2 - 0.02, h * 0.42, 0));

    this.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o !== glass && o !== screen) o.castShadow = true;
    });
    this.setExplode(0);
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
    const e = t * t * (3 - 2 * t); // smoothstep for a softer start and stop
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
