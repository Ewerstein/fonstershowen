import type { Sensitivity, ShowEvent } from '../shared/types';

/**
 * Gör om kroppspunkter från kameran till händelser för regissören: någon kom, någon gick,
 * var personen står, vinkning och båda händerna i luften. Ren logik utan webbläsare,
 * så varje regel går att testa med påhittade rörelser.
 *
 * Punkterna följer MediaPipe Pose (33 punkter), normaliserade 0..1 mot hela kamerabilden
 * som kameran ser den, alltså inte spegelvänd.
 */

export type { Sensitivity };

export interface Landmark {
  x: number;
  y: number;
  visibility: number;
}

export type BodyPose = Landmark[];

export const LM = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
} as const;

export interface GestureOptions {
  sensitivity: Sensitivity;
  /** Byt höger och vänster, om kameran sitter så att blicken blir omvänd. */
  flip: boolean;
}

interface Tuning {
  /** Minsta axelbredd i förhållande till bildens höjd. Mindre personer står för långt bort. */
  minScale: number;
  enterMs: number;
  leaveMs: number;
  /** Hur högt handleden ska vara: positivt tillåter lägre hand, i axelbredder under axeln. */
  raiseTolerance: number;
  /** Hur långt handen ska svänga åt varje håll, i axelbredder. */
  swing: number;
  reversals: number;
  /** En lyft hand som hålls stilla räknas som en hälsning efter så här lång tid. */
  holdMs: number;
}

const TUNING: Record<Sensitivity, Tuning> = {
  low: { minScale: 0.09, enterMs: 700, leaveMs: 1500, raiseTolerance: -0.25, swing: 0.42, reversals: 2, holdMs: Infinity },
  normal: { minScale: 0.055, enterMs: 400, leaveMs: 1500, raiseTolerance: 0, swing: 0.3, reversals: 2, holdMs: 1500 },
  high: { minScale: 0.035, enterMs: 250, leaveMs: 2000, raiseTolerance: 0.35, swing: 0.2, reversals: 1, holdMs: 900 },
};

const MIN_VISIBILITY = 0.5;
const SWING_WINDOW_MS = 1600;
const WAVE_COOLDOWN_MS = 2000;
const BOTH_HANDS_MS = 500;
const BOTH_HANDS_COOLDOWN_MS = 4000;
const POSITION_STEP = 0.04;

interface ArmState {
  raisedSince: number | null;
  direction: number;
  extreme: number;
  reversals: number[];
  coolUntil: number;
  /** En stilla lyft hand hälsar en gång. Handen måste ner innan den kan hälsa igen. */
  held: boolean;
}

function newArm(): ArmState {
  return { raisedSince: null, direction: 0, extreme: 0, reversals: [], coolUntil: 0, held: false };
}

export interface GestureSnapshot {
  /** Personer som är tillräckligt nära för att räknas. */
  people: number;
  present: boolean;
  /** Blickens mål, -1 vänster till 1 höger sett utifrån gatan. */
  look: number;
  raised: { left: boolean; right: boolean };
  lastGesture?: { type: 'wave' | 'bothHands'; at: number };
}

interface Measured {
  pose: BodyPose;
  scale: number;
  centerX: number;
}

export class GestureTracker {
  private options: GestureOptions;
  private seenSince: number | null = null;
  private lostSince: number | null = null;
  private present = false;
  private smoothX = 0.5;
  private sentLook: number | null = null;
  private arms = { left: newArm(), right: newArm() };
  private bothSince: number | null = null;
  private bothCoolUntil = 0;
  private _snapshot: GestureSnapshot = { people: 0, present: false, look: 0, raised: { left: false, right: false } };

  constructor(options: GestureOptions) {
    this.options = options;
  }

  setOptions(options: GestureOptions): void {
    const flipChanged = options.flip !== this.options.flip;
    this.options = options;
    if (flipChanged) this.sentLook = null;
  }

  get snapshot(): GestureSnapshot {
    return this._snapshot;
  }

