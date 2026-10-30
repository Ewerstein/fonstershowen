import { describe, expect, it } from 'vitest';
import { resolveClips } from './clips';

describe('koppling av klipp till lägen', () => {
  const available = ['Idle_Loop', 'Wave_Loop', 'Dance_Loop', 'Walk_Loop', 'Sit_Idle'];

  it('hittar klipp med exakta namn och mönster', () => {
    const r = resolveClips(available, {
      awake: ['Idle_Loop'],
      waveBack: ['/wave/'],
      celebrate: ['/dance|cheer|jump/'],
    });
    expect(r.awake).toBe('Idle_Loop');
    expect(r.waveBack).toBe('Wave_Loop');
    expect(r.celebrate).toBe('Dance_Loop');
  });

  it('faller tillbaka på närmaste läge när ett klipp saknas', () => {
    const r = resolveClips(available, { awake: ['Idle_Loop'], waveBack: ['/wave/'] });
    expect(r.greet).toBe('Wave_Loop');
    expect(r.lookAround).toBe('Idle_Loop');
    expect(r.notice).toBe('Idle_Loop');
    expect(r.sleep).toBe('Idle_Loop');
  });

  it('lånar aldrig firandets klipp till en vinkning', () => {
    const r = resolveClips(available, { awake: ['Idle_Loop'], celebrate: ['Dance_Loop'] });
    expect(r.waveBack).toBe('Idle_Loop');
    expect(r.greet).toBe('Idle_Loop');
    expect(r.celebrate).toBe('Dance_Loop');
  });

  it('tar första kandidat som finns', () => {
    const r = resolveClips(available, { sleep: ['Lie_Loop', 'Sit_Idle'], awake: ['Idle_Loop'] });
    expect(r.sleep).toBe('Sit_Idle');
  });

  it('ger null när inget alls passar', () => {
    const r = resolveClips([], { awake: ['Idle'] });
    expect(r.awake).toBeNull();
    expect(r.waveBack).toBeNull();
  });

  it('kraschar inte på ett trasigt mönster', () => {
    const r = resolveClips(available, { awake: ['/[/', 'Idle_Loop'] });
    expect(r.awake).toBe('Idle_Loop');
  });
});
