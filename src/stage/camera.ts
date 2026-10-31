import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import { GestureTracker, type BodyPose } from '../core/gestures';
import { PREVIEW_POINTS } from '../shared/cameraPoints';
import { isFullZone } from '../shared/settings';
import type { CameraError, CameraFrame, CameraSettings, CameraStatus, Sensitivity, ShowEvent } from '../shared/types';

/**
 * Kameran på scenen. Läser bilder, hittar kroppar med MediaPipe och skickar händelser till
 * regissören. Bilderna stannar i datorn. Bara en liten förhandsbild går till kontrollpanelen,
 * och bara medan panelen ber om den.
 */

/**
 * Kroppsmodellen hämtas från Google, låst version först och senaste som reserv.
 * VITE_POSE_MODEL_URL byter till en egen fil, till exempel vid test.
 */
const MODEL_ROOT = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16';
const MODEL_URLS: string[] = import.meta.env.VITE_POSE_MODEL_URL
  ? [import.meta.env.VITE_POSE_MODEL_URL]
  : [`${MODEL_ROOT}/1/pose_landmarker_full.task`, `${MODEL_ROOT}/latest/pose_landmarker_full.task`];
const WASM_BASE = `${import.meta.env.BASE_URL}mediapipe`;

const DETECT_INTERVAL_MS = 66;
const PREVIEW_INTERVAL_MS = 250;
const PREVIEW_TIMEOUT_MS = 5000;
const STALL_MS = 5000;
const RETRY_MS = 10000;

const CONFIDENCE: Record<Sensitivity, number> = { low: 0.6, normal: 0.5, high: 0.35 };

class ModelError extends Error {}

function classify(error: unknown): CameraError {
  if (error instanceof ModelError) return 'model';
  const name = error instanceof DOMException || error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'notFound';
  if (name === 'NotReadableError' || name === 'AbortError') return 'inUse';
  return 'unknown';
}

interface Handlers {
  onEvents: (events: ShowEvent[]) => void;
  onStatus: () => void;
  onFrame: (frame: CameraFrame) => void;
}

export class CameraSensor {
  status: CameraStatus = { state: 'off', fps: 0, people: 0, present: false };
  private settings: CameraSettings | null = null;
  private stream: MediaStream | null = null;
  private readonly video = document.createElement('video');
  private readonly crop = document.createElement('canvas');
  private readonly preview = document.createElement('canvas');
  private landmarker: PoseLandmarker | null = null;
  private landmarkerLoad: Promise<PoseLandmarker> | null = null;
  private landmarkerConfidence = 0;
  private readonly tracker = new GestureTracker({ sensitivity: 'normal', flip: false });
  private generation = 0;
  private timer = 0;
  private retryTimer = 0;
  private lastVideoTime = -1;
  private lastFrameAt = 0;
  private previewUntil = 0;
  private lastPreviewAt = 0;
  private poses: BodyPose[] = [];
  private detections = 0;
  private fpsWindowStart = 0;
  private lastGestureAt = -1;

  constructor(private readonly handlers: Handlers) {
    this.video.muted = true;
    this.video.playsInline = true;
  }

  configure(next: CameraSettings): void {
    const previous = this.settings;
    this.settings = next;
    this.tracker.setOptions({ sensitivity: next.sensitivity, flip: next.flip });
    if (this.landmarker && this.landmarkerConfidence !== CONFIDENCE[next.sensitivity]) void this.applyConfidence(this.landmarker);

    if (!next.enabled) {
      if (this.status.state !== 'off') this.stop();
      return;
    }
    const cameraChanged = !previous || !previous.enabled || previous.deviceId !== next.deviceId;
    if (cameraChanged || (this.status.state === 'error' && JSON.stringify(previous) !== JSON.stringify(next))) {
      void this.start();
    }
  }

  /** Panelen ber om förhandsbilder. Utan ny begäran slutar de efter några sekunder. */
  setPreview(on: boolean): void {
    this.previewUntil = on ? performance.now() + PREVIEW_TIMEOUT_MS : 0;
  }

