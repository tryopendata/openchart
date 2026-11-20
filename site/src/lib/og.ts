/**
 * The social card satori renders for each page, in the site's light theme: ink on
 * white over an axis rule. satori lays out flexbox only (no grid) and reads TTF, OTF
 * or WOFF fonts, never WOFF2, so cards use Inter from @fontsource/inter instead of
 * the site's variable sans, which ships as WOFF2 only.
 */
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

/** The text one card shows. */
export type Card = { title: string; description: string; siteName: string };
type Node = { type: string; props: { style?: Record<string, unknown>; children?: unknown } };

const INK = "#101010";
const INK_2 = "#3d3d3a";
const TICKS = 13;

const div = (style: Record<string, unknown>, children?: unknown): Node => ({
  type: "div",
  props: { style, children },
});

/** Clips text to `max` characters on a word boundary so long titles never overflow the card. */
export function clip(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : cut.length)}…`;
}

/** The site's section rule: a 2px ink line with evenly spaced ticks hanging from it. */
function axisRule(): Node {
  const tick = div({ width: "2px", height: "12px", background: INK });
  return div({ display: "flex", flexDirection: "column", width: "100%" }, [
    div({ width: "100%", height: "2px", background: INK }),
    div(
      { display: "flex", justifyContent: "space-between", width: "100%" },
      Array.from({ length: TICKS }, () => tick),
    ),
  ]);
}

/** The card's element tree, ready for satori. */
export function ogCard({ title, description, siteName }: Card): Node {
  return div(
    {
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: "72px",
      background: "#ffffff",
      color: INK,
      fontFamily: "Inter",
    },
    [
      div({ fontSize: 30, fontWeight: 700, letterSpacing: "-0.01em" }, siteName),
      div({ display: "flex", flexDirection: "column", gap: "24px" }, [
        div(
          { fontSize: 68, fontWeight: 700, lineHeight: 1.08, letterSpacing: "-0.02em" },
          clip(title, 80),
        ),
        div({ fontSize: 30, color: INK_2, lineHeight: 1.4 }, clip(description, 160)),
      ]),
      axisRule(),
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
