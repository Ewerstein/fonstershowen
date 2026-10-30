import type { DirectorState } from '../shared/types';

/**
 * Kopplar regissörens lägen till klipp i en modell. Ett tema anger kandidater per läge,
 * som namn eller mönster. Saknas ett klipp används närmaste läge, så att en figur med
 * få rörelser ändå fungerar.
 */

export type ClipCandidates = Partial<Record<DirectorState, string[]>>;

export const STATES: DirectorState[] = ['sleep', 'awake', 'lookAround', 'notice', 'greet', 'waveBack', 'celebrate'];

/** Ordningen regissören faller tillbaka i när ett läge saknar klipp. */
export const FALLBACK: Record<DirectorState, DirectorState[]> = {
  awake: [],
  lookAround: ['awake'],
  notice: ['lookAround', 'awake'],
  greet: ['waveBack', 'notice', 'awake'],
  waveBack: ['greet', 'celebrate', 'awake'],
  celebrate: ['waveBack', 'greet', 'awake'],
  sleep: ['awake'],
};

function matches(clipName: string, candidate: string): boolean {
  const name = clipName.toLowerCase();
  const c = candidate.toLowerCase();
  if (c.startsWith('/') && c.endsWith('/') && c.length > 2) {
    try {
      return new RegExp(c.slice(1, -1), 'i').test(clipName);
    } catch {
      return false;
    }
  }
  return name === c;
}

function findDirect(available: string[], candidates: string[] | undefined): string | null {
  if (!candidates) return null;
  for (const candidate of candidates) {
    const hit = available.find((name) => matches(name, candidate));
    if (hit) return hit;
  }
  return null;
}

export function resolveClips(available: string[], candidates: ClipCandidates): Record<DirectorState, string | null> {
  const direct = Object.fromEntries(STATES.map((s) => [s, findDirect(available, candidates[s])])) as Record<
    DirectorState,
    string | null
  >;
  const resolved = { ...direct };
  for (const state of STATES) {
    if (resolved[state]) continue;
    for (const fallback of FALLBACK[state]) {
      if (direct[fallback]) {
        resolved[state] = direct[fallback];
        break;
      }
    }
  }
  return resolved;
}
