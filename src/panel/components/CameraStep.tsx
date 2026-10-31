import { useCallback, useEffect, useRef, useState } from 'react';
import { PREVIEW_LINES, PREVIEW_WRISTS } from '../../shared/cameraPoints';
import type { Strings } from '../../shared/i18n';
import { FULL_ZONE, isFullZone, normalizeZone } from '../../shared/settings';
import type { CameraFrame, CameraSettings, CameraStatus, Sensitivity, Zone } from '../../shared/types';
import { Toggle } from './Toggle';

type Permission = 'unknown' | 'granted' | 'prompt' | 'denied';

interface CameraStepProps {
  t: Strings;
  camera: CameraSettings;
  status: CameraStatus | null;
  frame: CameraFrame | null;
  connected: boolean;
  onChange: (patch: Partial<CameraSettings>) => void;
  onPreview: (on: boolean) => void;
}

/** Steg 3 i installationen: tillgång, val av kamera, känslighet och vilken del av bilden som bevakas. */
export function CameraStep({ t, camera, status, frame, connected, onChange, onPreview }: CameraStepProps) {
  const { permission, devices, request } = useCameraAccess();
  const [asking, setAsking] = useState(false);

  const enable = async (on: boolean) => {
    if (!on) {
      onChange({ enabled: false });
      return;
    }
    // Tillgången tas här i panelen, så att scenen på projektorn inte behöver visa någon fråga.
    if (permission !== 'granted') {
      setAsking(true);
      const ok = await request();
      setAsking(false);
      if (!ok) return;
    }
    onChange({ enabled: true });
  };

  // Be scenen om förhandsbilder så länge steget visas och kameran är på.
  const wantPreview = connected && camera.enabled;
  useEffect(() => {
    if (!wantPreview) return;
    onPreview(true);
    const timer = window.setInterval(() => onPreview(true), 2000);
    return () => {
      window.clearInterval(timer);
      onPreview(false);
    };
  }, [wantPreview, onPreview]);

  const sensitivities: Sensitivity[] = ['low', 'normal', 'high'];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div>
        <CameraPreview t={t} frame={camera.enabled ? frame : null} zone={camera.zone} onZone={(zone) => onChange({ zone })} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <CameraStatusLine t={t} enabled={camera.enabled} status={status} />
          {!isFullZone(camera.zone) && (
            <button
              type="button"
              onClick={() => onChange({ zone: { ...FULL_ZONE } })}
              className="rounded-xl border border-night-600 px-3.5 py-1.5 text-sm font-medium text-frost hover:border-mist"
            >
              {t.cameraZoneReset}
            </button>
          )}
        </div>
        <p className="mt-3 max-w-[62ch] text-sm leading-snug text-mist">{t.cameraPrivacy}</p>
      </div>

      <div className="divide-y divide-night-700">
        <Toggle label={t.cameraUse} hint={t.cameraUseHint} checked={camera.enabled} onChange={(on) => void enable(on)} />

        {permission !== 'granted' && (
          <div className="py-3">
            <button
              type="button"
              disabled={asking}
              onClick={() => void request()}
              className="rounded-xl border border-lantern/60 px-4 py-2 text-sm font-medium text-lantern-soft hover:border-lantern disabled:opacity-60"
            >
              {t.cameraAccess}
            </button>
            <p className="mt-2 text-sm leading-snug text-mist">{permission === 'denied' ? t.cameraDenied : t.cameraAccessHint}</p>
          </div>
        )}

        {permission === 'granted' && (
          <label className="block py-3">
            <span className="text-[15px] font-medium text-frost">{t.cameraDevice}</span>
            <select
              value={devices.some((d) => d.deviceId === camera.deviceId) ? camera.deviceId : ''}
              onChange={(e) => onChange({ deviceId: e.target.value })}
              className="mt-2 block w-full rounded-xl border border-night-600 bg-night-800 px-3 py-2 text-[15px] text-frost"
            >
              <option value="">{t.cameraDefault}</option>
              {devices.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>
                  {d.label || `${t.cameraDevice} ${i + 1}`}
                </option>
              ))}
            </select>
          </label>
        )}

        <fieldset className="py-3">
          <legend className="text-[15px] font-medium text-frost">{t.cameraSensitivity}</legend>
          <div className="mt-2 inline-flex rounded-xl border border-night-600 p-0.5">
            {sensitivities.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={camera.sensitivity === value}
                onClick={() => onChange({ sensitivity: value })}
                className={[
                  'rounded-[10px] px-3.5 py-1.5 text-sm transition-colors',
                  camera.sensitivity === value ? 'bg-lantern/15 text-lantern-soft' : 'text-frost hover:text-lantern-soft',
                ].join(' ')}
              >
                {t.sensitivity[value]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm leading-snug text-mist">{t.sensitivityHint[camera.sensitivity]}</p>
        </fieldset>

        <Toggle label={t.cameraFlip} hint={t.cameraFlipHint} checked={camera.flip} onChange={(flip) => onChange({ flip })} />
      </div>
    </div>
  );
}

function CameraStatusLine({ t, enabled, status }: { t: Strings; enabled: boolean; status: CameraStatus | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!enabled) return <p className="text-sm text-mist">{t.cameraState.off}</p>;
  if (!status) return null;
  if (status.state === 'error') {
    return (
      <p role="status" className="text-sm text-ember">
        {status.error ? t.cameraError[status.error] : t.cameraState.error}
      </p>
    );
  }
  if (status.state !== 'running') return <p className="text-sm text-mist">{t.cameraState[status.state]}</p>;

  const parts = [t.cameraPeople(status.people), `${status.fps} ${t.cameraFps}`];
  if (status.lastGesture && now - status.lastGesture.at < 60000) {
    parts.push(t.cameraGesture(status.lastGesture.type, Math.max(0, Math.round((now - status.lastGesture.at) / 1000))));
  }
  // Under åtta analyser per sekund hinner en vinkning passera mellan bilderna.
  const slow = status.fps > 0 && status.fps < 8;
  return (
    <div role="status">
      <p className="text-sm text-frost/90">
        <span className={`mr-2 inline-block h-2 w-2 rounded-full align-middle ${slow ? 'bg-lantern' : 'bg-pine'}`} aria-hidden="true" />
        {parts.join(' · ')}
      </p>
      {slow && <p className="mt-1 max-w-[52ch] text-sm leading-snug text-lantern-soft">{t.cameraSlow}</p>}
    </div>
  );
}

