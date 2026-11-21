/**
 * Places the gallery's tiles on the six-column wall at build time, in entry
 * order, so the order a reader tabs through is the order they see and no cell
 * is left empty. A lead tile, first if there is one, takes a full row. A feature
 * starts a row, takes four columns and two rows, alternating left and right, and
 * the next two standard tiles fill the column beside it. Wide tiles take four
 * columns, standard and square tiles two, and a row of squares holds only squares,
 * since a square row is taller. Any order that would leave a hole is rejected.
 */
import { shapeOf, type WallEntry } from "./tile-size";

/** Where a tile sits on the wall: 1-based grid lines and spans. */
export type Placement = { column: number; span: number; row: number; rowSpan: number };

/** Thrown when the entry order cannot fill the wall without a hole. */
export class WallLayoutError extends Error {}

const COLUMNS = 6;
const FILE = "src/lib/gallery.ts";

/**
 * Every entry's placement, by slug.
 *
 * @throws {WallLayoutError} Naming the entry where the order breaks, and why.
 */
export function arrangeWall(entries: readonly WallEntry[]): Map<string, Placement> {
  const placements = new Map<string, Placement>();
  const fail = (entry: WallEntry, why: string): never => {
    throw new WallLayoutError(`${FILE}: gallery entry "${entry.slug}" ${why}.`);
  };
  let row = 1;
  let column = 1;
  let squareRow: boolean | null = null;
  let features = 0;
  let beside: { column: number; row: number }[] = [];

  const endRow = () => {
    row += 1;
    column = 1;
    squareRow = null;
  };

  entries.forEach((entry, index) => {
    const shape = shapeOf(entry);
    if (shape === "lead") {
      if (index !== 0) fail(entry, "is a lead but not the first entry");
      placements.set(entry.slug, { column: 1, span: COLUMNS, row, rowSpan: 1 });
      endRow();
      return;
    }
    const slot = beside.shift();
    if (slot) {
      if (shape !== "standard")
        fail(entry, `is ${shape} but must be standard to sit beside a feature`);
      placements.set(entry.slug, { column: slot.column, span: 2, row: slot.row, rowSpan: 1 });
      if (beside.length === 0) endRow();
      return;
    }
    if (shape === "feature") {
      if (column !== 1) fail(entry, "is a feature but does not start a row");
      const start = features % 2 === 0;
      features += 1;
      placements.set(entry.slug, { column: start ? 1 : 3, span: 4, row, rowSpan: 2 });
      const side = start ? 5 : 1;
      beside = [
        { column: side, row },
        { column: side, row: row + 1 },
      ];
      // The second slot's row ends the pair; move on past the first row now.
      row += 1;
      return;
    }
    const width = shape === "wide" ? 4 : 2;
    if (column + width - 1 > COLUMNS) fail(entry, `is ${shape} and runs past the end of its row`);
    const square = shape === "square";
    if (squareRow !== null && squareRow !== square) {
      fail(entry, "mixes square and flat tiles in one row");
    }
    squareRow = square;
    placements.set(entry.slug, { column, span: width, row, rowSpan: 1 });
    column += width;
    if (column > COLUMNS) endRow();
  });

  const last = entries.at(-1);
  if (last && (beside.length > 0 || column !== 1)) {
    fail(last, "is the last entry but leaves its row or a feature's column unfilled");
  }
  return placements;
}
