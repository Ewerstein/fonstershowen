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
  /** Projektorn ligger på sidan: bilden vrids 90 eller 270 grader så att den står rätt på fönstret. */
  rotation: Rotation;
}

export type Rotation = 0 | 90 | 270;

export type Locale = 'sv' | 'en';

export type Sensitivity = 'low' | 'normal' | 'high';

/** Del av kamerabilden, normaliserad 0..1. */
export interface Zone {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Ett pass i schemat, till exempel en morgon före soluppgången och en kväll från skymningen. */
export interface ScheduleSlot {
  startMode: 'time' | 'sunset';
  /** Starttid 'HH:MM'. Används också som reserv när solnedgången inte går att räkna ut. */
  startTime: string;
  /** Minuter före (negativt) eller efter solnedgången. */
  sunsetOffsetMin: number;
  endMode: 'time' | 'sunrise';
  endTime: string;
  /** Minuter före (negativt) eller efter soluppgången. */
  sunriseOffsetMin: number;
}

export interface ScheduleSettings {
  enabled: boolean;
  slots: ScheduleSlot[];
}

/** Avrundad plats för sol och väder. Null tills användaren valt plats. */
export type GeoLocation = { lat: number; lon: number } | null;

export interface SceneSettings {
  /** Text ovanför tomten. */
  text: 'none' | 'countdown' | 'custom';
  customText: string;
  /** Lätt snöfall hela tiden, vädret just nu från SMHI, eller ingen nederbörd. */
  weather: 'light' | 'live' | 'off';
  /** Måne och stjärnor. Följer appen vädret syns de bara när det är klart. */
  sky: boolean;
  /** Snö på marken under tomten. */
  ground: boolean;
}

export interface CameraSettings {
  enabled: boolean;
  /** Tom sträng betyder datorns standardkamera. */
  deviceId: string;
  /** Byt höger och vänster för blicken. */
  flip: boolean;
  sensitivity: Sensitivity;
  /** Bara den här delen av bilden bevakas. Ger bättre träff på personer långt bort. */
  zone: Zone;
}

export interface ShowSettings {
  version: 1;
  locale: Locale;
  autonomous: boolean;
  testPattern: boolean;
  themeId: string;
  /** Vald figurstil i temat. 'test' är den inbyggda testtomten, tom sträng betyder temats standard. */
  styleId: string;
  activeProfileId: string;
  profiles: WindowProfile[];
  camera: CameraSettings;
  schedule: ScheduleSettings;
  scene: SceneSettings;
  location: GeoLocation;
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

export type CameraError = 'denied' | 'notFound' | 'inUse' | 'model' | 'unsupported' | 'unknown';

export interface CameraStatus {
  state: 'off' | 'starting' | 'running' | 'error';
  error?: CameraError;
  detail?: string;
  /** Kamerans namn enligt datorn. */
  label?: string;
  /** Bilder per sekund som kroppsmodellen hinner med. */
  fps: number;
  people: number;
  present: boolean;
  lastGesture?: { type: 'wave' | 'bothHands'; at: number };
  /** Medelljuset i den bevakade ytan, 0 till 255. */
  light?: number;
  /** Hur mycket bilden ljusas upp innan analysen. 1 betyder inte alls. */
  gain?: number;
}

/** Liten förhandsbild från kameran med kroppspunkter, för att rikta kameran från panelen. */
export interface CameraFrame {
  /** JPEG som data-URL. */
  image: string;
  aspect: number;
  zone: Zone;
  /** Per person: punkterna i PREVIEW_POINTS som [x, y, synlighet], normaliserade mot hela bilden. */
  people: [number, number, number][][];
  at: number;
}

export interface StageStatus {
  state: DirectorState;
  fps: number;
  fullscreen: boolean;
  autonomous: boolean;
  screen: { width: number; height: number };
  /** Den figurstil scenen faktiskt visar. 'test' om temat inte gick att läsa in. */
  styleId: string;
  styleError?: string;
  camera: CameraStatus;
  /** Fönstret är släckt för natten enligt schemat. */
  blackout: boolean;
  /** Vädret från SMHI när appen följer vädret. */
  weather?: { now: import('./weather').WeatherNow | null; fetchedAt: number; error?: string };
  at: number;
}

export type BusMessage =
  | { kind: 'hello'; from: 'panel' | 'stage' }
  | { kind: 'settings'; settings: ShowSettings }
  | { kind: 'event'; event: ShowEvent }
  | { kind: 'status'; status: StageStatus }
  | { kind: 'requestStatus' }
  | { kind: 'cameraPreview'; on: boolean }
  | { kind: 'cameraFrame'; frame: CameraFrame };
