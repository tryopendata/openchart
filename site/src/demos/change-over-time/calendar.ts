/**
 * Demos for the calendar page (docs/change-over-time/calendar). The first
 * follows the Ladle calendar heatmap; the second uses the mark options listed in
 * docs/chart-types.md. The daily values come from a seeded generator, as in the
 * gallery, so they are labelled illustrative. Each demo covers a few weeks
 * rather than a year, but the mark draws a full year of cells per band however
 * few days have data, so one band is about 180 KB of static SVG. Under the
 * 500 KB page limit only the sequential demo keeps its static SVG; the others
 * draw in the browser.
 */
import { defineDemo } from "../types";

const DAY_MS = 86_400_000;
const ILLUSTRATIVE = { label: "Illustrative data" };

/** Seeded random numbers in [0, 1), so the same cells render on every build. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Days from 1 January to this UTC date, starting at 0. */
function dayOfYear(time: number): number {
  return (time - Date.UTC(new Date(time).getUTCFullYear(), 0, 1)) / DAY_MS;
}

/** One row per day for `weeks` weeks: a seasonal swing from cool to warm plus noise. */
function dailyAnomalies(startDate: string, weeks: number, seed: number) {
  const random = mulberry32(seed);
  const start = Date.parse(startDate);
  return Array.from({ length: weeks * 7 }, (_, day) => {
    const time = start + day * DAY_MS;
    const seasonal = 1 - Math.abs((dayOfYear(time) / 366) * 4 - 2);
    const value = (seasonal - 0.5) * 1.2 + (random() - 0.5) * 2.4;
    return {
      date: new Date(time).toISOString().slice(0, 10),
      anomaly: Math.round(value * 10) / 10,
    };
  });
}

/** The same days as a reading shifted above zero, for a sequential scale. */
function asReadings(rows: ReturnType<typeof dailyAnomalies>) {
  return rows.map((row) => ({ date: row.date, reading: Math.round((row.anomaly + 2) * 10) / 10 }));
}

export const basicCalendar = defineDemo({
  id: "change-over-time/calendar-basic",
  title: "Daily temperature anomaly over five weeks",
  source: ILLUSTRATIVE,
  height: 300,
  static: false,
  spec: {
    mark: "calendar",
    data: dailyAnomalies("2024-06-03", 5, 20240603),
    encoding: {
      x: { field: "date", type: "temporal" },
      color: {
        field: "anomaly",
        type: "quantitative",
        // redBlue runs red to blue from low to high; reversed, warm days are red.
        scale: { scheme: "redBlue", reverse: true, domain: [-2.5, 2.5] },
        format: "+.1f",
      },
    },
    chrome: {
      title: "Five summer weeks of daily temperature anomalies",
      subtitle:
        "Daily temperature anomaly against the seasonal normal, degrees C. One cell per day, weeks run left to right.",
    },
  },
});

export const sequentialCalendar = defineDemo({
  id: "change-over-time/calendar-sequential",
  title: "Daily readings on a sequential scale",
  source: ILLUSTRATIVE,
  height: 300,
  spec: {
    mark: { type: "calendar", weekStart: "sunday", cellRadius: 6 },
    data: asReadings(dailyAnomalies("2024-06-02", 4, 20240602)),
    encoding: {
      x: { field: "date", type: "temporal" },
      color: {
        field: "reading",
        type: "quantitative",
        scale: { scheme: "blues" },
        format: ".1f",
      },
    },
    chrome: {
      title: "Weeks start on Sunday and cells have rounder corners",
      subtitle: "Daily reading, one cell per day. weekStart: sunday, cellRadius: 6.",
    },
  },
});

export const twoYearCalendar = defineDemo({
  id: "change-over-time/calendar-two-years",
  title: "The same June weeks in two years",
  source: ILLUSTRATIVE,
  height: 440,
  static: false,
  spec: {
    mark: "calendar",
    data: [
      ...dailyAnomalies("2023-06-05", 4, 20230605),
      ...dailyAnomalies("2024-06-03", 4, 20240603),
    ],
    encoding: {
      x: { field: "date", type: "temporal" },
      color: {
        field: "anomaly",
        type: "quantitative",
        scale: { scheme: "redBlue", reverse: true, domain: [-2.5, 2.5] },
        format: "+.1f",
      },
    },
    chrome: {
      title: "June 2023 and June 2024, one band per year",
      subtitle:
        "Daily temperature anomaly against the seasonal normal, degrees C. Both bands share one color scale.",
    },
  },
});
