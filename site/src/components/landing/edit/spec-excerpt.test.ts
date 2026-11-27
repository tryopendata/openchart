/** The spec excerpt beside the edit section's chart, read against the real spec. */
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { describe, expect, it } from "vitest";
import { editSpec } from "./edit-spec";
import { calloutExcerpt, type ExcerptLine } from "./spec-excerpt";

/** The excerpt as text, two spaces per depth, with the offset line marked. */
const render = (lines: ExcerptLine[]) =>
  lines.map((line) => "  ".repeat(line.depth) + ("offset" in line ? "<offset>" : line.text));

describe("calloutExcerpt", () => {
  it("writes the callout as the spec does, with an ellipsis for the keys and annotations left out", () => {
    expect(render(calloutExcerpt(editSpec))).toEqual([
      '"annotations": [',
      "  {",
      '    "type": "text",',
      '    "text": "Peak of 8.5%\\nin summer 2022",',
      '    "x": "2022-07-01",',
      '    "y": 8.5,',
      "    …",
      "    <offset>",
      "  },",
      "  …",
      "]",
    ]);
  });

  it("prints no ellipsis where nothing is left out", () => {
    const bare: ChartSpec = {
      ...editSpec,
      annotations: [{ type: "text", x: "2022-07-01", y: 8.5, text: "Peak", offset: { dx: 0 } }],
    };
    expect(render(calloutExcerpt(bare))).not.toContain("    …");
    expect(render(calloutExcerpt(bare)).at(-2)).toBe("  }");
  });

  it("refuses a spec whose first annotation is not a text callout", () => {
    const refline: ChartSpec = { ...editSpec, annotations: [{ type: "refline", y: 2 }] };
    expect(() => calloutExcerpt(refline)).toThrow(/text annotation at index 0; found refline/);
  });
});
