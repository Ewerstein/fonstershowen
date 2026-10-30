import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { resolveClips } from '../../core/clips';
import type { StyleSpec } from '../../shared/theme';
import type { DirectorState } from '../../shared/types';
import { attachHeadwear, dressBody } from './dress';
import type { Character, CharacterContext } from './types';

/**
 * Figur från ett temapaket: en GLB-modell med skelett och rörelser från en eller flera filer.
 * Följer samma kontrakt som testtomten.
 */

const loader = new GLTFLoader();
const CROSSFADE = 0.35;
const HEAD_FOLLOW: Record<DirectorState, number> = {
  sleep: 0,
  awake: 0.15,
  lookAround: 0,
  notice: 0.75,
  greet: 0.6,
  waveBack: 0.55,
  celebrate: 0.2,
};

function findHead(root: THREE.Object3D): THREE.Bone | null {
  let head: THREE.Bone | null = null;
  root.traverse((obj) => {
    if (head || !(obj as THREE.Bone).isBone) return;
    const name = obj.name.toLowerCase();
    if (/(^|[_:.])head($|[_.]?0*1?$)/.test(name) || name === 'head') head = obj as THREE.Bone;
  });
  if (head) return head;
  root.traverse((obj) => {
    if (!head && (obj as THREE.Bone).isBone && /head/i.test(obj.name) && !/top|end|neck/i.test(obj.name)) head = obj as THREE.Bone;
  });
  return head;
}

function brighten(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const mat = m as THREE.MeshStandardMaterial;
      if (!mat.isMeshStandardMaterial) continue;
      if (mat.map) {
        mat.emissiveMap = mat.map;
        mat.emissive = new THREE.Color(0xffffff);
      } else {
        mat.emissive = mat.color.clone();
      }
      mat.emissiveIntensity = 0.32;
      mat.userData.baseEmissive = 0.32;
    }
  });
}

export class GlbCharacter implements Character {
  readonly object = new THREE.Group();
  private mixer: THREE.AnimationMixer;
  private actions = new Map<DirectorState, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private state: DirectorState = 'awake';
  private head: THREE.Bone | null;
  private yaw = 0;
  private glow = 1;
  private readonly axis = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  private readonly worldQ = new THREE.Quaternion();
  private readonly up = new THREE.Vector3(0, 1, 0);

  private constructor(model: THREE.Object3D, clips: THREE.AnimationClip[], style: StyleSpec) {
    // Normalisera storleken: fötterna på golvet, figuren centrerad, vald höjd.
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const scale = (style.height ?? 2.2) / Math.max(0.001, size.y);
    model.scale.setScalar(scale);
    model.rotation.y = style.rotationY ?? 0;
    model.updateMatrixWorld(true);
    const scaled = new THREE.Box3().setFromObject(model);
    const center = scaled.getCenter(new THREE.Vector3());
    model.position.set(-center.x, -scaled.min.y, -center.z);
    model.updateMatrixWorld(true);

    brighten(model);
    this.head = findHead(model);
    if (style.dress) {
      dressBody(model, style.dress);
      if (this.head) attachHeadwear(model, this.head, style.dress);
    }
    this.object.add(model);

    this.mixer = new THREE.AnimationMixer(model);
    const resolved = resolveClips(
      clips.map((c) => c.name),
      style.clips,
    );
    for (const [state, clipName] of Object.entries(resolved) as [DirectorState, string | null][]) {
      if (!clipName) continue;
      const clip = clips.find((c) => c.name === clipName);
      if (!clip) continue;
      const action = this.mixer.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      this.actions.set(state, action);
    }
    this.play('awake', 0);
  }

  static async load(base: string, style: StyleSpec): Promise<GlbCharacter> {
    const modelGltf = await loader.loadAsync(base + style.model);
    const clips = [...modelGltf.animations];
    for (const file of style.animations) {
      if (file === style.model) continue;
      const anim = await loader.loadAsync(base + file);
      for (const clip of anim.animations) if (!clips.some((c) => c.name === clip.name)) clips.push(clip);
    }
    return new GlbCharacter(modelGltf.scene, clips, style);
  }

  /** Klippnamn per läge, för felsökning och tester. */
  get clipNames(): Partial<Record<DirectorState, string>> {
    return Object.fromEntries([...this.actions].map(([s, a]) => [s, a.getClip().name]));
  }

  private play(state: DirectorState, fade = CROSSFADE): void {
    const next = this.actions.get(state) ?? this.actions.get('awake') ?? null;
    if (!next || next === this.current) return;
    next.reset().setEffectiveWeight(1).play();
    if (this.current && fade > 0) this.current.crossFadeTo(next, fade, false);
    else if (this.current) this.current.stop();
    this.current = next;
  }

  setState(state: DirectorState): void {
    if (state === this.state) return;
    this.state = state;
    this.play(state);
  }

  update(dt: number, ctx: CharacterContext): void {
    this.mixer.update(dt);

    const targetGlow = this.state === 'sleep' ? 0.35 : 1;
    this.glow += (targetGlow - this.glow) * (1 - Math.exp(-3 * dt));
    this.object.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const mat = m as THREE.MeshStandardMaterial;
        if (mat.isMeshStandardMaterial && mat.userData.baseEmissive !== undefined) {
          mat.emissiveIntensity = mat.userData.baseEmissive * this.glow;
        }
      }
    });

    // Huvudet vänds mot besökaren ovanpå klippets rörelse.
    if (this.head) {
      const target = ctx.lookTarget * 0.7 * HEAD_FOLLOW[this.state];
      this.yaw += (target - this.yaw) * (1 - Math.exp(-6 * dt));
      if (Math.abs(this.yaw) > 0.001) {
        this.head.getWorldQuaternion(this.worldQ);
        this.axis.copy(this.up).applyQuaternion(this.worldQ.invert());
        this.head.quaternion.multiply(this.q.setFromAxisAngle(this.axis, this.yaw));
      }
    }
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.object.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => m.dispose());
    });
  }
}
