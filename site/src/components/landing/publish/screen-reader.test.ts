import { type DataRow, generateAltText, generateDataTable } from "@opendata-ai/openchart-core";
import { describe, expect, it } from "vitest";
import { publishSpec } from "./publish-spec";
import { numericColumns, screenReaderContent } from "./screen-reader";

const rows = publishSpec.data as DataRow[];

describe("screenReaderContent", () => {
  const content = screenReaderContent(publishSpec);

  it("gives alt text that names the chart", () => {
    expect(content.altText).toMatch(/chart/i);
    expect(content.altText.length).toBeGreaterThan(20);
  });

  it("reads the year, share and source of each data row as plain strings", () => {
    expect(content.header).toEqual(["year", "share", "source"]);
    expect(content.rows).toHaveLength(rows.length);
    expect(content.rows.at(0)).toEqual(["2016", "31.2", "Coal"]);
    expect(content.rows.at(-1)).toEqual(["2023", "15.9", "Wind and solar"]);
  });

  it("is exactly what the library generates for the same spec", () => {
    expect(content.altText).toBe(generateAltText(publishSpec, rows));
    const [header = [], ...body] = generateDataTable(publishSpec, rows);
    expect(content.header).toEqual(header.map(String));
    expect(content.rows).toEqual(body.map((row) => row.map(String)));
  });
});

describe("numericColumns", () => {
  it("marks only the share column as numeric", () => {
    expect(numericColumns(publishSpec)).toEqual([false, true, false]);
  });
});
