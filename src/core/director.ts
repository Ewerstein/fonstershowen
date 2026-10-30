import type { DirectorState, ShowEvent } from '../shared/types';

/**
 * Regissören bestämmer vad figuren gör. Den känner inte till någon figur eller sensor,
 * bara händelser in och ett läge ut. Ren logik, så den går att testa utan webbläsare.
 */

export interface DirectorOptions {
  autonomous?: boolean;
  random?: () => number;
  onChange?: (state: DirectorState, previous: DirectorState) => void;
}

/** Hur länge varje kort läge varar innan regissören går vidare, i sekunder. */
export const DURATIONS = {
  lookAround: 3.5,
  greet: 3,
  waveBack: 3,
  celebrate: 3.2,
  noticeBeforeGreet: 1.5,
  waveCooldown: 2.5,
  autonomousMin: 5,
  autonomousMax: 10,
} as const;

export class Director {
  private _state: DirectorState = 'awake';
  private timeInState = 0;
  private sinceLastWave = Infinity;
  private nextAutonomousIn: number;
  private visitorPresent = false;
  private visitorX = 0;
  private readonly random: () => number;
  private readonly onChange?: DirectorOptions['onChange'];
  autonomous: boolean;

  constructor(options: DirectorOptions = {}) {
    this.random = options.random ?? Math.random;
    this.onChange = options.onChange;
    this.autonomous = options.autonomous ?? true;
    this.nextAutonomousIn = this.pickAutonomousDelay();
  }

  get state(): DirectorState {
    return this._state;
  }

  /** Vart figuren ska titta, -1 (vänster) till 1 (höger). */
  get lookTarget(): number {
    return this.visitorPresent ? this.visitorX : 0;
  }

  get hasVisitor(): boolean {
    return this.visitorPresent;
  }

  handle(event: ShowEvent): void {
    if (event.type === 'manual') {
      switch (event.action) {
        case 'wake':
          if (this._state === 'sleep') this.go('awake');
          return;
        case 'sleep':
          this.go('sleep');
          return;
        case 'wave':
          if (this._state !== 'sleep') this.go('waveBack');
          return;
        case 'celebrate':
          if (this._state !== 'sleep') this.go('celebrate');
          return;
        case 'lookAround':
          if (this._state !== 'sleep') this.go('lookAround');
          return;
      }
    }

    if (this._state === 'sleep') return;

    switch (event.type) {
      case 'visitor.enter':
      case 'doorbell.motion':
        this.visitorPresent = true;
        if (this._state === 'awake' || this._state === 'lookAround') this.go('notice');
        return;
      case 'doorbell.ring':
        this.go('greet');
        return;
      case 'visitor.leave':
        this.visitorPresent = false;
        this.visitorX = 0;
        if (this._state === 'notice' || this._state === 'greet') this.go('awake');
        return;
      case 'visitor.position':
        this.visitorX = Math.max(-1, Math.min(1, event.x));
        return;
      case 'gesture.wave':
        if (this.sinceLastWave >= DURATIONS.waveCooldown && this._state !== 'celebrate') {
          this.sinceLastWave = 0;
          this.go('waveBack');
        }
        return;
      case 'gesture.bothHands':
        if (this._state !== 'celebrate') this.go('celebrate');
        return;
    }
  }

  update(dt: number): void {
    this.timeInState += dt;
    this.sinceLastWave += dt;

    switch (this._state) {
      case 'sleep':
        return;
      case 'lookAround':
        if (this.timeInState >= DURATIONS.lookAround) this.go(this.visitorPresent ? 'notice' : 'awake');
        return;
      case 'greet':
        if (this.timeInState >= DURATIONS.greet) this.go(this.visitorPresent ? 'notice' : 'awake');
        return;
      case 'waveBack':
        if (this.timeInState >= DURATIONS.waveBack) this.go(this.visitorPresent ? 'notice' : 'awake');
        return;
      case 'celebrate':
        if (this.timeInState >= DURATIONS.celebrate) this.go(this.visitorPresent ? 'notice' : 'awake');
        return;
      case 'notice':
        if (this.visitorPresent && this.timeInState >= DURATIONS.noticeBeforeGreet) this.go('greet');
        if (!this.visitorPresent && this.timeInState >= DURATIONS.noticeBeforeGreet) this.go('awake');
        return;
      case 'awake':
        if (!this.autonomous || this.visitorPresent) return;
        this.nextAutonomousIn -= dt;
        if (this.nextAutonomousIn <= 0) {
          this.nextAutonomousIn = this.pickAutonomousDelay();
          const r = this.random();
          this.go(r < 0.6 ? 'lookAround' : r < 0.85 ? 'greet' : 'celebrate');
        }
        return;
    }
  }

  private go(next: DirectorState): void {
    const previous = this._state;
    this.timeInState = 0;
    if (next === previous) return;
    this._state = next;
    if (next === 'awake') this.nextAutonomousIn = this.pickAutonomousDelay();
    this.onChange?.(next, previous);
  }

  private pickAutonomousDelay(): number {
    return DURATIONS.autonomousMin + this.random() * (DURATIONS.autonomousMax - DURATIONS.autonomousMin);
  }
}
