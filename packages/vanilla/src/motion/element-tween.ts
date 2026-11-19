/**
 * Keyed element tween (Seam B): the update/exit motion shared by the mounts
 * that aren't driven by the chart transition driver (bar list, tile map,
 * sankey, geo map).
 *
 * Each adapter builds a list of {@link ElementTween}s from its previous and
 * next layouts (the map from its DOM-attribute snapshot), after the new root
 * is rendered in its final state. This module owns the timing, the
 * synchronous from-state, the rAF loop, ghosts, and cancellation. It never
 * measures the DOM.
 *
 * Timing comes from core's `updateTimeline`: removal ghosts fade first,
 * survivors hold until the exit clears (only when something is removed),
 * entering elements fade in alongside the tail of the survivors' motion.
 * Survivor geometry samples `sampleMotion(update, …)`, so curve and spring
 * phases both work and values never overshoot.
 */

import {
  evalValueCurve,
  FADE_CURVE,
  type MotionPhase,
  sampleMotion,
  updateTimeline,
} from '@opendata-ai/openchart-core';
import { interpolateRgb, interpolateString } from 'd3-interpolate';
import { prefersReducedMotion } from './tween';

/** One element property moving from its previous to its final value. */
export type ElementTween =
  | { kind: 'number'; el: Element; attr: string; from: number; to: number }
  /** `style: true` writes an inline style property instead of an attribute. */
  | { kind: 'color'; el: Element; attr: string; from: string; to: string; style?: boolean }
  /** Interpolates the numbers in place; snaps when the command letters differ. */
  | { kind: 'path'; el: Element; attr: 'd'; from: string; to: string }
  /** The element starts displaced by (dx, dy) and slides home. Composes with its own `transform`. */
  | { kind: 'offset'; el: Element; dx: number; dy: number }
  /** Fades in over the update's enter slot. */
  | { kind: 'enter'; el: Element }
  /** Fades out over the exit phase, then is removed. */
  | { kind: 'exit'; ghost: Element };

export interface ElementTweenOptions {
  update: MotionPhase;
  /** Removal fade. Null or omitted: ghosts vanish at once (`exit: false`). */
  exit?: MotionPhase | null;
  /** Snap when more distinct elements than this would move. No cap when omitted. */
  maxMarks?: number;
}

export interface ElementTweenHandle {
  readonly running: boolean;
  /** Snap every element to its final state and remove ghosts. */
  cancel(): void;
  /** Resolves when the tween finishes or is cancelled. */
  readonly finished: Promise<void>;
}

/** A prepared tween: write progress, or write the final state. */
interface Track {
  slot: 'update' | 'enter' | 'exit';
  apply(p: number): void;
  final(): void;
}

const PATH_COMMANDS = /[MmLlHhVvCcSsQqTtAaZz]/g;

function commandsOf(d: string): string {
  return (d.match(PATH_COMMANDS) ?? []).join('');
}

function isPaintRef(value: string): boolean {
  return value.trim().startsWith('url(');
}

function writeColor(el: Element, attr: string, value: string, style: boolean | undefined): void {
  if (style) (el as Element & ElementCSSInlineStyle).style.setProperty(attr, value);
  else el.setAttribute(attr, value);
}

/** Restore an attribute captured before the tween touched it. */
function restoreAttr(el: Element, attr: string, value: string | null): void {
  if (value === null) el.removeAttribute(attr);
  else el.setAttribute(attr, value);
}

function baseOpacity(el: Element): number {
  const raw = el.getAttribute('opacity');
  const n = raw === null ? 1 : Number(raw);
  return Number.isFinite(n) ? n : 1;
}

