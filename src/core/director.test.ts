import { describe, expect, it } from 'vitest';
import { Director, DURATIONS } from './director';
import type { DirectorState } from '../shared/types';

function run(director: Director, seconds: number, step = 0.05) {
  for (let t = 0; t < seconds; t += step) director.update(step);
}

describe('regissören', () => {
  it('vinkar tillbaka på en manuell vinkning och går sedan tillbaka till vaken', () => {
    const d = new Director({ autonomous: false });
    d.handle({ type: 'manual', action: 'wave' });
    expect(d.state).toBe('waveBack');
    run(d, DURATIONS.waveBack + 0.1);
    expect(d.state).toBe('awake');
  });

  it('märker en besökare, hälsar och svarar på vinkning', () => {
    const d = new Director({ autonomous: false });
    d.handle({ type: 'visitor.enter' });
    expect(d.state).toBe('notice');
    run(d, DURATIONS.noticeBeforeGreet + 0.1);
    expect(d.state).toBe('greet');
    d.handle({ type: 'gesture.wave' });
    expect(d.state).toBe('waveBack');
    run(d, DURATIONS.waveBack + 0.1);
    expect(d.state).toBe('notice');
  });

  it('svarar inte på vinkningar tätare än nedkylningen', () => {
    const states: DirectorState[] = [];
    const d = new Director({ autonomous: false, onChange: (s) => states.push(s) });
    d.handle({ type: 'gesture.wave' });
    run(d, 0.5);
    d.handle({ type: 'gesture.wave' });
    expect(states.filter((s) => s === 'waveBack')).toHaveLength(1);
    run(d, DURATIONS.waveCooldown);
    run(d, DURATIONS.waveBack);
    d.handle({ type: 'gesture.wave' });
    expect(states.filter((s) => s === 'waveBack')).toHaveLength(2);
  });

  it('ignorerar besökare när den sover men vaknar på knapp', () => {
    const d = new Director({ autonomous: false });
    d.handle({ type: 'manual', action: 'sleep' });
    d.handle({ type: 'visitor.enter' });
    d.handle({ type: 'gesture.wave' });
    expect(d.state).toBe('sleep');
    d.handle({ type: 'manual', action: 'wake' });
    expect(d.state).toBe('awake');
  });

  it('gör något av sig själv i autonomt läge', () => {
    let seed = 0.1;
    const d = new Director({ autonomous: true, random: () => (seed = (seed * 9301 + 49297) % 233280 / 233280) });
    const seen = new Set<DirectorState>();
    for (let t = 0; t < 120; t += 0.05) {
      d.update(0.05);
      seen.add(d.state);
    }
    expect(seen.has('lookAround') || seen.has('greet') || seen.has('celebrate')).toBe(true);
  });

  it('står stilla utan autonomt läge', () => {
    const d = new Director({ autonomous: false });
    run(d, 60);
    expect(d.state).toBe('awake');
  });

  it('följer besökarens position och släpper den när besökaren går', () => {
    const d = new Director({ autonomous: false });
    d.handle({ type: 'visitor.enter' });
    d.handle({ type: 'visitor.position', x: 1.7 });
    expect(d.lookTarget).toBe(1);
    d.handle({ type: 'visitor.leave' });
    expect(d.lookTarget).toBe(0);
    expect(d.state).toBe('awake');
  });
});
