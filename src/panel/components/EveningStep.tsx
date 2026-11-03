import { useEffect, useState } from 'react';
import type { Strings } from '../../shared/i18n';
import { offlineReadiness, type OfflineReadiness } from '../../shared/offline';

interface EveningStepProps {
  t: Strings;
  themeId: string;
  cameraEnabled: boolean;
}

/** Steg 4: helskärm som klarar omladdning, ström och drift utan internet. */
export function EveningStep({ t, themeId, cameraEnabled }: EveningStepProps) {
  const [ready, setReady] = useState<OfflineReadiness | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = () => void offlineReadiness(themeId).then((r) => !cancelled && setReady(r));
    check();
    const timer = window.setInterval(check, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [themeId]);

  let offline = t.offlineReady;
  let ok = true;
  if (!ready || !ready.worker) {
    offline = t.offlineNoWorker;
    ok = false;
  } else if (!ready.show) {
    offline = t.offlineNeedsShow;
    ok = false;
  } else if (cameraEnabled && !ready.camera) {
    offline = t.offlineNeedsCamera;
    ok = false;
  }

  const items: { text: string; ok?: boolean }[] = [{ text: t.eveningFullscreen }, { text: t.eveningPower }, { text: offline, ok }];

  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-[15px] leading-snug text-frost/90">
          <span
            aria-hidden="true"
            className={[
              'mt-1 h-2.5 w-2.5 shrink-0 rounded-full',
              item.ok === undefined ? 'bg-night-600' : item.ok ? 'bg-pine' : 'bg-lantern',
            ].join(' ')}
          />
          <span className="max-w-[70ch]">{item.text}</span>
        </li>
      ))}
    </ul>
  );
}
