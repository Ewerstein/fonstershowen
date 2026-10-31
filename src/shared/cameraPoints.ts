/** Punkterna som skickas i kamerans förhandsbild: näsa, axlar, armbågar, handleder, höfter, knän och fötter. */
export const PREVIEW_POINTS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

/** Linjer mellan punkterna, som index i PREVIEW_POINTS. */
export const PREVIEW_LINES: [number, number][] = [
  [1, 2],
  [1, 3],
  [3, 5],
  [2, 4],
  [4, 6],
  [1, 7],
  [2, 8],
  [7, 8],
  [7, 9],
  [9, 11],
  [8, 10],
  [10, 12],
];

/** Handlederna, som ritas tydligare eftersom det är dem vinkningen handlar om. */
export const PREVIEW_WRISTS = [5, 6];
