/**
 * Animation runtime for entrance animations.
 *
 * All animations are CSS-driven (keyframes + clip-path + transforms + opacity).
 * This module handles lifecycle: cleanup after completion, cancellation on update.
 *
 * Which element plays which entrance role is read from the choreography table
 * (`ENTRANCE_ROLES` in core), using the same selectors the generated CSS uses,
 * so cleanup timing and GIF export can't drift from the stylesheet.
 */

import {
  ENTRANCE_ROLES,
  type EntranceRole,
  type EntranceRoleExtent,
  type EntranceRoleRow,
  type EntranceTimingContext,
  entranceEndMs,
  type KeyframeName,
  type MotionPhase,
} from '@opendata-ai/openchart-core';

/**
 * Cancel entrance animations and clean up.
 * Called when update() is invoked during animation, or on destroy.
 */
export function cancelAnimations(svg: Element | null): void {
  if (svg) {
    svg.classList.remove('oc-animate');
    // Drop a play-when-seen hold, so a scene kept across renders never stays paused.
    (svg as Element & Partial<ElementCSSInlineStyle>).style?.removeProperty('--oc-play-state');
  }
}

// ---------------------------------------------------------------------------
// Entrance scan: which elements animate, as which role, with which timing
// ---------------------------------------------------------------------------

type StyledElement = Element & ElementCSSInlineStyle;

/** One element the generated entrance CSS animates. */
export interface EntranceElement {
  /** The element the keyframe runs on. */
  el: SVGElement | HTMLElement;
  role: EntranceRole;
  /** The keyframe it plays (the role's horizontal variant inside a horizontal group). */
  keyframe: KeyframeName;
  /** The stagger index its role reads (`--oc-mark-index`, `--oc-row-index`, map slot). */
  index: number;
  /** Per-element timing inputs read from stamped custom properties. */
  context: EntranceTimingContext;
}

export interface EntranceScan {
  elements: EntranceElement[];
  /** Root-level timing inputs (the custom properties stamped on the root). */
  context: EntranceTimingContext;
  /** The base duration the CSS sees (`--oc-animation-duration`), or undefined if unstamped. */
  durationMs: number | undefined;
}

function readMs(el: StyledElement | null | undefined, name: string): number | undefined {
  const raw = el?.style?.getPropertyValue(name);
  if (!raw) return undefined;
  const v = parseFloat(raw);
  return Number.isFinite(v) ? v : undefined;
}

/** A custom property's value as CSS inheritance resolves it: nearest stamped ancestor-or-self. */
function inheritedMs(el: Element, root: Element, name: string): number | undefined {
  for (let n: Element | null = el; n; n = n.parentElement) {
    const v = readMs(n as StyledElement, name);
    if (v !== undefined) return v;
    if (n === root) break;
  }
  return undefined;
}

function scopeSelector(selector: string): string {
  return selector.startsWith('>') ? `:scope ${selector}` : selector;
}

function rolesFor(root: Element): EntranceRoleRow[] {
  if (root.classList.contains('oc-table-wrapper')) {
    return ENTRANCE_ROLES.filter((r) => r.scope === 'table');
  }
  return ENTRANCE_ROLES.filter((r) => r.scope === 'chart');
}

/**
 * The role a single element plays, mirroring the cascade: the LAST role in
 * table order whose selectors match wins (later roles are the more specific
 * rules). Returns undefined when no entrance rule matches, or when a role
 * suppresses it (stack-reveal segments, bulk-mode map features).
 */
function roleOf(el: Element, roles: readonly EntranceRoleRow[]): EntranceRoleRow | undefined {
  let match: EntranceRoleRow | undefined;
  for (const row of roles) {
    if (row.suppress?.some((s) => el.matches(s))) return undefined;
    if (row.selectors.some((s) => !s.startsWith('>') && el.matches(s))) match = row;
  }
  return match;
}

function keyframeFor(row: EntranceRoleRow, el: Element, root?: Element): KeyframeName {
  if (!row.horizontalKeyframe) return row.keyframe;
  const oriented = el.closest('[data-orient]');
  const inside = !!oriented && (!root || oriented === root || root.contains(oriented));
  return inside && oriented!.getAttribute('data-orient') === 'horizontal'
    ? row.horizontalKeyframe
    : row.keyframe;
}

