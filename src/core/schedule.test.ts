import { describe, expect, it } from 'vitest';
import { formatTime, scheduleState, sunrise, sunset } from './schedule';
import type { ScheduleSettings, ScheduleSlot } from '../shared/types';

// Testerna räknar i svensk tid, som datorn i fönstret. Tidszonen sätts i vite.config.ts.

const slot = (patch: Partial<ScheduleSlot> = {}): ScheduleSlot => ({
  startMode: 'time',
  startTime: '16:00',
  sunsetOffsetMin: 0,
  endMode: 'time',
  endTime: '22:00',
  sunriseOffsetMin: 0,
  ...patch,
});
const schedule = (...slots: ScheduleSlot[]): ScheduleSettings => ({ enabled: true, slots });

const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min);
const minutesUtc = (date: Date) => date.getUTCHours() * 60 + date.getUTCMinutes();
const halmstad = { lat: 56.67, lon: 12.86 };

describe('solen', () => {
  it('stämmer på några minuter för kända platser och datum', () => {
    // Stockholm vid midsommar: solnedgång cirka 22:08 sommartid, alltså 20:08 UTC, och soluppgång cirka 03:31, alltså 01:31 UTC.
    expect(Math.abs(minutesUtc(sunset(2024, 6, 21, 59.3293, 18.0686)!) - (20 * 60 + 8))).toBeLessThanOrEqual(6);
    expect(Math.abs(minutesUtc(sunrise(2024, 6, 21, 59.3293, 18.0686)!) - (1 * 60 + 31))).toBeLessThanOrEqual(6);
    // London vid vintersolståndet: solnedgång cirka 15:53 UTC.
    expect(Math.abs(minutesUtc(sunset(2024, 12, 21, 51.5074, -0.1278)!) - (15 * 60 + 53))).toBeLessThanOrEqual(6);
  });

  it('ger ingen sol under polarnatten', () => {
    expect(sunset(2024, 12, 21, 69.65, 18.96)).toBeNull();
    expect(sunrise(2024, 12, 21, 69.65, 18.96)).toBeNull();
  });
});

describe('schema', () => {
  it('är av före start, på under kvällen och av efter stopp', () => {
    const s = schedule(slot());
    const before = scheduleState(at(2026, 11, 29, 15), s, null);
    expect(before.on).toBe(false);
    expect(formatTime(before.next)).toBe('16:00');
    const during = scheduleState(at(2026, 11, 29, 18), s, null);
    expect(during.on).toBe(true);
    expect(formatTime(during.next)).toBe('22:00');
    const after = scheduleState(at(2026, 11, 29, 23), s, null);
    expect(after.on).toBe(false);
    expect(after.next.getDate()).toBe(30);
  });

  it('klarar ett stopp efter midnatt', () => {
    const s = schedule(slot({ endTime: '01:00' }));
    const night = scheduleState(at(2026, 11, 30, 0, 30), s, null);
    expect(night.on).toBe(true);
    expect(formatTime(night.next)).toBe('01:00');
    const morning = scheduleState(at(2026, 11, 30, 1, 30), s, null);
    expect(morning.on).toBe(false);
    expect(formatTime(morning.next)).toBe('16:00');
  });

  it('har flera pass per dygn, med paus mitt på dagen', () => {
    const s = schedule(slot({ startTime: '06:30', endTime: '08:00' }), slot({ startTime: '15:30', endTime: '22:00' }));
    expect(scheduleState(at(2026, 12, 1, 7), s, null)).toMatchObject({ on: true });
    expect(formatTime(scheduleState(at(2026, 12, 1, 7), s, null).next)).toBe('08:00');
    const noon = scheduleState(at(2026, 12, 1, 12), s, null);
    expect(noon.on).toBe(false);
    expect(formatTime(noon.next)).toBe('15:30');
    const late = scheduleState(at(2026, 12, 1, 23), s, null);
    expect(late.on).toBe(false);
    expect(formatTime(late.next)).toBe('06:30');
    expect(late.next.getDate()).toBe(2);
  });

  it('slår ihop pass som överlappar', () => {
    const s = schedule(slot({ startTime: '15:00', endTime: '18:00' }), slot({ startTime: '17:00', endTime: '21:00' }));
    const state = scheduleState(at(2026, 12, 1, 16), s, null);
    expect(state.on).toBe(true);
    expect(formatTime(state.next)).toBe('21:00');
  });

  it('startar i skymningen och slutar i gryningen, med förskjutning', () => {
    const s = schedule(slot({ startMode: 'sunset', sunsetOffsetMin: -15, endMode: 'sunrise', sunriseOffsetMin: -30 }));
    const state = scheduleState(at(2026, 11, 29, 12), s, halmstad);
    const set = sunset(2026, 11, 29, halmstad.lat, halmstad.lon)!;
    const rise = sunrise(2026, 11, 30, halmstad.lat, halmstad.lon)!;
    expect(state.on).toBe(false);
    expect(state.next.getTime()).toBe(set.getTime() - 15 * 60_000);
    expect(state.window.end.getTime()).toBe(rise.getTime() - 30 * 60_000);
    // Halmstad första advent: solen går ner strax före halv fyra.
    expect(state.next.getHours()).toBe(15);
  });

  it('faller tillbaka på klockslagen utan plats', () => {
    const s = schedule(slot({ startMode: 'sunset', endMode: 'sunrise' }));
    const state = scheduleState(at(2026, 11, 29, 12), s, null);
    expect(formatTime(state.next)).toBe('16:00');
    expect(formatTime(state.window.end)).toBe('22:00');
  });
});
