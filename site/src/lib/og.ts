// The social card satori renders for each page. satori lays out flexbox only
// (no grid) and reads TTF, OTF or WOFF fonts, never WOFF2.
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

export type Card = { title: string; description: string; siteName: string };
type Node = { type: string; props: { style?: Record<string, unknown>; children?: unknown } };

const div = (style: Record<string, unknown>, children: unknown): Node => ({
  type: "div",
  props: { style, children },
});

/** Clips text to `max` characters on a word boundary so long titles never overflow the card. */
export function clip(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : cut.length)}…`;
}

export function ogCard({ title, description, siteName }: Card): Node {
  return div(
    {
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: "72px",
      background: "#0b1120",
      color: "#f8fafc",
      fontFamily: "Inter",
    },
    [
      div({ fontSize: 32, color: "#93c5fd", fontWeight: 700 }, siteName),
      div({ display: "flex", flexDirection: "column", gap: "24px" }, [
        div({ fontSize: 68, fontWeight: 700, lineHeight: 1.1 }, clip(title, 80)),
        div({ fontSize: 30, color: "#cbd5e1", lineHeight: 1.4 }, clip(description, 160)),
      ]),
    ],
  );
}

/** Inter from the installed @fontsource package, read at build time; nothing is fetched. */
export async function ogFonts() {
  const require = createRequire(import.meta.url);
  const load = (weight: 400 | 700) =>
    readFile(require.resolve(`@fontsource/inter/files/inter-latin-${weight}-normal.woff`));
  const [regular, bold] = await Promise.all([load(400), load(700)]);
  return [
    { name: "Inter", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Inter", data: bold, weight: 700 as const, style: "normal" as const },
  ];
}
