import type { Point } from './types';

/** 3x3-matris i radordning, h[8] = 1. */
export type Homography = number[];

/**
 * Räknar ut perspektivmatrisen som flyttar fyra källpunkter till fyra målpunkter.
 * Används för att lägga bilden exakt i fönstret även om projektorn står snett.
 */
export function computeHomography(src: Point[], dst: Point[]): Homography {
  if (src.length !== 4 || dst.length !== 4) throw new Error('Exakt fyra punkter krävs');
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    a.push([x, y, 1, 0, 0, 0, -x * u, -y * u]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -x * v, -y * v]);
    b.push(v);
  }
  const h = solve(a, b);
  return [...h, 1];
}

/** Gausseliminering med pivotering. */
function solve(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    }
    if (Math.abs(m[pivot][col]) < 1e-12) throw new Error('Hörnen ligger på en linje');
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = m[r][col] / m[col][col];
      for (let c = col; c <= n; c++) m[r][c] -= f * m[col][c];
    }
  }
  return m.map((row, i) => row[n] / row[i]);
}

export function applyHomography(h: Homography, p: Point): Point {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  return {
    x: (h[0] * p.x + h[1] * p.y + h[2]) / w,
    y: (h[3] * p.x + h[4] * p.y + h[5]) / w,
  };
}

/** CSS matrix3d i kolumnordning. Elementet ska ha transform-origin 0 0. */
export function toCssMatrix3d(h: Homography): string {
  const values = [h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, h[8]];
  return `matrix3d(${values.map((v) => Number(v.toFixed(10))).join(',')})`;
}
