/** Blog frontmatter: what a post must declare and which values are rejected. */
import { describe, expect, it } from "vitest";
import { blogSchema } from "./blog-schema";

const valid = {
  title: "How to chart a temperature anomaly",
  description: "What the zero line means and when bars beat a line.",
  published: "2026-11-20",
  author: "OpenChart",
  tags: ["chart-choice", "climate"],
  related: ["comparison/column", "style/color"],
};

const messages = (input: unknown) =>
  blogSchema.safeParse(input).error?.issues.map((issue) => issue.message) ?? [];

describe("blogSchema", () => {
  it("parses a post, reading dates and defaulting draft to false", () => {
    const post = blogSchema.parse(valid);
    expect(post.published).toEqual(new Date("2026-11-20"));
    expect(post.draft).toBe(false);
    expect(post.tags).toEqual(["chart-choice", "climate"]);
  });

  it("accepts an updated date on or after published, and a lead demo", () => {
    const post = blogSchema.parse({
      ...valid,
      updated: "2026-11-20",
      lead: "style/color-diverging",
    });
    expect(post.updated).toEqual(post.published);
    expect(post.lead).toBe("style/color-diverging");
  });

  it("rejects an updated date before published", () => {
    expect(messages({ ...valid, updated: "2026-11-19" })).toEqual([
      "updated must not be before published",
    ]);
  });

  it.each([
    ["a title over 70 characters", { title: "x".repeat(71) }],
    ["a description over 160 characters", { description: "x".repeat(161) }],
    ["no tags", { tags: [] }],
    ["five tags", { tags: ["color", "maps", "tables", "climate", "annotation"] }],
    ["no related pages", { related: [] }],
    ["five related pages", { related: ["a/b", "a/c", "a/d", "a/e", "a/f"] }],
    ["a related id that is not a page id", { related: ["/docs/comparison/column/"] }],
    ["an empty author", { author: " " }],
  ])("rejects %s", (_case, change) => {
    expect(blogSchema.safeParse({ ...valid, ...change }).success).toBe(false);
  });

  it("rejects an unknown tag and lists the valid ids", () => {
    const [message = ""] = messages({ ...valid, tags: ["climate", "weather"] });
    expect(message).toContain("tags must come from blogTags");
    expect(message).toContain("chart-choice");
    expect(message).toContain("accessibility");
  });

  it("rejects a post without a published date", () => {
    const { published: _published, ...undated } = valid;
    expect(blogSchema.safeParse(undated).success).toBe(false);
  });
});
