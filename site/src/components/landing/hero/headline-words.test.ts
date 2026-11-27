import { describe, expect, it } from "vitest";
import { headlineWords } from "./headline-words";

describe("headlineWords", () => {
  const text = "Charts, maps and tables that arrive ready to publish.";

  it("splits on spaces and keeps punctuation with its word", () => {
    const words = headlineWords(text);
    expect(words[0]).toEqual({ word: "Charts,", index: 0 });
    expect(words.at(-1)).toEqual({ word: "publish.", index: 8 });
    expect(words).toHaveLength(9);
  });

  it("joins back to the text", () => {
    expect(
      headlineWords(text)
        .map((entry) => entry.word)
        .join(" "),
    ).toBe(text);
  });

  it("ignores extra spaces and gives nothing for an empty headline", () => {
    expect(headlineWords("  Two   words ").map((entry) => entry.word)).toEqual(["Two", "words"]);
    expect(headlineWords("")).toEqual([]);
  });
});
