// Builds every OpenChart brand file from the geometry and colors below.
// Run from site/: `node brand/source/build.mjs`. Outputs are committed; rerun after
// changing anything here. Files the site serves are also copied into public/.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as fontkit from "fontkitten";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const brand = join(here, "..");
const pub = join(brand, "../public");
for (const dir of ["svg", "png", "webp"]) mkdirSync(join(brand, dir), { recursive: true });
mkdirSync(join(pub, "brand"), { recursive: true });

// ------------------------------------------------------------------ colors
// The four hues follow the chart library's categorical order (blue, ochre, rose, cyan
// are series 3, 2, 4 and 1), brightened for use as flat logo fills.
export const PALETTE = {
  light: { ink: "#101010", bar: "#3d6fe0", point: "#e8a23a", arc: "#d1458f", area: "#0a9cb5" },
  dark: { ink: "#f2f2ee", bar: "#6591e1", point: "#f9be78", arc: "#d771a4", area: "#22d3ee" },
};
const mono = (c) => ({ ink: c, bar: c, point: c, arc: c, area: c });
const PAPER = "#ffffff";
const INK_2 = "#3d3d3a";

// -------------------------------------------------------------------- mark
// Four cells, one mark each: bar, point, arc, area. `cell` is the cell edge and `gap`
// the gutter; the master is 13 + 2 + 13 = 28 units, the small cut 7 + 2 + 7 = 16 so
// every edge lands on a whole pixel at 16px.
const MASTER = { cell: 13, gap: 2 };
const SMALL = { cell: 7, gap: 2 };
const n = (v) => String(+v.toFixed(3));

function markShapes({ cell, gap }, p, { x = 0, y = 0, scale = 1 } = {}) {
  const c = cell * scale;
  const far = (cell + gap) * scale;
  const end = far + c;
  const r = c / 2;
  return [
    `<path fill="${p.bar}" d="M${n(x)} ${n(y)}h${n(c)}v${n(c)}h${n(-c)}z"/>`,
    `<circle fill="${p.point}" cx="${n(x + far + r)}" cy="${n(y + r)}" r="${n(r)}"/>`,
    `<path fill="${p.arc}" d="M${n(x)} ${n(y + far)}a${n(c)} ${n(c)} 0 0 1 ${n(c)} ${n(c)}h${n(-c)}z"/>`,
    `<path fill="${p.area}" d="M${n(x + far)} ${n(y + end)}l${n(c)} ${n(-c)}v${n(c)}z"/>`,
  ].join("");
}
const size = ({ cell, gap }) => cell * 2 + gap;

// -------------------------------------------------------------------- type
// Schibsted Grotesk, the site's sans, instanced to static cuts so glyphs can be
// outlined (see fonts/README in the brand README). No kerning is applied; tracking is
// set per use.
const fonts = {
  bold: fontkit.create(readFileSync(join(here, "fonts/SchibstedGrotesk-700.ttf"))),
  regular: fontkit.create(readFileSync(join(here, "fonts/SchibstedGrotesk-400.ttf"))),
};

/** Outlines `text` with its baseline at (x, y). Returns the path data and advance width. */
function outline(text, { font = "bold", px, tracking = 0, x = 0, y = 0 }) {
  const face = fonts[font];
  const s = px / face.unitsPerEm;
  let pen = x;
  let d = "";
  for (const ch of text) {
    const glyph = face.glyphForCodePoint(ch.codePointAt(0));
    d += glyph.path.scale(s, -s).translate(pen, y).toSVG();
    pen += glyph.advanceWidth * s + tracking * px;
  }
  return { d, width: pen - tracking * px - x, capHeight: face.capHeight * s };
}

const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(w)} ${n(h)}">${body}</svg>\n`;

// ----------------------------------------------------------------- lockups
const WORD = { px: 26, tracking: -0.025 };

function horizontal(p) {
  const m = size(MASTER);
  const word = outline("OpenChart", { ...WORD, x: m + 10, y: 0 });
  const baseline = (m + word.capHeight) / 2;
  const { d, width } = outline("OpenChart", { ...WORD, x: m + 10, y: baseline });
  return svg(m + 10 + width, m, `${markShapes(MASTER, p)}<path fill="${p.ink}" d="${d}"/>`);
}