  reset(): ShowEvent[] {
    const events: ShowEvent[] = this.present ? [{ type: 'visitor.leave' }] : [];
    this.present = false;
    this.seenSince = null;
    this.lostSince = null;
    this.sentLook = null;
    this.arms = { left: newArm(), right: newArm() };
    this.bothSince = null;
    this._snapshot = { ...this._snapshot, people: 0, present: false, look: 0, raised: { left: false, right: false } };
    return events;
  }

  /**
   * @param time tid i millisekunder
   * @param poses alla kroppar kameran hittade i bilden
   * @param aspect kamerabildens bredd delat med höjd
   */
  update(time: number, poses: BodyPose[], aspect: number): ShowEvent[] {
    const t = TUNING[this.options.sensitivity];
    const events: ShowEvent[] = [];
    const people = poses.map((p) => this.measure(p, aspect)).filter((m): m is Measured => m !== null && m.scale >= t.minScale);
    const primary = people.reduce<Measured | null>((best, m) => (!best || m.scale > best.scale ? m : best), null);

    // Närvaro med fördröjning åt båda hållen, så att en enstaka missad bild inte räknas som att någon gick.
    if (primary) {
      this.lostSince = null;
      this.seenSince ??= time;
      if (!this.present && time - this.seenSince >= t.enterMs) {
        this.present = true;
        this.smoothX = primary.centerX;
        this.sentLook = null;
        events.push({ type: 'visitor.enter' });
      }
    } else {
      this.seenSince = null;
      this.lostSince ??= time;
      if (this.present && time - this.lostSince >= t.leaveMs) {
        this.present = false;
        this.sentLook = null;
        this.arms = { left: newArm(), right: newArm() };
        this.bothSince = null;
        events.push({ type: 'visitor.leave' });
      }
    }

    let raised = { left: false, right: false };
    if (primary) {
      this.smoothX += (primary.centerX - this.smoothX) * 0.3;
      const look = this.lookFrom(this.smoothX);
      if (this.present && (this.sentLook === null || Math.abs(look - this.sentLook) >= POSITION_STEP)) {
        this.sentLook = look;
        events.push({ type: 'visitor.position', x: look });
      }
      raised = this.gestures(time, primary, aspect, t, events);
    } else {
      this.arms.left.raisedSince = null;
      this.arms.right.raisedSince = null;
      this.bothSince = null;
    }

    let lastGesture = this._snapshot.lastGesture;
    for (const e of events) {
      if (e.type === 'gesture.wave') lastGesture = { type: 'wave', at: time };
      if (e.type === 'gesture.bothHands') lastGesture = { type: 'bothHands', at: time };
    }
    this._snapshot = {
      people: people.length,
      present: this.present,
      look: this.present ? this.lookFrom(this.smoothX) : 0,
      raised,
      lastGesture,
    };
    return events;
  }

  private lookFrom(x: number): number {
    // Kameran tittar ut mot gatan. Det som är till vänster i bilden är till höger för den som står utanför.
    const look = 1 - 2 * x;
    return Math.max(-1, Math.min(1, this.options.flip ? -look : look));
  }

  private measure(pose: BodyPose, aspect: number): Measured | null {
    const ls = pose[LM.leftShoulder];
    const rs = pose[LM.rightShoulder];
    if (!ls || !rs || ls.visibility < MIN_VISIBILITY || rs.visibility < MIN_VISIBILITY) return null;
    // Avstånd i bildhöjder, så att bredd och höjd mäts med samma mått.
    const shoulderWidth = Math.hypot((ls.x - rs.x) * aspect, ls.y - rs.y);
    let scale = shoulderWidth;
    const lh = pose[LM.leftHip];
    const rh = pose[LM.rightHip];
    if (lh && rh && lh.visibility >= MIN_VISIBILITY && rh.visibility >= MIN_VISIBILITY) {
      const torso = Math.hypot(((lh.x + rh.x) / 2 - (ls.x + rs.x) / 2) * aspect, (lh.y + rh.y) / 2 - (ls.y + rs.y) / 2);
      // En person som står snett har smala axlar. Bålen ger då ett stabilare mått.
      scale = Math.max(shoulderWidth, torso * 0.55);
    }
    return { pose, scale, centerX: (ls.x + rs.x) / 2 };
  }

