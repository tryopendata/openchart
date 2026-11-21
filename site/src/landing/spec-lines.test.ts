/**
 * The spec pane's formatting and line marking, on the shapes the hero steps
 * produce: nesting, a repeated line, a comma gained by a line that gets a
 * sibling, and bracket-only lines.
 */
import { describe, expect, it } from "vitest";
import { formatSpec, markAddedLines } from "./spec-lines";

const texts = (spec: object) =>
  formatSpec(spec).map((line) => `${"  ".repeat(line.depth)}${line.text}`);

describe("formatSpec", () => {
  it("breaks shallow containers onto lines, keeps deep plain ones inline and folds data", () => {
    expect(
      texts({
        mark: "point",
        data: [{ a: 1 }, { a: 2 }],
        encoding: { x: { field: "a", scale: { type: "log" }, values: [1, 10] } },
        flag: true,
      }),
    ).toEqual([
      "{",
      '  "mark": "point",',
      '  "data": [ … 2 rows ],',
      '  "encoding": {',
      '    "x": {',
      '      "field": "a",',
      '      "scale": { "type": "log" },',
      '      "values": [1, 10]',
      "    }",
      "  },",
      '  "flag": true',
      "}",
    ]);
  });

  it("tags tokens by kind so the pane can tint them", () => {
    const [, line] = formatSpec({ size: 3 });
    expect(line?.tokens).toEqual([
      { kind: "key", text: '"size"' },
      { kind: "punct", text: ": " },
      { kind: "number", text: "3" },
    ]);
  });
});

describe("markAddedLines", () => {
  const before = formatSpec({ encoding: { x: { type: "quantitative" } } });

  it("marks a repeated line only where it is new, and ignores a gained comma", () => {
    const after = formatSpec({
      encoding: {
        x: { type: "quantitative", axis: { title: "X" } },
        size: { type: "quantitative" },
      },
    });
    const added = markAddedLines(before, after)
      .filter((line) => line.added)
      .map((line) => line.text);
    expect(added).toEqual(['"axis": { "title": "X" }', '"size": {', '"type": "quantitative"']);
  });

  it("counts a line that moves to another depth as added", () => {
    const shallow = formatSpec({ title: "A" });
    const deeper = formatSpec({ chrome: { title: "A" } });
    expect(
      markAddedLines(shallow, deeper)
        .filter((line) => line.added)
        .map((line) => `${line.depth}:${line.text}`),
    ).toEqual(['1:"chrome": {', '2:"title": "A"']);
  });

  it("folds a named root key to one line that keeps its full lines", () => {
    const [, fold, last] = formatSpec(
      { theme: { rule: { width: 40 } }, mark: "bar" },
      { theme: "house style" },
    );
    expect(fold?.text).toBe('"theme": { … house style },');
    expect(fold?.folded?.map((line) => `${line.depth}:${line.text}`)).toEqual([
      '1:"theme": {',
      '2:"rule": {',
      '3:"width": 40',
      "2:}",
      "1:},",
    ]);
    expect(last?.text).toBe('"mark": "bar"');
  });

  it("never marks bracket-only lines, and marks every line with content for a first step", () => {
    const marked = markAddedLines([], before);
    expect(marked.filter((line) => line.added).map((line) => line.text)).toEqual([
      '"encoding": {',
      '"x": {',
      '"type": "quantitative"',
    ]);
  });
});
