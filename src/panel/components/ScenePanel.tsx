import { christmasBanner } from '../../core/countdown';
import type { Strings } from '../../shared/i18n';
import type { GeoLocation, Locale, SceneSettings, StageStatus } from '../../shared/types';
import { LocationButton } from './LocationButton';
import { Toggle } from './Toggle';

interface ScenePanelProps {
  t: Strings;
  locale: Locale;
  scene: SceneSettings;
  location: GeoLocation;
  weather: StageStatus['weather'];
  onChange: (patch: Partial<SceneSettings>) => void;
  onLocation: (location: GeoLocation) => void;
}

/** Tillval runt tomten: text, väder, himmel och snö på marken. */
export function ScenePanel({ t, locale, scene, location, weather, onChange, onLocation }: ScenePanelProps) {
  const countdown = christmasBanner(new Date(), locale);

  let weatherLine: string | null = null;
  let weatherFailed = false;
  if (scene.weather === 'live' && location) {
    if (weather?.now) {
      weatherLine = t.sceneWeatherNow(t.scenePrecip[weather.now.precip], weather.now.windMs, weather.now.tempC);
    } else if (weather?.error) {
      weatherLine = t.sceneWeatherFailed;
      weatherFailed = true;
    } else {
      weatherLine = t.sceneWeatherLoading;
    }
  }

  return (
    <section className="rounded-[22px] border border-night-700 bg-night-900 p-5 sm:p-6">
      <h2 className="font-display text-[21px] font-semibold">{t.sceneTitle}</h2>
      <p className="mb-4 mt-1 text-[15px] text-mist">{t.sceneHint}</p>

      <fieldset>
        <legend className="text-[15px] font-medium text-frost">{t.sceneText}</legend>
        <Segmented
          value={scene.text}
          options={[
            ['none', t.sceneTextNone],
            ['countdown', t.sceneTextCountdown],
            ['custom', t.sceneTextCustom],
          ]}
          onChange={(text) => onChange({ text })}
        />
        {scene.text === 'custom' && (
          <input
            type="text"
            maxLength={40}
            value={scene.customText}
            placeholder={t.sceneTextPlaceholder}
            onChange={(e) => onChange({ customText: e.target.value })}
            className="mt-2 block w-full rounded-xl border border-night-600 bg-night-800 px-3 py-2 text-[17px] text-frost placeholder:text-mist/70 focus:border-lantern focus:outline-none"
          />
        )}
        {scene.text === 'countdown' && <p className="mt-2 text-sm text-mist">{t.sceneTextPreview(countdown.main, countdown.sub)}</p>}
      </fieldset>

      <fieldset className="mt-5">
        <legend className="text-[15px] font-medium text-frost">{t.sceneWeather}</legend>
        <Segmented
          value={scene.weather}
          options={[
            ['light', t.sceneWeatherLight],
            ['live', t.sceneWeatherLive],
            ['off', t.sceneWeatherOff],
          ]}
          onChange={(w) => onChange({ weather: w })}
        />
        {scene.weather === 'live' && (
          <div className="mt-2 space-y-2">
            <p className="text-sm leading-snug text-mist">{t.sceneWeatherLiveHint}</p>
            {!location && <LocationButton t={t} location={location} onChange={onLocation} />}
            {weatherLine && (
              <p role="status" className={`text-sm leading-snug ${weatherFailed ? 'text-ember' : 'text-frost/90'}`}>
                {weatherLine}
              </p>
            )}
          </div>
        )}
      </fieldset>

      <div className="mt-3 divide-y divide-night-700 border-t border-night-700">
        <Toggle label={t.sceneSky} hint={t.sceneSkyHint} checked={scene.sky} onChange={(sky) => onChange({ sky })} />
        <Toggle label={t.sceneGround} hint={t.sceneGroundHint} checked={scene.ground} onChange={(ground) => onChange({ ground })} />
      </div>
    </section>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="mt-2 inline-flex flex-wrap rounded-xl border border-night-600 p-0.5">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={[
            'rounded-[10px] px-3 py-1.5 text-sm transition-colors',
            value === v ? 'bg-lantern/15 text-lantern-soft' : 'text-frost hover:text-lantern-soft',
          ].join(' ')}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