  private async start(): Promise<void> {
    const generation = ++this.generation;
    window.clearTimeout(this.retryTimer);
    window.clearTimeout(this.timer);
    this.stopStream();
    this.setStatus({ state: 'starting', error: undefined, detail: undefined, fps: 0 });

    if (!navigator.mediaDevices?.getUserMedia) {
      this.fail(generation, 'unsupported', 'Webbläsaren saknar stöd för kamera');
      return;
    }
    try {
      const model = this.loadLandmarker();
      // Felet hanteras när modellen väntas in nedan. Det här hindrar en varning om den hinner fallera först.
      model.catch(() => undefined);
      const stream = await this.openStream(this.settings?.deviceId ?? '');
      if (generation !== this.generation) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = stream;
      const track = stream.getVideoTracks()[0];
      track?.addEventListener('ended', () => this.fail(generation, 'notFound', 'Kameran kopplades bort'));
      this.video.srcObject = stream;
      await this.video.play();
      await model;
      if (generation !== this.generation) return;
      this.lastVideoTime = -1;
      this.lastFrameAt = performance.now();
      this.fpsWindowStart = performance.now();
      this.detections = 0;
      this.setStatus({ state: 'running', label: track?.label || undefined });
      this.loop(generation);
    } catch (error) {
      this.fail(generation, classify(error), error instanceof Error ? error.message : String(error));
    }
  }

