// The animated OpenChart mark: the four shapes drop in, bounce and settle into the logo.
//
// The motion is a small ballistic simulation solved ahead of time and written out as CSS
// keyframes, so the result needs no script. Each shape falls under gravity and loses
// speed at every impact (restitution), which makes each flight an exact parabola; a
// parabola is a quadratic ease, so one keyframe per impact and apex reproduces it. Drift
// and spin lose a share at each impact too, and their starting values are solved so the
// last bounce ends on the shape's place in the mark, upright. With the animation off
// (reduced motion, or after it ends) the markup is the plain mark.
//
// build.mjs writes svg/openchart-mark-animated*.svg from this, and the stylesheet the site
// header's mark uses (src/styles/brand-mark-motion.css, for BrandMarkAnimated.astro).

/** Lengths below are in units of the 16-unit small cut and scale with the grid. */
const BASE = 16;
/** Gravity, units/s². Tuned so the first fall takes about a third of a second. */
const GRAVITY = 400;
/** A bounce lower than this is the shape coming to rest. */
const REST_HEIGHT = 0.08;
/** Vertical squash at the first impact; later impacts scale with their speed. */
const SQUASH = 0.2;
/** Share of drift and of spin a shape keeps through an impact. */
const DRIFT_KEPT = 0.6;
const SPIN_KEPT = 0.1;

const FALL = "cubic-bezier(.33,0,.67,.33)"; // quadratic ease-in: apex to floor
const RISE = "cubic-bezier(.33,.67,.67,1)"; // quadratic ease-out: floor to apex

/**
 * Per shape: the height it drops from, how much speed it keeps per bounce, how far to
 * the side it starts, how far it turns on the way (a multiple of the shape's symmetry,
 * so it lands upright) and when it lets go. The bottom row goes first and is nearly at
 * rest when the top row lands above it.
 */
const SHAPES = [
  { name: "arc", col: 0, row: 1, drop: 31, restitution: 0.5, drift: 9, spin: -360, delay: 0 },
  { name: "area", col: 1, row: 1, drop: 31, restitution: 0.42, drift: -5, spin: 360, delay: 0.1 },
  { name: "bar", col: 0, row: 0, drop: 22, restitution: 0.46, drift: -6, spin: 180, delay: 0.42 },
  { name: "point", col: 1, row: 0, drop: 22, restitution: 0.6, drift: 12, spin: 0, delay: 0.54 },
];

const n = (v) => String(+v.toFixed(3));

/**
 * Solves one shape's flight. Returns the flights between impacts (`start`, `duration`,
 * `apex` height, the `speed` it lands with) and the total time.
 */
export function flights({ drop, restitution }) {
  const fall = Math.sqrt((2 * drop) / GRAVITY);
  const list = [{ start: 0, duration: fall, apex: drop, speed: GRAVITY * fall, first: true }];
  let speed = GRAVITY * fall * restitution;
  let t = fall;
  while (speed ** 2 / (2 * GRAVITY) > REST_HEIGHT) {
    const duration = (2 * speed) / GRAVITY;
    list.push({ start: t, duration, apex: speed ** 2 / (2 * GRAVITY), speed, first: false });
    t += duration;
    speed *= restitution;
  }
  return { list, total: t };
}

/**
 * Positions at each impact for a quantity that moves at a constant rate in flight and
 * keeps `kept` of that rate through an impact, starting at `from` and ending on 0.
 */
function decay(list, from, kept) {
  const weights = list.map((f, i) => kept ** i * f.duration);
  const sum = weights.reduce((a, b) => a + b, 0);
  let left = from;
  return [from, ...weights.map((w) => (left -= (from * w) / sum))];
}

function keyframes(name, stops) {
  const body = stops
    .map(({ at, css, ease }) => {
      const timing = ease ? `;animation-timing-function:${ease}` : "";
      return `${n(at * 100)}%{${css}${timing}}`;
    })
    .join("");
  return `@keyframes ${name}{${body}}`;
}

