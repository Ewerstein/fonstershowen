import * as THREE from 'three';

/**
 * Three.js-scenen. Bakgrunden är helt svart så att bara figuren syns på duken.
 * Ingen dimma, ingen glöd över hela bilden: det lyfter det svarta och gör duken grå.
 */
export class ShowScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private readonly stage = new THREE.Group();
  private snow: THREE.Points | null = null;
  private snowSpeeds: Float32Array | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(28, 16 / 10, 0.1, 50);
    this.camera.position.set(0, 1.25, 6.2);
    this.camera.lookAt(0, 1.15, 0);

    this.scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x221a14, 0.9));
    const key = new THREE.DirectionalLight(0xfff1dc, 2.2);
    key.position.set(2, 3.5, 4);
    const rim = new THREE.DirectionalLight(0xbfd8ff, 2.4);
    rim.position.set(-2.5, 3, -3);
    this.scene.add(key, rim, this.stage);
    this.addSnow();
  }

  add(object: THREE.Object3D): void {
    this.stage.add(object);
  }

  remove(object: THREE.Object3D): void {
    this.stage.remove(object);
  }

  setSize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    // Bredare fönster: låt figuren ta samma höjd. Smalare fönster: backa kameran så att figuren får plats.
    const narrow = Math.max(0, 1.2 - this.camera.aspect);
    this.camera.position.z = 6.2 + narrow * 3.5;
    this.camera.updateProjectionMatrix();
  }

  private addSnow(): void {
    const count = 140;
    const positions = new Float32Array(count * 3);
    this.snowSpeeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 6;
      positions[i * 3 + 1] = Math.random() * 3.4;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 2 - 0.5;
      this.snowSpeeds[i] = 0.15 + Math.random() * 0.25;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0xffffff, size: 0.035, transparent: true, opacity: 0.85 });
    this.snow = new THREE.Points(geometry, material);
    this.scene.add(this.snow);
  }

  update(dt: number, time: number): void {
    if (this.snow && this.snowSpeeds) {
      const attr = this.snow.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let i = 0; i < this.snowSpeeds.length; i++) {
        arr[i * 3 + 1] -= this.snowSpeeds[i] * dt;
        arr[i * 3] += Math.sin(time * 0.7 + i) * 0.04 * dt;
        if (arr[i * 3 + 1] < -0.2) arr[i * 3 + 1] = 3.4;
      }
      attr.needsUpdate = true;
    }
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
