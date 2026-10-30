import { get, set } from 'idb-keyval';
import { defaultCorners } from './geometry';
import type { Corners, Locale, MaskShape, ShowSettings, WindowProfile } from './types';

const STORAGE_KEY = 'fonstershowen:settings';

export function createProfile(partial: Partial<WindowProfile> = {}): WindowProfile {
  const windowWidthCm = partial.windowWidthCm ?? 125;
  const windowHeightCm = partial.windowHeightCm ?? 78;
  return {
    id: partial.id ?? crypto.randomUUID(),
    name: partial.name ?? 'Vardagsrummet',
    windowWidthCm,
    windowHeightCm,
    corners: partial.corners ?? defaultCorners(windowWidthCm / windowHeightCm),
    mirror: partial.mirror ?? true,
    mask: partial.mask ?? 'rect',
    maskInsetPct: partial.maskInsetPct ?? 0,
  };
}

export function defaultSettings(): ShowSettings {
  const profile = createProfile();
  return {
    version: 1,
    locale: 'sv',
    autonomous: true,
    testPattern: true,
    themeId: 'jul',
    styleId: '',
    activeProfileId: profile.id,
    profiles: [profile],
  };
}

const ID_PATTERN = /^[a-z0-9-]{0,40}$/;

export function activeProfile(settings: ShowSettings): WindowProfile {
  return settings.profiles.find((p) => p.id === settings.activeProfileId) ?? settings.profiles[0];
}

const MASKS: MaskShape[] = ['rect', 'rounded', 'arch'];
const LOCALES: Locale[] = ['sv', 'en'];

function num(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function normalizeCorners(value: unknown, fallback: Corners): Corners {
  if (!Array.isArray(value) || value.length !== 4) return fallback;
  const pts = value.map((p, i) => ({
    x: num((p as { x?: unknown })?.x, fallback[i].x, -0.5, 1.5),
    y: num((p as { y?: unknown })?.y, fallback[i].y, -0.5, 1.5),
  }));
  return pts as Corners;
}

function normalizeProfile(value: unknown): WindowProfile | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<WindowProfile>;
  const base = createProfile({
    id: typeof v.id === 'string' ? v.id : undefined,
    name: typeof v.name === 'string' && v.name.trim() ? v.name.slice(0, 60) : undefined,
    windowWidthCm: num(v.windowWidthCm, 125, 10, 1000),
    windowHeightCm: num(v.windowHeightCm, 78, 10, 1000),
  });
  return {
    ...base,
    corners: normalizeCorners(v.corners, base.corners),
    mirror: typeof v.mirror === 'boolean' ? v.mirror : base.mirror,
    mask: MASKS.includes(v.mask as MaskShape) ? (v.mask as MaskShape) : base.mask,
    maskInsetPct: num(v.maskInsetPct, 0, 0, 25),
  };
}

/** Tar emot okänd data (från lagring eller en importerad fil) och returnerar giltiga inställningar. */
export function normalizeSettings(value: unknown): ShowSettings {
  const fallback = defaultSettings();
  if (!value || typeof value !== 'object') return fallback;
  const v = value as Partial<ShowSettings>;
  const profiles = Array.isArray(v.profiles)
    ? v.profiles.map(normalizeProfile).filter((p): p is WindowProfile => p !== null)
    : [];
  if (profiles.length === 0) return fallback;
  const activeProfileId = profiles.some((p) => p.id === v.activeProfileId) ? (v.activeProfileId as string) : profiles[0].id;
  return {
    version: 1,
    locale: LOCALES.includes(v.locale as Locale) ? (v.locale as Locale) : 'sv',
    autonomous: typeof v.autonomous === 'boolean' ? v.autonomous : true,
    testPattern: typeof v.testPattern === 'boolean' ? v.testPattern : false,
    themeId: typeof v.themeId === 'string' && v.themeId && ID_PATTERN.test(v.themeId) ? v.themeId : 'jul',
    styleId: typeof v.styleId === 'string' && ID_PATTERN.test(v.styleId) ? v.styleId : '',
    activeProfileId,
    profiles,
  };
}

export async function loadSettings(): Promise<ShowSettings> {
  try {
    return normalizeSettings(await get(STORAGE_KEY));
  } catch {
    return defaultSettings();
  }
}

export async function saveSettings(settings: ShowSettings): Promise<void> {
  await set(STORAGE_KEY, settings);
}

export function exportSettings(settings: ShowSettings): string {
  return JSON.stringify({ app: 'fonstershowen', exportedAt: new Date().toISOString(), settings }, null, 2);
}

export function importSettings(text: string): ShowSettings {
  const parsed = JSON.parse(text) as { app?: string; settings?: unknown };
  if (parsed?.app !== 'fonstershowen') throw new Error('Filen kommer inte från Fönstershowen');
  return normalizeSettings(parsed.settings);
}
