import { useEffect, useState } from 'react';
import { formatTime, scheduleState } from '../../core/schedule';
import type { Strings } from '../../shared/i18n';
import type { ScheduleSettings } from '../../shared/types';
import { Toggle } from './Toggle';

interface SchedulePanelProps {
  t: Strings;
  schedule: ScheduleSettings;
  onChange: (patch: Partial<ScheduleSettings>) => void;
}

const OFFSETS = [-60, -30, -15, 0, 15, 30, 60];

/** Start och stopp för showen: klockslag eller skymning, och ett klockslag för stopp. */
export function SchedulePanel({ t, schedule, onChange }: SchedulePanelProps) {
  const [now, setNow] = useState(() => new Date());
  const [locating, setLocating] = useState(false);
  const [locateFailed, setLocateFailed] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const locate = () => {
    if (!navigator.geolocation) {
      setLocateFailed(true);
      return;
    }
    setLocating(true);
    setLocateFailed(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        // Två decimaler räcker för solnedgången och avslöjar inte adressen.
        const round = (v: number) => Math.round(v * 100) / 100;
        onChange({ location: { lat: round(pos.coords.latitude), lon: round(pos.coords.longitude) } });
      },
      () => {
        setLocating(false);
        setLocateFailed(true);
      },
      { timeout: 15000, maximumAge: 86_400_000 },
    );
  };

  const state = scheduleState(now, schedule);
  const tomorrow = state.window.start.getDate() !== now.getDate() && !state.on;
  const summary = state.on
    ? t.scheduleRunning(formatTime(state.window.end))
    : t.scheduleUpcoming(formatTime(state.window.start), formatTime(state.window.end), tomorrow);
  const sunsetMissing = schedule.startMode === 'sunset' && !schedule.location;

  return (
    <section className="rounded-[22px] border border-night-700 bg-night-900 p-5 sm:p-6">
      <h2 className="font-display text-[21px] font-semibold">{t.scheduleTitle}</h2>
      <Toggle label={t.scheduleUse} hint={t.scheduleUseHint} checked={schedule.enabled} onChange={(enabled) => onChange({ enabled })} />

      <div className={`mt-2 space-y-4 border-t border-night-700 pt-4 ${schedule.enabled ? '' : 'opacity-60'}`}>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[15px] font-medium text-frost">{t.scheduleStart}</span>
            <div className="inline-flex rounded-xl border border-night-600 p-0.5">
              {(['time', 'sunset'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={schedule.startMode === mode}
                  onClick={() => onChange({ startMode: mode })}
                  className={[
                    'rounded-[10px] px-3 py-1.5 text-sm transition-colors',
                    schedule.startMode === mode ? 'bg-lantern/15 text-lantern-soft' : 'text-frost hover:text-lantern-soft',
                  ].join(' ')}
                >
                  {mode === 'time' ? t.scheduleModeTime : t.scheduleModeSunset}
                </button>
              ))}
            </div>
          </div>
          {schedule.startMode === 'time' ? (
            <input
              type="time"
              aria-label={t.scheduleStart}
              value={schedule.startTime}
              onChange={(e) => e.target.value && onChange({ startTime: e.target.value })}
              className="mt-2 w-32 rounded-xl border border-night-600 bg-night-800 px-3 py-2 text-[17px] tabular-nums text-frost [color-scheme:dark]"
            />
          ) : (
            <div className="mt-2 space-y-2">
              <select
                aria-label={t.scheduleStart}
                value={schedule.sunsetOffsetMin}
                onChange={(e) => onChange({ sunsetOffsetMin: Number(e.target.value) })}
                className="block w-full rounded-xl border border-night-600 bg-night-800 px-3 py-2 text-[15px] text-frost"
              >
                {OFFSETS.map((min) => (
                  <option key={min} value={min}>
                    {t.scheduleOffset(min)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={locating}
                onClick={locate}
                className={[
                  'rounded-xl border px-3.5 py-1.5 text-sm font-medium disabled:opacity-60',
                  schedule.location ? 'border-night-600 text-frost hover:border-mist' : 'border-lantern/60 text-lantern-soft hover:border-lantern',
                ].join(' ')}
              >
                {schedule.location ? t.scheduleLocated : t.scheduleLocate}
              </button>
              <p className={`text-sm leading-snug ${locateFailed ? 'text-ember' : 'text-mist'}`}>
                {locateFailed ? t.scheduleLocateFailed : t.scheduleLocateHint}
              </p>
            </div>
          )}
        </div>

        <label className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[15px] font-medium text-frost">{t.scheduleEnd}</span>
          <input
            type="time"
            value={schedule.endTime}
            onChange={(e) => e.target.value && onChange({ endTime: e.target.value })}
            className="w-32 rounded-xl border border-night-600 bg-night-800 px-3 py-2 text-[17px] tabular-nums text-frost [color-scheme:dark]"
          />
        </label>

        {schedule.enabled && !sunsetMissing && (
          <p role="status" className="text-sm text-frost/90">
            {summary}
          </p>
        )}
      </div>
    </section>
  );
}
