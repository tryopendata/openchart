// @vitest-environment node
// The beeswarm post shows its teacher-pay spec in a `json demo` fence so a
// reader can copy it. It must stay the spec the registered demo draws, over the
// dataset modules' rows, and every figure the prose quotes is recomputed here
// from those rows.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { collegeMajors } from "@datasets/college-majors";
import { teacherSalaryByState } from "@datasets/teacher-salary-by-state";
import { describe, expect, it } from "vitest";
import { staticSvgPair } from "../../lib/demo/static-svg";
import { validateDemo } from "../../lib/demo/validate";
import {
  majorsSwarm,
  teacherChanges,
  teacherHistogram,
  teacherSwarm,
  widestField,
} from "./how-to-make-a-beeswarm-plot";

const post = readFileSync(
  join(process.cwd(), "src/content/blog/how-to-make-a-beeswarm-plot.mdx"),
  "utf8",
);
const demos = [teacherHistogram, teacherSwarm, majorsSwarm];
const specOf = (demo: (typeof demos)[number]) =>
  demo.spec as {
    data?: Record<string, unknown>[];
    chrome?: { title?: string; subtitle?: string };
  };

describe("the beeswarm post's figures", () => {
  it("writes the teacher-pay swarm's spec in its json demo fence, citing the dataset", () => {
    const [, info = "", body = ""] = /^```json (demo[^\n]*)\n([\s\S]*?)^```$/m.exec(post) ?? [];
    expect(info).toContain(`source="${teacherSwarm.source.label}"`);
    expect(info).toContain(`height=${teacherSwarm.height}`);
    expect(JSON.parse(body)).toEqual(teacherSwarm.spec);
  });

  it("derives teacher pay changes from the dataset's rows, leaving out the national row", () => {
    expect(teacherSalaryByState.data).toHaveLength(52);
    expect(teacherChanges).toHaveLength(51);
    for (const row of teacherChanges) {
      const source = teacherSalaryByState.data.find((entry) => entry.state === row.state);
      expect(source, row.state).toBeDefined();
      const expected =
        (100 * ((source?.salary_2021_22 ?? 0) - (source?.salary_1999_00 ?? 0))) /
        (source?.salary_1999_00 ?? 1);
      expect(row.change, row.state).toBeCloseTo(expected, 1);
    }
    expect(specOf(teacherSwarm).data).toEqual(teacherChanges);
    expect(specOf(teacherHistogram).data).toEqual(teacherChanges.map(({ change }) => ({ change })));
  });

  it("pins the pay changes the prose quotes", () => {
    expect(teacherChanges.filter((row) => row.change < 0)).toHaveLength(36);
    const byChange = [...teacherChanges].sort((a, b) => a.change - b.change);
    expect(byChange[0]).toMatchObject({ state: "Indiana", change: -22.4 });
    expect(byChange.at(-1)).toMatchObject({ state: "Washington", change: 19.3 });
  });

  it("pins the college majors the prose quotes", () => {
    const rows = collegeMajors.data;
    expect(rows).toHaveLength(60);
    expect(widestField).toBe("Engineering");
    const engineering = rows.filter((row) => row.major_category === "Engineering");
    expect(Math.min(...engineering.map((row) => row.median_salary))).toBe(40000);
    expect(Math.max(...engineering.map((row) => row.median_salary))).toBe(65000);
    const at45k = rows.filter((row) => row.median_salary === 45000);
    expect(at45k).toHaveLength(7);
    expect(at45k.filter((row) => row.major_category === "Computers & Mathematics")).toHaveLength(4);
    expect(
      (specOf(majorsSwarm).data ?? []).map(({ major, field, pay }) => ({ major, field, pay })),
    ).toEqual(
      rows.map((row) => ({
        major: row.major,
        field: row.major_category,
        pay: row.median_salary,
      })),
    );
  });

  it("matches the correlation the prose gives between share of women and pay", () => {
    const rows = collegeMajors.data;
    const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
    const xs = rows.map((row) => row.share_women);
    const ys = rows.map((row) => row.median_salary);
    const [mx, my] = [mean(xs), mean(ys)];
    const cross = xs.reduce((sum, x, i) => sum + (x - mx) * ((ys[i] ?? 0) - my), 0);
    const spread = Math.sqrt(
      xs.reduce((sum, x) => sum + (x - mx) ** 2, 0) * ys.reduce((sum, y) => sum + (y - my) ** 2, 0),
    );
    expect(Math.round((cross / spread) * 100) / 100).toBe(-0.56);
  });

  it("titles each chart with a finding read off the rows", () => {
    expect(specOf(teacherHistogram).chrome?.title).toBe(
      "Teacher pay fell in 36 of 51 states, but the bars cannot say which",
    );
    expect(specOf(teacherSwarm).chrome?.title).toBe(
      "Teacher pay fell in 36 of 51 states, by as much as 22.4%",
    );
    expect(specOf(majorsSwarm).chrome?.title).toBe(
      "Engineering majors range from $40,000 to $65,000, the widest spread of any field",
    );
  });

  it("validates every demo and renders light and dark static SVGs", () => {
    for (const demo of demos) {
      expect(() => validateDemo(demo.id, demo.spec), demo.id).not.toThrow();
      expect(demo.height, demo.id).toBeTypeOf("number");
      const svgs = staticSvgPair(demo.spec, {
        idPrefix: demo.id.replaceAll("/", "-"),
        width: 720,
        height: demo.height ?? 440,
      });
      expect(svgs, demo.id).not.toBeNull();
      expect(svgs, demo.id).toContain('data-theme="light"');
      expect(svgs, demo.id).toContain('data-theme="dark"');
    }
  });
});
