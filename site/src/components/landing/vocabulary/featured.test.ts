/**
 * The featured figures point at demos that exist and docs pages that exist,
 * cite a named source, show the symbol map, tile map and sankey the section
 * promises, and fill every row of the grid.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getDemo } from "../../../demos/registry";
import { featuredFigures } from "./featured";

/** The .mdx file behind a docs URL; vitest runs from site/. */
const docsFile = (href: string) =>
  join("src/content/docs", `${href.replace(/^\/docs\//, "").replace(/\/$/, "")}.mdx`);

describe("the featured figures", () => {
  it.each(featuredFigures.map((figure) => [figure.demo, figure] as const))(
    "%s exists, links to a docs page and cites a named source",
    (_, figure) => {
      const demo = getDemo(figure.demo);
      expect(existsSync(docsFile(figure.href)), figure.href).toBe(true);
      // A newsroom cites a named source; "Illustrative data" does not belong on this page.
      expect(demo.source.label).not.toMatch(/illustrative/i);
    },
  );

  it("are a dominant symbol map, a tile map beside it and a full-width sankey", () => {
    const shown = featuredFigures.map((figure) => {
      const spec = getDemo(figure.demo).spec as { type?: string; points?: unknown };
      return { type: spec.type, points: Boolean(spec.points), place: figure.place };
    });
    expect(shown).toEqual([
      { type: "map", points: true, place: "dominant" },
      { type: "tilemap", points: false, place: "side" },
      { type: "sankey", points: false, place: "full" },
    ]);
  });

  it("fill every row at two and three columns, so no row ends on an empty cell", () => {
    // Cells each place takes: [at two columns, at three columns]. The dominant
    // figure's 2x2 at three columns is four cells; the side figure beside it
    // spans both rows, two cells.
    const cells = {
      dominant: [2, 4],
      side: [2, 2],
      full: [2, 3],
    } as const;
    const total = (columns: 0 | 1) =>
      featuredFigures.reduce((sum, figure) => sum + cells[figure.place][columns], 0);
    expect(total(0) % 2).toBe(0);
    expect(total(1) % 3).toBe(0);
  });
});
