/**
 * Helpers and generated samples shared by the distribution page demos. The
 * samples are seeded, so a rebuild draws the same points every time, and each is
 * kept near 150 points or fewer so a page stays small.
 */
import type { DemoSource } from "../types";

/** The source label for data the demos generate or invent. */
export const ILLUSTRATIVE: DemoSource = { label: "Illustrative data" };

/** A small seeded random number generator (mulberry32), so generated samples never change. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** How many small gifts and large checks the donation sample holds. */
export const SMALL_GIFTS = 36;
export const LARGE_CHECKS = 24;

/**
 * Individual contributions to two campaigns: small gifts that pile up under
 * $100 with a long tail, and larger checks that cluster near $620.
 */
export const campaignDonations: { amount: number; candidate: string }[] = (() => {
  const random = seededRandom(0xd04a7e);
  const rows: { amount: number; candidate: string }[] = [];
  for (let i = 0; i < SMALL_GIFTS; i++) {
    rows.push({ amount: Math.round(20 + 700 * random() ** 2.2), candidate: "Small donors" });
  }
  for (let i = 0; i < LARGE_CHECKS; i++) {
    rows.push({
      amount: Math.round(620 + (random() + random() - 1) * 480),
      candidate: "Large donors",
    });
  }
  return rows;
})();

/** The donations from the small-gift group only. */
export const smallDonations = campaignDonations.filter((row) => row.candidate === "Small donors");

/** How many counties each region contributes to the income sample. */
export const COUNTIES_PER_REGION = 12;

/** Median household income ($K) for a sample of counties in each of four regions. */
export const countyIncomes: { region: string; income: number; population: number }[] = (() => {
  const random = seededRandom(0xbee5);
  const regionMeans: [string, number][] = [
    ["Northeast", 82],
    ["Midwest", 68],
    ["South", 61],
    ["West", 74],
  ];
  const rows: { region: string; income: number; population: number }[] = [];
  for (const [region, mean] of regionMeans) {
    for (let i = 0; i < COUNTIES_PER_REGION; i++) {
      // Two draws averaged give a soft bell around the regional mean.
      const spread = (random() + random() - 1) * 34;
      rows.push({
        region,
        income: Math.round((mean + spread) * 10) / 10,
        population: Math.round(20 + random() ** 2 * 480),
      });
    }
  }
  return rows;
})();
