import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { frameCamera, orbitCamera, zoomCamera, type CameraPreset } from './cameraModes';

export interface PickHandler {
  (faceId: string | null): void;
}

export class SceneManager {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;
  private pickRoot: THREE.Object3D | null = null;
  private onPick: PickHandler | null = null;
  private raf: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private pointerStart: { x: number; y: number; time: number } | null = null;
  private disposed = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    this.camera.position.set(4.2, 3.4, 4.8);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = 18;
    this.controls.minPolarAngle = 0.08;
    this.controls.maxPolarAngle = Math.PI - 0.08;
    this.controls.rotateSpeed = 0.75;
    this.controls.zoomSpeed = 0.8;

    const hemi = new THREE.HemisphereLight(0xfff4dc, 0x1d4a46, 1.6);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(4, 7, 5);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xf0b648, 0.85);
    fill.position.set(-5, -1, -4);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0x8fb7c9, 0.6);
    rim.position.set(-2, 4, -6);
    this.scene.add(rim);

    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointerleave', this.handlePointerLeave);
    this.observeSize();
    this.start();
  }

  setPickRoot(root: THREE.Object3D | null): void {
    this.pickRoot = root;
  }

  setPickHandler(handler: PickHandler): void {
    this.onPick = handler;
  }

  frame(radius: number, preset: CameraPreset = 'orbit'): void {
    frameCamera(this.camera, this.controls, radius, preset);
  }

  setFrameRadius(radius: number): void {
    const fov = (this.camera.fov * Math.PI) / 180;
    const distance = (Math.max(radius, 0.8) / Math.sin(fov / 2)) * 1.35;
    const offset = this.camera.position.clone().sub(this.controls.target);
    if (offset.lengthSq() < 1e-8) offset.set(1, 0.8, 1.2);
    offset.setLength(distance);
    this.camera.position.copy(this.controls.target).add(offset);
    this.camera.near = distance / 100;
    this.camera.far = distance * 20;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  orbit(deltaTheta: number, deltaPhi: number): void {
    orbitCamera(this.camera, this.controls, deltaTheta, deltaPhi);
  }

  zoom(factor: number): void {
    zoomCamera(this.camera, this.controls, factor);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private start(): void {
    const loop = () => {
      if (this.disposed) return;
      this.controls.update();
      this.render();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    document.addEventListener('visibilitychange', this.handleVisibility);
  }

  private observeSize(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(parent);
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  private resize = (): void => {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const width = parent.clientWidth;
    const height = parent.clientHeight;
    if (width === 0 || height === 0) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };

  private handleVisibility = (): void => {
    if (document.hidden) {
      if (this.raf !== null) cancelAnimationFrame(this.raf);
      this.raf = null;
    } else if (this.raf === null && !this.disposed) {
      this.start();
    }
  };

  private handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    this.pointerStart = { x: event.clientX, y: event.clientY, time: performance.now() };
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (!this.pointerStart || event.button !== 0) return;
    const distance = Math.hypot(
      event.clientX - this.pointerStart.x,
      event.clientY - this.pointerStart.y,
    );
    const elapsed = performance.now() - this.pointerStart.time;
    this.pointerStart = null;
    if (distance > 7 || elapsed > 700) return;
    this.pick(event);
  };

  private handlePointerLeave = (): void => {
    this.pointerStart = null;
  };

  private pick(event: PointerEvent): void {
    if (!this.pickRoot || !this.onPick) return;
    const rect = this.canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, this.camera);
    const hits = raycaster.intersectObjects(this.pickRoot.children, true);
    const faceId = hits.find((hit) => typeof hit.object.userData.faceId === 'string')?.object
      .userData.faceId as string | undefined;
    this.onPick(faceId ?? null);
  }

  dispose(): void {
    this.disposed = true;
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointerleave', this.handlePointerLeave);
    this.controls.dispose();
    this.renderer.dispose();
  }
}
