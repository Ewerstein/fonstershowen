import { describe, expect, it } from 'vitest';
import { applyHomography, computeHomography, toCssMatrix3d } from './homography';
import { defaultCorners, projectorDistanceCm } from './geometry';

const rect = [
  { x: 0, y: 0 },
  { x: 1152, y: 0 },
  { x: 1152, y: 720 },
  { x: 0, y: 720 },
];

describe('perspektivmatris', () => {
  it('flyttar hörnen exakt dit de ska', () => {
    const dst = [
      { x: 120, y: 40 },
      { x: 1700, y: 90 },
      { x: 1650, y: 1020 },
      { x: 160, y: 1060 },
    ];
    const h = computeHomography(rect, dst);
    rect.forEach((p, i) => {
      const q = applyHomography(h, p);
      expect(q.x).toBeCloseTo(dst[i].x, 6);
      expect(q.y).toBeCloseTo(dst[i].y, 6);
    });
  });

  it('ger identitet när källa och mål är samma', () => {
    const h = computeHomography(rect, rect);
    [1, 0, 0, 0, 1, 0, 0, 0, 1].forEach((v, i) => expect(h[i]).toBeCloseTo(v, 9));
    expect(toCssMatrix3d(h)).toBe('matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)');
  });

  it('vägrar hörn som ligger på en linje', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ];
    expect(() => computeHomography(rect, line)).toThrow();
  });
});

describe('fönstrets geometri', () => {
  it('fyller höjden och centrerar ett 125 x 78 cm-fönster på en 16:9-skärm', () => {
    const [tl, tr, br, bl] = defaultCorners(125 / 78);
    expect(tl.y).toBe(0);
    expect(bl.y).toBe(1);
    expect(tl.x).toBeCloseTo(1 - tr.x, 9);
    expect(br.x - bl.x).toBeCloseTo((125 / 78) / (16 / 9), 9);
  });

  it('räknar projektoravståndet för 78 cm höjd till ungefär 1,7 m', () => {
    expect(projectorDistanceCm(78)).toBe(166);
  });
});
