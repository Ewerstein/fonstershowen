import type { ScheduleSettings } from '../shared/types';

/**
 * När showen ska vara igång. Start vid ett klockslag eller i skymningen, stopp vid ett klockslag.
 * Ett stopp efter midnatt fungerar, till exempel 16:00 till 01:00. Allt räknas i datorns lokala tid.
 */

export interface ShowWindow {
  start: Date;
  end: Date;
}

export interface ScheduleState {
  on: boolean;
  /** Nästa gång showen startar eller slutar. */
  next: Date;
  /** Kvällens fönster: pågående om showen är igång, annars nästa. */
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
 * Solnedgång för ett datum och en plats, enligt soluppgångsekvationen. Ger null när solen
 * inte går ner eller inte går upp den dagen, alltså midnattssol eller polarnatt.
 * Felet är några minuter, vilket räcker för att tända ett fönster.
 */
export function sunset(year: number, month: number, day: number, lat: number, lon: number): Date | null {
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
  const jSet = jTransit + omega / 360;
  return new Date((jSet - 2440587.5) * DAY_MS);
}

function atMinutes(base: Date, minutes: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setMinutes(minutes);
  return d;
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
}

/** Starttiden en viss dag. Skymning utan plats, eller en dag utan solnedgång, faller tillbaka på klockslaget. */
export function startOn(day: Date, s: ScheduleSettings): Date {
  if (s.startMode === 'sunset' && s.location) {
    const set = sunset(day.getFullYear(), day.getMonth() + 1, day.getDate(), s.location.lat, s.location.lon);
    if (set) return new Date(set.getTime() + s.sunsetOffsetMin * 60_000);
  }
  return atMinutes(day, parseTime(s.startTime) ?? 15 * 60 + 30);
}

/** Showens fönster för kvällen som börjar en viss dag. */
export function windowOn(day: Date, s: ScheduleSettings): ShowWindow {
  const start = startOn(day, s);
  let end = atMinutes(day, parseTime(s.endTime) ?? 22 * 60);
  // Ett stopp före starten betyder efter midnatt.
  if (end.getTime() <= start.getTime()) end = atMinutes(addDays(day, 1), parseTime(s.endTime) ?? 22 * 60);
  return { start, end };
}

export function scheduleState(now: Date, s: ScheduleSettings): ScheduleState {
  const t = now.getTime();
  const yesterday = windowOn(addDays(now, -1), s);
  if (t >= yesterday.start.getTime() && t < yesterday.end.getTime()) return { on: true, next: yesterday.end, window: yesterday };
  const today = windowOn(now, s);
  if (t >= today.start.getTime() && t < today.end.getTime()) return { on: true, next: today.end, window: today };
  if (t < today.start.getTime()) return { on: false, next: today.start, window: today };
  const tomorrow = windowOn(addDays(now, 1), s);
  return { on: false, next: tomorrow.start, window: tomorrow };
}
