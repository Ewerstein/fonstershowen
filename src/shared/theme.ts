import type { ClipCandidates } from '../core/clips';
import type { Locale } from './types';

/**
 * Ett tema är en mapp under public/themes med en manifest.json. Motorn vet inget om tomtar:
 * allt som gör tomten till en tomte står här.
 */

export type LocalizedText = Record<Locale, string>;

/** Dräkt som läggs på en basfigur: färger för kroppens zoner och tillbehör på huvudet. */
export interface DressSpec {
  coat: string;
  trim: string;
  belt: string;
  boots: string;
  mittens: string;
  skin?: string;
  hat: 'classic' | 'tall' | 'floppy' | 'none';
  hatColor: string;
  beard: number;
  beardColor?: string;
}

export interface StyleSpec {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  /** Modellfil relativt temamappen. */
  model: string;
  /** Filer med rörelser relativt temamappen. Kan vara samma som modellen. */
  animations: string[];
  clips: ClipCandidates;
  dress?: DressSpec;
  /** Figurens höjd i scenens enheter. Testtomten är cirka 2,2. */
  height?: number;
  rotationY?: number;
}

export interface CreditSpec {
  what: string;
  author: string;
  license: string;
  url: string;
}

export interface ThemeManifest {
  id: string;
  name: LocalizedText;
  defaultStyle: string;
  styles: StyleSpec[];
  credits: CreditSpec[];
}

export const DEFAULT_THEME = 'jul';

export function themeBase(themeId: string): string {
  return `${import.meta.env.BASE_URL}themes/${themeId}/`;
}

export async function loadTheme(themeId: string): Promise<ThemeManifest> {
  const response = await fetch(`${themeBase(themeId)}manifest.json`, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Temat ${themeId} saknas (${response.status})`);
  return (await response.json()) as ThemeManifest;
}
