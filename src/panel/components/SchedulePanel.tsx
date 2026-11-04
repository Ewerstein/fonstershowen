import { useEffect, useState } from 'react';
import { formatTime, scheduleState } from '../../core/schedule';
import type { Strings } from '../../shared/i18n';
import { defaultSlot, MAX_SLOTS } from '../../shared/settings';
import type { GeoLocation, ScheduleSettings, ScheduleSlot } from '../../shared/types';
import { LocationButton } from './LocationButton';
import { Toggle } from './Toggle';

interface SchedulePanelProps {
  t: Strings;
  schedule: ScheduleSettings;
  location: GeoLocation;
  onChange: (patch: Partial<ScheduleSettings>) => void;
  onLocation: (location: GeoLocation) => void;
}

const OFFSETS = [-60, -30, -15, 0, 15, 30, 60];

/** Ett eller flera pass per dygn. Varje pass startar vid ett klockslag eller i skymningen och slutar vid ett klockslag eller i gryningen. */
export function SchedulePanel({ t, schedule, location, onChange, onLocation }: SchedulePanelProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const setSlot = (index: number, patch: Partial<ScheduleSlot>) =>
    onChange({ slots: schedule.slots.map((s, i) => (i === index ? { ...s, ...patch } : s)) });

  const state = scheduleState(now, schedule, location);
  const tomorrow = state.window.start.getDate() !== now.getDate() && !state.on;
  const summary = state.on
    ? t.scheduleRunning(formatTime(state.window.end))
    : t.scheduleUpcoming(formatTime(state.window.start), formatTime(state.window.end), tomorrow);
  const usesSun = schedule.slots.some((s) => s.startMode === 'sunset' || s.endMode === 'sunrise');

  return (
    <section className="rounded-[22px] border border-night-700 bg-night-900 p-5 sm:p-6">
      <h2 className="font-display text-[21px] font-semibold">{t.scheduleTitle}</h2>
      <Toggle label={t.scheduleUse} hint={t.scheduleUseHint} checked={schedule.enabled} onChange={(enabled) => onChange({ enabled })} />

      <div className={`mt-2 space-y-4 border-t border-night-700 pt-4 ${schedule.enabled ? '' : 'opacity-60'}`}>
        {schedule.slots.map((slot, i) => (
          <div key={i} className="rounded-2xl border border-night-700 bg-night-800/60 p-3.5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-lantern-soft">{t.scheduleSlot(i + 1)}</span>
              {schedule.slots.length > 1 && (
                <button
                  type="button"
                  onClick={() => onChange({ slots: schedule.slots.filter((_, j) => j !== i) })}
                  className="text-sm text-mist underline decoration-night-600 underline-offset-2 hover:text-frost"
                >
                  {t.scheduleRemoveSlot}
                </button>
              )}
            </div>
            <SlotEdge
              label={t.scheduleStart}
              mode={slot.startMode === 'sunset' ? 'sun' : 'time'}
              modes={[t.scheduleModeTime, t.scheduleModeSunset]}
              time={slot.startTime}
              offset={slot.sunsetOffsetMin}
              offsetLabel={t.scheduleOffset}
              onMode={(m) => setSlot(i, { startMode: m === 'sun' ? 'sunset' : 'time' })}
              onTime={(startTime) => setSlot(i, { startTime })}
              onOffset={(sunsetOffsetMin) => setSlot(i, { sunsetOffsetMin })}
            />
            <div className="mt-3">
              <SlotEdge
                label={t.scheduleEnd}
                mode={slot.endMode === 'sunrise' ? 'sun' : 'time'}
                modes={[t.scheduleModeTime, t.scheduleModeSunrise]}
                time={slot.endTime}
                offset={slot.sunriseOffsetMin}
                offsetLabel={t.scheduleSunriseOffset}
                onMode={(m) => setSlot(i, { endMode: m === 'sun' ? 'sunrise' : 'time' })}
                onTime={(endTime) => setSlot(i, { endTime })}
                onOffset={(sunriseOffsetMin) => setSlot(i, { sunriseOffsetMin })}
              />
            </div>
          </div>
        ))}

        {schedule.slots.length < MAX_SLOTS && (
          <div>
            <button
              type="button"
              onClick={() => onChange({ slots: [...schedule.slots, { ...defaultSlot(), startTime: '06:30', endTime: '08:00' }] })}
              className="rounded-xl border border-night-600 px-3.5 py-1.5 text-sm font-medium text-frost hover:border-mist"
            >
              {t.scheduleAddSlot}
            </button>
            <p className="mt-2 text-sm leading-snug text-mist">{t.scheduleSlotsHint}</p>
          </div>
        )}

        {usesSun && <LocationButton t={t} location={location} onChange={onLocation} />}

        {schedule.enabled && (
          <p role="status" className="text-sm text-frost/90">
            {summary}
          </p>
        )}
      </div>
    </section>
  );
}

function SlotEdge({
  label,
  mode,
  modes,
  time,
  offset,
  offsetLabel,
  onMode,
  onTime,
  onOffset,
}: {
  label: string;
  mode: 'time' | 'sun';
  modes: [string, string];
  time: string;
  offset: number;
  offsetLabel: (min: number) => string;
  onMode: (m: 'time' | 'sun') => void;
  onTime: (v: string) => void;
  onOffset: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[15px] font-medium text-frost">{label}</span>
        <div className="inline-flex rounded-xl border border-night-600 p-0.5">
          {(['time', 'sun'] as const).map((m, k) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => onMode(m)}
              className={[
                'rounded-[10px] px-3 py-1.5 text-sm transition-colors',
                mode === m ? 'bg-lantern/15 text-lantern-soft' : 'text-frost hover:text-lantern-soft',
              ].join(' ')}
            >
              {modes[k]}
            </button>
          ))}
        </div>
      </div>
      {mode === 'time' ? (
        <input
          type="time"
          aria-label={label}
          value={time}
          onChange={(e) => e.target.value && onTime(e.target.value)}
          className="mt-2 w-36 rounded-xl border border-night-600 bg-night-800 px-3 py-2 text-[17px] tabular-nums text-frost [color-scheme:dark]"
        />
      ) : (
        <select
          aria-label={label}
          value={offset}
          onChange={(e) => onOffset(Number(e.target.value))}
          className="mt-2 block w-full rounded-xl border border-night-600 bg-night-800 px-3 py-2 text-[15px] text-frost"
        >
          {OFFSETS.map((min) => (
            <option key={min} value={min}>
              {offsetLabel(min)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
