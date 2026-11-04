import type { Locale } from '../shared/types';

/**
 * Text ovanför tomten: nedräkning till julafton, julhälsning i julhelgen och nyårshälsning
 * fram till trettondagen. Räknas i hela dagar från dagens datum, så den byts vid midnatt.
 */
export interface Banner {
  main: string;
  sub: string;
}

const DAY_MS = 86_400_000;

function dayNumber(d: Date): number {
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
}

export function christmasBanner(now: Date, locale: Locale): Banner {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const sv = locale === 'sv';
  if (m === 12 && d >= 24 && d <= 26) return { main: sv ? 'God Jul!' : 'Merry Christmas!', sub: '' };
  if ((m === 12 && d >= 27) || (m === 1 && d <= 6)) return { main: sv ? 'Gott nytt år!' : 'Happy New Year!', sub: '' };
  const target = m === 12 && d > 24 ? new Date(y + 1, 11, 24) : new Date(y, 11, 24);
  const days = dayNumber(target) - dayNumber(now);
  if (days === 1) return { main: sv ? 'I morgon' : 'Tomorrow', sub: sv ? 'är det julafton' : 'is Christmas Eve' };
  return {
    main: sv ? `${days} dagar` : `${days} days`,
    sub: sv ? 'kvar till julafton' : 'until Christmas Eve',
  };
}