function stacked(p) {
  const probe = outline("OpenChart", WORD);
  const w = Math.ceil(probe.width);
  const m = 56;
  const { d } = outline("OpenChart", {
    ...WORD,
    x: (w - probe.width) / 2,
    y: m + 14 + probe.capHeight,
  });
  const mark = markShapes(MASTER, p, { x: (w - m) / 2, scale: m / size(MASTER) });
  return svg(w, m + 14 + probe.capHeight, `${mark}<path fill="${p.ink}" d="${d}"/>`);
}

function wordmark(p) {
  const probe = outline("OpenChart", WORD);
  const { d } = outline("OpenChart", { ...WORD, y: probe.capHeight });
  return svg(probe.width, probe.capHeight, `<path fill="${p.ink}" d="${d}"/>`);
}

const mark = (grid, p) => svg(size(grid), size(grid), markShapes(grid, p));

/** The mark centred on a filled square, for touch and manifest icons. */
function tile(px, p, background, share) {
  const m = px * share;
  const shapes = markShapes(MASTER, p, {
    x: (px - m) / 2,
    y: (px - m) / 2,
    scale: m / size(MASTER),
  });
  return svg(px, px, `<path fill="${background}" d="M0 0h${px}v${px}H0z"/>${shapes}`);
}

// ------------------------------------------------------------ social cards
function card(w, h) {
  const p = PALETTE.light;
  const pad = 72;
  const lock = 40 / size(MASTER);
  const name = outline("OpenChart", { px: 26 * lock, tracking: -0.025, x: pad + 40 + 14, y: 0 });
  const nameY = pad + (40 + name.capHeight) / 2;
  const word = outline("OpenChart", { px: 26 * lock, tracking: -0.025, x: pad + 54, y: nameY });
  const big = h * 0.44;
  const ruleY = h - pad - 14;
  const lines = ["Charts, tables and maps", "from a JSON spec."];
  const headPx = 66;
  const headTop = ruleY - 150 - headPx * 1.1;
  const head = lines
    .map(
      (line, i) =>
        outline(line, { px: headPx, tracking: -0.02, x: pad, y: headTop + i * headPx * 1.1 }).d,
    )
    .join("");
  const url = outline("openchart.steamfield.io", {
    font: "regular",
    px: 28,
    x: pad,
    y: ruleY - 44,
  });
  const ticks = Array.from({ length: 13 }, (_, i) => {
    const x = pad + ((w - pad * 2 - 2) * i) / 12;
    return `M${n(x)} ${ruleY + 2}h2v12h-2z`;
  }).join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<path fill="${PAPER}" d="M0 0h${w}v${h}H0z"/>` +
    markShapes(MASTER, p, { x: pad, y: pad, scale: lock }) +
    `<path fill="${p.ink}" d="${word.d}${head}"/>` +
    `<path fill="${INK_2}" d="${url.d}"/>` +
    markShapes(MASTER, p, { x: w - pad - big, y: pad, scale: big / size(MASTER) }) +
    `<path fill="${p.ink}" d="M${pad} ${ruleY}h${w - pad * 2}v2h${-(w - pad * 2)}z${ticks}"/>` +
    `</svg>\n`
  );
}

// ------------------------------------------------------------------ output
const write = (path, text) => writeFileSync(join(brand, path), text);
const variants = {
  "": PALETTE.light,
  "-dark": PALETTE.dark,
  "-black": mono("#101010"),
  "-white": mono("#ffffff"),
};

const files = {};
for (const [suffix, p] of Object.entries(variants)) {
  files[`openchart-mark${suffix}`] = mark(MASTER, p);
  files[`openchart-horizontal${suffix}`] = horizontal(p);
}
for (const suffix of ["", "-dark"]) {
  files[`openchart-mark-small${suffix}`] = mark(SMALL, variants[suffix]);
  files[`openchart-stacked${suffix}`] = stacked(variants[suffix]);
}
files["openchart-wordmark"] = wordmark(PALETTE.light);
files["openchart-wordmark-white"] = wordmark(mono("#ffffff"));
for (const [name, text] of Object.entries(files)) write(`svg/${name}.svg`, text);

// The tab icon: the small cut, switching to the dark hues with the system theme.
const l = PALETTE.light;
const d = PALETTE.dark;
write(
  "favicon.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><title>OpenChart</title>` +
    `<style>.b{fill:${l.bar}}.p{fill:${l.point}}.r{fill:${l.arc}}.a{fill:${l.area}}` +
    `@media (prefers-color-scheme:dark){.b{fill:${d.bar}}.p{fill:${d.point}}.r{fill:${d.arc}}.a{fill:${d.area}}}</style>` +
    `<path class="b" d="M0 0h7v7H0z"/><circle class="p" cx="12.5" cy="3.5" r="3.5"/>` +
    `<path class="r" d="M0 9a7 7 0 0 1 7 7H0z"/><path class="a" d="M9 16l7-7v7z"/></svg>\n`,
);

