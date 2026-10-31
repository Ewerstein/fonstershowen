import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { resolveClips } from '../../core/clips';
import type { OverlayName, RigSpec, StyleSpec } from '../../shared/theme';
import type { DirectorState } from '../../shared/types';
import { attachHeadwear, dressBody, tintKeepAlpha } from './dress';
import { buildPuppet } from './puppet';
import type { Character, CharacterContext } from './types';

/**
 * Figur från ett temapaket: en GLB-modell med skelett och rörelser från en eller flera filer.
 * Lägen utan eget klipp får en kodad rörelse ovanpå, till exempel vinkning.
 * Följer samma kontrakt som testtomten.
 */

const loader = new GLTFLoader();
const CROSSFADE = 0.35;

/** Hur mycket huvudet följer besökaren i varje läge. */
const HEAD_FOLLOW: Record<DirectorState, number> = {
  sleep: 0,
  awake: 0.8,
  lookAround: 0,
  notice: 0.8,
  greet: 0.65,
  waveBack: 0.6,
  celebrate: 0.2,
};

const DEFAULT_OVERLAYS: Partial<Record<DirectorState, OverlayName>> = {
  greet: 'raiseHand',
  waveBack: 'wave',
  sleep: 'sleepy',
};

/** Ben hittas på namn. Ett skelett utan kropp har vanliga noder i stället för Bone, så båda godtas. */
function findBone(root: THREE.Object3D, name: string): THREE.Object3D | null {
  return root.getObjectByName(name) ?? null;
}

function findHead(root: THREE.Object3D): THREE.Object3D | null {
  let head: THREE.Object3D | null = null;
  root.traverse((obj) => {
    if (!head && /^head$/i.test(obj.name)) head = obj;
  });
  return head;
}

