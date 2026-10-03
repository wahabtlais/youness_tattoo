import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import armUrl from '../../../../assets/work/glb/younes_tattoo_arm_rigged.glb?url';
import { gsap } from 'gsap';
import { ARM } from './armConfig';

/** the clone print's untransformed box on screen (CSS px) */
export interface PrintBase {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

/**
 * Where the arm is. x/y: the grip point on screen in CSS px (y down) as if
 * at the print's depth; z: px toward the viewer; rx/ry/rz in degrees.
 * The pick timeline drives this object; the stage renders it.
 *
 * This is the ONLY thing that moves the arm: it is one rigid object. The
 * GLB's synthetic rig and its Reach/Grip/Pull clips are deliberately not
 * used - they moved the upper arm and made the shoulder wobble - so the
 * model always stays in its bind pose.
 */
export interface ArmPose {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
}

const DEG = Math.PI / 180;
const FOV = 26;

let gltfPromise: Promise<THREE.Group> | null = null;
/** the model loads once and is reused for every pick (its clips are ignored) */
function loadArm(): Promise<THREE.Group> {
  gltfPromise ??= new GLTFLoader().loadAsync(armUrl).then((g) => g.scene);
  return gltfPromise;
}

/**
 * The 3D arm, on one transparent WebGL canvas laid over the pick.
 *
 * World units are CSS px at the print's plane (z = 0): the camera sits
 * exactly far enough back for that, so DOM rectangles map straight into
 * the scene and the arm keeps real perspective as it comes toward you.
 *
 * Layering is real depth: an invisible plane the size of the print sits
 * where the print is (it draws nothing but the hand's shadow and writes
 * depth). The hand stays in front of it and the forearm tips away behind
 * it, so the fingers sit over the print's edge while any of the forearm
 * that passes behind the print is hidden - nothing crosses the plane.
 * After the grab the print rides on a point of the hand.
 *
 * Renders only while a pick is playing.
 */
export class ArmStage {
  readonly pose: ArmPose = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 };
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 1, 10, 10000);
  private root = new THREE.Group();
  private occluder: THREE.Mesh<THREE.PlaneGeometry, THREE.ShadowMaterial>;
  private wall: THREE.Mesh<THREE.PlaneGeometry, THREE.ShadowMaterial>;
  private key: THREE.DirectionalLight;
  private model: THREE.Group | null = null;
  private W = 1;
  private H = 1;
  private D = 1;
  private raf = 0;

  private clone: HTMLElement | null = null;
  private base: PrintBase | null = null;
  private attached = false;
  private grip = new THREE.Vector3();
  private attachRz = 0;
  private attachRot = 0;
  private attachScale = 1;
  private sway = 0;
  private swayV = 0;

  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    // warm paper light: soft sky/ground fill, one warm key from above-left
    // (the prints' own shadows fall down and right), a dim warm fill
    this.scene.add(new THREE.HemisphereLight(0xfff6ec, 0x857a6e, 1.15));
    this.key = new THREE.DirectionalLight(0xfff0de, 2.3);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.6;
    this.key.shadow.radius = 6;
    this.scene.add(this.key, this.key.target);
    const fill = new THREE.DirectionalLight(0xffe9d6, 0.45);
    fill.position.set(900, -200, 900);
    this.scene.add(fill);

    // the print's stand-in: depth + the hand's shadow on the photograph
    this.occluder = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.34 }));
    this.occluder.material.transparent = false; // drawn first, so it hides what is behind it
    this.occluder.renderOrder = -1;
    this.occluder.receiveShadow = true;
    // the paper behind the line: a faint shadow of the arm
    this.wall = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.1 }));
    this.wall.position.z = -160;
    this.wall.receiveShadow = true;
    this.scene.add(this.occluder, this.wall, this.root);
    this.root.visible = false;
    this.occluder.visible = false;
    this.resize();
  }

  /** load (once) and normalise the model: grip point at the origin, one hand length = 1 */
  async ready(): Promise<void> {
    if (this.model) return;
    const scene = await loadArm();
    const yaw = new THREE.Group();
    const flip = new THREE.Group();
    flip.rotation.z = Math.PI; // the arm hangs down in the file: point it up
    flip.add(scene);
    yaw.rotation.y = ARM.yaw * DEG;
    yaw.add(flip);
    yaw.updateMatrixWorld(true);

    // measure the hand from the mesh itself
    const pts: THREE.Vector3[] = [];
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      // skinned mesh: its bounds are the bind pose; never cull it mid-pick
      mesh.frustumCulled = false;
      const pos = mesh.geometry.getAttribute('position');
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i += 2) pts.push(v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).clone());
    });
    const top = Math.max(...pts.map((p) => p.y));
    const bottom = Math.min(...pts.map((p) => p.y));
    const span = top - bottom;
    // the wrist is the narrowest slice below the hand
    let wristY = top - span * 0.25;
    let narrow = Infinity;
    for (let f = 0.12; f <= 0.4; f += 0.01) {
      const y = top - span * f;
      const slice = pts.filter((p) => Math.abs(p.y - y) < span * 0.006);
      if (slice.length < 6) continue;
      const w = Math.max(...slice.map((p) => p.x)) - Math.min(...slice.map((p) => p.x));
      if (w < narrow) {
        narrow = w;
        wristY = y;
      }
    }
    const hand = top - wristY;
    const gripY = top - hand * ARM.gripFromTip;
    const fingers = pts.filter((p) => Math.abs(p.y - gripY) < hand * 0.04);
    const gx = fingers.reduce((s, p) => s + p.x, 0) / fingers.length;
    const gz = fingers.reduce((s, p) => s + p.z, 0) / fingers.length;

    const norm = new THREE.Group();
    norm.scale.setScalar(1 / hand);
    yaw.position.set(-gx, -gripY, -gz);
    norm.add(yaw);
    this.root.add(norm);
    this.model = norm;

    // warm up: compile the shaders and the shadow map now, while nothing is
    // on screen, so the first frame of the reach doesn't stall
    this.root.visible = true;
    this.occluder.visible = true;
    this.renderer.compile(this.scene, this.camera);
    this.renderer.render(this.scene, this.camera);
    this.root.visible = false;
    this.occluder.visible = false;
    this.renderer.clear();
  }

  resize() {
    const W = this.canvas.clientWidth || innerWidth;
    const H = this.canvas.clientHeight || innerHeight;
    this.W = W;
    this.H = H;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.setSize(W, H, false);
    this.camera.aspect = W / H;
    this.D = H / 2 / Math.tan((FOV / 2) * DEG);
    this.camera.position.set(0, 0, this.D);
    this.camera.near = this.D * 0.1;
    this.camera.far = this.D * 4;
    this.camera.updateProjectionMatrix();
    this.wall.scale.set(W * 3, H * 3, 1);
    // key light from above-left, in front; its shadow box covers the screen
    this.key.position.set(-W * 0.35, H * 0.9, this.D * 0.8);
    const cam = this.key.shadow.camera;
    cam.left = -W;
    cam.right = W;
    cam.top = H;
    cam.bottom = -H;
    cam.near = 1;
    cam.far = this.D * 3;
    cam.updateProjectionMatrix();
  }

  /** a new pick: the clone print it works with, and the hand's length (px) for it */
  setPrint(clone: HTMLElement, base: PrintBase, handLength: number) {
    this.clone = clone;
    this.base = base;
    this.attached = false;
    this.root.scale.setScalar(handLength);
    this.occluder.scale.set(base.w, base.h, 1);
    this.root.visible = true;
    this.occluder.visible = true;
  }

  /** from now on the print rides on the hand */
  attach() {
    if (!this.clone || !this.base) return;
    this.applyPose();
    const x = gsap.getProperty(this.clone, 'x') as number;
    const y = gsap.getProperty(this.clone, 'y') as number;
    const centre = new THREE.Vector3(this.base.cx + x - this.W / 2, this.H / 2 - (this.base.cy + y), 0);
    this.grip.copy(this.root.worldToLocal(centre));
    this.attachRz = this.pose.rz;
    this.attachRot = gsap.getProperty(this.clone, 'rotation') as number;
    this.attachScale = gsap.getProperty(this.clone, 'scale') as number;
    this.attached = true;
  }

  /** the hand lets go; the timeline flies the print on from where it is */
  release() {
    this.attached = false;
    this.occluder.visible = false;
  }

  start() {
    if (this.raf) return;
    this.resize();
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this.frame();
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.root.visible = false;
    this.occluder.visible = false;
    this.attached = false;
    this.renderer.clear();
  }

  private applyPose() {
    const p = this.pose;
    this.root.position.set(p.x - this.W / 2, this.H / 2 - p.y, p.z);
    this.root.rotation.set(p.rx * DEG, p.ry * DEG, p.rz * DEG, 'XYZ');
    this.root.updateMatrixWorld(true);
  }

  private frame() {
    this.applyPose();
    const clone = this.clone;
    const base = this.base;
    if (clone && base) {
      if (this.attached) {
        // the print follows the hand exactly, with a whisper of lag in its angle
        const wp = this.root.localToWorld(this.grip.clone());
        const sp = wp.clone().project(this.camera);
        const sx = ((sp.x + 1) / 2) * this.W;
        const sy = ((1 - sp.y) / 2) * this.H;
        const k = this.D / (this.D - wp.z);
        const target = this.attachRot - (this.pose.rz - this.attachRz);
        this.swayV += (target - this.sway) * 0.12;
        this.swayV *= 0.78;
        this.sway += this.swayV;
        gsap.set(clone, { x: sx - base.cx, y: sy - base.cy, scale: this.attachScale * k, rotation: this.sway });
        this.occluder.position.copy(wp);
        this.occluder.scale.set(base.w * this.attachScale, base.h * this.attachScale, 1);
        this.occluder.rotation.set(0, 0, -this.sway * DEG);
      } else {
        const x = gsap.getProperty(clone, 'x') as number;
        const y = gsap.getProperty(clone, 'y') as number;
        const s = gsap.getProperty(clone, 'scale') as number;
        const r = gsap.getProperty(clone, 'rotation') as number;
        this.sway = r;
        this.swayV = 0;
        this.occluder.position.set(base.cx + x - this.W / 2, this.H / 2 - (base.cy + y), 0);
        this.occluder.scale.set(base.w * s, base.h * s, 1);
        this.occluder.rotation.set(0, 0, -r * DEG);
      }
    }
    this.key.target.position.copy(this.root.position);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.stop();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        for (const value of Object.values(m)) if (value instanceof THREE.Texture) value.dispose();
        m.dispose();
      }
    });
    this.key.shadow.map?.dispose();
    this.renderer.dispose();
    gltfPromise = null;
  }
}
