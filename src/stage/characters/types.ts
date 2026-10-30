import type { Object3D } from 'three';
import type { DirectorState } from '../../shared/types';

export interface CharacterContext {
  /** Vart figuren ska titta, -1 (vänster) till 1 (höger). */
  lookTarget: number;
  /** Sekunder sedan scenen startade. */
  time: number;
}

/**
 * Alla figurer följer samma kontrakt. Testtomten är byggd av grundformer.
 * Riktiga figurer från ett temapaket (GLB-modell och klipp) implementerar samma gränssnitt.
 */
export interface Character {
  readonly object: Object3D;
  setState(state: DirectorState): void;
  update(dt: number, ctx: CharacterContext): void;
  dispose(): void;
}
