import { describe, expect, it } from "vitest";
import { publishSpec } from "./publish-spec";
import { screenReaderContent } from "./screen-reader";

describe("screenReaderContent", () => {
  const content = screenReaderContent(publishSpec);

  it("gives alt text that names the chart", () => {
    expect(content.altText).toMatch(/chart/i);
    expect(content.altText.length).toBeGreaterThan(20);
  });

  it("gives a header and one row of strings per data row", () => {
    const rows = (publishSpec as unknown as { data: unknown[] }).data;
    expect(content.header.length).toBeGreaterThanOrEqual(2);
    expect(content.rows).toHaveLength(rows.length);
    for (const row of content.rows) {
      expect(row).toHaveLength(content.header.length);
      for (const cell of row) expect(typeof cell).toBe("string");
    }
  });
});