function describe(
  el: Element,
  row: EntranceRoleRow,
  root: Element,
  rootContext: EntranceTimingContext,
): EntranceElement {
  const context: EntranceTimingContext = { ...rootContext };
  let index = 0;
  switch (row.delay.stagger) {
    case 'row':
      index = inheritedMs(el, root, '--oc-row-index') ?? 0;
      break;
    case 'map-sweep': {
      // The CSS reads the stamped, shuffled --oc-map-delay; express it as a
      // slot index on the map stagger so entranceTiming lands on the same ms.
      const delay = inheritedMs(el, root, '--oc-map-delay') ?? 0;
      const stagger = rootContext.staggerMs ?? 0;
      index = stagger > 0 ? delay / stagger : 0;
      break;
    }
    case 'tilemap-tile':
      context.delayMs = inheritedMs(el, root, '--oc-tile-delay') ?? 0;
      break;
    case 'none':
      break;
    default:
      index = inheritedMs(el, root, '--oc-mark-index') ?? 0;
  }
  // A per-element role delay replaces the whole rule, as in the CSS.
  const stamped = inheritedMs(el, root, row.vars.delay);
  if (stamped !== undefined) context.stampedDelayMs = stamped;
  if (row.delay.stagger === 'map-point') {
    const perPoint = inheritedMs(el, root, '--oc-point-stagger');
    if (perPoint !== undefined) context.pointStaggerMs = perPoint;
  }
  return {
    el: el as SVGElement | HTMLElement,
    role: row.name,
    keyframe: keyframeFor(row, el, root),
    index,
    context,
  };
}

/** The role and keyframe a single element plays, or undefined (no entrance rule). */
export function entranceRoleOf(
  el: Element,
): { role: EntranceRole; keyframe: KeyframeName } | undefined {
  const root = el.closest('.oc-table-wrapper') ?? el.closest('svg') ?? el;
  const row = roleOf(el, rolesFor(root));
  return row ? { role: row.name, keyframe: keyframeFor(row, el) } : undefined;
}

/**
 * Find every element under `root` that the generated entrance CSS animates,
 * with the role, index and stamped timing inputs its rule reads.
 */
export function scanEntrance(root: StyledElement): EntranceScan {
  const roles = rolesFor(root);
  const context: EntranceTimingContext = {};
  const stagger = readMs(root, '--oc-animation-stagger');
  if (stagger !== undefined) context.staggerMs = stagger;
  const annotationDelay = readMs(root, '--oc-annotation-delay');
  if (annotationDelay !== undefined) context.annotationDelayMs = annotationDelay;
  // Anchor offsets the renderer resolved through this render's curve.
  for (const row of roles) {
    if (!row.delay.after) continue;
    const after = readMs(root, row.vars.after);
    if (after !== undefined) (context.afterMs ??= {})[row.name] = after;
  }

  const candidates = new Set<Element>();
  for (const row of roles) {
    for (const el of root.querySelectorAll(row.selectors.map(scopeSelector).join(', '))) {
      candidates.add(el);
    }
  }
  // Scope-relative selectors (`> .oc-chrome`) can't be tested with matches().
  const direct = new Map<Element, EntranceRoleRow>();
  for (const row of roles) {
    for (const s of row.selectors) {
      if (!s.startsWith('>')) continue;
      for (const el of root.querySelectorAll(scopeSelector(s))) direct.set(el, row);
    }
  }

  const elements: EntranceElement[] = [];
  for (const el of candidates) {
    const row = roleOf(el, roles) ?? direct.get(el);
    if (row) elements.push(describe(el, row, root, context));
  }
  return { elements, context, durationMs: readMs(root, '--oc-animation-duration') };
}

/** Per-role extents of a scan, the shape entranceEndMs takes. */
export function scanExtents(scan: EntranceScan): Partial<Record<EntranceRole, EntranceRoleExtent>> {
  const roles: Partial<Record<EntranceRole, EntranceRoleExtent>> = {};
  for (const e of scan.elements) {
    const extent = (roles[e.role] ??= { count: 0, maxIndex: 0, maxDelayMs: 0, stampedCount: 0 });
    extent.count++;
    extent.maxIndex = Math.max(extent.maxIndex ?? 0, e.index);
    extent.maxDelayMs = Math.max(extent.maxDelayMs ?? 0, e.context.delayMs ?? 0);
    const stamped = e.context.stampedDelayMs;
    if (stamped !== undefined) {
      extent.stampedCount = (extent.stampedCount ?? 0) + 1;
      extent.maxStampedDelayMs = Math.max(extent.maxStampedDelayMs ?? stamped, stamped);
    }
  }
  return roles;
}

/**
 * Pick the largest per-point stagger in a scan. Map points read it from the
 * root, so every point shares one value.
 */
function pointStagger(scan: EntranceScan): number | undefined {
  for (const e of scan.elements) {
    if (e.context.pointStaggerMs !== undefined) return e.context.pointStaggerMs;
  }
  return undefined;
}

/** When the last entrance animation under `root` ends, in ms, with no buffer. */
export function scanEntranceEndMs(scan: EntranceScan, phase?: Partial<MotionPhase>): number {
  const duration = scan.durationMs ?? phase?.duration;
  if (duration === undefined) return 0;
  return entranceEndMs({
    ...scan.context,
    pointStaggerMs: pointStagger(scan),
    phase: { ...phase, duration },
    roles: scanExtents(scan),
  });
}

