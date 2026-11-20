/**
 * Turns an MDX page body into plain Markdown for the exports: the ESM import
 * block goes, and each `<Demo id="..." />` outside fenced code becomes its spec
 * as a json fence. Text inside fences is left exactly as written.
 */

/** Looks up a demo's spec by id, for inlining `<Demo />` into Markdown exports. */
export type DemoSpecLookup = (id: string) => unknown;

/** Thrown when a page's `<Demo />` tag cannot become a spec in its Markdown export. */
export class DemoExportError extends Error {}

/** A run of body lines: prose outside any fence, or one fence from opener to closer. */
type Segment = { fenced: boolean; text: string };

const IMPORT_LINE = /^import\s/;
const FENCE_MARKER = /^\s*(`{3,}|~{3,})/;
/** A self-closing Demo tag, which may wrap across lines. */
const DEMO_TAG = /<Demo\b[^>]*?\/>/g;
/** The id attribute, written `id="x"` or `id={"x"}`. */
const DEMO_ID = /\bid=(?:"([^"]+)"|\{\s*"([^"]+)"\s*\})/;
const DEMO_OPENING = /<Demo\b/;

/** The body without the ESM import block MDX pages open with; later lines are kept as written. */
function withoutLeadingImports(lines: readonly string[]): string[] {
  const firstContent = lines.findIndex((line) => line.trim() !== "" && !IMPORT_LINE.test(line));
  return firstContent === -1 ? [] : lines.slice(firstContent);
}

/** True when `marker` closes a fence opened by `opener`: the same character, at least as long. */
function closesFence(opener: string, marker: string): boolean {
  return marker[0] === opener[0] && marker.length >= opener.length;
}

/** Splits lines into prose segments and fence segments, each fence from opener to closer. */
function segments(lines: readonly string[]): Segment[] {
  const result: Segment[] = [];
  let current: string[] = [];
  let openFence: string | undefined;
  const flush = (fenced: boolean) => {
    if (current.length > 0) result.push({ fenced, text: current.join("\n") });
    current = [];
  };
  for (const line of lines) {
    const marker = FENCE_MARKER.exec(line)?.[1];
    if (!openFence && marker) {
      flush(false);
      openFence = marker;
    }
    current.push(line);
    // The opener is the segment's first line, so only a later line can close it.
    if (openFence && marker && current.length > 1 && closesFence(openFence, marker)) {
      flush(true);
      openFence = undefined;
    }
  }
  flush(openFence !== undefined);
  return result;
}

/**
 * The spec fence for one Demo tag.
 *
 * @throws {DemoExportError} When the tag has no id or the lookup fails; the lookup's error is the cause.
 */
function demoFence(pageId: string, tag: string, demoSpec: DemoSpecLookup): string {
  const match = DEMO_ID.exec(tag);
  const id = match?.[1] ?? match?.[2];
  if (id === undefined) {
    throw new DemoExportError(
      `Docs page "${pageId}" has a Demo tag without an id: ${tag}. Write <Demo id="group/name" />.`,
    );
  }
  let spec: unknown;
  try {
    spec = demoSpec(id);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new DemoExportError(`Docs page "${pageId}" shows demo "${id}": ${reason}`, {
      cause: error,
    });
  }
  return `\`\`\`json\n${JSON.stringify(spec, null, 2)}\n\`\`\``;
}

/**
 * Prose with each Demo tag replaced by its spec.
 *
 * @throws {DemoExportError} When a tag cannot be replaced, or a `<Demo` that is not a
 * self-closing tag remains.
 */
function inlineDemos(pageId: string, prose: string, demoSpec: DemoSpecLookup): string {
  const inlined = prose.replace(DEMO_TAG, (tag) => demoFence(pageId, tag, demoSpec));
  const leftover = DEMO_OPENING.exec(inlined);
  if (leftover) {
    const line = inlined.slice(leftover.index).split("\n")[0];
    throw new DemoExportError(
      `Docs page "${pageId}" has a Demo tag the Markdown export cannot read: ${line}. Write <Demo id="group/name" />.`,
    );
  }
  return inlined;
}

/**
 * MDX source as plain Markdown: the import block removed, each `<Demo id="x" />`
 * outside fenced code replaced by its spec as a json fence.
 *
 * @param pageId The page's id, named in every error.
 * @throws {DemoExportError} When a Demo tag has no id, names an unknown demo, or is
 * not written as a self-closing tag.
 */
export function mdxToMarkdown(pageId: string, body: string, demoSpec: DemoSpecLookup): string {
  return segments(withoutLeadingImports(body.split("\n")))
    .map((segment) => (segment.fenced ? segment.text : inlineDemos(pageId, segment.text, demoSpec)))
    .join("\n");
}
