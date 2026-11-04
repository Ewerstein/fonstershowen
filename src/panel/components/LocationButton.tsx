import { useState } from 'react';
import type { Strings } from '../../shared/i18n';
import type { GeoLocation } from '../../shared/types';

/** Hämtar platsen en gång och avrundar den. Används för sol och väder. */
export function LocationButton({ t, location, onChange }: { t: Strings; location: GeoLocation; onChange: (l: GeoLocation) => void }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const locate = () => {
    if (!navigator.geolocation) {
      setFailed(true);
      return;
    }
    setBusy(true);
    setFailed(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        // Två decimaler räcker för sol och väder och avslöjar inte adressen.
        const round = (v: number) => Math.round(v * 100) / 100;
        onChange({ lat: round(pos.coords.latitude), lon: round(pos.coords.longitude) });
      },
      () => {
        setBusy(false);
        setFailed(true);
      },
      { timeout: 15000, maximumAge: 86_400_000 },
    );
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={locate}
        className={[
          'rounded-xl border px-3.5 py-1.5 text-sm font-medium disabled:opacity-60',
          location ? 'border-night-600 text-frost hover:border-mist' : 'border-lantern/60 text-lantern-soft hover:border-lantern',
        ].join(' ')}
      >
        {location ? t.scheduleLocated : t.scheduleLocate}
      </button>
      <p className={`text-sm leading-snug ${failed ? 'text-ember' : 'text-mist'}`}>{failed ? t.scheduleLocateFailed : t.scheduleLocateHint}</p>
    </div>
  );
}
