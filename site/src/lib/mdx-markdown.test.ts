/** MDX bodies as Markdown: Demo tags become spec fences, and every failure names page and demo. */
import { describe, expect, it } from "vitest";
import { DemoExportError, mdxToMarkdown } from "./mdx-markdown";

const PAGE = "comparison/bar";
const SPEC = { mark: "bar", data: [{ a: 1 }] };
const SPEC_FENCE = `\`\`\`json\n${JSON.stringify(SPEC, null, 2)}\n\`\`\``;

/** A lookup that knows one demo and throws like the registry for any other. */
function lookup(id: string): unknown {
  if (id === "comparison/bar-basic") return SPEC;
  throw new Error(`No demo has the id "${id}".`);
}

function exportError(body: string): DemoExportError {
  try {
    mdxToMarkdown(PAGE, body, lookup);
  } catch (error) {
    if (error instanceof DemoExportError) return error;
    throw error;
  }
  throw new Error("mdxToMarkdown did not throw");
}

describe("mdxToMarkdown", () => {
  it.each([
    ["on one line", '<Demo id="comparison/bar-basic" />'],
    ["wrapped across lines", '<Demo\n  id="comparison/bar-basic"\n  tabs={false}\n/>'],
    ["with the id as an expression", '<Demo id={"comparison/bar-basic"} />'],
    ["with the id last", '<Demo tabs={false} id="comparison/bar-basic"/>'],
  ])("replaces a Demo tag %s with its spec", (_case, tag) => {
    expect(mdxToMarkdown(PAGE, `Intro.\n\n${tag}\n\nOutro.`, lookup)).toBe(
      `Intro.\n\n${SPEC_FENCE}\n\nOutro.`,
    );
  });

  it("leaves Demo tags inside fences alone, even an unknown one", () => {
    const fenced = '```mdx\n<Demo id="nope/nope" />\n<Demo\n```';
    expect(mdxToMarkdown(PAGE, `${fenced}\n\n<Demo id="comparison/bar-basic" />`, lookup)).toBe(
      `${fenced}\n\n${SPEC_FENCE}`,
    );
  });

  it("names the page and the demo when the lookup fails, keeping the lookup's error", () => {
    const error = exportError('<Demo id="comparison/nope" />');
    expect(error.message).toBe(
      'Docs page "comparison/bar" shows demo "comparison/nope": No demo has the id "comparison/nope".',
    );
    expect(error.cause).toBeInstanceOf(Error);
    expect((error.cause as Error).message).toBe('No demo has the id "comparison/nope".');
  });

  it.each([
    ["has no id", "<Demo tabs={false} />", /Demo tag without an id: <Demo tabs=\{false\} \/>/],
    ["is not self-closing", '<Demo id="comparison/bar-basic">', /cannot read: <Demo id=/],
    ["uses a variable id", "<Demo id={demoId} />", /Demo tag without an id/],
  ])("throws naming the page when a Demo tag %s", (_case, body, message) => {
    const error = exportError(`Intro.\n\n${body}\n`);
    expect(error.message).toContain('Docs page "comparison/bar"');
    expect(error.message).toMatch(message);
  });

  it("drops the leading import block and keeps later lines that start with import", () => {
    const body = 'import Demo from "../Demo.astro";\n\nText.\n\nimport is a keyword.';
    expect(mdxToMarkdown(PAGE, body, lookup)).toBe("Text.\n\nimport is a keyword.");
  });
});