  private async openStream(deviceId: string): Promise<MediaStream> {
    const base: MediaTrackConstraints = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } };
    if (deviceId) {
      try {
        return await navigator.mediaDevices.getUserMedia({ video: { ...base, deviceId: { exact: deviceId } }, audio: false });
      } catch (error) {
        // Den valda kameran finns inte längre. Ta datorns standardkamera hellre än ingen alls.
        if (classify(error) !== 'notFound') throw error;
      }
    }
    return navigator.mediaDevices.getUserMedia({ video: base, audio: false });
  }

  private loadLandmarker(): Promise<PoseLandmarker> {
    this.landmarkerLoad ??= (async () => {
      try {
        const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
        const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
        const confidence = CONFIDENCE[this.settings?.sensitivity ?? 'normal'];
        const create = (modelAssetPath: string, delegate: 'GPU' | 'CPU') =>
          PoseLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath, delegate },
            runningMode: 'VIDEO',
            numPoses: 3,
            minPoseDetectionConfidence: confidence,
            minPosePresenceConfidence: confidence,
            minTrackingConfidence: 0.5,
          });
        // Grafikkortet är snabbast. VITE_POSE_DELEGATE=CPU används bara vid test utan grafikkort.
        const delegates: ('GPU' | 'CPU')[] = import.meta.env.VITE_POSE_DELEGATE === 'CPU' ? ['CPU'] : ['GPU', 'CPU'];
        let landmarker: PoseLandmarker | null = null;
        let lastError: unknown = null;
        for (const url of MODEL_URLS) {
          for (const delegate of delegates) {
            try {
              landmarker = await create(url, delegate);
              break;
            } catch (error) {
              lastError = error;
            }
          }
          if (landmarker) break;
        }
        if (!landmarker) throw lastError ?? new Error('Ingen modell');
        this.landmarker = landmarker;
        this.landmarkerConfidence = confidence;
        return landmarker;
      } catch (error) {
        this.landmarkerLoad = null;
        throw new ModelError(`Kroppsmodellen gick inte att läsa in: ${error instanceof Error ? error.message : String(error)}`);
      }
    })();
    return this.landmarkerLoad;
  }

  private async applyConfidence(landmarker: PoseLandmarker): Promise<void> {
    const confidence = CONFIDENCE[this.settings?.sensitivity ?? 'normal'];
    this.landmarkerConfidence = confidence;
    try {
      await landmarker.setOptions({ minPoseDetectionConfidence: confidence, minPosePresenceConfidence: confidence });
    } catch {
      // Gamla värden fungerar också. Inget att göra.
    }
  }

  private loop(generation: number): void {
    const tick = () => {
      if (generation !== this.generation) return;
      this.detect(generation);
      if (generation === this.generation) this.timer = window.setTimeout(tick, DETECT_INTERVAL_MS);
    };
    tick();
  }

  private detect(generation: number): void {
    const video = this.video;
    const landmarker = this.landmarker;
    const settings = this.settings;
    const now = performance.now();
    if (!landmarker || !settings) return;

    if (video.readyState < 2 || !video.videoWidth || video.currentTime === this.lastVideoTime) {
      // Ingen ny bild på länge betyder att kameran har hängt sig. Starta om den.
      if (now - this.lastFrameAt > STALL_MS) void this.start();
      return;
    }
    this.lastVideoTime = video.currentTime;
    this.lastFrameAt = now;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const zone = settings.zone;
    const full = isFullZone(zone);
    let source: HTMLVideoElement | HTMLCanvasElement = video;
    if (!full) {
      const cw = Math.max(16, Math.round(zone.w * vw));
      const ch = Math.max(16, Math.round(zone.h * vh));
      if (this.crop.width !== cw || this.crop.height !== ch) {
        this.crop.width = cw;
        this.crop.height = ch;
      }
      this.crop.getContext('2d')?.drawImage(video, zone.x * vw, zone.y * vh, cw, ch, 0, 0, cw, ch);
      source = this.crop;
    }

    let landmarks;
    try {
      landmarks = landmarker.detectForVideo(source, now).landmarks;
    } catch (error) {
      this.fail(generation, 'model', error instanceof Error ? error.message : String(error));
      return;
    }
    this.poses = landmarks.map((points) =>
      points.map((p) => ({
        x: full ? p.x : zone.x + p.x * zone.w,
        y: full ? p.y : zone.y + p.y * zone.h,
        visibility: p.visibility ?? 0,
      })),
    );

    const events = this.tracker.update(now, this.poses, vw / vh);
    if (events.length > 0) this.handlers.onEvents(events);

    this.detections++;
    let fps = this.status.fps;
    if (now - this.fpsWindowStart >= 1000) {
      fps = Math.round((this.detections * 1000) / (now - this.fpsWindowStart));
      this.detections = 0;
      this.fpsWindowStart = now;
    }
    const snap = this.tracker.snapshot;
    let lastGesture = this.status.lastGesture;
    if (snap.lastGesture && snap.lastGesture.at !== this.lastGestureAt) {
      this.lastGestureAt = snap.lastGesture.at;
      lastGesture = { type: snap.lastGesture.type, at: Date.now() };
    }
    const changed = snap.people !== this.status.people || snap.present !== this.status.present || lastGesture !== this.status.lastGesture;
    this.status = { ...this.status, fps, people: snap.people, present: snap.present, lastGesture };
    if (changed) this.handlers.onStatus();

    if (now < this.previewUntil && now - this.lastPreviewAt >= PREVIEW_INTERVAL_MS) {
      this.lastPreviewAt = now;
      this.sendPreview(vw / vh);
    }
  }

  private sendPreview(aspect: number): void {
    const settings = this.settings;
    if (!settings) return;
    const width = 384;
    const height = Math.round(width / aspect);
    if (this.preview.width !== width || this.preview.height !== height) {
      this.preview.width = width;
      this.preview.height = height;
    }
    const ctx = this.preview.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(this.video, 0, 0, width, height);
    const round = (v: number) => Math.round(v * 1000) / 1000;
    this.handlers.onFrame({
      image: this.preview.toDataURL('image/jpeg', 0.6),
      aspect,
      zone: settings.zone,
      people: this.poses.map((pose) =>
        PREVIEW_POINTS.map((i) => [round(pose[i]?.x ?? 0), round(pose[i]?.y ?? 0), round(pose[i]?.visibility ?? 0)] as [number, number, number]),
      ),
      at: Date.now(),
    });
  }

  private fail(generation: number, error: CameraError, detail: string): void {
    if (generation !== this.generation) return;
    this.generation++;
    window.clearTimeout(this.timer);
    this.stopStream();
    const events = this.tracker.reset();
    if (events.length > 0) this.handlers.onEvents(events);
    this.setStatus({ state: 'error', error, detail, fps: 0, people: 0, present: false });
    // En urkopplad eller upptagen kamera kan komma tillbaka. Nekad tillgång kräver att någon ändrar inställningen.
    if (error !== 'denied' && error !== 'unsupported') {
      this.retryTimer = window.setTimeout(() => {
        if (this.settings?.enabled && this.status.state === 'error') void this.start();
      }, RETRY_MS);
    }
  }

  stop(): void {
    this.generation++;
    window.clearTimeout(this.timer);
    window.clearTimeout(this.retryTimer);
    this.stopStream();
    const events = this.tracker.reset();
    if (events.length > 0) this.handlers.onEvents(events);
    this.poses = [];
    this.setStatus({ state: 'off', error: undefined, detail: undefined, label: undefined, fps: 0, people: 0, present: false });
  }

  private stopStream(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
  }

  private setStatus(patch: Partial<CameraStatus>): void {
    this.status = { ...this.status, ...patch };
    this.handlers.onStatus();
  }
}