function toTrack(tween: ElementTween): Track {
  switch (tween.kind) {
    case 'number': {
      const { el, attr, from, to } = tween;
      return {
        slot: 'update',
        apply: (p) => el.setAttribute(attr, String(from + (to - from) * p)),
        final: () => el.setAttribute(attr, String(to)),
      };
    }
    case 'color': {
      const { el, attr, from, to, style } = tween;
      const final = () => writeColor(el, attr, to, style);
      // Pattern/gradient references can't be interpolated as RGB (it yields
      // black), and the old reference may point at a removed def.
      if (from === to || isPaintRef(from) || isPaintRef(to)) {
        return { slot: 'update', apply: () => {}, final };
      }
      const interp = interpolateRgb(from, to);
      return { slot: 'update', apply: (p) => writeColor(el, attr, interp(p), style), final };
    }
    case 'path': {
      const { el, attr, from, to } = tween;
      const final = () => el.setAttribute(attr, to);
      if (from === to || commandsOf(from) !== commandsOf(to)) {
        return { slot: 'update', apply: () => {}, final };
      }
      const interp = interpolateString(from, to);
      return { slot: 'update', apply: (p) => el.setAttribute(attr, interp(p)), final };
    }
    case 'offset': {
      const { el, dx, dy } = tween;
      const base = el.getAttribute('transform');
      const prefix = base ? `${base} ` : '';
      return {
        slot: 'update',
        apply: (p) =>
          el.setAttribute('transform', `${prefix}translate(${dx * (1 - p)}, ${dy * (1 - p)})`),
        final: () => restoreAttr(el, 'transform', base),
      };
    }
    case 'enter': {
      const { el } = tween;
      const base = el.getAttribute('opacity');
      const target = baseOpacity(el);
      return {
        slot: 'enter',
        apply: (p) => el.setAttribute('opacity', String(target * p)),
        final: () => restoreAttr(el, 'opacity', base),
      };
    }
    case 'exit': {
      const { ghost } = tween;
      const start = baseOpacity(ghost);
      return {
        slot: 'exit',
        apply: (p) => ghost.setAttribute('opacity', String(start * (1 - p))),
        final: () => removeGhost(ghost),
      };
    }
  }
}

function targetOf(tween: ElementTween): Element {
  return tween.kind === 'exit' ? tween.ghost : tween.el;
}

function settledHandle(): ElementTweenHandle {
  return { running: false, cancel: () => {}, finished: Promise.resolve() };
}

/**
 * Run `tweens` over one update transition. Every from-state is written
 * synchronously, so the first painted frame never shows the final state.
 * Snaps (final state at once, ghosts removed) under reduced motion, for a
 * zero-length update, or when more than `maxMarks` distinct elements move.
 */
export function runElementTweens(
  tweens: readonly ElementTween[],
  opts: ElementTweenOptions,
): ElementTweenHandle {
  const tracks = tweens.map(toTrack);
  const snapAll = () => {
    for (const track of tracks) track.final();
  };
  if (tracks.length === 0) return settledHandle();

  const distinct = new Set(tweens.map(targetOf)).size;
  if (
    prefersReducedMotion() ||
    opts.update.duration <= 0 ||
    (opts.maxMarks !== undefined && distinct > opts.maxMarks)
  ) {
    snapAll();
    return settledHandle();
  }

  const update = opts.update;
  const exit: MotionPhase = opts.exit ?? { duration: 0 };
  const hasExit = tracks.some((t) => t.slot === 'exit');
  // Without ghosts the exit phase must not stretch the transition's end.
  const timeline = updateTimeline(update, hasExit ? exit : { duration: 0 }, hasExit);

  const progressAt = (slot: Track['slot'], elapsed: number): number => {
    if (slot === 'update') return sampleMotion(update, elapsed - timeline.updateDelayMs).position;
    if (slot === 'exit') return sampleMotion(exit, elapsed).position;
    const local = elapsed - timeline.enterDelayMs;
    if (local <= 0) return 0;
    if (timeline.enterMs <= 0 || local >= timeline.enterMs) return 1;
    return evalValueCurve(FADE_CURVE, local / timeline.enterMs);
  };

  // Synchronous from-state, before the first frame.
  for (const track of tracks) track.apply(progressAt(track.slot, 0));

  let running = true;
  let start: number | null = null;
  let frame = 0;
  let resolveFinished!: () => void;
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve;
  });

  const end = () => {
    running = false;
    snapAll();
    resolveFinished();
  };

  const tick = (now: number) => {
    if (!running) return;
    if (start === null) start = now;
    const elapsed = now - start;
    if (elapsed >= timeline.totalMs) {
      end();
      return;
    }
    for (const track of tracks) track.apply(progressAt(track.slot, elapsed));
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);

  return {
    get running() {
      return running;
    },
    cancel() {
      if (!running) return;
      cancelAnimationFrame(frame);
      end();
    },
    finished,
  };
}

// ---------------------------------------------------------------------------
// Ghosts
// ---------------------------------------------------------------------------

const URL_REF = /url\(\s*['"]?#([^'")\s]+)['"]?\s*\)/g;
const HREF_ATTRS = ['href', 'xlink:href'];

let ghostDefSeq = 0;

/** Defs a ghost's paint was re-homed into; they leave with the ghost. */
const ghostDefs = new WeakMap<Element, Element[]>();

function removeGhost(ghost: Element): void {
  ghost.remove();
  for (const def of ghostDefs.get(ghost) ?? []) def.remove();
  ghostDefs.delete(ghost);
}

