import * as THREE from 'three';
import type { SceneWeather } from '../shared/weather';

/**
 * Three.js-scenen. Bakgrunden är helt svart så att bara figuren syns på duken.
 * Ingen dimma, ingen glöd över hela bilden: det lyfter det svarta och gör duken grå.
 * Tillval: snö eller regn efter vädret, måne och stjärnor, snö på marken och plats för text överst.
 */

const MAX_SNOW = 460;
const MAX_RAIN = 380;
const SPREAD_X = 4;

export class ShowScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private readonly stage = new THREE.Group();
  private readonly snow: THREE.Points;
  private readonly snowSpeeds = new Float32Array(MAX_SNOW);
  private readonly rain: THREE.LineSegments;
  private readonly rainSpeeds = new Float32Array(MAX_RAIN);
  private readonly sky = new THREE.Group();
  private readonly moon = new THREE.Group();
  private readonly ground: THREE.Mesh;
  private weather: SceneWeather = { snow: 0.3, rain: 0, wind: 0, clear: true };
  private smoothed: SceneWeather = { snow: 0.3, rain: 0, wind: 0, clear: true };
  private textSpace = false;
  private size = { width: 1152, height: 720 };

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

    this.snow = this.makeSnow();
    this.rain = this.makeRain();
    this.ground = this.makeGround();
    this.makeSky();
    this.scene.add(this.snow, this.rain, this.ground, this.sky);
    this.setWeather(this.weather);
  }

  add(object: THREE.Object3D): void {
    this.stage.add(object);
  }

  remove(object: THREE.Object3D): void {
    this.stage.remove(object);
  }

  setSize(width: number, height: number): void {
    this.size = { width, height };
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    // Tomten fyller höjden. Kameran backar bara när fönstret är så smalt att en vinkande arm inte får plats.
    // Med text överst backar den lite och tittar högre, så att tomten hamnar under texten.
    const aspect = this.camera.aspect;
    const z = this.textSpace ? Math.max(6.9, 4.1 / aspect) : Math.max(6.0, 3.7 / aspect);
    const lookY = this.textSpace ? 1.5 : 1.2;
    this.camera.position.set(0, lookY + 0.1, z);
    this.camera.lookAt(0, lookY, 0);
    this.camera.updateProjectionMatrix();
    // Månen placeras i övre vänstra hörnet av det synliga, under texten om den visas.
    const distance = z + 8;
    const halfH = Math.tan((this.camera.fov * Math.PI) / 360) * distance;
    const halfW = halfH * aspect;
    this.moon.position.set(-halfW * 0.6, lookY + halfH * (this.textSpace ? 0.4 : 0.66), -8);
  }

  setTextSpace(on: boolean): void {
    if (on === this.textSpace) return;
    this.textSpace = on;
    this.setSize(this.size.width, this.size.height);
  }

  setWeather(weather: SceneWeather): void {
    this.weather = weather;
  }

  setSky(on: boolean): void {
    this.sky.userData.wanted = on;
  }

  setGround(on: boolean): void {
    this.ground.visible = on;
  }

  private makeSnow(): THREE.Points {
    const positions = new Float32Array(MAX_SNOW * 3);
    for (let i = 0; i < MAX_SNOW; i++) {
      positions[i * 3] = (Math.random() - 0.5) * SPREAD_X * 2;
      positions[i * 3 + 1] = Math.random() * 3.8;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 2 - 0.5;
      this.snowSpeeds[i] = 0.15 + Math.random() * 0.25;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0xffffff, size: 0.04, transparent: true, opacity: 0.85 });
    return new THREE.Points(geometry, material);
  }

  private makeRain(): THREE.LineSegments {
    const positions = new Float32Array(MAX_RAIN * 6);
    for (let i = 0; i < MAX_RAIN; i++) {
      const x = (Math.random() - 0.5) * SPREAD_X * 2;
      const y = Math.random() * 3.8;
      const z = (Math.random() - 0.5) * 2 - 0.5;
      positions.set([x, y, z, x, y + 0.2, z], i * 6);
      this.rainSpeeds[i] = 4.5 + Math.random() * 2;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({ color: 0xb8d2ff, transparent: true, opacity: 0.55 });
    return new THREE.LineSegments(geometry, material);
  }

  private makeGround(): THREE.Mesh {
    // En mjuk snödriva under fötterna: en tillplattad boll med lite gupp.
    const geometry = new THREE.SphereGeometry(1, 48, 16);
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      if (pos.getY(i) > 0) pos.setY(i, pos.getY(i) * (1 + 0.25 * Math.sin(x * 7) * Math.cos(z * 5)));
    }
    geometry.computeVertexNormals();
    // Inte helt vit: en stor vit yta lyser upp hela fönstret och tar uppmärksamheten från tomten.
    const material = new THREE.MeshStandardMaterial({ color: 0xc9d4e4, emissive: 0x8796ab, emissiveIntensity: 0.25, roughness: 1 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.set(1.9, 0.26, 1.1);
    mesh.position.set(0, -0.16, 0.1);
    mesh.visible = false;
    return mesh;
  }

  private makeSky(): void {
    const count = 110;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 16;
      positions[i * 3 + 1] = 1.4 + Math.random() * 5;
      positions[i * 3 + 2] = -8.5;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const stars = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xffffff, size: 0.045, transparent: true, opacity: 0.8 }));
    // Måne som skära: en ljus skiva och en svart skiva lite förskjuten framför.
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.42, 48), new THREE.MeshBasicMaterial({ color: 0xfff3cf, transparent: true }));
    const shade = new THREE.Mesh(new THREE.CircleGeometry(0.38, 48), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    shade.position.set(0.19, 0.11, 0.01);
    this.moon.add(disc, shade);
    this.sky.add(stars, this.moon);
    this.sky.visible = false;
    this.sky.userData.wanted = false;
  }

  update(dt: number, time: number): void {
    // Vädret byts mjukt, så att snön inte slås av och på.
    const k = 1 - Math.exp(-0.8 * dt);
    this.smoothed.snow += (this.weather.snow - this.smoothed.snow) * k;
    this.smoothed.rain += (this.weather.rain - this.smoothed.rain) * k;
    this.smoothed.wind += (this.weather.wind - this.smoothed.wind) * k;
    const drift = this.smoothed.wind * 1.4;

    const snowCount = Math.round(MAX_SNOW * this.smoothed.snow);
    this.snow.geometry.setDrawRange(0, snowCount);
    this.snow.visible = snowCount > 0;
    if (snowCount > 0) {
      const attr = this.snow.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let i = 0; i < snowCount; i++) {
        arr[i * 3 + 1] -= this.snowSpeeds[i] * (1 + this.smoothed.wind * 0.6) * dt;
        arr[i * 3] += (Math.sin(time * 0.7 + i) * 0.04 + drift * (0.7 + 0.3 * Math.sin(i))) * dt;
        if (arr[i * 3 + 1] < -0.2) arr[i * 3 + 1] = 3.8;
        if (arr[i * 3] > SPREAD_X) arr[i * 3] -= SPREAD_X * 2;
      }
      attr.needsUpdate = true;
    }

    const rainCount = Math.round(MAX_RAIN * this.smoothed.rain);
    this.rain.geometry.setDrawRange(0, rainCount * 2);
    this.rain.visible = rainCount > 0;
    if (rainCount > 0) {
      const attr = this.rain.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      const slant = -drift * 0.05;
      for (let i = 0; i < rainCount; i++) {
        const o = i * 6;
        let y = arr[o + 1] - this.rainSpeeds[i] * dt;
        let x = arr[o] + drift * 1.5 * dt;
        if (y < -0.2) y = 3.8;
        if (x > SPREAD_X) x -= SPREAD_X * 2;
        arr[o] = x;
        arr[o + 1] = y;
        arr[o + 3] = x + slant;
        arr[o + 4] = y + 0.2;
      }
      attr.needsUpdate = true;
    }

    // Följer appen vädret syns måne och stjärnor bara när himlen är klar.
    this.sky.visible = this.sky.userData.wanted === true && this.weather.clear;
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
