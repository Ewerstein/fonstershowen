import { describe, expect, it } from 'vitest';
import { christmasBanner } from './countdown';

describe('nedräkning till julafton', () => {
  it('räknar hela dagar till julafton', () => {
    expect(christmasBanner(new Date(2026, 10, 29, 16), 'sv')).toEqual({ main: '25 dagar', sub: 'kvar till julafton' });
    expect(christmasBanner(new Date(2026, 11, 23, 23, 59), 'sv')).toEqual({ main: 'I morgon', sub: 'är det julafton' });
  });

  it('önskar god jul i julhelgen och gott nytt år fram till trettondagen', () => {
    expect(christmasBanner(new Date(2026, 11, 24, 8), 'sv').main).toBe('God Jul!');
    expect(christmasBanner(new Date(2026, 11, 31, 20), 'sv').main).toBe('Gott nytt år!');
    expect(christmasBanner(new Date(2027, 0, 6, 20), 'sv').main).toBe('Gott nytt år!');
    expect(christmasBanner(new Date(2027, 0, 7, 20), 'sv').main).toBe('351 dagar');
  });

  it('räknar rätt över sommartidens slut', () => {
    expect(christmasBanner(new Date(2026, 9, 24, 12), 'sv').main).toBe('61 dagar');
    expect(christmasBanner(new Date(2026, 9, 26, 12), 'sv').main).toBe('59 dagar');
  });
});
