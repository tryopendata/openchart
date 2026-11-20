// @vitest-environment node
/** Which docs/*.md files become pages, read from a real directory on disk. */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DuplicatePageError } from "./docs";
import { InvalidRepoDocError, publishedRepoDocs } from "./repo-docs";

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

  it("reads frontmatter as YAML, so a trailing comment is not part of the section", () => {
    write("getting-started.md", "---\nsection: get-started # guide\n---\n");
    expect(publishedRepoDocs(docsDir).get("getting-started.md")).toBe(
      "get-started/getting-started",
    );
  });

  it("throws naming the file when the section is not in docsAreas", () => {
    write("blog.md", "---\nsection: blog\n---\n");
    expect(() => publishedRepoDocs(docsDir)).toThrow(InvalidRepoDocError);
    expect(() => publishedRepoDocs(docsDir)).toThrow(/docs\/blog\.md has section "blog"/);
  });

  it("throws naming the file when the slug is not lowercase letters, digits and hyphens", () => {
    write("spec-reference.md", "---\nsection: spec\nslug: Chart Spec\n---\n");
    expect(() => publishedRepoDocs(docsDir)).toThrow(/docs\/spec-reference\.md has slug/);
  });

  it("throws naming both files when two resolve to the same page id", () => {
    write("chart-spec.md", "---\nsection: spec\n---\n");
    write("spec-reference.md", "---\nsection: spec\nslug: chart-spec\n---\n");
    expect(() => publishedRepoDocs(docsDir)).toThrow(DuplicatePageError);
    expect(() => publishedRepoDocs(docsDir)).toThrow(
      /docs\/chart-spec\.md and docs\/spec-reference\.md .*"spec\/chart-spec"/,
    );
  });

  it("leaves out files without frontmatter or without a section in it", () => {
    write("architecture.md", "# Architecture\n\nsection: not frontmatter\n");
    write("codebase-map.md", "---\ntitle: Codebase map\n---\n\n# Map\n");
    write("notes.txt", "---\nsection: get-started\n---\n");
    mkdirSync(join(docsDir, "evidence"));
    expect(publishedRepoDocs(docsDir)).toEqual(new Map());
  });
});