/** Självlysande material så att figuren syns med en svag projektor. */
function brighten(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const mat = m as THREE.MeshStandardMaterial;
      if (!mat.isMeshStandardMaterial || mat.userData.baseEmissive !== undefined) continue;
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

interface ArmRig {
  upper: THREE.Object3D;
  lower: THREE.Object3D;
  hand: THREE.Object3D;
  /** Åt vilket håll armen sitter i figurens egna koordinater, 1 eller -1. */
  side: number;
}

export class GlbCharacter implements Character {
  readonly object = new THREE.Group();
  private readonly model: THREE.Object3D;
  private mixer: THREE.AnimationMixer;
  private actions = new Map<DirectorState, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private state: DirectorState = 'awake';
  private stateTime = 0;
  private head: THREE.Object3D | null;
  private arm: ArmRig | null = null;
  private overlays: Partial<Record<DirectorState, OverlayName>>;
  private overlay: OverlayName = 'none';
  private overlayWeight = 0;
  private boneScale: { bone: THREE.Object3D; scale: number }[] = [];
  private yaw = 0;
  private pitch = 0;
  private glow = 1;
  private readonly v1 = new THREE.Vector3();
  private readonly v2 = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();
  private readonly q1 = new THREE.Quaternion();
  private readonly q2 = new THREE.Quaternion();
  private readonly q3 = new THREE.Quaternion();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly right = new THREE.Vector3(1, 0, 0);

  private constructor(model: THREE.Object3D, clips: THREE.AnimationClip[], attachments: { object: THREE.Object3D; bone: string; tint?: string }[], style: StyleSpec) {
    this.model = model;
    this.overlays = { ...DEFAULT_OVERLAYS, ...style.overlays };

    // Färger och tillbehör läggs på i viloposen, innan storleken ändras.
    model.updateMatrixWorld(true);
    brighten(model);
    for (const [name, hex] of Object.entries(style.tints ?? {})) {
      model.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh && obj.name.toLowerCase().includes(name.toLowerCase())) tintKeepAlpha(obj, hex);
      });
    }
    if (style.dress) dressBody(model, style.dress);
    for (const a of attachments) {
      const bone = findBone(model, a.bone);
      if (!bone) continue;
      if (a.tint) tintKeepAlpha(a.object, a.tint);
      brighten(a.object);
      model.add(a.object);
      model.updateMatrixWorld(true);
      bone.attach(a.object);
    }
    this.head = (style.rig && findBone(model, style.rig.head)) || findHead(model);
    if (style.dress && this.head) {
      for (const added of attachHeadwear(model, this.head, style.dress)) brighten(added);
    }
    if (style.puppet) buildPuppet(model, style.puppet);
    this.arm = this.buildArm(model, style.rig);
    for (const [name, scale] of Object.entries(style.boneScale ?? {})) {
      const bone = findBone(model, name);
      if (bone) this.boneScale.push({ bone, scale });
    }

    // Storlek: fötterna på golvet, figuren centrerad, vald höjd.
    model.rotation.y = style.rotationY ?? 0;
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model, true);
    const size = box.getSize(new THREE.Vector3());
    model.scale.setScalar((style.height ?? 2.2) / Math.max(0.001, size.y));
    model.updateMatrixWorld(true);
    const scaled = new THREE.Box3().setFromObject(model, true);
    const center = scaled.getCenter(new THREE.Vector3());
    model.position.set(-center.x, -scaled.min.y, -center.z);
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

  private buildArm(model: THREE.Object3D, rig?: RigSpec): ArmRig | null {
    if (!rig) return null;
    const upper = findBone(model, rig.upperArm);
    const lower = findBone(model, rig.lowerArm);
    const hand = findBone(model, rig.hand);
    if (!upper || !lower || !hand) return null;
    model.updateMatrixWorld(true);
    const local = model.worldToLocal(upper.getWorldPosition(new THREE.Vector3()));
    return { upper, lower, hand, side: local.x >= 0 ? 1 : -1 };
  }

  static async load(base: string, style: StyleSpec): Promise<GlbCharacter> {
    const [modelGltf, ...extra] = await Promise.all([
      loader.loadAsync(base + style.model),
      ...style.animations.filter((f) => f !== style.model).map((f) => loader.loadAsync(base + f)),
    ]);
    const clips = [...modelGltf.animations];
    for (const gltf of extra) for (const clip of gltf.animations) if (!clips.some((c) => c.name === clip.name)) clips.push(clip);
    const attachments = await Promise.all(
      (style.attachments ?? []).map(async (a) => ({ object: (await loader.loadAsync(base + a.model)).scene, bone: a.bone, tint: a.tint })),
    );
    return new GlbCharacter(modelGltf.scene, clips, attachments, style);
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
    this.stateTime = 0;
    this.play(state);
  }

  /** Riktar ett ben så att det pekar mot en riktning i figurens egna koordinater. */
  private aim(bone: THREE.Object3D, child: THREE.Object3D, localDir: THREE.Vector3, weight: number): void {
    if (!bone.parent) return;
    // Målriktningen läses först: localDir kan vara samma vektor som används som arbetsyta nedan.
    const target = this.dir.copy(localDir).normalize().transformDirection(this.model.matrixWorld);
    bone.updateWorldMatrix(true, false);
    child.updateWorldMatrix(false, false);
    const from = bone.getWorldPosition(this.v1);
    const current = child.getWorldPosition(this.v2).sub(from).normalize();
    const delta = this.q1.setFromUnitVectors(current, target);
    const boneWorld = bone.getWorldQuaternion(this.q2);
    const parentWorld = bone.parent.getWorldQuaternion(this.q3).invert();
    const goal = parentWorld.multiply(delta.multiply(boneWorld));
    bone.quaternion.slerp(goal, weight);
    bone.updateMatrixWorld(true);
  }

  private applyOverlay(time: number): void {
    if (!this.arm || this.overlayWeight < 0.001) return;
    const { upper, lower, hand, side } = this.arm;
    const w = this.overlayWeight;
    if (this.overlay === 'wave') {
      const swing = Math.sin(time * 9) * 0.5;
      this.aim(upper, lower, this.v1.set(side, 0.2, 0.35), w);
      this.aim(lower, hand, this.v1.set(side * 0.3 + swing, 1, 0.25), w);
    } else if (this.overlay === 'raiseHand') {
      this.aim(upper, lower, this.v1.set(side * 0.85, 0.35, 0.45), w);
      this.aim(lower, hand, this.v1.set(side * 0.1, 1, 0.3), w);
    }
  }

  update(dt: number, ctx: CharacterContext): void {
    this.stateTime += dt;
    this.mixer.update(dt);
    for (const { bone, scale } of this.boneScale) bone.scale.setScalar(scale);
    this.model.updateMatrixWorld(true);

    // Kodade rörelser tonas in och ut. Byte av rörelse väntar tills den förra tonats ut.
    const wanted = this.overlays[this.state] ?? 'none';
    if (wanted !== this.overlay) {
      this.overlayWeight += (0 - this.overlayWeight) * (1 - Math.exp(-14 * dt));
      if (this.overlayWeight < 0.02) this.overlay = wanted;
    } else {
      const goal = wanted === 'none' ? 0 : 1;
      this.overlayWeight += (goal - this.overlayWeight) * (1 - Math.exp(-10 * dt));
    }
    if (this.overlay === 'wave' || this.overlay === 'raiseHand') this.applyOverlay(ctx.time);

    const targetGlow = this.state === 'sleep' ? 0.35 : 1;
    this.glow += (targetGlow - this.glow) * (1 - Math.exp(-3 * dt));
    this.object.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const mat = m as THREE.MeshStandardMaterial;
        if (mat.userData.baseEmissive !== undefined) mat.emissiveIntensity = mat.userData.baseEmissive * this.glow;
      }
    });

    // Huvudet: följer besökaren, tittar runt eller nickar till av sömn, ovanpå klippet.
    if (this.head) {
      const look = this.state === 'lookAround' ? Math.sin(this.stateTime * 1.6) * 0.65 : ctx.lookTarget * 0.7 * HEAD_FOLLOW[this.state];
      const nod = this.overlay === 'sleepy' ? 0.45 * this.overlayWeight : this.state === 'greet' ? Math.sin(this.stateTime * 5) * 0.06 : 0;
      this.yaw += (look - this.yaw) * (1 - Math.exp(-6 * dt));
      this.pitch += (nod - this.pitch) * (1 - Math.exp(-6 * dt));
      if (Math.abs(this.yaw) > 0.001 || Math.abs(this.pitch) > 0.001) {
        const inverse = this.head.getWorldQuaternion(this.q2).invert();
        const modelQ = this.model.getWorldQuaternion(this.q3);
        const upAxis = this.v1.copy(this.up).applyQuaternion(modelQ).applyQuaternion(inverse);
        const rightAxis = this.v2.copy(this.right).applyQuaternion(modelQ).applyQuaternion(inverse);
        this.head.quaternion.multiply(this.q1.setFromAxisAngle(upAxis, this.yaw));
        this.head.quaternion.multiply(this.q1.setFromAxisAngle(rightAxis, this.pitch));
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
