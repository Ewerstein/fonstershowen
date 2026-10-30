import { contentSize } from '../shared/geometry';
import { computeHomography, toCssMatrix3d } from '../shared/homography';
import type { MaskShape, WindowProfile } from '../shared/types';

/**
 * Lägger bilden i fönstret: storlek efter fönstrets format, perspektiv från de fyra hörnen,
 * spegling för bakprojektion och mask efter fönstrets form.
 */

export function maskClipPath(shape: MaskShape, insetPct: number): string {
  const p = Math.max(0, Math.min(25, insetPct));
  switch (shape) {
    case 'rect':
      return p > 0 ? `inset(${p}%)` : 'none';
    case 'rounded':
      return `inset(${p}% round 8%)`;
    case 'arch': {
      // Valv: raka sidor upp till en tredjedel, halvellips överst.
      const cx = 50;
      const cy = 38;
      const rx = 50 - p;
      const ry = cy - p;
      const points: string[] = [`${p}% ${100 - p}%`, `${100 - p}% ${100 - p}%`, `${100 - p}% ${cy}%`];
      const steps = 28;
      for (let i = 1; i < steps; i++) {
        const a = (i / steps) * Math.PI;
        points.push(`${(cx + Math.cos(a) * rx).toFixed(2)}% ${(cy - Math.sin(a) * ry).toFixed(2)}%`);
      }
      points.push(`${p}% ${cy}%`);
      return `polygon(${points.join(',')})`;
    }
  }
}

export interface ProjectionLayout {
  width: number;
  height: number;
  transform: string;
  clipPath: string;
  mirror: boolean;
}

export function computeLayout(profile: WindowProfile, screenWidth: number, screenHeight: number): ProjectionLayout {
  const aspect = profile.windowWidthCm / profile.windowHeightCm;
  const { width, height } = contentSize(aspect, screenHeight);
  const src = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  const dst = profile.corners.map((c) => ({ x: c.x * screenWidth, y: c.y * screenHeight }));
  let transform = 'none';
  try {
    transform = toCssMatrix3d(computeHomography(src, dst));
  } catch {
    // Hörn som ligger på en linje: behåll bilden oförvrängd tills de flyttas.
  }
  return { width, height, transform, clipPath: maskClipPath(profile.mask, profile.maskInsetPct), mirror: profile.mirror };
}
