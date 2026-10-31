import { useState } from 'react';
import { SCREEN_ASPECT_DEFAULT } from '../shared/geometry';
import { strings } from '../shared/i18n';
import { activeProfile } from '../shared/settings';
import type { Locale } from '../shared/types';
import { SettingsFile } from './components/SettingsFile';
import { SetupView } from './components/SetupView';
import { StylePicker } from './components/StylePicker';
import { Toggle } from './components/Toggle';
import { TriggerPad } from './components/TriggerPad';
import { WindowStatus } from './components/WindowStatus';
import { openStage, type OpenResult } from './openStage';
import { useShow } from './useShow';

type Tab = 'studio' | 'setup';

export function App() {
  const { settings, status, connected, update, updateProfile, replaceSettings, send } = useShow();
  const [tab, setTab] = useState<Tab>('studio');
  const [openResult, setOpenResult] = useState<OpenResult | null>(null);

  if (!settings) return <div className="min-h-dvh bg-night-950" />;

  const t = strings(settings.locale);
  const profile = activeProfile(settings);
  const aspect = profile.windowWidthCm / profile.windowHeightCm;
  const screenAspect = status ? status.screen.width / status.screen.height : SCREEN_ASPECT_DEFAULT;

  const handleOpen = async () => setOpenResult(await openStage());

  const openMessage =
    openResult === 'external' ? t.openedOnExternal : openResult === 'here' ? t.openedHere : openResult === 'blocked' ? t.popupBlocked : null;

  return (
    <div className="mx-auto min-h-dvh max-w-[1120px] px-4 pb-16 pt-6 sm:px-8 sm:pt-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="h-9 w-9" />
          <h1 className="font-display text-[26px] font-semibold tracking-tight">{t.appName}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 text-sm text-mist" role="status">
            <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-pine' : 'bg-night-600'}`} aria-hidden="true" />
            {connected ? t.stageOpen : t.stageClosed}
          </span>
          <button
            type="button"
            onClick={() => void handleOpen()}
            className="rounded-2xl bg-lantern px-5 py-3 text-[15px] font-semibold text-night-950 transition-colors hover:bg-lantern-soft"
          >
            {connected ? t.openStageAgain : t.openStage}
          </button>
        </div>
      </header>
      {openMessage && (
        <p role="status" className={`mt-4 max-w-[70ch] text-[15px] ${openResult === 'blocked' ? 'text-ember' : 'text-frost/85'}`}>
          {openMessage}
        </p>
      )}

      <nav className="mt-8 inline-flex rounded-2xl bg-night-900 p-1" aria-label={t.appName}>
        {(['studio', 'setup'] as Tab[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            aria-current={tab === value ? 'page' : undefined}
            className={[
              'rounded-xl px-5 py-2 text-[15px] font-medium transition-colors',
              tab === value ? 'bg-night-700 text-frost' : 'text-mist hover:text-frost',
            ].join(' ')}
          >
            {value === 'studio' ? t.tabStudio : t.tabSetup}
          </button>
        ))}
      </nav>

      <main className="mt-6">
        {tab === 'studio' ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)] lg:items-start">
            <div className="space-y-6">
              <WindowStatus t={t} status={status} aspect={aspect} />
              <StylePicker
                t={t}
                locale={settings.locale}
                themeId={settings.themeId}
                styleId={settings.styleId}
                status={status}
                onChange={(styleId) => update((s) => ({ ...s, styleId }))}
              />
            </div>
            <section className="rounded-[22px] border border-night-700 bg-night-900 p-5 sm:p-6">
              <h2 className="font-display text-[21px] font-semibold">{t.triggerTitle}</h2>
              <p className="mb-5 mt-1 text-[15px] text-mist">{t.triggerHint}</p>
              <TriggerPad
                t={t}
                state={status?.state ?? null}
                disabled={!connected}
                onAction={(action) => send({ type: 'manual', action })}
              />
              <div className="mt-5 divide-y divide-night-700 border-t border-night-700">
                <Toggle
                  label={t.autonomous}
                  hint={t.autonomousHint}
                  checked={settings.autonomous}
                  onChange={(autonomous) => update((s) => ({ ...s, autonomous }))}
                />
                <Toggle
                  label={t.testPattern}
                  hint={t.testPatternHint}
                  checked={settings.testPattern}
                  onChange={(testPattern) => update((s) => ({ ...s, testPattern }))}
                />
              </div>
            </section>
          </div>
        ) : (
          <SetupView
            t={t}
            settings={settings}
            profile={profile}
            screenAspect={screenAspect}
            onProfile={updateProfile}
            onSettings={update}
          />
        )}
      </main>

      <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-night-800 pt-6">
        <SettingsFile t={t} settings={settings} onImport={replaceSettings} />
        <div className="flex items-center gap-4">
          <span className="text-sm text-mist">{t.savedLocally}</span>
          <label className="flex items-center gap-2 text-sm text-mist">
            {t.language}
            <select
              value={settings.locale}
              onChange={(e) => update((s) => ({ ...s, locale: e.target.value as Locale }))}
              className="rounded-lg border border-night-600 bg-night-800 px-2 py-1 text-frost"
            >
              <option value="sv">Svenska</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>
      </footer>
    </div>
  );
}
