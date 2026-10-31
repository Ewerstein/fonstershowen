import { describe, expect, it } from 'vitest';
import { formatTime, scheduleState, sunset } from './schedule';
import type { ScheduleSettings } from '../shared/types';

// Testerna räknar i svensk tid, som datorn i fönstret. Tidszonen sätts i vite.config.ts.

const base: ScheduleSettings = {
  enabled: true,
  startMode: 'time',
  startTime: '16:00',
  sunsetOffsetMin: 0,
  endTime: '22:00',
  location: null,
};

const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min);
const minutesUtc = (date: Date) => date.getUTCHours() * 60 + date.getUTCMinutes();

describe('solnedgång', () => {
  it('stämmer på några minuter för kända platser och datum', () => {
    // Stockholm vid midsommar: cirka 22:08 svensk sommartid, alltså 20:08 UTC.
    const stockholm = sunset(2024, 6, 21, 59.3293, 18.0686);
    expect(Math.abs(minutesUtc(stockholm!) - (20 * 60 + 8))).toBeLessThanOrEqual(6);
    // London vid vintersolståndet: cirka 15:53 UTC.
    const london = sunset(2024, 12, 21, 51.5074, -0.1278);
    expect(Math.abs(minutesUtc(london!) - (15 * 60 + 53))).toBeLessThanOrEqual(6);
  });

  it('ger ingen solnedgång under polarnatten', () => {
    expect(sunset(2024, 12, 21, 69.65, 18.96)).toBeNull();
  });
});

describe('schema', () => {
  it('är av före start, på under kvällen och av efter stopp', () => {
    const before = scheduleState(at(2026, 11, 29, 15), base);
    expect(before.on).toBe(false);
    expect(formatTime(before.next)).toBe('16:00');
    const during = scheduleState(at(2026, 11, 29, 18), base);
    expect(during.on).toBe(true);
    expect(formatTime(during.next)).toBe('22:00');
    const after = scheduleState(at(2026, 11, 29, 23), base);
    expect(after.on).toBe(false);
    expect(after.next.getDate()).toBe(30);
  });

  it('klarar ett stopp efter midnatt', () => {
    const late = { ...base, endTime: '01:00' };
    const night = scheduleState(at(2026, 11, 30, 0, 30), late);
    expect(night.on).toBe(true);
    expect(formatTime(night.next)).toBe('01:00');
    const morning = scheduleState(at(2026, 11, 30, 1, 30), late);
    expect(morning.on).toBe(false);
    expect(formatTime(morning.next)).toBe('16:00');
    expect(morning.next.getDate()).toBe(30);
  });

  it('startar i skymningen med förskjutning, och faller tillbaka på klockslaget utan plats', () => {
    const halmstad = { ...base, startMode: 'sunset' as const, sunsetOffsetMin: -15, location: { lat: 56.67, lon: 12.86 } };
    const state = scheduleState(at(2026, 11, 29, 12), halmstad);
    const set = sunset(2026, 11, 29, 56.67, 12.86)!;
    expect(state.next.getTime()).toBe(set.getTime() - 15 * 60_000);
    // Halmstad första advent: solen går ner strax före halv fyra.
    expect(state.next.getHours()).toBe(15);
    const noPlace = scheduleState(at(2026, 11, 29, 12), { ...halmstad, location: null });
    expect(formatTime(noPlace.next)).toBe('16:00');
  });
});
