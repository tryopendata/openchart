/**
 * Cumulative per-student spending vs PISA 2022 math performance, OECD countries.
 *
 * Editorial data carried over from the existing scatter story with its original
 * citation (OECD PISA 2022 / Education at a Glance). Two quantitative axes with
 * a weak correlation — the canonical "more money doesn't buy scores" scatter.
 */
export const pisaScores = {
  source: 'Source: OECD PISA 2022, Education at a Glance',
  url: 'https://www.oecd.org/pisa/',
  data: [
    { country: 'Singapore', spending: 14.5, math: 575 },
    { country: 'Japan', spending: 10.1, math: 536 },
    { country: 'South Korea', spending: 12.2, math: 527 },
    { country: 'Estonia', spending: 8.4, math: 510 },
    { country: 'Switzerland', spending: 17.8, math: 508 },
    { country: 'Canada', spending: 12.4, math: 497 },
    { country: 'Netherlands', spending: 13.2, math: 493 },
    { country: 'Ireland', spending: 11.3, math: 492 },
    { country: 'Poland', spending: 7.8, math: 489 },
    { country: 'Denmark', spending: 14.1, math: 489 },
    { country: 'United Kingdom', spending: 12.6, math: 489 },
    { country: 'Australia', spending: 12.8, math: 487 },
    { country: 'Finland', spending: 12.0, math: 484 },
    { country: 'Germany', spending: 13.7, math: 475 },
    { country: 'France', spending: 11.4, math: 474 },
    { country: 'Italy', spending: 10.2, math: 471 },
    { country: 'Norway', spending: 16.2, math: 468 },
    { country: 'United States', spending: 14.3, math: 465 },
    { country: 'Israel', spending: 10.6, math: 458 },
    { country: 'Chile', spending: 6.1, math: 412 },
    { country: 'Mexico', spending: 3.3, math: 395 },
    { country: 'Colombia', spending: 3.8, math: 383 },
  ],
} as const;
