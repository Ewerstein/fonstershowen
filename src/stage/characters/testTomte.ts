import * as THREE from 'three';
import type { DirectorState } from '../../shared/types';
import type { Character, CharacterContext } from './types';

/**
 * Testtomte av grundformer. Den finns för att kalibrera och testa regissören innan
 * riktiga modeller kommer in vecka 2. Ljusa färger och självlysande material, så att
 * den syns med en svag projektor.
 */

interface Pose {
  armRaiseRight: number;
  armRaiseLeft: number;
  headYaw: number;
  headPitch: number;
  lift: number;
  lean: number;
  glow: number;
}

const REST: Pose = { armRaiseRight: 0.12, armRaiseLeft: 0.12, headYaw: 0, headPitch: 0, lift: 0, lean: 0, glow: 1 };

const COLORS = {
  coat: 0xd8342f,
  trim: 0xf4f1ea,
  skin: 0xf2c3a0,
  beard: 0xffffff,
  mitten: 0x3fa66b,
  boot: 0x5a3a2a,
  buckle: 0xf4c25a,
  eye: 0x1b2433,
  cheek: 0xff8f8f,
};

function material(color: number, emissiveStrength = 0.35): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: emissiveStrength,
    roughness: 0.65,
    metalness: 0,
  });
}

