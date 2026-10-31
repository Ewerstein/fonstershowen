import { describe, expect, it } from 'vitest';
import { GestureTracker, LM, type BodyPose, type GestureOptions } from './gestures';
import type { ShowEvent } from '../shared/types';

const ASPECT = 16 / 9;
const STEP = 1000 / 15;

interface BodySpec {
  /** Mitten mellan axlarna, 0..1 i bildens bredd. */
  cx?: number;
  /** Axelbredd i bildhöjder. */
  scale?: number;
  /** Handledens läge i axelbredder från axeln. Negativt y är uppåt. */
  left?: [number, number];
  right?: [number, number];
}

function body({ cx = 0.5, scale = 0.12, left = [0.2, 1.4], right = [-0.2, 1.4] }: BodySpec): BodyPose {
  const pose: BodyPose = Array.from({ length: 33 }, () => ({ x: cx, y: 0.5, visibility: 0.2 }));
  const shoulderY = 0.4;
  const put = (i: number, dx: number, dy: number, from: { x: number; y: number }) => {
    pose[i] = { x: from.x + (dx * scale) / ASPECT, y: from.y + dy * scale, visibility: 0.95 };
  };
  const center = { x: cx, y: shoulderY };
  put(LM.leftShoulder, 0.5, 0, center);
  put(LM.rightShoulder, -0.5, 0, center);
  put(LM.nose, 0, -0.75, center);
  put(LM.leftHip, 0.35, 1.7, center);
  put(LM.rightHip, -0.35, 1.7, center);
  for (const [wrist, elbow, shoulder, w, side] of [
    [LM.leftWrist, LM.leftElbow, LM.leftShoulder, left, 1],
    [LM.rightWrist, LM.rightElbow, LM.rightShoulder, right, -1],
  ] as const) {
    const s = pose[shoulder];
    put(elbow, side * 0.55, w[1] < 0 ? 0.05 : 0.85, s);
    put(wrist, w[0], w[1], s);
  }
  return pose;
}

function tracker(options: Partial<GestureOptions> = {}) {
  return new GestureTracker({ sensitivity: 'normal', flip: false, ...options });
}

/** Kör en följd av bilder och samlar händelserna. */
function play(t: GestureTracker, start: number, ms: number, frame: (time: number) => BodyPose[]): { events: ShowEvent[]; end: number } {
  const events: ShowEvent[] = [];
  let time = start;
  for (; time < start + ms; time += STEP) events.push(...t.update(time, frame(time), ASPECT));
  return { events, end: time };
}

const types = (events: ShowEvent[]) => events.map((e) => e.type);

describe('gester från kameran', () => {
  it('märker en besökare efter en kort stund och släpper den först när den varit borta en tid', () => {
    const t = tracker();
    const first = play(t, 0, 300, () => [body({})]);
    expect(types(first.events)).not.toContain('visitor.enter');
    const stay = play(t, first.end, 400, () => [body({})]);
    expect(types(stay.events)).toContain('visitor.enter');
    const blink = play(t, stay.end, 400, () => []);
    expect(types(blink.events)).not.toContain('visitor.leave');
    const back = play(t, blink.end, 200, () => [body({})]);
    const gone = play(t, back.end, 1700, () => []);
    expect(types(gone.events)).toContain('visitor.leave');
  });

  it('bryr sig inte om personer långt bort', () => {
    const t = tracker();
    const { events } = play(t, 0, 2000, () => [body({ scale: 0.03 })]);
    expect(events).toHaveLength(0);
    expect(t.snapshot.people).toBe(0);
  });

  it('räknar blicken från gatan och kan byta håll', () => {
    // Till vänster i kamerabilden betyder till höger för den som står utanför.
    const t = tracker();
    play(t, 0, 1500, () => [body({ cx: 0.2 })]);
    expect(t.snapshot.look).toBeGreaterThan(0.4);
    const flipped = tracker({ flip: true });
    play(flipped, 0, 1500, () => [body({ cx: 0.2 })]);
    expect(flipped.snapshot.look).toBeLessThan(-0.4);
  });

  it('följer den som står närmast', () => {
    const t = tracker();
    const { events } = play(t, 0, 1500, () => [body({ cx: 0.8, scale: 0.08 }), body({ cx: 0.25, scale: 0.16 })]);
    const position = events.filter((e) => e.type === 'visitor.position').at(-1);
    expect(position && position.type === 'visitor.position' && position.x).toBeGreaterThan(0.3);
    expect(t.snapshot.people).toBe(2);
  });

  it('ser en vinkning med handen uppe som svänger fram och tillbaka', () => {
    const t = tracker();
    const before = play(t, 0, 600, () => [body({})]);
    const wave = play(t, before.end, 1500, (time) => [body({ right: [-0.2 + Math.sin(time / 1000 * 2 * Math.PI * 2.5) * 0.6, -0.9] })]);
    expect(types(wave.events).filter((e) => e === 'gesture.wave')).toHaveLength(1);
  });

  it('tar inte armar som svänger när någon går förbi för en vinkning', () => {
    const t = tracker({ sensitivity: 'high' });
    const { events } = play(t, 0, 4000, (time) => {
      const swing = Math.sin(time / 1000 * 2 * Math.PI * 1.8) * 0.5;
      return [body({ cx: 0.2 + time / 8000, left: [0.15 + swing, 1.5], right: [-0.15 - swing, 1.5] })];
    });
    expect(types(events)).not.toContain('gesture.wave');
  });

  it('räknar en stilla lyft hand som en hälsning, en gång, men inte på låg känslighet', () => {
    const t = tracker();
    const { events } = play(t, 0, 5000, () => [body({ right: [-0.1, -1.1] })]);
    expect(types(events).filter((e) => e === 'gesture.wave')).toHaveLength(1);
    const low = tracker({ sensitivity: 'low' });
    expect(types(play(low, 0, 5000, () => [body({ right: [-0.1, -1.1] })]).events)).not.toContain('gesture.wave');
  });

  it('ser båda händerna i luften som firande och inte som vinkning', () => {
    const t = tracker();
    const { events } = play(t, 0, 1500, (time) => [
      body({ left: [0.1 + Math.sin(time / 120) * 0.5, -1.6], right: [-0.1 - Math.sin(time / 120) * 0.5, -1.6] }),
    ]);
    expect(types(events)).toContain('gesture.bothHands');
    expect(types(events)).not.toContain('gesture.wave');
  });

  it('säger att besökaren gick när kameran stängs av', () => {
    const t = tracker();
    play(t, 0, 1000, () => [body({})]);
    expect(types(t.reset())).toEqual(['visitor.leave']);
    expect(t.reset()).toHaveLength(0);
  });
});
