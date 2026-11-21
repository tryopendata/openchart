// @vitest-environment node
// Demo modules may not cite data the dataset module itself calls illustrative
// under a real publication's name. Two such modules were in use until phase 4;
// this keeps them from coming back.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Dataset modules whose rows are illustrative while their `source` names a publication. */
const MISLABELLED_DATASETS = ["us-unemployment", "energy-flow"];

const demosDir = join(process.cwd(), "src/demos");
const demoModules = readdirSync(demosDir, { recursive: true, encoding: "utf8" }).filter(
  (file) => file.endsWith(".ts") && !file.endsWith(".test.ts"),
);

/** The dataset names a module imports from `@datasets/`. */
function datasetImports(source: string): string[] {
  return [...source.matchAll(/from\s+["']@datasets\/([^"']+)["']/g)].map(([, name]) => name ?? "");
}

describe("demo data provenance", () => {
  it("reads the demo modules", () => {
    expect(demoModules.length).toBeGreaterThan(10);
  });

  it("no demo module imports a mislabelled dataset", () => {
    const offenders = demoModules.flatMap((file) =>
      datasetImports(readFileSync(join(demosDir, file), "utf8"))
        .filter((name) => MISLABELLED_DATASETS.includes(name))
        .map((name) => `${file} imports @datasets/${name}`),
    );
    expect(offenders).toEqual([]);
  });
});
