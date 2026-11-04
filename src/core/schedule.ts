import type { GeoLocation, ScheduleSettings, ScheduleSlot } from '../shared/types';

/**
 * När showen ska vara igång. Ett schema har ett eller flera pass per dygn, till exempel en morgon
 * före soluppgången och en kväll från skymningen. Pass som överlappar slås ihop. Ett stopp efter
 * midnatt fungerar. Allt räknas i datorns lokala tid.
 */

export interface ShowWindow {
  start: Date;
  end: Date;
}

export interface ScheduleState {
  on: boolean;
  /** Nästa gång showen startar eller slutar. */
  next: Date;
  /** Pågående fönster om showen är igång, annars nästa. */
  window: ShowWindow;
}

const DAY_MS = 86_400_000;
const RAD = Math.PI / 180;

export function parseTime(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * Soluppgång och solnedgång för ett datum och en plats, enligt soluppgångsekvationen. Ger null när
 * solen inte går ner eller inte går upp den dagen. Felet är några minuter, vilket räcker för ett fönster.
 */
function sunTimes(year: number, month: number, day: number, lat: number, lon: number): { rise: Date; set: Date } | null {
  const jdNoon = Date.UTC(year, month - 1, day, 12) / DAY_MS + 2440587.5;
  const n = Math.round(jdNoon - 2451545.0 + 0.0008);
  const jStar = n - lon / 360;
  const M = (((357.5291 + 0.98560028 * jStar) % 360) + 360) % 360;
  const C = 1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 0.0003 * Math.sin(3 * M * RAD);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const jTransit = 2451545.0 + jStar + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * lambda * RAD);
  const sinDecl = Math.sin(lambda * RAD) * Math.sin(23.4397 * RAD);
  const cosDecl = Math.cos(Math.asin(sinDecl));
  const cosOmega = (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * sinDecl) / (Math.cos(lat * RAD) * cosDecl);
  if (cosOmega < -1 || cosOmega > 1) return null;
  const omega = Math.acos(cosOmega) / RAD;
  const toDate = (j: number) => new Date((j - 2440587.5) * DAY_MS);
  return { rise: toDate(jTransit - omega / 360), set: toDate(jTransit + omega / 360) };
}

export function sunset(year: number, month: number, day: number, lat: number, lon: number): Date | null {
  return sunTimes(year, month, day, lat, lon)?.set ?? null;
}

export function sunrise(year: number, month: number, day: number, lat: number, lon: number): Date | null {
  return sunTimes(year, month, day, lat, lon)?.rise ?? null;
}

function atMinutes(base: Date, minutes: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setMinutes(minutes);
  return d;
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
}

function sunOn(day: Date, location: GeoLocation, which: 'rise' | 'set'): Date | null {
  if (!location) return null;
  const t = sunTimes(day.getFullYear(), day.getMonth() + 1, day.getDate(), location.lat, location.lon);
  return t ? t[which] : null;
}

/** Ett pass fönster för dagen det börjar. Sol utan plats, eller en dag utan sol, faller tillbaka på klockslagen. */
export function slotWindow(day: Date, slot: ScheduleSlot, location: GeoLocation): ShowWindow {
  const set = slot.startMode === 'sunset' ? sunOn(day, location, 'set') : null;
  const start = set ? new Date(set.getTime() + slot.sunsetOffsetMin * 60_000) : atMinutes(day, parseTime(slot.startTime) ?? 15 * 60 + 30);
  const endOn = (d: Date): Date => {
    const rise = slot.endMode === 'sunrise' ? sunOn(d, location, 'rise') : null;
    return rise ? new Date(rise.getTime() + slot.sunriseOffsetMin * 60_000) : atMinutes(d, parseTime(slot.endTime) ?? 22 * 60);
  };
  let end = endOn(day);
  // Ett stopp före starten betyder nästa dag, till exempel efter midnatt eller vid nästa soluppgång.
  if (end.getTime() <= start.getTime()) end = endOn(addDays(day, 1));
  return { start, end };
}

/** Alla pass från gårdagen till i övermorgon, sorterade och ihopslagna där de överlappar. */
function windowsAround(now: Date, schedule: ScheduleSettings, location: GeoLocation): ShowWindow[] {
  const all: ShowWindow[] = [];
  for (let d = -1; d <= 2; d++) {
    for (const slot of schedule.slots) all.push(slotWindow(addDays(now, d), slot, location));
  }
  all.sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: ShowWindow[] = [];
  for (const w of all) {
    const last = merged[merged.length - 1];
    if (last && w.start.getTime() <= last.end.getTime()) {
      if (w.end.getTime() > last.end.getTime()) last.end = w.end;
    } else {
      merged.push({ start: w.start, end: w.end });
    }
  }
  return merged;
}

export function scheduleState(now: Date, schedule: ScheduleSettings, location: GeoLocation): ScheduleState {
  const t = now.getTime();
  const windows = windowsAround(now, schedule, location);
  const current = windows.find((w) => t >= w.start.getTime() && t < w.end.getTime());
  if (current) return { on: true, next: current.end, window: current };
  const upcoming = windows.find((w) => w.start.getTime() > t) ?? windows[windows.length - 1];
  return { on: false, next: upcoming.start, window: upcoming };
}
