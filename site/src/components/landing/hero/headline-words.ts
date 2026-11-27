/**
 * The headline as words, so the hero can set each in its own span and stagger
 * their entrance without a script.
 */

/** One word of the headline, with its punctuation, and its place in the line. */
export type HeadlineWord = { word: string; index: number };

/** Split the headline into indexed words, keeping punctuation and dropping extra spaces. */
export function headlineWords(text: string): HeadlineWord[] {
  return text
    .split(" ")
    .filter(Boolean)
    .map((word, index) => ({ word, index }));
}