/** The keyframes and rules for one shape, lengths scaled by `k`. */
function motion(shape, k, id) {
  const { list, total } = flights(shape);
  const at = (t) => t / total;
  const y = [];
  for (const f of list) {
    if (f.first) {
      y.push({ at: 0, css: `translate:0 ${n(-f.apex * k)}px`, ease: FALL });
      continue;
    }
    y.push({ at: at(f.start), css: "translate:0 0", ease: RISE });
    y.push({
      at: at(f.start + f.duration / 2),
      css: `translate:0 ${n(-f.apex * k)}px`,
      ease: FALL,
    });
  }
  y.push({ at: 1, css: "translate:0 0" });

  // Squash against the floor at each impact, wider as it gets shorter.
  const squash = [{ at: 0, css: "scale:1 1" }];
  list.forEach((f, i) => {
    const next = list[i + 1];
    const amount = (SQUASH * f.speed) / list[0].speed;
    if (!next || amount < 0.02) return;
    const hit = f.start + f.duration;
    squash.push({ at: at(hit - Math.min(0.03, f.duration * 0.3)), css: "scale:1 1" });
    squash.push({ at: at(hit), css: `scale:${n(1 + amount / 2)} ${n(1 - amount)}` });
    squash.push({ at: at(hit + Math.min(0.09, next.duration * 0.4)), css: "scale:1 1" });
  });
  squash.push({ at: 1, css: "scale:1 1" });

  const xs = decay(list, shape.drift * k, DRIFT_KEPT);
  const turns = decay(list, -shape.spin, SPIN_KEPT);
  const times = [0, ...list.map((f) => at(f.start + f.duration))];
  const drift = times.map((t, i) => ({
    at: t,
    css: `translate:${n(xs[i])}px 0;rotate:${n(turns[i])}deg`,
  }));
  drift[drift.length - 1].css = "translate:0 0;rotate:0deg";

  const run = `${n(total)}s ${n(shape.delay)}s backwards`;
  const css =
    keyframes(`${id}-y`, y) +
    keyframes(`${id}-s`, squash) +
    keyframes(`${id}-d`, drift) +
    `.${id}-o{animation:${id}-y ${run},${id}-s ${run} ease-out}` +
    `.${id}-i{animation:${id}-d ${run} linear}`;
  return { css, end: shape.delay + total };
}

/** Document order of the static mark. */
const ORDER = ["bar", "point", "arc", "area"];

/**
 * The stylesheet that animates the mark's markup: for each shape `name`, a group
 * `.ocb-<name>-o` that falls and squashes about the point it lands on, holding a group
 * `.ocb-<name>-i` that drifts and spins about the cell's centre, all inside a root with
 * class `ocb`. The names are global, so a page takes one copy.
 * @param {{cell?: number, gap?: number}} [grid] The small cut by default.
 */
export function bouncingMarkCss({ cell = 7, gap = 2 } = {}) {
  const k = (cell * 2 + gap) / BASE;
  const r = cell / 2;
  let css = ".ocb{overflow:visible}";
  for (const name of ORDER) {
    const shape = SHAPES.find((s) => s.name === name);
    const x = shape.col * (cell + gap);
    const y = shape.row * (cell + gap);
    const id = `ocb-${name}`;
    css +=
      motion(shape, k, id).css +
      `.${id}-o{transform-origin:${n(x + r)}px ${n(y + cell)}px}` +
      `.${id}-i{transform-origin:${n(x + r)}px ${n(y + r)}px}`;
  }
  return `${css}@media (prefers-reduced-motion:reduce){.ocb g{animation:none}}`;
}

/**
 * The animated mark as one self-contained SVG string, stylesheet included.
 * @param {{bar: string, point: string, arc: string, area: string}} palette Fill per shape.
 * @param {{cell?: number, gap?: number, title?: string}} [options] `cell` and `gap` pick
 *   the grid (the small cut by default); `title` names the image, and without it the SVG
 *   is hidden from assistive technology.
 */
export function bouncingMark(palette, { cell = 7, gap = 2, title = "" } = {}) {
  const size = cell * 2 + gap;
  const far = cell + gap;
  const r = cell / 2;
  const draw = {
    bar: `<path fill="${palette.bar}" d="M0 0h${n(cell)}v${n(cell)}h${n(-cell)}z"/>`,
    point: `<circle fill="${palette.point}" cx="${n(far + r)}" cy="${n(r)}" r="${n(r)}"/>`,
    arc: `<path fill="${palette.arc}" d="M0 ${n(far)}a${n(cell)} ${n(cell)} 0 0 1 ${n(cell)} ${n(cell)}h${n(-cell)}z"/>`,
    area: `<path fill="${palette.area}" d="M${n(far)} ${n(size)}l${n(cell)} ${n(-cell)}v${n(cell)}z"/>`,
  };
  const body = ORDER.map(
    (name) => `<g class="ocb-${name}-o"><g class="ocb-${name}-i">${draw[name]}</g></g>`,
  ).join("");
  const label = title ? `role="img"><title>${title}</title>` : `aria-hidden="true">`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(size)} ${n(size)}" class="ocb" ${label}` +
    `<style>${bouncingMarkCss({ cell, gap })}</style>${body}</svg>`
  );
}

/** Seconds from load until the last shape is at rest. */
export function bouncingMarkDuration() {
  return Math.max(...SHAPES.map((s) => s.delay + flights(s).total));
}
