/**
 * The headline as words, so the hero can set each in its own span and stagger
 * their entrance without a script.
 */

/** One word of the headline, with its punctuation, and its place in the line. */
export type HeadlineWord = { word: string; index: number };

/** The headline's words in order; joining them with single spaces gives the text back. */
export function headlineWords(_text: string): HeadlineWord[] {
  throw new Error("headlineWords is not implemented.");
}
