/**
 * Seat counts for parliament (hemicycle) chart demos.
 *
 * usHouse: the 435-seat US House of Representatives, a two-party split with a
 * 218-seat majority threshold. Party colors are the conventional blue/red.
 *
 * euParliament: an 8-party European-Parliament-style chamber (705 seats),
 * ordered left-to-right along the political spectrum so the hemicycle blocks
 * read as a coalition gradient.
 *
 * Illustrative: plausible seat splits, not transcribed from a certified
 * result, so labeled illustrative rather than carrying a results citation.
 */

export const usHouse = {
  source: 'Illustrative data',
  data: [
    { party: 'Democratic', seats: 213 },
    { party: 'Republican', seats: 222 },
  ],
  colors: ['#1b7fa3', '#c44e52'] as const,
} as const;

export const euParliament = {
  source: 'Illustrative data',
  data: [
    { group: 'Left', seats: 39 },
    { group: 'Greens', seats: 71 },
    { group: 'S&D', seats: 139 },
    { group: 'Renew', seats: 102 },
    { group: 'EPP', seats: 178 },
    { group: 'ECR', seats: 69 },
    { group: 'ID', seats: 49 },
    { group: 'Non-attached', seats: 58 },
  ],
  colors: [
    '#8b1a1a',
    '#3d9970',
    '#c44e52',
    '#f0a202',
    '#1b7fa3',
    '#2c3e88',
    '#5b6ee1',
    '#8a8f98',
  ] as const,
} as const;