/** Rasterizes an SVG string at `width` pixels, sampling the vector at that size. */
function raster(text, width) {
  const viewBoxWidth = Number(/viewBox="0 0 ([\d.]+)/.exec(text)[1]);
  return sharp(Buffer.from(text), { density: (72 * width) / viewBoxWidth }).resize({ width });
}

async function both(name, text, width) {
  await raster(text, width)
    .png()
    .toFile(join(brand, `png/${name}.png`));
  await raster(text, width)
    .webp({ lossless: true })
    .toFile(join(brand, `webp/${name}.webp`));
}

for (const suffix of ["", "-dark"]) {
  for (const px of [512, 1024])
    await both(`openchart-mark${suffix}-${px}`, files[`openchart-mark${suffix}`], px);
  await both(`openchart-horizontal${suffix}-1200`, files[`openchart-horizontal${suffix}`], 1200);
  await both(`openchart-stacked${suffix}-800`, files[`openchart-stacked${suffix}`], 800);
}

await raster(tile(180, PALETTE.light, PAPER, 0.62), 180)
  .png()
  .toFile(join(brand, "apple-touch-icon.png"));
// Manifest icons keep the mark inside the maskable safe zone (the middle 80%).
for (const px of [192, 512])
  await raster(tile(px, PALETTE.light, PAPER, 0.56), px)
    .png()
    .toFile(join(brand, `png/icon-${px}.png`));

await sharp(Buffer.from(card(1200, 630)))
  .png()
  .toFile(join(brand, "og-image.png"));
await sharp(Buffer.from(card(1200, 630)), { density: 144 })
  .png()
  .toFile(join(brand, "png/openchart-og-2400x1260.png"));
await sharp(Buffer.from(card(1280, 640)))
  .png()
  .toFile(join(brand, "png/openchart-social-1280x640.png"));

// favicon.ico: PNG-encoded entries at 16 and 32 (small cut) and 48 (master).
const entries = await Promise.all(
  [
    [16, files["openchart-mark-small"]],
    [32, files["openchart-mark-small"]],
    [48, files["openchart-mark"]],
  ].map(async ([px, text]) => ({ px, data: await raster(text, px).png().toBuffer() })),
);
const header = Buffer.alloc(6 + entries.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(entries.length, 4);
let offset = header.length;
entries.forEach(({ px, data }, i) => {
  const at = 6 + i * 16;
  header.writeUInt8(px, at);
  header.writeUInt8(px, at + 1);
  header.writeUInt16LE(1, at + 4);
  header.writeUInt16LE(32, at + 6);
  header.writeUInt32LE(data.length, at + 8);
  header.writeUInt32LE(offset, at + 12);
  offset += data.length;
});
writeFileSync(join(brand, "favicon.ico"), Buffer.concat([header, ...entries.map((e) => e.data)]));

// What the site serves.
for (const [from, to] of [
  ["favicon.svg", "favicon.svg"],
  ["favicon.ico", "favicon.ico"],
  ["apple-touch-icon.png", "apple-touch-icon.png"],
  ["og-image.png", "og-image.png"],
  ["png/icon-192.png", "icon-192.png"],
  ["png/icon-512.png", "icon-512.png"],
  ...Object.keys(files).map((name) => [`svg/${name}.svg`, `brand/${name}.svg`]),
]) {
  copyFileSync(join(brand, from), join(pub, to));
}
