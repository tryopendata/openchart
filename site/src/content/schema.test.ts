/** Docs frontmatter: what a page must declare and which values are rejected. */
import { describe, expect, it } from "vitest";
import { docSchema, repoDocSchema } from "./schema";

const valid = {
  title: "Bar",
  description: "Compare values across categories.",
  section: "comparison",
  order: 1,
};

describe("docSchema", () => {
  it("parses a title, description, section and order", () => {
    expect(docSchema.parse(valid)).toEqual(valid);
  });

  it("defaults order to 100", () => {
    const { order: _order, ...withoutOrder } = valid;
    expect(docSchema.parse(withoutOrder).order).toBe(100);
  });

  it("rejects a description over 160 characters", () => {
    expect(docSchema.safeParse({ ...valid, description: "x".repeat(161) }).success).toBe(false);
  });

  it("rejects an unknown section and lists the valid ids", () => {
    const result = docSchema.safeParse({ ...valid, section: "blog" });
    expect(result.success).toBe(false);
    const message = result.error?.issues[0]?.message ?? "";
    expect(message).toContain("section must be one of:");
    expect(message).toContain("get-started");
    expect(message).toContain("comparison");
  });

  it("rejects a page without a section", () => {
    const { section: _section, ...withoutSection } = valid;
    expect(docSchema.safeParse(withoutSection).success).toBe(false);
  });
});

describe("repoDocSchema", () => {
  it("accepts a slug that replaces the file name", () => {
    expect(repoDocSchema.parse({ ...valid, slug: "intro" }).slug).toBe("intro");
  });
});
