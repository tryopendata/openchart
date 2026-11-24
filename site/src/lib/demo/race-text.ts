/** Measure static race labels from the same Schibsted Grotesk asset the site serves. */
import { readFileSync } from "node:fs";
import { estimateTextWidth, type MeasureTextFn } from "@opendata-ai/openchart-core";
import { create, type Font } from "fontkitten";

const ASSET =
  "@fontsource-variable/schibsted-grotesk/files/schibsted-grotesk-latin-wght-normal.woff2";
let regular: Font | undefined;

function face(): Font {
  if (!regular) {
    const loaded = create(readFileSync(new URL(import.meta.resolve(ASSET))));
    if (loaded.isCollection) throw new Error("Expected one face in the Schibsted Grotesk webfont.");
    regular = loaded;
  }
  return regular;
}

/** Read glyph advances for body and axis text. Use estimates for unsupported glyphs and weights. */
export const measureRaceText: MeasureTextFn = (text, size, weight = 400) => {
  const height = size * 1.2;
  if (weight !== 400) return { width: estimateTextWidth(text, size, weight), height };
  const font = face();
  let width = 0;
  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;
    width += font.hasGlyphForCodePoint(codePoint)
      ? (font.glyphForCodePoint(codePoint).advanceWidth / font.unitsPerEm) * size
      : estimateTextWidth(char, size, weight);
  }
  return { width, height };
};
