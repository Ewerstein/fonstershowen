import { describe, expect, it } from 'vitest';
import { parseSmhi, sceneWeather } from './weather';

const entry = (time: string, data: Record<string, number>) => ({ time, data });

describe('väder från SMHI', () => {
  it('tar prognosen närmast i tid och tolkar snö', () => {
    const json = {
      timeSeries: [
        entry('2026-12-01T15:00:00Z', { predominant_precipitation_type_at_surface: 0, symbol_code: 1, wind_speed: 2, air_temperature: -1 }),
        entry('2026-12-01T16:00:00Z', {
          predominant_precipitation_type_at_surface: 5,
          precipitation_amount_median: 1.2,
          symbol_code: 16,
          wind_speed: 7,
          air_temperature: -3,
        }),
      ],
    };
    const w = parseSmhi(json, Date.parse('2026-12-01T16:10:00Z'))!;
    expect(w.precip).toBe('snow');
    expect(w.intensity).toBeCloseTo(0.48, 2);
    expect(w.windMs).toBe(7);
    expect(w.tempC).toBe(-3);
    expect(w.clear).toBe(false);
  });

  it('känner igen regn, duggregn, snöblandat och klart väder', () => {
    const at = (data: Record<string, number>) => parseSmhi({ timeSeries: [entry('2026-12-01T16:00:00Z', data)] }, Date.parse('2026-12-01T16:00:00Z'))!;
    expect(at({ predominant_precipitation_type_at_surface: 1, precipitation_amount_median: 3 }).precip).toBe('rain');
    expect(at({ predominant_precipitation_type_at_surface: 11, precipitation_amount_median: 0.1 }).precip).toBe('rain');
    expect(at({ predominant_precipitation_type_at_surface: 2, precipitation_amount_median: 0.5 }).precip).toBe('sleet');
    const clear = at({ predominant_precipitation_type_at_surface: 0, symbol_code: 1, wind_speed: 9999 });
    expect(clear.precip).toBe('none');
    expect(clear.clear).toBe(true);
    expect(clear.windMs).toBe(0);
  });

  it('ger inget väder för ett trasigt svar', () => {
    expect(parseSmhi({})).toBeNull();
    expect(parseSmhi({ timeSeries: [] })).toBeNull();
  });

  it('visar lätt snö när vädret inte följs eller saknas, och vädret när det finns', () => {
    expect(sceneWeather('light', null)).toEqual({ snow: 0.3, rain: 0, wind: 0, clear: true });
    expect(sceneWeather('live', null).snow).toBe(0.3);
    expect(sceneWeather('off', null).snow).toBe(0);
    const rain = sceneWeather('live', { precip: 'rain', intensity: 1, windMs: 12, clear: false, tempC: 4, validAt: 0 });
    expect(rain).toEqual({ snow: 0, rain: 1, wind: 1, clear: false });
  });
});
