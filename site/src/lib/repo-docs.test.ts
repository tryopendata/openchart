// @vitest-environment node
/** Which docs/*.md files become pages, read from a real directory on disk. */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { publishedRepoDocs } from "./repo-docs";

let docsDir: string;

beforeEach(() => {
  docsDir = mkdtempSync(join(tmpdir(), "repo-docs-"));
});

afterEach(() => {
  rmSync(docsDir, { recursive: true, force: true });
});

const write = (file: string, source: string) => writeFileSync(join(docsDir, file), source);

describe("publishedRepoDocs", () => {
  it("publishes a file whose frontmatter has a section, under <section>/<file name>", () => {
    write("getting-started.md", "---\ntitle: Getting started\nsection: get-started\n---\n\n# Hi\n");
    expect(publishedRepoDocs(docsDir)).toEqual(
      new Map([["getting-started.md", "get-started/getting-started"]]),
    );
  });

  it("uses the frontmatter slug in place of the file name", () => {
    write("spec-reference.md", "---\nsection: spec\nslug: 'chart-spec'\n---\n");
    expect(publishedRepoDocs(docsDir).get("spec-reference.md")).toBe("spec/chart-spec");
  });

  it("leaves out files without frontmatter or without a section in it", () => {
    write("architecture.md", "# Architecture\n\nsection: not frontmatter\n");
    write("codebase-map.md", "---\ntitle: Codebase map\n---\n\n# Map\n");
    write("notes.txt", "---\nsection: get-started\n---\n");
    mkdirSync(join(docsDir, "evidence"));
    expect(publishedRepoDocs(docsDir)).toEqual(new Map());
  });
});