/** Pad after the computed end for charts: the margin cleanup has always used. */
const CHART_CLEANUP_PAD_MS = 500;
/** Pad after the computed end for tables. */
export const TABLE_CLEANUP_PAD_MS = 300;

/**
 * Compute the total entrance-animation time for a rendered SVG, in ms: the
 * choreography table's end for the elements present (`entranceEndMs`) plus a
 * 500ms pad. Used as the cleanup fallback where `getAnimations` is missing,
 * and by canvas mark mode to size its fallback window.
 */
export function computeAnimationDuration(svg: SVGElement): number {
  return scanEntranceEndMs(scanEntrance(svg)) + CHART_CLEANUP_PAD_MS;
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

export interface AnimationCleanupOptions {
  /** Fires once, after every entrance animation has finished. Never after cancel. */
  onComplete?: () => void;
  /**
   * Fixed window in ms. Replaces the computed fallback timer, and in browsers
   * with `getAnimations` it is also waited out when no `canvasFinished` is
   * given (a JS entrance whose completion isn't otherwise observable).
   */
  totalMs?: number;
  /** Resolves when a JS-driven (canvas) entrance finishes. Awaited alongside the CSS. */
  canvasFinished?: Promise<void>;
  /** Pad added to the computed end on the fallback path. Default 500 (charts). */
  fallbackPadMs?: number;
}

type AnimatableRoot = StyledElement & {
  getAnimations?: (options?: { subtree?: boolean }) => Animation[];
};

function hasFiniteIterations(animation: Animation): boolean {
  const iterations = animation.effect?.getTiming?.().iterations;
  return iterations !== Number.POSITIVE_INFINITY;
}

/**
 * Remove `oc-animate` (and call `onComplete`) once the entrance has really
 * finished.
 *
 * In browsers, cleanup waits one animation frame (the next style recalc is
 * when CSS animations start; collecting them then avoids forcing a recalc
 * per chart at mount), then awaits every animation's `finished` under the
 * root. A busy page can start the CSS hundreds of ms after mount, so the
 * real completion beats any estimate. Without `getAnimations` (happy-dom,
 * old engines) it falls back to a timer at the choreography table's end
 * plus a pad.
 *
 * The returned function cancels: it never calls `onComplete`, and removing
 * `oc-animate` rejects the pending `finished` promises, which
 * `Promise.allSettled` absorbs.
 */
export function setupAnimationCleanup(
  root: StyledElement,
  options: AnimationCleanupOptions = {},
): () => void {
  const { onComplete, totalMs, canvasFinished } = options;
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  // The `totalMs` floor, kept apart from `timer` (the collect fallback) so
  // cancel clears both.
  let minimumTimer: ReturnType<typeof setTimeout> | undefined;
  let frame: number | undefined;

  const complete = () => {
    if (cancelled) return;
    cancelled = true;
    root.classList.remove('oc-animate');
    onComplete?.();
  };
  // A rejected canvas promise means the canvas entrance was torn down; treat
  // it as finished rather than letting it surface as unhandled.
  const settledCanvas = canvasFinished?.then(
    () => undefined,
    () => undefined,
  );

  const animatable = root as AnimatableRoot;
  if (typeof animatable.getAnimations !== 'function') {
    const windowMs =
      totalMs ??
      scanEntranceEndMs(scanEntrance(root)) + (options.fallbackPadMs ?? CHART_CLEANUP_PAD_MS);
    timer = setTimeout(() => {
      timer = undefined;
      if (settledCanvas) void settledCanvas.then(complete);
      else complete();
    }, windowMs);
  } else {
    const minimum =
      !canvasFinished && totalMs !== undefined
        ? new Promise<void>((resolve) => {
            minimumTimer = setTimeout(resolve, totalMs);
          })
        : undefined;
    const collect = () => {
      frame = undefined;
      if (cancelled) return;
      const waits: Promise<unknown>[] = animatable.getAnimations!({ subtree: true })
        .filter(hasFiniteIterations)
        .map((a) => a.finished);
      if (settledCanvas) waits.push(settledCanvas);
      if (minimum) waits.push(minimum);
      void Promise.allSettled(waits).then(complete);
    };
    if (typeof requestAnimationFrame === 'function') {
      frame = requestAnimationFrame(collect);
    } else {
      timer = setTimeout(collect, 0);
    }
  }

  return () => {
    cancelled = true;
    if (timer !== undefined) clearTimeout(timer);
    if (minimumTimer !== undefined) clearTimeout(minimumTimer);
    if (frame !== undefined && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(frame);
    }
    cancelAnimations(root);
  };
}
