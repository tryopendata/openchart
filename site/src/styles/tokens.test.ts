/**
 * Checks the color tokens in global.css against WCAG AA, reading the stylesheet the
 * site ships, so a token change that breaks contrast fails here before axe sees it.
 * @vitest-environment node
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Read from disk: a ?raw import of a .css file comes back empty under Vitest's CSS handling.
const css = readFileSync(fileURLToPath(new URL("./global.css", import.meta.url)), "utf8");

type Tokens = Record<string, string>;

/** The `--color-*` declarations inside the first block that `opener` matches. */
function tokensIn(opener: RegExp): Tokens {
  const start = css.search(opener);
  if (start < 0) throw new Error(`global.css has no block matching ${opener}`);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries(
    [...body.matchAll(/--color-([\w-]+):\s*(#[0-9a-f]{6})/gi)].map(([, name, hex]) => [
      name ?? "",
      hex ?? "",
    ]),
  );
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((at) =>
    channel(Number.parseInt(hex.slice(at, at + 2), 16)),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

const light = tokensIn(/@theme static \{/);
const dark = tokensIn(/\.dark \{/);
const noScriptDark = tokensIn(/:root:not\(\.light\) \{/);
const themes = [
  ["light", light],
  ["dark", dark],
] as const;

describe.each(themes)("the %s theme", (_name, tokens) => {
  const color = (name: string) => {
    const value = tokens[name];
    if (!value) throw new Error(`Token --color-${name} is missing`);
    return value;
  };

  it.each(
    ["ink", "ink-2", "muted", "accent"].flatMap((text) => [
      [text, "canvas"],
      [text, "panel"],
    ]),
  )("%s on %s reaches 4.5:1", (text, surface) => {
    expect(contrast(color(text), color(surface))).toBeGreaterThanOrEqual(4.5);
  });

  it("accent-ink on the accent reaches 4.5:1", () => {
    expect(contrast(color("accent-ink"), color("accent"))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["canvas", "panel"])("line-strong on %s reaches 3:1", (surface) => {
    expect(contrast(color("line-strong"), color(surface))).toBeGreaterThanOrEqual(3);
  });
});

describe("the no-JavaScript dark fallback", () => {
  it("carries the same tokens as the dark theme", () => {
    expect(noScriptDark).toEqual(dark);
  });
});
