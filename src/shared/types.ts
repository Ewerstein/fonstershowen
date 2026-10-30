// Delade typer mellan scenen, kontrollpanelen och regissören.

export type DirectorState =
  | 'sleep'
  | 'awake'
  | 'lookAround'
  | 'notice'
  | 'greet'
  | 'waveBack'
  | 'celebrate';

export type ManualAction = 'wave' | 'celebrate' | 'lookAround' | 'sleep' | 'wake';

export type Point = { x: number; y: number };

/** Hörnen i ordningen övre vänster, övre höger, nedre höger, nedre vänster. Normaliserade 0..1 mot scenens skärm. */
export type Corners = [Point, Point, Point, Point];

export type MaskShape = 'rect' | 'rounded' | 'arch';

export interface WindowProfile {
  id: string;
  name: string;
  windowWidthCm: number;
  windowHeightCm: number;
  corners: Corners;
  mirror: boolean;
  mask: MaskShape;
  /** Hur mycket masken dras in från kanten, i procent av bildens kortaste sida. */
  maskInsetPct: number;
}

export type Locale = 'sv' | 'en';

export interface ShowSettings {
  version: 1;
  locale: Locale;
  autonomous: boolean;
  testPattern: boolean;
  activeProfileId: string;
  profiles: WindowProfile[];
}

/** Allt som kan hända och som regissören reagerar på. Sensorer skickar bara sådana här. */
export type ShowEvent =
  | { type: 'manual'; action: ManualAction }
  | { type: 'visitor.enter' }
  | { type: 'visitor.leave' }
  | { type: 'visitor.position'; x: number }
  | { type: 'gesture.wave' }
  | { type: 'gesture.bothHands' }
  | { type: 'doorbell.motion' }
  | { type: 'doorbell.ring' };

export interface StageStatus {
  state: DirectorState;
  fps: number;
  fullscreen: boolean;
  autonomous: boolean;
  screen: { width: number; height: number };
  at: number;
}

export type BusMessage =
  | { kind: 'hello'; from: 'panel' | 'stage' }
  | { kind: 'settings'; settings: ShowSettings }
  | { kind: 'event'; event: ShowEvent }
  | { kind: 'status'; status: StageStatus }
  | { kind: 'requestStatus' };
