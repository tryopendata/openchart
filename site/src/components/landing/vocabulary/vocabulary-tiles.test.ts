/**
 * The wall's tile list against the real demos and the docs page list: every
 * tile draws a registered, valid demo and links to a page the catalog builds,
 * and the wall covers every Visualizations section.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { catalogPageIds } from "../../../../tests/catalog-pages";
import { getDemo } from "../../../demos/registry";
import { vocabularyTiles } from "../../../landing/vocabulary";
import { validateDemo } from "../../../lib/demo/validate";
import { WALL_INTENTS } from "./wall-filter";

const pageIdOf = (href: string) => /^\/docs\/([a-z0-9-]+\/[a-z0-9-]+)\/$/.exec(href)?.[1];

describe("the vocabulary wall's tiles", () => {
  it("number about two dozen, each demo once", () => {
    expect(vocabularyTiles.length).toBeGreaterThanOrEqual(20);
    expect(vocabularyTiles.length).toBeLessThanOrEqual(28);
    const demos = vocabularyTiles.map((tile) => tile.demo);
    expect(demos.filter((demo, index) => demos.indexOf(demo) !== index)).toEqual([]);
  });

  it.each(vocabularyTiles.map((tile) => [tile.demo, tile] as const))(
    "%s is a registered demo with a valid spec",
    (id) => {
      expect(() => validateDemo(id, getDemo(id).spec)).not.toThrow();
    },
  );

  it.each(vocabularyTiles.map((tile) => [tile.href, tile] as const))(
    "%s is a built docs page in the tile's own section",
    (href, tile) => {
      const id = pageIdOf(href);
      expect(id, `${href} looks like /docs/<section>/<slug>/`).toBeDefined();
      expect(catalogPageIds).toContain(id);
      expect(id?.startsWith(`${tile.intent}/`)).toBe(true);
      expect(existsSync(resolve("src/content/docs", `${id}.mdx`))).toBe(true);
    },
  );

  it("covers every Visualizations section, grouped in sidebar order", () => {
    const runs = vocabularyTiles
      .map((tile) => tile.intent)
      .filter((intent, index, all) => all[index - 1] !== intent);
    expect(runs).toEqual(WALL_INTENTS.map((intent) => intent.id));
  });

  it("gives every tile a label", () => {
    expect(vocabularyTiles.filter((tile) => tile.label.trim() === "")).toEqual([]);
  });
});
