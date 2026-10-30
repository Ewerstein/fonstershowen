import type { Strings } from '../../shared/i18n';
import type { DirectorState, StageStatus } from '../../shared/types';

interface WindowStatusProps {
  t: Strings;
  status: StageStatus | null;
  aspect: number;
}

/** Ett litet upplyst fönster med tomtens siluett. Visar vad scenen gör just nu. */
export function WindowStatus({ t, status, aspect }: WindowStatusProps) {
  const state: DirectorState | null = status?.state ?? null;
  const lit = state !== null && state !== 'sleep';
  const [title, body] = state ? t.states[state] : [t.closedTitle, t.closedBody];

  return (
    <section aria-live="polite" className="rounded-[22px] bg-night-700 p-3">
      <div
        className="relative overflow-hidden rounded-[14px] bg-night-900"
        style={{ aspectRatio: String(Math.min(2.2, Math.max(1, aspect))) }}
      >
        <div className="window-glow absolute inset-0" style={{ opacity: lit ? 1 : state === 'sleep' ? 0.12 : 0 }} />
        <Silhouette state={state} />
        <div className="absolute inset-x-0 top-0 p-5 sm:p-7">
          <h2 className="font-display text-[28px] font-semibold leading-tight text-frost sm:text-[34px]">{title}</h2>
          <p className="mt-1.5 max-w-[42ch] text-[15px] leading-snug text-frost/80">{body}</p>
        </div>
        {status && (
          <div className="absolute bottom-4 left-5 flex flex-wrap gap-2 sm:left-7">
            <Chip>
              {status.fps} {t.fps}
            </Chip>
            {!status.fullscreen && <Chip>{t.fullscreenOff}</Chip>}
          </div>
        )}
      </div>
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-night-950/70 px-3 py-1 text-[13px] tabular-nums text-frost/90 backdrop-blur-sm">
      {children}
    </span>
  );
}

function Silhouette({ state }: { state: DirectorState | null }) {
  // Positiv vinkel är medurs i SVG: höger arm lyfts med negativ vinkel, vänster med positiv.
  const right =
    state === 'waveBack' ? 'rotate(-150deg)' : state === 'greet' ? 'rotate(-100deg)' : state === 'celebrate' ? 'rotate(-160deg)' : 'rotate(-6deg)';
  const left = state === 'celebrate' ? 'rotate(160deg)' : state === 'notice' ? 'rotate(22deg)' : 'rotate(6deg)';
  const head =
    state === 'sleep' ? 'rotate(14deg) translate(4px, 6px)' : state === 'lookAround' ? 'rotate(-8deg)' : 'none';
  const visible = state !== null;

  return (
    <svg
      viewBox="0 0 200 220"
      aria-hidden="true"
      className="absolute bottom-0 right-[8%] h-[72%] transition-opacity duration-700"
      style={{ opacity: visible ? 0.92 : 0 }}
    >
      <g className={`tomte-body ${state === 'celebrate' ? 'hopping' : ''}`} fill="#08111d">
        <path d="M54 220 C54 152 70 120 100 116 C130 120 146 152 146 220 Z" />
        <rect className={`tomte-arm right ${state === 'waveBack' ? 'waving' : ''}`} x="116" y="118" width="20" height="64" rx="10" style={{ transform: right }} />
        <rect className="tomte-arm left" x="64" y="118" width="20" height="64" rx="10" style={{ transform: left }} />
        <g style={{ transform: head, transformOrigin: '100px 100px', transition: 'transform 500ms ease' }}>
          <circle cx="100" cy="88" r="26" />
          <path d="M76 74 C80 44 104 28 128 22 C120 40 122 58 124 74 Z" />
          <circle cx="130" cy="22" r="8" />
        </g>
      </g>
    </svg>
  );
}