  private gestures(time: number, m: Measured, aspect: number, t: Tuning, events: ShowEvent[]): { left: boolean; right: boolean } {
    const p = m.pose;
    const isRaised = (wrist: number, shoulder: number) => {
      const w = p[wrist];
      const s = p[shoulder];
      return !!w && w.visibility >= MIN_VISIBILITY * 0.8 && w.y < s.y + t.raiseTolerance * m.scale;
    };
    const left = isRaised(LM.leftWrist, LM.leftShoulder);
    const right = isRaised(LM.rightWrist, LM.rightShoulder);

    // Båda händerna ovanför huvudet betyder firande och går före vinkning.
    const nose = p[LM.nose];
    const headY = nose && nose.visibility >= MIN_VISIBILITY ? nose.y : Math.min(p[LM.leftShoulder].y, p[LM.rightShoulder].y) - 0.5 * m.scale;
    const bothUp = p[LM.leftWrist]?.y < headY && p[LM.rightWrist]?.y < headY && left && right;
    if (bothUp) {
      this.bothSince ??= time;
      if (time - this.bothSince >= BOTH_HANDS_MS && time >= this.bothCoolUntil) {
        this.bothCoolUntil = time + BOTH_HANDS_COOLDOWN_MS;
        events.push({ type: 'gesture.bothHands' });
      }
      for (const arm of [this.arms.left, this.arms.right]) {
        arm.reversals = [];
        arm.raisedSince = null;
      }
      return { left, right };
    }
    this.bothSince = null;

    this.arm(time, this.arms.left, left, LM.leftWrist, LM.leftElbow, LM.leftShoulder, m, aspect, t, events);
    this.arm(time, this.arms.right, right, LM.rightWrist, LM.rightElbow, LM.rightShoulder, m, aspect, t, events);
    return { left, right };
  }

  private arm(
    time: number,
    arm: ArmState,
    raised: boolean,
    wrist: number,
    elbow: number,
    shoulder: number,
    m: Measured,
    aspect: number,
    t: Tuning,
    events: ShowEvent[],
  ): void {
    if (!raised) {
      arm.raisedSince = null;
      arm.direction = 0;
      arm.reversals = [];
      arm.held = false;
      return;
    }
    const p = m.pose;
    const anchor = p[elbow] && p[elbow].visibility >= MIN_VISIBILITY * 0.6 ? p[elbow] : p[shoulder];
    const r = ((p[wrist].x - anchor.x) * aspect) / m.scale;

    if (arm.raisedSince === null) {
      arm.raisedSince = time;
      arm.extreme = r;
      arm.direction = 0;
      arm.reversals = [];
    }

    // Räkna vändningar med en tröskel, så att små darrningar inte blir en vinkning.
    if (arm.direction === 0) {
      if (Math.abs(r - arm.extreme) >= t.swing) {
        arm.direction = Math.sign(r - arm.extreme);
        arm.extreme = r;
      } else if (Math.abs(r - arm.extreme) < 0.05) {
        arm.extreme = (arm.extreme + r) / 2;
      }
    } else if ((r - arm.extreme) * arm.direction > 0) {
      arm.extreme = r;
    } else if (Math.abs(r - arm.extreme) >= t.swing) {
      arm.reversals.push(time);
      arm.direction = -arm.direction;
      arm.extreme = r;
    }
    arm.reversals = arm.reversals.filter((at) => time - at <= SWING_WINDOW_MS);

    if (time < arm.coolUntil) return;
    // En vinkning är en första sväng plus minst så många vändningar som känsligheten kräver.
    const waving = arm.direction !== 0 && arm.reversals.length >= t.reversals;
    const holding = !arm.held && time - arm.raisedSince >= t.holdMs;
    if (waving || holding) {
      if (holding) arm.held = true;
      arm.coolUntil = time + WAVE_COOLDOWN_MS;
      arm.reversals = [];
      arm.direction = 0;
      arm.extreme = r;
      // Samma nedkylning för båda armarna, så att en vinkning med två händer räknas en gång.
      for (const other of [this.arms.left, this.arms.right]) other.coolUntil = Math.max(other.coolUntil, arm.coolUntil);
      events.push({ type: 'gesture.wave' });
    }
  }
}
