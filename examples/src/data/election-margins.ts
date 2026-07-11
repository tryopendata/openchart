/**
 * Representative US swing-state results: winner, margin, electoral votes.
 *
 * Illustrative: the margin figures are a plausible battleground pattern, not
 * transcribed from a certified return, so this is labeled illustrative rather
 * than carrying a results citation. Drives the heatmap-cell demo (margin) and
 * the category-color-cell demo (winner → party color).
 */
export const electionMargins = {
  source: 'Illustrative data',
  data: [
    { state: 'Georgia', winner: 'Republican', margin: 2.2, electoralVotes: 16 },
    { state: 'Arizona', winner: 'Republican', margin: 5.5, electoralVotes: 11 },
    { state: 'Pennsylvania', winner: 'Republican', margin: 1.7, electoralVotes: 19 },
    { state: 'Wisconsin', winner: 'Republican', margin: 0.9, electoralVotes: 10 },
    { state: 'Michigan', winner: 'Republican', margin: 1.4, electoralVotes: 15 },
    { state: 'Nevada', winner: 'Republican', margin: 3.1, electoralVotes: 6 },
    { state: 'North Carolina', winner: 'Republican', margin: 3.4, electoralVotes: 16 },
    { state: 'Minnesota', winner: 'Democrat', margin: 4.3, electoralVotes: 10 },
    { state: 'Virginia', winner: 'Democrat', margin: 5.8, electoralVotes: 13 },
    { state: 'New Hampshire', winner: 'Democrat', margin: 2.8, electoralVotes: 4 },
    { state: 'New Mexico', winner: 'Democrat', margin: 6.0, electoralVotes: 5 },
    { state: 'Colorado', winner: 'Democrat', margin: 11.0, electoralVotes: 10 },
  ],
} as const;
