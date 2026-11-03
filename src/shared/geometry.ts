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

/**
 * Projektorns bild måste täcka hela fönstret. Kastförhållandet gäller projektorns långsida,
 * som är vågrät när projektorn står och lodrät när den ligger på sidan.
 */
function longSideCm(windowWidthCm: number, windowHeightCm: number, onSide: boolean, nativeAspect: number): number {
  return onSide
    ? Math.max(windowHeightCm, windowWidthCm * nativeAspect)
    : Math.max(windowWidthCm, windowHeightCm * nativeAspect);
}

/** Avstånd från projektor till duk, med Webhallen-projektorns kastförhållande 1,2. */
export function projectorDistanceCm(
  windowWidthCm: number,
  windowHeightCm: number,
  onSide = false,
  throwRatio = 1.2,
  nativeAspect = SCREEN_ASPECT_DEFAULT,
): number {
  return Math.round(longSideCm(windowWidthCm, windowHeightCm, onSide, nativeAspect) * throwRatio);
}

/** Andel av projektorns ljus som hamnar på fönstret. Resten lyser på svart runt fönstret. */
export function lightOnWindow(windowWidthCm: number, windowHeightCm: number, onSide = false, nativeAspect = SCREEN_ASPECT_DEFAULT): number {
  const long = longSideCm(windowWidthCm, windowHeightCm, onSide, nativeAspect);
  return (windowWidthCm * windowHeightCm) / (long * (long / nativeAspect));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
