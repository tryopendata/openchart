/**
 * The animated mark's motion (brand/source/bouncing-mark.mjs, drawn in the header by
 * BrandMarkAnimated.astro): every shape must come to rest exactly on the static mark,
 * and the flight must behave like a bounce.
 */
import { readFileSync } from "node:fs";
import {
  bouncingMark,
  bouncingMarkCss,
  bouncingMarkDuration,
  flights,
} from "../../brand/source/bouncing-mark.mjs";

const palette = { bar: "#111", point: "#222", arc: "#333", area: "#444" };
const svg = bouncingMark(palette);

/** The last stop of each `@keyframes` block, by animation name. */
function finalStops(markup: string) {
  return [...markup.matchAll(/@keyframes ([\w-]+)\{.*?100%\{([^}]*)\}\}/g)].map((match) => ({
    name: match[1] ?? "",
    css: match[2] ?? "",
  }));
}

describe("bouncingMark", () => {
  it("draws the four shapes of the static small mark", () => {
    const body = svg.replace(/<style>.*<\/style>/, "");
    expect(body).toContain('d="M0 0h7v7h-7z"');
    expect(body).toContain('cx="12.5" cy="3.5" r="3.5"');
    expect(body).toContain('d="M0 9a7 7 0 0 1 7 7h-7z"');
    expect(body).toContain('d="M9 16l7 -7v7z"');
    expect(svg).toContain('class="ocb" aria-hidden="true"');
  });

  it("ends every animation with the shape in place, upright and unscaled", () => {
    const stops = finalStops(svg);
    expect(stops).toHaveLength(12);
    for (const { name, css } of stops) {
      if (name.endsWith("-s")) expect(css).toBe("scale:1 1");
      else if (name.endsWith("-d")) expect(css).toBe("translate:0 0;rotate:0deg");
      else expect(css).toBe("translate:0 0");
    }
  });

  it("holds each shape at its start until its turn, and leaves nothing applied after", () => {
    expect(svg.match(/backwards/g)).toHaveLength(12);
    expect(svg).not.toMatch(/forwards|infinite/);
  });

  it("turns the motion off for readers who prefer reduced motion", () => {
    expect(svg).toContain("@media (prefers-reduced-motion:reduce){.ocb g{animation:none}}");
  });

  it("is the stylesheet the site header uses, around the same shapes", () => {
    const sheet = readFileSync("src/styles/brand-mark-motion.css", "utf8");
    expect(sheet).toContain(bouncingMarkCss());
    expect(svg).toContain(`<style>${bouncingMarkCss()}</style>`);
    const header = readFileSync("src/layouts/BrandMarkAnimated.astro", "utf8");
    for (const name of ["bar", "point", "arc", "area"]) {
      expect(header).toContain(`class="ocb-${name}-o"`);
      expect(header).toContain(`class="ocb-${name}-i"`);
    }
  });

  it("names the image when given a title", () => {
    expect(bouncingMark(palette, { title: "OpenChart" })).toContain(
      'role="img"><title>OpenChart</title>',
    );
  });
});

describe("flights", () => {
  const { list, total } = flights({ drop: 22, restitution: 0.5 });

  it("bounces lower and shorter each time, a quarter the height at half the speed", () => {
    expect(list.length).toBeGreaterThan(2);
    expect(list[1]?.apex).toBeCloseTo(22 / 4);
    for (let i = 2; i < list.length; i++) {
      expect(list[i]?.apex).toBeCloseTo((list[i - 1]?.apex ?? 0) / 4);
      expect(list[i]?.duration).toBeCloseTo((list[i - 1]?.duration ?? 0) / 2);
    }
  });

  it("runs the flights back to back", () => {
    const last = list.at(-1);
    expect((last?.start ?? 0) + (last?.duration ?? 0)).toBeCloseTo(total);
  });

  it("settles the whole mark within two seconds", () => {
    expect(bouncingMarkDuration()).toBeLessThan(2);
  });
});
