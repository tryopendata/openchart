import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { docSchema } from "./schema";

const valid = { title: "Install", description: "How to install.", group: "getting-started" };

describe("docSchema", () => {
  it("defaults order and accepts a known group", () => {
    expect(docSchema.parse(valid).order).toBe(100);
  });

  it("rejects an unknown group and a description over 160 characters", () => {
    expect(docSchema.safeParse({ ...valid, group: "blog" }).success).toBe(false);
    expect(docSchema.safeParse({ ...valid, description: "x".repeat(161) }).success).toBe(false);
  });

  it("names a group in every shipped page", () => {
    const root = "src/content/docs";
    const files = readdirSync(root, { recursive: true, encoding: "utf8" }).filter((file) =>
      file.endsWith(".md"),
    );
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(readFileSync(join(root, file), "utf8"), file).toMatch(/^group: [\w-]+$/m);
    }
  });
});
