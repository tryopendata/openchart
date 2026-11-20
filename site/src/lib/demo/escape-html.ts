/**
 * Escaping for text placed in the demo figure's HTML strings, which are built
 * by hand because the `json demo` fence cannot render an Astro component.
 */

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** The text with `&`, `<`, `>` and both quotes escaped, safe in element content and attribute values. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

/**
 * The text with only `&` and `<` escaped: enough for element content, and much
 * shorter than `escapeHtml` for code, whose quotes stay as written. Not safe in
 * attribute values.
 */
export function escapeElementText(text: string): string {
  return text.replace(/[&<]/g, (char) => ESCAPES[char] ?? char);
}
