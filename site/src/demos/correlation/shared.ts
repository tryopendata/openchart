/**
 * Helpers and a generated sample shared by the correlation page demos. The
 * sample is seeded, so a rebuild draws the same points every time.
 */
import type { DemoSource } from "../types";

/** A dataset's citation as a figure source; the figure caption adds the "Source:" prefix. */
export function sourceOf(dataset: { source: string; url: string }): DemoSource {
  return { label: dataset.source.replace(/^Source:\s*/, ""), url: dataset.url };
}

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

/**
 * 60 invented campuses: the share of low-income students and the share
 * reading at grade level, which falls as the first rises, with noise on top.
 */
export const campusReading: { lowIncome: number; reading: number }[] = (() => {
  const random = seededRandom(2025);
  return Array.from({ length: 60 }, () => {
    const lowIncome = random() * 100;
    const noise = (random() - 0.5) * 34;
    return {
      lowIncome: Math.round(lowIncome * 10) / 10,
      reading:
        Math.round(Math.max(2, Math.min(98, 72 - 0.62 * (lowIncome - 50) + noise)) * 10) / 10,
    };
  });
})();
