import * as THREE from 'three';
import type { PuppetSpec } from '../../shared/theme';

/**
 * Bygger en tecknad tomte av grundformer på ett riktigt skelett. Varje del sitter fast på
 * sitt ben, så figuren rör sig med de inspelade rörelserna men behåller enkla, tydliga
 * former som syns på håll i en svag projektor.
 *
 * Skelettet följer Quaternius och Unreals namn: pelvis, spine_01..03, neck_01, Head,
 * upperarm_l/r, lowerarm_l/r, hand_l/r, thigh_l/r, calf_l/r, foot_l/r, ball_leaf_l/r.
 */

const UP = new THREE.Vector3(0, 1, 0);

function mat(hex: string, emissive = 0.35): THREE.MeshStandardMaterial {
  const color = new THREE.Color(hex);
  const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: emissive, roughness: 0.7 });
  m.userData.baseEmissive = emissive;
  return m;
}

function worldPos(node: THREE.Object3D): THREE.Vector3 {
  return node.getWorldPosition(new THREE.Vector3());
}

export function buildPuppet(root: THREE.Object3D, spec: PuppetSpec): void {
  root.updateMatrixWorld(true);
  const node = (name: string): THREE.Object3D => {
    const found = root.getObjectByName(name);
    if (!found) throw new Error(`Benet ${name} saknas i skelettet`);
    return found;
  };

  /** Lägger en del i världskoordinater i viloposen och fäster den på ett ben. */
  const place = (bone: string, mesh: THREE.Object3D, position: THREE.Vector3, quaternion?: THREE.Quaternion) => {
    mesh.position.copy(position);
    if (quaternion) mesh.quaternion.copy(quaternion);
    root.add(mesh);
    mesh.updateMatrixWorld(true);
    node(bone).attach(mesh);
  };

  /** En kapsel mellan två ben, fäst på det första. */
  const limb = (from: string, to: string, radius: number, hex: string, extend = 0) => {
    const a = worldPos(node(from));
    const b = worldPos(node(to));
    const dir = b.clone().sub(a);
    const length = dir.length();
    dir.normalize();
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, Math.max(0.01, length - radius + extend), 6, 16), mat(hex));
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir);
    place(from, mesh, a.clone().add(b).multiplyScalar(0.5).addScaledVector(dir, extend / 2), q);
    return { a, b, dir };
  };

  const ring = (bone: string, center: THREE.Vector3, axis: THREE.Vector3, radius: number, tube: number, hex: string) => {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 10, 32), mat(hex, 0.5));
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis.clone().normalize());
    place(bone, mesh, center, q);
  };

  const ball = (bone: string, center: THREE.Vector3, radius: number, hex: string, scale = new THREE.Vector3(1, 1, 1), emissive = 0.35) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 28, 20), mat(hex, emissive));
    mesh.scale.copy(scale);
    place(bone, mesh, center);
    return mesh;
  };

  const pelvis = worldPos(node('pelvis'));
  const neck = worldPos(node('neck_01'));
  const head = worldPos(node('Head'));
  const belly = spec.belly;

  // Kropp: mage, bröst, bälte och krage.
  ball('spine_01', new THREE.Vector3(0, pelvis.y + 0.2, 0.04), 0.25 * belly, spec.coat, new THREE.Vector3(1.05, 1.15, 1));
  ball('spine_03', new THREE.Vector3(0, neck.y - 0.17, 0), 0.21, spec.coat, new THREE.Vector3(1.25, 1, 0.95));
  ring('spine_01', new THREE.Vector3(0, pelvis.y + 0.12, 0.03), UP, 0.235 * belly, 0.035, spec.belt);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.03), mat(spec.buckle, 0.6));
  place('spine_01', buckle, new THREE.Vector3(0, pelvis.y + 0.12, 0.03 + 0.25 * belly));
  ring('spine_03', new THREE.Vector3(0, neck.y - 0.01, 0), UP, 0.1, 0.045, spec.trim);

  // Rockens nederdel: kort rock, lång klänning eller tunika.
  const skirt = { coat: [0.33, 0.3], dress: [0.42, 0.68], tunic: [0.3, 0.2] }[spec.skirt];
  const skirtMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * belly, skirt[0], skirt[1], 32, 1, true), mat(spec.coat));
  (skirtMesh.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  place('pelvis', skirtMesh, new THREE.Vector3(0, pelvis.y + 0.06 - skirt[1] / 2, 0.01));
  ring('pelvis', new THREE.Vector3(0, pelvis.y + 0.06 - skirt[1], 0.01), UP, skirt[0], 0.04, spec.trim);

  // Armar med muddar och vantar.
  for (const side of ['l', 'r'] as const) {
    ball(`upperarm_${side}`, worldPos(node(`upperarm_${side}`)), 0.095, spec.coat);
    limb(`upperarm_${side}`, `lowerarm_${side}`, 0.078, spec.coat, 0.04);
    const fore = limb(`lowerarm_${side}`, `hand_${side}`, 0.07, spec.coat);
    ring(`lowerarm_${side}`, fore.b.clone().addScaledVector(fore.dir, -0.03), fore.dir, 0.07, 0.03, spec.trim);
    ball(`hand_${side}`, fore.b.clone().addScaledVector(fore.dir, 0.07), 0.075, spec.mittens, new THREE.Vector3(1, 1, 1), 0.45);

    // Ben och stövlar.
    limb(`thigh_${side}`, `calf_${side}`, 0.095, spec.pants, 0.04);
    limb(`calf_${side}`, `foot_${side}`, 0.08, spec.boots);
    const foot = worldPos(node(`foot_${side}`));
    const toe = worldPos(node(`ball_leaf_${side}`));
    const bootDir = toe.clone().sub(foot).normalize();
    const boot = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.16, 6, 14), mat(spec.boots, 0.3));
    place(`foot_${side}`, boot, foot.clone().add(toe).multiplyScalar(0.5).setY(0.07), new THREE.Quaternion().setFromUnitVectors(UP, bootDir.setY(0).normalize()));
  }

  // Huvud: ansikte, kinder, näsa, ögon, ögonbryn, skägg, hår och mössa.
  const r = 0.17 * spec.headScale;
  const face = new THREE.Vector3(head.x, head.y + r * 0.75, head.z + 0.02);
  ball('Head', face, r, spec.skin, new THREE.Vector3(1, 1, 1), 0.4);
  ball('Head', face.clone().add(new THREE.Vector3(0, -r * 0.05, r * 0.95)), r * 0.2, spec.cheeks, new THREE.Vector3(1, 0.9, 1), 0.45);
  for (const x of [-1, 1]) {
    ball('Head', face.clone().add(new THREE.Vector3(x * r * 0.55, -r * 0.12, r * 0.7)), r * 0.17, spec.cheeks, new THREE.Vector3(1, 0.8, 0.6), 0.4);
    ball('Head', face.clone().add(new THREE.Vector3(x * r * 0.33, r * 0.2, r * 0.9)), r * 0.09, '#1b2433', new THREE.Vector3(1, 1.15, 0.6), 0.05);
    ball('Head', face.clone().add(new THREE.Vector3(x * r * 0.3, r * 0.25, r * 0.97)), r * 0.03, '#ffffff', new THREE.Vector3(1, 1, 1), 0.8);
    if (spec.beard) {
      ball('Head', face.clone().add(new THREE.Vector3(x * r * 0.35, r * 0.42, r * 0.85)), r * 0.13, spec.beard, new THREE.Vector3(1.6, 0.6, 0.6), 0.55);
    }
  }
  if (spec.beard) {
    const len = spec.beardLength;
    ball('Head', face.clone().add(new THREE.Vector3(0, -r * 0.45, r * 0.45)), r * 0.82, spec.beard, new THREE.Vector3(1.05, 0.85 + 0.5 * len, 0.75), 0.55);
    ball('Head', face.clone().add(new THREE.Vector3(0, -r * (0.95 + 0.6 * len), r * 0.42)), r * 0.45, spec.beard, new THREE.Vector3(1, 0.9 + 0.4 * len, 0.7), 0.55);
    for (const x of [-1, 1]) {
      ball('Head', face.clone().add(new THREE.Vector3(x * r * 0.28, -r * 0.18, r * 0.98)), r * 0.24, spec.beard, new THREE.Vector3(1.5, 0.6, 0.7), 0.55);
    }
  }
  ball('Head', face.clone().add(new THREE.Vector3(0, r * 0.05, -r * 0.35)), r * 0.98, spec.hair, new THREE.Vector3(1.04, 0.95, 0.9), 0.5);
  if (spec.bun) ball('Head', face.clone().add(new THREE.Vector3(0, r * 0.55, -r * 0.85)), r * 0.42, spec.hair, new THREE.Vector3(1, 1, 1), 0.5);

  const hat = new THREE.Group();
  const hatH = r * (spec.hat === 'tall' ? 3.2 : spec.hat === 'floppy' ? 1.7 : 2.1);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(r * 0.95, hatH, 32, 1, true), mat(spec.hatColor));
  (cone.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  cone.position.y = hatH / 2;
  const pompom = new THREE.Mesh(new THREE.SphereGeometry(r * 0.24, 16, 12), mat(spec.trim, 0.6));
  pompom.position.y = hatH;
  const tip = new THREE.Group();
  tip.add(cone, pompom);
  tip.rotation.set(spec.hat === 'tall' ? -0.35 : -0.15, 0, spec.hat === 'floppy' ? -0.75 : -0.22);
  const brim = new THREE.Mesh(new THREE.TorusGeometry(r * 0.98, r * 0.2, 12, 40), mat(spec.trim, 0.55));
  brim.rotation.x = Math.PI / 2;
  hat.add(tip, brim);
  hat.rotation.x = -0.12;
  hat.position.set(face.x, face.y + r * 0.55, face.z - r * 0.08);
  root.add(hat);
  hat.updateMatrixWorld(true);
  node('Head').attach(hat);
}
