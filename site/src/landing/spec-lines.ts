/**
 * Turns a chart spec into the lines the hero's spec pane shows, and marks the
 * lines one step adds to the step before it. The formatting is fixed so a line
 * written by an early step reads the same in every later step: containers nested
 * fewer than three levels deep always break onto their own lines, deeper
 * containers of plain values sit on one line, the root's `data` folds to a row
 * count, and a root key named in `folds` (the theme preset) folds to one line
 * that keeps its full lines behind it for a reader who opens it.
 */

/** What a token is, which decides how the pane colors it. */
export type SpecTokenKind = "key" | "string" | "number" | "literal" | "punct" | "fold";

/** One run of text on a line. */
export type SpecToken = { kind: SpecTokenKind; text: string };

/**
 * One line of the formatted spec. `text` is the tokens joined, with no
 * indentation. A folded line carries the lines it stands for in `folded`.
 */
export type SpecLine = { depth: number; tokens: SpecToken[]; text: string; folded?: SpecLine[] };

/** A line of the formatted spec, and whether the step being shown added it. */
export type MarkedSpecLine = SpecLine & { added: boolean };

/** Root keys to fold, each with the words its folded line shows: `{ theme: "broadsheet preset" }`. */
export type SpecFolds = Readonly<Record<string, string>>;

/** Containers at this depth or deeper are written on one line when they hold only plain values. */
const INLINE_FROM_DEPTH = 3;

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const isContainer = (value: unknown): value is Json[] | { [key: string]: Json } =>
  typeof value === "object" && value !== null;

function scalarToken(value: unknown): SpecToken {
  if (typeof value === "string") return { kind: "string", text: JSON.stringify(value) };
  if (typeof value === "number") return { kind: "number", text: JSON.stringify(value) };
  return { kind: "literal", text: JSON.stringify(value) };
}

const punct = (text: string): SpecToken => ({ kind: "punct", text });
const keyToken = (key: string): SpecToken => ({ kind: "key", text: JSON.stringify(key) });

/** A container of plain values as tokens on one line: `{ "a": 1 }` or `["x", "y"]`. */
function inlineTokens(value: Json[] | { [key: string]: Json }): SpecToken[] {
  if (Array.isArray(value)) {
    if (value.length === 0) return [punct("[]")];
    const items = value.flatMap((item, index) => [
      ...(index > 0 ? [punct(", ")] : []),
      scalarToken(item),
    ]);
    return [punct("["), ...items, punct("]")];
  }
  const entries = Object.entries(value);
  if (entries.length === 0) return [punct("{}")];
  const fields = entries.flatMap(([key, item], index) => [
    punct(index > 0 ? ", " : " "),
    keyToken(key),
    punct(": "),
    scalarToken(item),
  ]);
  return [punct("{"), ...fields, punct(" }")];
}

const holdsOnlyScalars = (value: Json[] | { [key: string]: Json }) =>
  Object.values(value).every((item) => !isContainer(item));

function makeLine(depth: number, tokens: SpecToken[], folded?: SpecLine[]): SpecLine {
  const text = tokens.map((token) => token.text).join("");
  return folded ? { depth, tokens, text, folded } : { depth, tokens, text };
}

/** The rows a folded `data` value shows instead of its contents. */
function rowCount(value: unknown): string {
  const count = Array.isArray(value) ? value.length : 0;
  return `[ … ${count} ${count === 1 ? "row" : "rows"} ]`;
}

/**
 * Writes `value` as lines, the first starting with `lead` (the key, if any).
 * `depth` is how many containers enclose the value.
 */
function writeValue(
  value: Json,
  depth: number,
  lead: SpecToken[],
  trailingComma: boolean,
  lines: SpecLine[],
  folds: SpecFolds,
): void {
  const comma = trailingComma ? [punct(",")] : [];
  if (!isContainer(value)) {
    lines.push(makeLine(depth, [...lead, scalarToken(value), ...comma]));
    return;
  }
  if (depth >= INLINE_FROM_DEPTH && holdsOnlyScalars(value)) {
    lines.push(makeLine(depth, [...lead, ...inlineTokens(value), ...comma]));
    return;
  }
  const [open, close] = Array.isArray(value) ? ["[", "]"] : ["{", "}"];
  lines.push(makeLine(depth, [...lead, punct(open)]));
  const entries: [string | null, Json][] = Array.isArray(value)
    ? value.map((item) => [null, item])
    : Object.entries(value);
  entries.forEach(([key, item], index) => {
    const childComma = index === entries.length - 1 ? [] : [punct(",")];
    const keyLead = key === null ? [] : [keyToken(key), punct(": ")];
    const atRoot = depth === 0 && key !== null;
    if (atRoot && key === "data") {
      lines.push(makeLine(1, [...keyLead, { kind: "fold", text: rowCount(item) }, ...childComma]));
      return;
    }
    const foldLabel = atRoot ? folds[key] : undefined;
    if (foldLabel !== undefined) {
      const hidden: SpecLine[] = [];
      writeValue(item, 1, keyLead, childComma.length > 0, hidden, folds);
      const fold = { kind: "fold" as const, text: `{ … ${foldLabel} }` };
      lines.push(makeLine(1, [...keyLead, fold, ...childComma], hidden));
      return;
    }
    writeValue(item, depth + 1, keyLead, childComma.length > 0, lines, folds);
  });
  lines.push(makeLine(depth, [punct(close), ...comma]));
}

/** The spec as the pane shows it, one entry per line, with `data` and any `folds` keys folded. */
export function formatSpec(spec: object, folds: SpecFolds = {}): SpecLine[] {
  const lines: SpecLine[] = [];
  writeValue(JSON.parse(JSON.stringify(spec)) as Json, 0, [], false, lines, folds);
  return lines;
}

/**
 * A line as compared across steps: its depth and text, where a comma that
 * appears once a sibling follows does not make the line new.
 */
const comparable = (line: SpecLine) => `${line.depth}:${line.text.replace(/,$/, "")}`;

/** Lines of only brackets carry nothing a reader would call added. */
const isBracketOnly = (line: SpecLine) => /^[[\]{}]+,?$/.test(line.text);

/**
 * Marks the lines of `current` that are not in `previous`, by a longest common
 * subsequence over the lines, so a repeated line (two `"type": "quantitative"`)
 * counts as added only where it is new. Bracket-only lines are never marked.
 */
export function markAddedLines(previous: SpecLine[], current: SpecLine[]): MarkedSpecLine[] {
  const before = previous.map(comparable);
  const after = current.map(comparable);
  // common(i, j): the longest common subsequence of before[i..] and after[j..].
  const width = after.length + 1;
  const table = new Array<number>((before.length + 1) * width).fill(0);
  const common = (i: number, j: number) => table[i * width + j] ?? 0;
  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      table[i * width + j] =
        before[i] === after[j]
          ? common(i + 1, j + 1) + 1
          : Math.max(common(i + 1, j), common(i, j + 1));
    }
  }
  const kept = new Set<number>();
  let i = 0;
  let j = 0;
  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) {
      kept.add(j);
      i += 1;
      j += 1;
    } else if (common(i + 1, j) >= common(i, j + 1)) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return current.map((line, index) => ({
    ...line,
    added: !kept.has(index) && !isBracketOnly(line),
  }));
}

/** A line's identity in the pane: its depth and text. Tests and the pane compare lines by it. */
export const lineKey = (line: Pick<SpecLine, "depth" | "text">) => `${line.depth}:${line.text}`;
