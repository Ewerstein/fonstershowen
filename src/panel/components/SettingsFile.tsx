import { useRef, useState } from 'react';
import type { Strings } from '../../shared/i18n';
import { exportSettings, importSettings } from '../../shared/settings';
import type { ShowSettings } from '../../shared/types';

interface SettingsFileProps {
  t: Strings;
  settings: ShowSettings;
  onImport: (settings: ShowSettings) => void;
}

/** Spara och läs in inställningar som fil, för säkerhetskopia eller för att ge till någon annan. */
export function SettingsFile({ t, settings, onImport }: SettingsFileProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const download = () => {
    const blob = new Blob([exportSettings(settings)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fonstershowen-installningar.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const upload = async (file: File) => {
    try {
      onImport(importSettings(await file.text()));
      setMessage({ ok: true, text: t.imported });
    } catch {
      setMessage({ ok: false, text: t.importFailed });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={download} className="rounded-xl border border-night-600 px-4 py-2 text-sm text-frost hover:border-mist">
        {t.exportSettings}
      </button>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="rounded-xl border border-night-600 px-4 py-2 text-sm text-frost hover:border-mist"
      >
        {t.importSettings}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = '';
        }}
      />
      {message && (
        <span role="status" className={`text-sm ${message.ok ? 'text-pine' : 'text-ember'}`}>
          {message.text}
        </span>
      )}
    </div>
  );
}