/** Förhandsbild med kroppspunkter. Dra med musen för att välja vilken del av bilden som bevakas. */
function CameraPreview({ t, frame, zone, onZone }: { t: Strings; frame: CameraFrame | null; zone: Zone; onZone: (zone: Zone) => void }) {
  const ref = useRef<SVGSVGElement | null>(null);
  const [draft, setDraft] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const aspect = frame?.aspect ?? 16 / 9;
  const W = 1000;
  const H = W / aspect;

  const point = useCallback((e: React.PointerEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  }, []);

  const shown = draft
    ? {
        x: Math.min(draft.x0, draft.x1),
        y: Math.min(draft.y0, draft.y1),
        w: Math.abs(draft.x1 - draft.x0),
        h: Math.abs(draft.y1 - draft.y0),
      }
    : zone;
  const full = !draft && isFullZone(zone);

  return (
    <figure className="m-0">
      <figcaption className="mb-2 text-[15px] font-medium text-frost">{t.cameraPreview}</figcaption>
      <div className="relative overflow-hidden rounded-2xl border border-night-700 bg-night-950" style={{ aspectRatio: String(aspect) }}>
        {frame ? (
          <img src={frame.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-mist">{t.cameraPreviewWaiting}</p>
        )}
        {frame && (
          <svg
            ref={ref}
            viewBox={`0 0 ${W} ${H}`}
            className="absolute inset-0 h-full w-full touch-none cursor-crosshair"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              const p = point(e);
              setDraft({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
            }}
            onPointerMove={(e) => {
              if (!draft) return;
              const p = point(e);
              setDraft({ ...draft, x1: p.x, y1: p.y });
            }}
            onPointerUp={() => {
              if (!draft) return;
              const w = Math.abs(draft.x1 - draft.x0);
              const h = Math.abs(draft.y1 - draft.y0);
              // Ett klick utan att dra ändrar inget.
              if (w >= 0.08 && h >= 0.08) onZone(normalizeZone({ x: Math.min(draft.x0, draft.x1), y: Math.min(draft.y0, draft.y1), w, h }));
              setDraft(null);
            }}
          >
            {!full && (
              <>
                <path
                  d={`M0 0H${W}V${H}H0Z M${shown.x * W} ${shown.y * H}v${shown.h * H}h${shown.w * W}v${-shown.h * H}Z`}
                  fill="rgba(4,8,15,0.6)"
                  fillRule="evenodd"
                />
                <rect
                  x={shown.x * W}
                  y={shown.y * H}
                  width={shown.w * W}
                  height={shown.h * H}
                  fill="none"
                  stroke="#f4b860"
                  strokeWidth={3}
                  strokeDasharray={draft ? '10 8' : undefined}
                  rx={6}
                />
              </>
            )}
            {frame.people.map((person, i) => (
              <g key={i}>
                {PREVIEW_LINES.map(([a, b]) =>
                  person[a][2] > 0.5 && person[b][2] > 0.5 ? (
                    <line
                      key={`${a}-${b}`}
                      x1={person[a][0] * W}
                      y1={person[a][1] * H}
                      x2={person[b][0] * W}
                      y2={person[b][1] * H}
                      stroke="#9fe0b8"
                      strokeWidth={4}
                      strokeLinecap="round"
                    />
                  ) : null,
                )}
                {PREVIEW_WRISTS.map((w) =>
                  person[w][2] > 0.4 ? <circle key={w} cx={person[w][0] * W} cy={person[w][1] * H} r={9} fill="#f4b860" /> : null,
                )}
              </g>
            ))}
          </svg>
        )}
      </div>
      {frame && <p className="mt-2 text-sm leading-snug text-mist">{t.cameraZoneHint}</p>}
    </figure>
  );
}

/** Kamerans tillgång och lista över kameror. Etiketterna syns först när tillgång finns. */
function useCameraAccess() {
  const [permission, setPermission] = useState<Permission>('unknown');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  const refreshDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(all.filter((d) => d.kind === 'videoinput' && d.deviceId));
    } catch {
      setDevices([]);
    }
  }, []);

  useEffect(() => {
    let status: PermissionStatus | null = null;
    const apply = () => {
      if (!status) return;
      setPermission(status.state as Permission);
      if (status.state === 'granted') void refreshDevices();
    };
    navigator.permissions
      ?.query({ name: 'camera' as PermissionName })
      .then((s) => {
        status = s;
        s.addEventListener('change', apply);
        apply();
      })
      .catch(() => setPermission('prompt'));
    const onDeviceChange = () => void refreshDevices();
    navigator.mediaDevices?.addEventListener('devicechange', onDeviceChange);
    return () => {
      status?.removeEventListener('change', apply);
      navigator.mediaDevices?.removeEventListener('devicechange', onDeviceChange);
    };
  }, [refreshDevices]);

  const request = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      stream.getTracks().forEach((track) => track.stop());
      setPermission('granted');
      await refreshDevices();
      return true;
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      setPermission(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'prompt');
      return false;
    }
  }, [refreshDevices]);

  return { permission, devices, request };
}
