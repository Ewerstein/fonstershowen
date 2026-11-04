import type { SceneSettings } from './types';

/**
 * Vädret just nu från SMHI:s öppna prognos (SNOW1gv1, CC BY 4.0). Hämtas i webbläsaren,
 * utan nyckel. Täcker Norden. Används bara när användaren valt att följa vädret.
 */

export interface WeatherNow {
  precip: 'none' | 'rain' | 'snow' | 'sleet';
  /** 0 till 1, där 1 är kraftig nederbörd. */
  intensity: number;
  windMs: number;
  /** Klart eller nästan klart. */
  clear: boolean;
  tempC: number | null;
  /** Tidpunkten prognosen gäller, millisekunder. */
  validAt: number;
}

export function smhiUrl(lat: number, lon: number): string {
  return `https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/${lon.toFixed(6)}/lat/${lat.toFixed(6)}/data.json`;
}

type Entry = { time: string; data: Record<string, number | undefined> };

function value(entry: Entry, name: string): number | null {
  const v = entry.data?.[name];
  // SMHI använder 9999 och negativa koder för värden som saknas.
  return typeof v === 'number' && v !== 9999 ? v : null;
}

/** Tar prognosen som ligger närmast i tid och gör om den till det scenen behöver. */
export function parseSmhi(json: unknown, now = Date.now()): WeatherNow | null {
  const series = (json as { timeSeries?: Entry[] })?.timeSeries;
  if (!Array.isArray(series) || series.length === 0) return null;
  const closest = series.reduce((a, b) => (Math.abs(Date.parse(b.time) - now) < Math.abs(Date.parse(a.time) - now) ? b : a));
  const category = value(closest, 'predominant_precipitation_type_at_surface') ?? 0;
  const symbol = value(closest, 'symbol_code');
  const amount = Math.max(0, value(closest, 'precipitation_amount_median') ?? value(closest, 'precipitation_amount_mean') ?? 0);
  // Kategorier i SNOW1gv1: 1 regn, 2 snöblandat regn, 5 snö, 6 underkyld blandning, 11 duggregn.
  let precip: WeatherNow['precip'] = 'none';
  if (category === 1 || category === 11) precip = 'rain';
  else if (category === 2) precip = 'sleet';
  else if (category === 5 || category === 6) precip = 'snow';
  else if (symbol !== null && amount > 0) {
    if (symbol >= 15 && symbol <= 17) precip = 'snow';
    else if (symbol >= 25 && symbol <= 27) precip = 'snow';
    else if (symbol >= 12 && symbol <= 14) precip = 'sleet';
    else if (symbol >= 22 && symbol <= 24) precip = 'sleet';
    else if ((symbol >= 8 && symbol <= 10) || (symbol >= 18 && symbol <= 20)) precip = 'rain';
  }
  return {
    precip,
    intensity: precip === 'none' ? 0 : Math.min(1, Math.max(0.2, amount / 2.5)),
    windMs: Math.max(0, value(closest, 'wind_speed') ?? 0),
    clear: symbol !== null && symbol <= 2,
    tempC: value(closest, 'air_temperature'),
    validAt: Date.parse(closest.time),
  };
}

export async function fetchWeather(lat: number, lon: number, signal?: AbortSignal): Promise<WeatherNow> {
  const response = await fetch(smhiUrl(lat, lon), { signal });
  if (!response.ok) throw new Error(`SMHI svarade ${response.status}`);
  const weather = parseSmhi(await response.json());
  if (!weather) throw new Error('SMHI gav ingen prognos');
  return weather;
}

/** Vad scenen ska visa: mängd snö och regn 0 till 1, vind 0 till 1 och om himlen är klar. */
export interface SceneWeather {
  snow: number;
  rain: number;
  wind: number;
  clear: boolean;
}

export function sceneWeather(mode: SceneSettings['weather'], live: WeatherNow | null): SceneWeather {
  if (mode === 'off') return { snow: 0, rain: 0, wind: 0, clear: true };
  // Utan aktuellt väder visas lätt snöfall, som om vädret inte följdes.
  if (mode === 'light' || !live) return { snow: 0.3, rain: 0, wind: 0, clear: true };
  const wind = Math.min(1, live.windMs / 12);
  switch (live.precip) {
    case 'snow':
      return { snow: 0.35 + 0.65 * live.intensity, rain: 0, wind, clear: false };
    case 'rain':
      return { snow: 0, rain: 0.35 + 0.65 * live.intensity, wind, clear: false };
    case 'sleet':
      return { snow: 0.3 + 0.3 * live.intensity, rain: 0.3 + 0.3 * live.intensity, wind, clear: false };
    default:
      return { snow: 0, rain: 0, wind, clear: live.clear };
  }
}
