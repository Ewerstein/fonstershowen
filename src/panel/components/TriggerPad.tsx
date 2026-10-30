import type { Strings } from '../../shared/i18n';
import type { DirectorState, ManualAction } from '../../shared/types';

interface TriggerPadProps {
  t: Strings;
  state: DirectorState | null;
  disabled: boolean;
  onAction: (action: ManualAction) => void;
}

/** Knappar som styr tomten för hand. Det läge som pågår markeras. */
export function TriggerPad({ t, state, disabled, onAction }: TriggerPadProps) {
  const sleeping = state === 'sleep';
  const actions: { action: ManualAction; label: string; active: boolean }[] = [
    { action: 'wave', label: t.actionWave, active: state === 'waveBack' },
    { action: 'celebrate', label: t.actionCelebrate, active: state === 'celebrate' },
    { action: 'lookAround', label: t.actionLookAround, active: state === 'lookAround' },
    { action: sleeping ? 'wake' : 'sleep', label: sleeping ? t.actionWake : t.actionSleep, active: false },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {actions.map(({ action, label, active }) => (
        <button
          key={action}
          type="button"
          disabled={disabled || (sleeping && action !== 'wake')}
          onClick={() => onAction(action)}
          aria-pressed={active}
          className={[
            'h-14 rounded-2xl border text-[16px] font-semibold transition-colors',
            'disabled:cursor-not-allowed disabled:opacity-40',
            active
              ? 'border-lantern bg-lantern/15 text-lantern-soft'
              : 'border-night-600 bg-night-800 text-frost hover:border-mist hover:bg-night-700',
          ].join(' ')}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