export class TestTomte implements Character {
  readonly object = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly armRight = new THREE.Group();
  private readonly armLeft = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly materials: { mat: THREE.MeshStandardMaterial; base: number }[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private state: DirectorState = 'awake';
  private stateTime = 0;
  private pose: Pose = { ...REST };

  constructor() {
    this.build();
  }

  private mesh(geometry: THREE.BufferGeometry, color: number, emissive = 0.35): THREE.Mesh {
    const mat = material(color, emissive);
    this.materials.push({ mat, base: emissive });
    this.geometries.push(geometry);
    return new THREE.Mesh(geometry, mat);
  }

  private build(): void {
    const coat = this.mesh(new THREE.CapsuleGeometry(0.46, 0.62, 8, 24), COLORS.coat);
    coat.position.y = 0.95;
    const hem = this.mesh(new THREE.TorusGeometry(0.44, 0.07, 12, 40), COLORS.trim, 0.5);
    hem.rotation.x = Math.PI / 2;
    hem.position.y = 0.58;
    const belt = this.mesh(new THREE.CylinderGeometry(0.475, 0.475, 0.09, 40), COLORS.boot, 0.2);
    belt.position.y = 0.9;
    const buckle = this.mesh(new THREE.BoxGeometry(0.16, 0.12, 0.04), COLORS.buckle, 0.6);
    buckle.position.set(0, 0.9, 0.47);
    const bootL = this.mesh(new THREE.CapsuleGeometry(0.11, 0.12, 6, 12), COLORS.boot, 0.25);
    bootL.position.set(-0.18, 0.28, 0.06);
    const bootR = bootL.clone();
    bootR.position.x = 0.18;
    this.body.add(coat, hem, belt, buckle, bootL, bootR);

    const face = this.mesh(new THREE.SphereGeometry(0.31, 32, 24), COLORS.skin, 0.4);
    const beard = this.mesh(new THREE.SphereGeometry(0.3, 32, 24), COLORS.beard, 0.55);
    beard.scale.set(1.05, 1.05, 0.75);
    beard.position.set(0, -0.17, 0.1);
    const nose = this.mesh(new THREE.SphereGeometry(0.065, 16, 12), COLORS.cheek, 0.45);
    nose.position.set(0, 0.0, 0.31);
    const eyeL = this.mesh(new THREE.SphereGeometry(0.035, 12, 10), COLORS.eye, 0.1);
    eyeL.position.set(-0.1, 0.08, 0.28);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.1;
    const brim = this.mesh(new THREE.TorusGeometry(0.3, 0.07, 12, 40), COLORS.trim, 0.55);
    brim.rotation.x = Math.PI / 2;
    brim.position.y = 0.2;
    const hat = this.mesh(new THREE.ConeGeometry(0.3, 0.62, 32), COLORS.coat);
    hat.position.set(0.04, 0.5, -0.02);
    hat.rotation.z = -0.25;
    const pompom = this.mesh(new THREE.SphereGeometry(0.085, 16, 12), COLORS.trim, 0.6);
    pompom.position.set(0.12, 0.8, -0.02);
    this.head.add(face, beard, nose, eyeL, eyeR, brim, hat, pompom);
    this.head.position.y = 1.78;

    const makeArm = (group: THREE.Group, side: 1 | -1) => {
      const sleeve = this.mesh(new THREE.CapsuleGeometry(0.11, 0.42, 6, 16), COLORS.coat);
      sleeve.position.y = -0.3;
      const cuff = this.mesh(new THREE.TorusGeometry(0.11, 0.04, 8, 24), COLORS.trim, 0.5);
      cuff.rotation.x = Math.PI / 2;
      cuff.position.y = -0.55;
      const mitten = this.mesh(new THREE.SphereGeometry(0.12, 16, 12), COLORS.mitten, 0.45);
      mitten.position.y = -0.66;
      group.add(sleeve, cuff, mitten);
      group.position.set(0.5 * side, 1.38, 0);
    };
    makeArm(this.armRight, 1);
    makeArm(this.armLeft, -1);

    this.object.add(this.body, this.head, this.armRight, this.armLeft);
  }

  setState(state: DirectorState): void {
    if (state !== this.state) {
      this.state = state;
      this.stateTime = 0;
    }
  }

  private target(t: number, look: number): Pose {
    const s = this.stateTime;
    const idleYaw = Math.sin(t * 0.37) * 0.12 + Math.sin(t * 0.91) * 0.05;
    switch (this.state) {
      case 'sleep':
        return { ...REST, armRaiseRight: 0.05, armRaiseLeft: 0.05, headPitch: 0.45, headYaw: 0.1, glow: 0.3 };
      case 'awake':
        return { ...REST, headYaw: idleYaw };
      case 'lookAround':
        return { ...REST, headYaw: Math.sin(s * 1.6) * 0.75, headPitch: -0.05 };
      case 'notice':
        return { ...REST, headYaw: look * 0.7, lean: 0.08, armRaiseLeft: 0.25 };
      case 'greet':
        return { ...REST, headYaw: look * 0.6, armRaiseRight: 1.5, headPitch: Math.sin(s * 5) * 0.08 };
      case 'waveBack':
        return {
          ...REST,
          headYaw: look * 0.6,
          headPitch: -0.05,
          armRaiseRight: 2.45 + Math.sin(s * 10) * 0.38,
          lean: Math.sin(s * 5) * 0.04,
          glow: 1.15,
        };
      case 'celebrate':
        return {
          ...REST,
          armRaiseRight: 2.7 + Math.sin(s * 9) * 0.15,
          armRaiseLeft: 2.7 + Math.sin(s * 9 + 1) * 0.15,
          lift: Math.abs(Math.sin(s * 6.5)) * 0.22,
          headPitch: -0.15,
          glow: 1.25,
        };
    }
  }

  update(dt: number, ctx: CharacterContext): void {
    this.stateTime += dt;
    const target = this.target(ctx.time, ctx.lookTarget);
    // Snabbare följning för vinkningen så att svaret känns direkt.
    const speed = this.state === 'waveBack' || this.state === 'celebrate' ? 14 : 6;
    const k = 1 - Math.exp(-speed * dt);
    (Object.keys(this.pose) as (keyof Pose)[]).forEach((key) => {
      this.pose[key] += (target[key] - this.pose[key]) * k;
    });

    const breath = Math.sin(ctx.time * (this.state === 'sleep' ? 1.1 : 2)) * 0.012;
    this.body.scale.set(1 + breath, 1 - breath * 0.5, 1 + breath);
    this.object.position.y = this.pose.lift;
    this.object.rotation.x = this.pose.lean;
    this.head.rotation.set(this.pose.headPitch, this.pose.headYaw, 0);
    this.armRight.rotation.z = this.pose.armRaiseRight;
    this.armLeft.rotation.z = -this.pose.armRaiseLeft;
    for (const { mat, base } of this.materials) mat.emissiveIntensity = base * this.pose.glow;
  }

  dispose(): void {
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach(({ mat }) => mat.dispose());
  }
}
