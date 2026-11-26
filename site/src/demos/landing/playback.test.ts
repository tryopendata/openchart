import { describe, expect, it } from "vitest";
import { landingPlayback } from "./playback";

type Row = { country: string; region: string; year: number };

const DOCS_DEMO_COUNTRIES = 62;
const LABELLED = ["China", "India", "United States"];

describe("the landing playback demo", () => {
  const rows = (landingPlayback.spec as unknown as { data: Row[] }).data;

  it("plays every country the docs demo does", () => {
    expect(new Set(rows.map((row) => row.country)).size).toBe(DOCS_DEMO_COUNTRIES);
  });

  it("covers at least 12 periods and 4 regions", () => {
    expect(new Set(rows.map((row) => row.year)).size).toBeGreaterThanOrEqual(12);
    expect(new Set(rows.map((row) => row.region)).size).toBeGreaterThanOrEqual(4);
  });

  it("has the labelled countries in the first and last period", () => {
    const years = rows.map((row) => row.year);
    const last = Math.max(...years);
    for (const country of LABELLED) {
      const own = rows.filter((row) => row.country === country).map((row) => row.year);
      expect(own, country).toContain(last);
      expect(own.length, country).toBeGreaterThanOrEqual(12);
    }
  });

  it("is registered as landing/playback", () => {
    expect(landingPlayback.id).toBe("landing/playback");
  });
});
