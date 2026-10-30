import type { ClipCandidates } from '../core/clips';
import type { DirectorState, Locale } from './types';

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
  /** Byxor under rockens kant. Utan värde har benen samma färg som rocken. */
  pants?: string;
  hat: 'classic' | 'tall' | 'floppy' | 'none';
  hatColor: string;
  beard: number;
  beardColor?: string;
}

/** Rörelser som läggs ovanpå klippen med kod, för lägen som saknar eget klipp. */
export type OverlayName = 'wave' | 'raiseHand' | 'sleepy' | 'none';

/** Benen som de kodade rörelserna styr. Namnen följer modellens skelett. */
export interface RigSpec {
  head: string;
  upperArm: string;
  lowerArm: string;
  hand: string;
}

/** En extra modell, till exempel skägg eller hår, som fästs på ett ben. Modellen ska ligga rätt i figurens vilopose. */
export interface AttachmentSpec {
  model: string;
  bone: string;
  tint?: string;
}

/** Tecknad tomte av grundformer som byggs på skelettet. Används när modellfilen bara innehåller rörelser. */
export interface PuppetSpec {
  coat: string;
  trim: string;
  belt: string;
  buckle: string;
  pants: string;
  boots: string;
  mittens: string;
  skin: string;
  cheeks: string;
  hair: string;
  /** Skäggets färg. Utan värde blir det inget skägg. */
  beard?: string;
  beardLength: number;
  bun?: boolean;
  hat: 'classic' | 'tall' | 'floppy';
  hatColor: string;
  skirt: 'coat' | 'dress' | 'tunic';
  /** 1 är rund mage. */
  belly: number;
  /** 1 är tecknat stort huvud. */
  headScale: number;
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
  overlays?: Partial<Record<DirectorState, OverlayName>>;
  rig?: RigSpec;
  attachments?: AttachmentSpec[];
  /** Färg per delmodell, matchas mot namnet, till exempel vita ögonbryn. */
  tints?: Record<string, string>;
  /** Skala per ben, till exempel ett större huvud för en mer tecknad figur. */
  boneScale?: Record<string, number>;
  dress?: DressSpec;
  puppet?: PuppetSpec;
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
