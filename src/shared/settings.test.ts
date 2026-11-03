import { describe, expect, it } from 'vitest';
import { defaultSettings, isFullZone, normalizeSettings, normalizeZone } from './settings';

describe('inställningar', () => {
  it('ger kameran standardvärden när äldre inställningar saknar den', () => {
    const old = { ...defaultSettings() } as Record<string, unknown>;
    delete old.camera;
    const s = normalizeSettings(old);
    expect(s.camera.enabled).toBe(false);
    expect(s.camera.sensitivity).toBe('normal');
    expect(isFullZone(s.camera.zone)).toBe(true);
  });

  it('rättar en trasig kamerazon så att den ligger inne i bilden', () => {
    const z = normalizeZone({ x: 0.8, y: -1, w: 0.5, h: 0.02 });
    expect(z.w).toBe(0.5);
    expect(z.x).toBe(0.5);
    expect(z.y).toBe(0);
    expect(z.h).toBe(0.1);
  });

  it('släpper inte igenom okända värden för känslighet', () => {
    const s = normalizeSettings({ ...defaultSettings(), camera: { enabled: true, sensitivity: 'max', deviceId: 42 } });
    expect(s.camera.enabled).toBe(true);
    expect(s.camera.sensitivity).toBe('normal');
    expect(s.camera.deviceId).toBe('');
  });
});

describe('schema i inställningar', () => {
  it('ger schemat standardvärden och rättar felaktiga tider och platser', () => {
    const s = normalizeSettings({
      ...defaultSettings(),
      schedule: { enabled: true, startMode: 'sunset', startTime: '25:00', endTime: '23:30', sunsetOffsetMin: -500, location: { lat: 999, lon: 12 } },
    });
    expect(s.schedule.enabled).toBe(true);
    expect(s.schedule.startMode).toBe('sunset');
    expect(s.schedule.startTime).toBe('15:30');
    expect(s.schedule.endTime).toBe('23:30');
    expect(s.schedule.sunsetOffsetMin).toBe(-120);
    expect(s.schedule.location).toBeNull();
    const old = { ...defaultSettings() } as Record<string, unknown>;
    delete old.schedule;
    expect(normalizeSettings(old).schedule.enabled).toBe(false);
  });
});