function svgOf(el: Element): Element | null {
  return el.tagName.toLowerCase() === 'svg' ? el : el.closest('svg');
}

function findById(root: Element, id: string): Element | null {
  for (const el of root.querySelectorAll('[id]')) {
    if (el.getAttribute('id') === id) return el;
  }
  return null;
}

function ensureDefs(svg: Element): Element {
  for (const child of svg.children) {
    if (child.tagName.toLowerCase() === 'defs') return child;
  }
  const defs = svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'defs');
  svg.insertBefore(defs, svg.firstChild);
  return defs;
}

/**
 * Point `el`'s (and its subtree's) `url(#id)` paints and `href="#id"` links
 * at copies of the referenced defs, re-homed from `fromSvg` into `toSvg`'s
 * `<defs>` under fresh ids. The old SVG is about to be removed, so the clone
 * would otherwise reference nothing (or a same-id def with other stops).
 */
function rehomeRefs(
  el: Element,
  fromSvg: Element,
  toSvg: Element,
  moved: Map<string, string>,
  copies: Element[],
) {
  const resolve = (id: string): string | null => {
    const known = moved.get(id);
    if (known) return known;
    const def = findById(fromSvg, id);
    if (!def) return null;
    const fresh = `${id}-ghost-${++ghostDefSeq}`;
    moved.set(id, fresh);
    const copy = def.cloneNode(true) as Element;
    copy.setAttribute('id', fresh);
    // Ids inside the copied def would duplicate the live ones.
    for (const inner of copy.querySelectorAll('[id]')) inner.removeAttribute('id');
    rehomeRefs(copy, fromSvg, toSvg, moved, copies);
    ensureDefs(toSvg).appendChild(copy);
    copies.push(copy);
    return fresh;
  };

  for (const node of [el, ...el.querySelectorAll('*')]) {
    for (const attr of [...node.attributes]) {
      const { name, value } = attr;
      if (HREF_ATTRS.includes(name) && value.startsWith('#')) {
        const fresh = resolve(value.slice(1));
        if (fresh) node.setAttribute(name, `#${fresh}`);
      } else if (value.includes('url(')) {
        const next = value.replace(URL_REF, (match, id: string) => {
          const fresh = resolve(id);
          return fresh ? `url(#${fresh})` : match;
        });
        if (next !== value) node.setAttribute(name, next);
      }
    }
  }
}

/**
 * Clone `source` as an exit ghost appended to `parent`: `.oc-ghost`,
 * `aria-hidden`, no pointer events, and no `id`/`data-key`/`tabindex` (so it
 * never matches a key lookup, duplicates an id, or takes focus). When
 * `source` lives in another SVG (the one being replaced), any `url(#id)`
 * paint it uses is copied into `parent`'s SVG with a fresh id.
 */
export function makeGhost(source: Element, parent: Element): Element {
  const ghost = source.cloneNode(true) as Element;
  ghost.classList.add('oc-ghost');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.setAttribute('pointer-events', 'none');
  for (const node of [ghost, ...ghost.querySelectorAll('*')]) {
    node.removeAttribute('id');
    node.removeAttribute('data-key');
    node.removeAttribute('tabindex');
  }
  const fromSvg = svgOf(source);
  const toSvg = svgOf(parent);
  if (fromSvg && toSvg && fromSvg !== toSvg) {
    const copies: Element[] = [];
    rehomeRefs(ghost, fromSvg, toSvg, new Map(), copies);
    if (copies.length > 0) ghostDefs.set(ghost, copies);
  }
  parent.appendChild(ghost);
  return ghost;
}

const TRAILING_TRANSLATE =
  /translate\(\s*([-+]?[\d.]+(?:e[-+]?\d+)?)[\s,]+([-+]?[\d.]+(?:e[-+]?\d+)?)\s*\)\s*$/i;

/**
 * The displacement an in-flight `offset` tween last wrote on `el`, so an
 * interrupting update starts from where the element is drawn. Only valid for
 * elements that carry no `transform` of their own; (0, 0) when there is none.
 */
export function currentOffset(el: Element): { x: number; y: number } {
  const m = TRAILING_TRANSLATE.exec(el.getAttribute('transform') ?? '');
  return m ? { x: Number(m[1]), y: Number(m[2]) } : { x: 0, y: 0 };
}

/** A numeric attribute, or undefined when absent or not a number. */
export function numAttr(el: Element, name: string): number | undefined {
  const raw = el.getAttribute(name);
  if (raw === null) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}
