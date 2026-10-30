import { useEffect, useState } from 'react';
import type { Strings } from '../../shared/i18n';
import { loadTheme, type ThemeManifest } from '../../shared/theme';
import type { Locale, StageStatus } from '../../shared/types';

interface StylePickerProps {
  t: Strings;
  locale: Locale;
  themeId: string;
  styleId: string;
  status: StageStatus | null;
  onChange: (styleId: string) => void;
}

/** Val av tomtestil. Listan kommer från temats manifest, testtomten finns alltid. */
export function StylePicker({ t, locale, themeId, styleId, status, onChange }: StylePickerProps) {
  const [theme, setTheme] = useState<ThemeManifest | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadTheme(themeId)
      .then((m) => !cancelled && setTheme(m))
      .catch(() => !cancelled && setTheme(null));
    return () => {
      cancelled = true;
    };
  }, [themeId]);

  const selected = styleId || theme?.defaultStyle || 'test';
  const options = [
    ...(theme?.styles.map((s) => ({ id: s.id, name: s.name[locale], description: s.description[locale] })) ?? []),
    { id: 'test', name: t.testStyleName, description: t.testStyleDescription },
  ];

  return (
    <section className="rounded-[22px] border border-night-700 bg-night-900 p-5 sm:p-6">
      <h2 className="font-display text-[21px] font-semibold">{t.styleTitle}</h2>
      <p className="mb-4 mt-1 text-[15px] text-mist">{t.styleHint}</p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {options.map((o) => {
          const active = o.id === selected;
          const shown = status?.styleId === o.id;
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.id)}
              className={[
                'rounded-2xl border px-4 py-3 text-left transition-colors',
                active ? 'border-lantern bg-lantern/10' : 'border-night-600 bg-night-800 hover:border-mist',
              ].join(' ')}
            >
              <span className="flex items-center justify-between gap-2">
                <span className={`text-[15px] font-semibold ${active ? 'text-lantern-soft' : 'text-frost'}`}>{o.name}</span>
                {shown && <span className="text-xs text-pine">{t.styleShown}</span>}
              </span>
              <span className="mt-0.5 block text-sm leading-snug text-mist">{o.description}</span>
            </button>
          );
        })}
      </div>
      {status?.styleError && selected !== 'test' && (
        <p role="status" className="mt-4 text-sm text-ember">
          {t.styleLoadFailed}
        </p>
      )}
      {theme && theme.credits.length > 0 && (
        <p className="mt-4 text-xs text-mist">
          {t.credits}:{' '}
          {theme.credits.map((c, i) => (
            <span key={c.url}>
              {i > 0 && ', '}
              <a href={c.url} target="_blank" rel="noreferrer" className="underline decoration-night-600 underline-offset-2 hover:text-frost">
                {c.author}
              </a>{' '}
              ({c.license})
            </span>
          ))}
        </p>
      )}
    </section>
  );
}
