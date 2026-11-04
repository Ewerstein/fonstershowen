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
  it('flyttar ett äldre schema med ett pass och platsen till de nya fälten', () => {
    const old = {
      ...defaultSettings(),
      schedule: { enabled: true, startMode: 'sunset', startTime: '25:00', endTime: '23:30', sunsetOffsetMin: -500, location: { lat: 56.67, lon: 12.86 } },
    } as Record<string, unknown>;
    delete old.location;
    const s = normalizeSettings(old);
    expect(s.schedule.enabled).toBe(true);
    expect(s.schedule.slots).toHaveLength(1);
    expect(s.schedule.slots[0].startMode).toBe('sunset');
    expect(s.schedule.slots[0].startTime).toBe('15:30');
    expect(s.schedule.slots[0].endTime).toBe('23:30');
    expect(s.schedule.slots[0].sunsetOffsetMin).toBe(-120);
    expect(s.location).toEqual({ lat: 56.67, lon: 12.86 });
  });

  it('tar högst fyra pass och ger omgivningen standardvärden', () => {
    const slots = Array.from({ length: 6 }, () => ({ startTime: '10:00', endTime: '11:00' }));
    const s = normalizeSettings({ ...defaultSettings(), schedule: { enabled: false, slots }, scene: { text: 'blink', weather: 'live' } });
    expect(s.schedule.slots).toHaveLength(4);
    expect(s.scene.text).toBe('none');
    expect(s.scene.weather).toBe('live');
    expect(s.scene.ground).toBe(false);
  });
});
