import * as THREE from 'three';
import type { DressSpec } from '../../shared/theme';

/**
 * Klär en basfigur till tomte utan att röra modellfilen.
 * Kroppen färgas i zoner efter höjd i viloposen: stövlar, rock, bälte, kantband och vantar.
 * Huvudet behåller sina färger. Mössa och skägg byggs av grundformer och fästs på huvudbenet.
 */

const ZONES = {
  boots: 0.075,
  hemLow: 0.355,
  hemHigh: 0.395,
  beltLow: 0.47,
  beltHigh: 0.505,
  collarLow: 0.795,
  neck: 0.835,
  cuffFrom: 0.72,
  mittenFrom: 0.8,
};

interface Bounds {
  minY: number;
  maxY: number;
  maxAbsX: number;
}

function bindBounds(mesh: THREE.SkinnedMesh): Bounds {
  mesh.geometry.computeBoundingBox();
  const box = mesh.geometry.boundingBox as THREE.Box3;
  return { minY: box.min.y, maxY: box.max.y, maxAbsX: Math.max(Math.abs(box.min.x), Math.abs(box.max.x)) };
}

function dressMaterial(source: THREE.Material, dress: DressSpec, bounds: Bounds): THREE.Material {
  const mat = (source as THREE.MeshStandardMaterial).clone();
  const color = (hex: string) => new THREE.Color(hex);
  const uniforms = {
    uMinY: { value: bounds.minY },
    uMaxY: { value: bounds.maxY },
    uMaxAbsX: { value: bounds.maxAbsX },
    uCoat: { value: color(dress.coat) },
    uTrim: { value: color(dress.trim) },
    uBelt: { value: color(dress.belt) },
    uBoots: { value: color(dress.boots) },
    uMittens: { value: color(dress.mittens) },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBindPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBindPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vBindPos;
uniform float uMinY; uniform float uMaxY; uniform float uMaxAbsX;
uniform vec3 uCoat; uniform vec3 uTrim; uniform vec3 uBelt; uniform vec3 uBoots; uniform vec3 uMittens;
vec4 dressZone(vec4 base) {
  float h = (vBindPos.y - uMinY) / max(0.0001, uMaxY - uMinY);
  float ax = abs(vBindPos.x) / max(0.0001, uMaxAbsX);
  if (h > ${ZONES.neck}) return base;
  if (ax > ${ZONES.mittenFrom} && h > 0.3) return vec4(uMittens, base.a);
  if (ax > ${ZONES.cuffFrom} && h > 0.3) return vec4(uTrim, base.a);
  if (h < ${ZONES.boots}) return vec4(uBoots, base.a);
  if (h > ${ZONES.collarLow}) return vec4(uTrim, base.a);
  if (h > ${ZONES.beltLow} && h < ${ZONES.beltHigh}) return vec4(uBelt, base.a);
  if (h > ${ZONES.hemLow} && h < ${ZONES.hemHigh}) return vec4(uTrim, base.a);
  return vec4(uCoat, base.a);
}`,
      )
      .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor = dressZone(diffuseColor);');
  };
  mat.customProgramCacheKey = () => `dress-${dress.coat}-${dress.trim}-${dress.boots}-${dress.mittens}-${dress.belt}`;
  return mat;
}

/** Färgar alla skinnade kroppsdelar som har ett grundmaterial. */
export function dressBody(root: THREE.Object3D, dress: DressSpec): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    const bounds = bindBounds(mesh);
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((m) => dressMaterial(m, dress, bounds));
    } else {
      mesh.material = dressMaterial(mesh.material, dress, bounds);
    }
  });
}

function glowMaterial(hex: string, emissive = 0.4): THREE.MeshStandardMaterial {
  const color = new THREE.Color(hex);
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: emissive, roughness: 0.7 });
}

/**
 * Mössa och skägg. Byggs i världskoordinater i viloposen och fästs sedan på huvudbenet,
 * så att benets egna axlar inte spelar någon roll.
 */
export function attachHeadwear(root: THREE.Object3D, head: THREE.Bone, dress: DressSpec): THREE.Object3D[] {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const headPos = head.getWorldPosition(new THREE.Vector3());
  const headSize = Math.max(0.05, box.max.y - headPos.y);
  const added: THREE.Object3D[] = [];

  if (dress.hat !== 'none') {
    const hat = new THREE.Group();
    const radius = headSize * 0.62;
    const height = headSize * (dress.hat === 'tall' ? 2.3 : dress.hat === 'floppy' ? 1.5 : 1.45);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 32, 1, true), glowMaterial(dress.hatColor));
    cone.position.y = height / 2;
    const brim = new THREE.Mesh(new THREE.TorusGeometry(radius, headSize * 0.13, 12, 40), glowMaterial(dress.trim, 0.55));
    brim.rotation.x = Math.PI / 2;
    const pompom = new THREE.Mesh(new THREE.SphereGeometry(headSize * 0.17, 16, 12), glowMaterial(dress.trim, 0.6));
    pompom.position.y = height;
    const tip = new THREE.Group();
    tip.add(cone, pompom);
    if (dress.hat === 'floppy') {
      tip.rotation.z = -0.55;
      tip.position.x = headSize * 0.1;
    } else {
      tip.rotation.z = -0.18;
    }
    hat.add(brim, tip);
    hat.position.set(headPos.x, box.max.y - headSize * 0.32, headPos.z - headSize * 0.04);
    head.attach(hat);
    added.push(hat);
  }

  if (dress.beard > 0) {
    const beard = new THREE.Mesh(
      new THREE.SphereGeometry(headSize * 0.5, 28, 20),
      glowMaterial(dress.beardColor ?? '#ffffff', 0.55),
    );
    beard.scale.set(1.05 * dress.beard, 1.15 * dress.beard, 0.7);
    beard.position.set(headPos.x, headPos.y + headSize * 0.05, headPos.z + headSize * 0.38);
    head.attach(beard);
    added.push(beard);
  }
  return added;
}
