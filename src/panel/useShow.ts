import { useCallback, useEffect, useRef, useState } from 'react';
import { createBus, type Bus } from '../shared/bus';
import { loadSettings, saveSettings } from '../shared/settings';
import type { CameraFrame, ShowEvent, ShowSettings, StageStatus, WindowProfile } from '../shared/types';

/** Kontrollpanelens koppling till scenen: inställningar ut, status in. */
export function useShow() {
  const [settings, setSettings] = useState<ShowSettings | null>(null);
  const [status, setStatus] = useState<StageStatus | null>(null);
  const [cameraFrame, setCameraFrame] = useState<CameraFrame | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const busRef = useRef<Bus | null>(null);
  const settingsRef = useRef<ShowSettings | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const bus = createBus((message) => {
      if (message.kind === 'status') setStatus(message.status);
      if (message.kind === 'cameraFrame') setCameraFrame(message.frame);
      if (message.kind === 'hello' && message.from === 'stage' && settingsRef.current) {
        bus.send({ kind: 'settings', settings: settingsRef.current });
      }
    });
    busRef.current = bus;
    let cancelled = false;
    void loadSettings().then((loaded) => {
      if (cancelled) return;
      settingsRef.current = loaded;
      setSettings(loaded);
      bus.send({ kind: 'hello', from: 'panel' });
    });
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      cancelled = true;
      bus.close();
      window.clearInterval(timer);
    };
  }, []);

  const update = useCallback((change: (current: ShowSettings) => ShowSettings) => {
    const current = settingsRef.current;
    if (!current) return;
    const next = change(current);
    settingsRef.current = next;
    setSettings(next);
    busRef.current?.send({ kind: 'settings', settings: next });
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void saveSettings(next), 250);
  }, []);

  const updateProfile = useCallback(
    (patch: Partial<WindowProfile>) =>
      update((s) => ({
        ...s,
        profiles: s.profiles.map((p) => (p.id === s.activeProfileId ? { ...p, ...patch } : p)),
      })),
    [update],
  );

  const replaceSettings = useCallback((next: ShowSettings) => update(() => next), [update]);

  const send = useCallback((event: ShowEvent) => busRef.current?.send({ kind: 'event', event }), []);

  /** Ber scenen om förhandsbilder från kameran. Måste upprepas, annars slutar scenen skicka efter några sekunder. */
  const previewCamera = useCallback((on: boolean) => busRef.current?.send({ kind: 'cameraPreview', on }), []);

  const connected = status !== null && now - status.at < 3500;

  const frame = connected && cameraFrame && now - cameraFrame.at < 4000 ? cameraFrame : null;

  return {
    settings,
    status: connected ? status : null,
    connected,
    cameraFrame: frame,
    update,
    updateProfile,
    replaceSettings,
    send,
    previewCamera,
  };
}
