import type { Corners } from './types';

export const SCREEN_ASPECT_DEFAULT = 16 / 9;

/** Hörn som fyller skärmens höjd och centrerar ett fönster med givet bildformat. */
export function defaultCorners(windowAspect: number, screenAspect = SCREEN_ASPECT_DEFAULT): Corners {
  if (windowAspect <= screenAspect) {
    const w = windowAspect / screenAspect;
    const x0 = (1 - w) / 2;
    return [
      { x: x0, y: 0 },
      { x: x0 + w, y: 0 },
      { x: x0 + w, y: 1 },
      { x: x0, y: 1 },
    ];
  }
  const h = screenAspect / windowAspect;
  const y0 = (1 - h) / 2;
  return [
    { x: 0, y: y0 },
    { x: 1, y: y0 },
    { x: 1, y: y0 + h },
    { x: 0, y: y0 + h },
  ];
}

/** Bildens storlek i pixlar för ett fönster, anpassad efter skärmens höjd. */
export function contentSize(windowAspect: number, screenHeight: number): { width: number; height: number } {
  const height = Math.round(Math.min(Math.max(screenHeight, 480), 1080));
  return { width: Math.round(height * windowAspect), height };
}

/** Avstånd från projektor till duk, med Webhallen-projektorns kastförhållande 1,2. */
export function projectorDistanceCm(windowHeightCm: number, throwRatio = 1.2, screenAspect = SCREEN_ASPECT_DEFAULT): number {
  return Math.round(windowHeightCm * screenAspect * throwRatio);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
