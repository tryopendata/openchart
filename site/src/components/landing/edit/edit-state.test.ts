/**
 * Which edits the edit section accepts. The transactions are the ones the
 * library really emits for the section's chart (recorded in a browser from a
 * mouse drag, an arrow-key nudge and a Delete), plus the shapes its other
 * gestures produce: a double-click add, a title edit, a refline label drag and
 * a connector handle drag.
 */
import type { EditOp, EditTransaction } from "@opendata-ai/openchart-core";
import { describe, expect, it } from "vitest";
import { specWithOffset } from "./callout-offset";
import { editSpec, startOffset } from "./edit-spec";
import { acceptedOffset, offsetLine } from "./edit-state";

const callout = { type: "text", text: "Peak of 8.5%\nin summer 2022" } as const;
const target = { type: "refline", text: "Fed's 2% target" } as const;

/** What a drag or a nudge of the callout emits: anchor, offset and responsive together. */
function move(offset: { dx: number; dy: number }, anchor = "right"): EditOp[] {
  return [
    { op: "set", path: "/annotations/0/anchor", value: anchor, expect: callout },
    { op: "set", path: "/annotations/0/offset", value: offset, expect: callout },
    { op: "set", path: "/annotations/0/responsive", value: false, expect: callout },
  ];
}

const tx = (...ops: EditOp[]): EditTransaction => ({ ops });

describe("acceptedOffset", () => {
  it("accepts a mouse drag of the callout and returns its new offset in whole pixels", () => {
    const drag = tx(...move({ dx: 132, dy: 38.0007286012 }));
    expect(acceptedOffset(editSpec, drag)).toEqual({ dx: 132, dy: 38 });
  });

  it("rounds a fractional move the way the readout prints it, never to -0", () => {
    const drag = tx(...move({ dx: -40.5, dy: -0.3 }));
    expect(acceptedOffset(editSpec, drag)).toEqual({ dx: -40, dy: 0 });
    expect(Object.is(acceptedOffset(editSpec, drag)?.dy, -0)).toBe(false);
  });

  it("accepts a nudge from a callout already moved", () => {
    const moved = specWithOffset(editSpec, { dx: 132, dy: 38 });
    expect(acceptedOffset(moved, tx(...move({ dx: 134, dy: 38 })))).toEqual({ dx: 134, dy: 38 });
  });

  it("accepts a bare offset op", () => {
    const bare = tx({ op: "set", path: "/annotations/0/offset", value: { dx: 4, dy: -6 } });
    expect(acceptedOffset(editSpec, bare)).toEqual({ dx: 4, dy: -6 });
  });

  it.each([
    ["a delete of the callout", tx({ op: "remove", path: "/annotations/0", expect: callout })],
    [
      "a double-click add",
      tx({
        op: "add",
        path: "/annotations/-",
        value: { type: "text", x: "2020-04-01", y: 0.3, text: "New note" },
      }),
    ],
    ["a title edit", tx({ op: "set", path: "/chrome/title", value: { text: "Prices" } })],
    [
      "a drag of the target line's label",
      tx({
        op: "set",
        path: "/annotations/1/labelOffset",
        value: { dx: -40, dy: 0 },
        expect: target,
      }),
    ],
    [
      "a drag of the callout's connector handle",
      tx({
        op: "set",
        path: "/annotations/0/connectorOffset",
        value: { to: { dx: 6, dy: 4 } },
        expect: callout,
      }),
    ],
    ["a move that flips the callout's side", tx(...move({ dx: -20, dy: 0 }, "left"))],
    ["a text edit of the callout", tx({ op: "set", path: "/annotations/0/text", value: "Peak" })],
    [
      "a move mixed with a title edit",
      tx(...move({ dx: 40, dy: 0 }), { op: "set", path: "/chrome/title", value: { text: "x" } }),
    ],
    [
      "a move whose precondition no longer matches",
      tx({
        op: "set",
        path: "/annotations/0/offset",
        value: { dx: 40, dy: 0 },
        expect: { type: "text", text: "Another note" },
      }),
    ],
    [
      "an offset that is not a pair of numbers",
      tx({ op: "set", path: "/annotations/0/offset", value: { dx: "40", dy: 0 } }),
    ],
    ["an empty transaction", tx()],
  ])("refuses %s", (_name, transaction) => {
    expect(acceptedOffset(editSpec, transaction)).toBeNull();
  });

  it("leaves the spec it is given unchanged", () => {
    const before = JSON.stringify(editSpec);
    acceptedOffset(editSpec, tx(...move({ dx: 1, dy: 2 })));
    expect(JSON.stringify(editSpec)).toBe(before);
  });
});

describe("offsetLine", () => {
  it("writes the spec's offset line", () => {
    expect(offsetLine({ dx: 16, dy: 0 })).toBe('"offset": { "dx": 16, "dy": 0 }');
  });

  it("rounds to whole pixels and never writes -0", () => {
    expect(offsetLine({ dx: 131.6, dy: -0.2 })).toBe('"offset": { "dx": 132, "dy": 0 }');
    expect(offsetLine({ dx: -12.5, dy: 38.0007286012 })).toBe('"offset": { "dx": -12, "dy": 38 }');
  });

  it("starts at the spec's own offset", () => {
    expect(offsetLine(startOffset)).toBe('"offset": { "dx": 112, "dy": 8 }');
  });
});
