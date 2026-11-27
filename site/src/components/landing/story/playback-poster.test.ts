/** Tests the last-period still the motion section renders at build time. */
import { type ChartSpec, isChartSpec } from "@opendata-ai/openchart-core";
import { describe, expect, it } from "vitest";
import { landingPlayback } from "../../../demos/landing/playback";
import { playbackPosterSpec } from "./playback-poster";

const bubble = {
  mark: "point",
  data: [
    { country: "China", income: 12_000, life: 78, year: 2022 },
    { country: "China", income: 200, life: 55, year: 1970 },
    { country: "India", income: 2_400, life: 67, year: 2022 },
    { country: "India", income: 110, life: 47, year: 1970 },
  ],
  encoding: {
    x: { field: "income", type: "quantitative" },
    y: { field: "life", type: "quantitative" },
    key: { field: "country", type: "nominal" },
  },
  chrome: { title: "Wealth and health" },
} satisfies ChartSpec;

const playback = {
  ...bubble,
  encoding: { ...bubble.encoding, time: { field: "year", type: "temporal" } },
  playback: { duration: 16_000 },
} satisfies ChartSpec;

describe("the playback poster", () => {
  it("keeps every row from the latest period and removes the playback channels without changing the input", () => {
    const input = structuredClone(playback);

    expect(playbackPosterSpec(input)).toStrictEqual({
      ...bubble,
      data: [bubble.data[0], bubble.data[2]],
    });
    expect(input).toStrictEqual(playback);
  });

  it("compares temporal dates by instant", () => {
    const early = { country: "China", income: 12_000, life: 78, year: "2022-01-01T01:00+02:00" };
    const late = { country: "China", income: 12_000, life: 78, year: "2022-01-01T00:00Z" };

    expect(playbackPosterSpec({ ...playback, data: [late, early] }).data).toStrictEqual([late]);
  });

  it("keeps the largest value even when an ordinal playback orders it first", () => {
    const ordinal = {
      ...playback,
      encoding: {
        ...playback.encoding,
        time: { field: "year", type: "ordinal", sort: ["2022", "1970"] },
      },
    } satisfies ChartSpec;

    expect(playbackPosterSpec(ordinal).data).toStrictEqual([bubble.data[0], bubble.data[2]]);
  });

  it("keeps the landing playback's all-period position and size domains in the still", () => {
    const { spec } = landingPlayback;
    if (!isChartSpec(spec)) throw new Error("The landing playback demo must be a chart.");

    const poster = playbackPosterSpec(spec);

    expect(poster.encoding).toMatchObject({
      x: { scale: { domain: [10, 100_000] } },
      y: { scale: { domain: [10, 85] } },
      size: { scale: { domain: [2.4, 1425.4] } },
    });
    expect(poster.mark).toEqual({ type: "point", trendline: false });
  });

  it("names the missing time encoding when the chart has none", () => {
    expect(() => playbackPosterSpec(bubble)).toThrow("encoding.time");
  });

  it("names the missing rows when the chart has none", () => {
    expect(() => playbackPosterSpec({ ...playback, data: [] })).toThrow("no rows");
  });
});
