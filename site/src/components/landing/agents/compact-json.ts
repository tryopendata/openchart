/**
 * JSON written the way a person lays out a spec: an object or array that fits
 * on one line stays on one line, and only the ones that don't break across
 * lines, indented two spaces. The agent transcript shows specs this way so a
 * whole spec reads in a dozen lines.
 */

/** The widest a line may run, indentation included, before a value breaks across lines. */
const MAX_LINE = 76;

function inline(value: unknown): string {
  if (Array.isArray(value)) {
    return value.length === 0 ? "[]" : `[${value.map(inline).join(", ")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return "{}";
    return `{ ${entries.map(([key, v]) => `${JSON.stringify(key)}: ${inline(v)}`).join(", ")} }`;
  }
  return JSON.stringify(value);
}

function format(value: unknown, indent: number, prefix: string): string {
  const flat = inline(value);
  if (indent + prefix.length + flat.length <= MAX_LINE || value === null || typeof value !== "object") {
    return flat;
  }
  const pad = " ".repeat(indent + 2);
  const close = " ".repeat(indent);
  if (Array.isArray(value)) {
    const items = value.map((item) => `${pad}${format(item, indent + 2, "")}`);
    return `[\n${items.join(",\n")}\n${close}]`;
  }
  const items = Object.entries(value)
    .filter(([, v]) => v !== undefined)
    .map(([key, v]) => {
      const name = `${JSON.stringify(key)}: `;
      return `${pad}${name}${format(v, indent + 2, name)}`;
    });
  return `{\n${items.join(",\n")}\n${close}}`;
}

/** The value as compact, readable JSON. Parsing the result gives the value back. */
export function compactJson(value: unknown): string {
  return format(value, 0, "");
}
