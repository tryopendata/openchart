import type { AxisLayout, ChartLayout, PointMark } from '@opendata-ai/openchart-core';
import { serializeKeyValue } from '@opendata-ai/openchart-engine';
import { cubicOut } from '../motion/easing';
import { flattenFill } from '../scatter-canvas/state';

import { computeGridlineDeltas } from './chrome-tweens';
import type {
  CanvasGridlinesTween,
  CanvasLayerLike,
  CanvasPointsTween,
  GeometrySnapshot,
  Tween,
} from './types';

// ---------------------------------------------------------------------------
// Canvas point tween building
// ---------------------------------------------------------------------------

/**
 * Canvas counterpart of `buildPointTweens`: the same keyed diff, minus the DOM.
 *
 * Where the SVG builder does a `querySelector` per key and emits one tween per
 * mark, this resolves keys against the layer's SoA (already built from the NEXT
 * layout by `render()`) and emits exactly one packed tween.
 */
export function buildCanvasPointsTween(
  prevLayout: ChartLayout,
  nextLayout: ChartLayout,
  layer: CanvasLayerLike,
  tweens: Tween[],
  fromSnapshot?: GeometrySnapshot,
): void {
  const prevPoints = prevLayout.marks.filter((m): m is PointMark => m.type === 'point');
  const nextPoints = nextLayout.marks.filter((m): m is PointMark => m.type === 'point');

  const prevByKey = new Map<string, PointMark>();
  for (const m of prevPoints) {
    if (m.key) prevByKey.set(m.key, m);
  }

  // The layer's SoA is the authority on where a point lives on the canvas.
  // `nextPoints` is only used to confirm the layer and the layout agree.
  const soa = layer.state.marks;
  const survivors: number[] = [];
  const enters: number[] = [];
  for (let i = 0; i < soa.n; i++) {
    const key = soa.keys[i];
    if (key !== undefined && prevByKey.has(key)) survivors.push(i);
    else enters.push(i);
  }

  const exits: PointMark[] = [];
  const nextKeys = new Set<string>();
  for (const m of nextPoints) {
    if (m.key) nextKeys.add(m.key);
  }
  for (const [key, prev] of prevByKey) {
    if (!nextKeys.has(key)) exits.push(prev);
  }

  const sn = survivors.length;
  const soaIndex = new Uint32Array(sn);
  const fromCx = new Float32Array(sn);
  const fromCy = new Float32Array(sn);
  const fromR = new Float32Array(sn);
  const toCx = new Float32Array(sn);
  const toCy = new Float32Array(sn);
  const toR = new Float32Array(sn);
  const soaKeys: string[] = new Array(sn);

  for (let s = 0; s < sn; s++) {
    const i = survivors[s];
    // `survivors` holds exactly the indices whose key is present in prevByKey,
    // so both lookups are total.
    const key = soa.keys[i] as string;
    const prev = prevByKey.get(key) as PointMark;

    // Retarget from an interrupted transition's frozen geometry when present.
    // The snapshot is mode-agnostic (`{type:'point'}`), so a canvas transition
    // interrupted by an SVG-mode update retargets correctly and vice versa.
    let px = prev.cx;
    let py = prev.cy;
    let pr = prev.r;
    const snap = fromSnapshot?.get(key);
    if (snap && snap.type === 'point') {
      px = snap.cx;
      py = snap.cy;
      if (snap.r !== undefined) pr = snap.r;
    }

    soaIndex[s] = i;
    soaKeys[s] = key;
    fromCx[s] = px;
    fromCy[s] = py;
    fromR[s] = pr;
    // The SoA already holds the destination geometry -- render() built it from
    // nextLayout before the transition started.
    toCx[s] = soa.x[i];
    toCy[s] = soa.y[i];
    toR[s] = soa.r[i];
  }

  const enterSoaIndex = Uint32Array.from(enters);
  if (enters.length > 0) {
    // Entering points fade via `enterAlpha`, the whole-mark channel the
    // entrance animation uses, NOT `fillOpacity`: on canvas as in SVG,
    // fill-opacity must not drag the stroke down with it. Seed the array at
    // full alpha so every surviving point stays opaque; the tween only ever
    // writes the entering indices.
    const alpha = new Float32Array(soa.n).fill(1);
    for (const i of enters) alpha[i] = 0;
    layer.state.enterAlpha = alpha;
  }

  const exitCx = new Float32Array(exits.length);
  const exitCy = new Float32Array(exits.length);
  const exitR = new Float32Array(exits.length);
  const exitFill: string[] = new Array(exits.length);
  for (let x = 0; x < exits.length; x++) {
    const m = exits[x];
    exitCx[x] = m.cx;
    exitCy[x] = m.cy;
    exitR[x] = m.r;
    exitFill[x] = flattenFill(m.fill);
  }
  // alpha: 1 matches the synchronous t=0 applyTweenState pass.
  const exitState =
    exits.length > 0 ? { x: exitCx, y: exitCy, r: exitR, fill: exitFill, alpha: 1 } : null;

  tweens.push({
    tweenType: 'canvasPoints',
    kind: 'update',
    layer,
    soaIndex,
    fromCx,
    fromCy,
    fromR,
    toCx,
    toCy,
    toR,
    soaKeys,
    enterSoaIndex,
    exitState,
  });
}

/**
 * Write one frame of a canvas point tween into the layer's SoA.
 *
 * Enters and exits run on their own clocks here rather than through the shared
 * `kind` prologue, because a single record carries all three phases.
 */
export function applyCanvasPointsState(
  tw: CanvasPointsTween,
  elapsed: number,
  update: { duration: number },
  exit: { duration: number },
  enterDelay: number,
  enterDuration: number,
): void {
  const soa = tw.layer.state.marks;
  const easedUpdate = cubicOut(Math.min(elapsed / update.duration, 1));

  for (let s = 0; s < tw.soaIndex.length; s++) {
    const i = tw.soaIndex[s];
    soa.x[i] = tw.fromCx[s] + (tw.toCx[s] - tw.fromCx[s]) * easedUpdate;
    soa.y[i] = tw.fromCy[s] + (tw.toCy[s] - tw.fromCy[s]) * easedUpdate;
    soa.r[i] = tw.fromR[s] + (tw.toR[s] - tw.fromR[s]) * easedUpdate;
  }

  // Enters fade in, delayed 40% of the update duration -- same phase math the
  // SVG point path uses, so both modes read as one motion.
  const alpha = tw.layer.state.enterAlpha;
  if (alpha && tw.enterSoaIndex.length > 0) {
    const tEnter = elapsed < enterDelay ? 0 : Math.min((elapsed - enterDelay) / enterDuration, 1);
    const easedEnter = cubicOut(tEnter);
    for (let e = 0; e < tw.enterSoaIndex.length; e++) {
      alpha[tw.enterSoaIndex[e]] = easedEnter;
    }
  }

  // Exit ghosts hold their prev position and fade out on the exit clock.
  // The record is preallocated; only alpha changes frame to frame.
  if (tw.exitState) {
    const easedExit = cubicOut(Math.min(elapsed / exit.duration, 1));
    tw.exitState.alpha = 1 - easedExit;
    tw.layer.state.exiting = tw.exitState;
  }
}

/**
 * The axes that contribute canvas gridlines, in the order `buildScatterCanvasState`
 * walks them. `layer.state.gridlines` is a flat array, so the tween can only index
 * into it by replaying that exact traversal -- keep the two in lockstep.
 */
export function canvasGridlineAxes(
  layout: ChartLayout,
): { axis: AxisLayout | undefined; orient: 'x' | 'y' }[] {
  return [
    { axis: layout.axes.y, orient: 'y' as const },
    { axis: layout.axes.y2, orient: 'y' as const },
    { axis: layout.axes.x, orient: 'x' as const },
  ];
}

/** True when this axis renders gridlines at all (mirrors `collectGridlines`). */
export function axisEmitsGridlines(
  axis: AxisLayout | undefined,
  orient: 'x' | 'y',
): axis is AxisLayout {
  if (!axis) return false;
  return !(orient === 'y' && axis.orient === 'right');
}

/**
 * Build the canvas gridline tween.
 *
 * The layer's `gridlines` array is already at the NEXT layout's positions, so
 * this only has to compute where each one came FROM. Survivors rewind to their
 * prev position at full alpha; new gridlines hold position and fade in on the
 * enter clock. Exits are dropped rather than ghosted: the next layout's array
 * has no slot for them, and a gridline fading out under 4k points is not worth
 * a parallel ghost array.
 */
export function buildCanvasGridlinesTween(
  prevLayout: ChartLayout,
  nextLayout: ChartLayout,
  layer: CanvasLayerLike,
  tweens: Tween[],
): void {
  const live = layer.state.gridlines;
  const index: number[] = [];
  const fromPos: number[] = [];
  const toPos: number[] = [];
  const fromAlpha: number[] = [];
  const toAlpha: number[] = [];

  const prevAxes = canvasGridlineAxes(prevLayout);
  const nextAxes = canvasGridlineAxes(nextLayout);

  let cursor = 0;
  for (let a = 0; a < nextAxes.length; a++) {
    const nextAxis = nextAxes[a].axis;
    const orient = nextAxes[a].orient;
    if (!axisEmitsGridlines(nextAxis, orient)) continue;

    const prevAxis = prevAxes[a].axis;
    const deltas = axisEmitsGridlines(prevAxis, orient)
      ? computeGridlineDeltas(prevAxis, nextAxis)
      : null;

    // Position -> tick value for THIS axis, so each flat-array slot can be
    // resolved back to the key the deltas are keyed by.
    const valueAtPosition = new Map<number, string>();
    for (const tick of nextAxis.ticks) {
      valueAtPosition.set(tick.position, serializeKeyValue(tick.value));
    }

    for (const gridline of nextAxis.gridlines) {
      const slot = cursor++;
      // Defensive: the layer was built from this same layout, so the arrays
      // must be the same length. Bail rather than write past the end.
      if (slot >= live.length) break;

      const key = valueAtPosition.get(gridline.position);
      const prevPos = key !== undefined ? deltas?.prevGridByValue.get(key) : undefined;

      index.push(slot);
      toPos.push(gridline.position);
      toAlpha.push(live[slot].alpha);
      if (prevPos !== undefined) {
        // Survivor: slide, no fade.
        fromPos.push(prevPos);
        fromAlpha.push(live[slot].alpha);
      } else {
        // Enter: hold position, fade in.
        fromPos.push(gridline.position);
        fromAlpha.push(0);
      }
    }
  }

  if (index.length === 0) return;

  tweens.push({
    tweenType: 'canvasGridlines',
    kind: 'update',
    layer,
    index: Uint32Array.from(index),
    fromPos: Float32Array.from(fromPos),
    toPos: Float32Array.from(toPos),
    fromAlpha: Float32Array.from(fromAlpha),
    toAlpha: Float32Array.from(toAlpha),
  });
}

/** Write one frame of a canvas gridline tween into the layer state. */
export function applyCanvasGridlinesState(
  tw: CanvasGridlinesTween,
  elapsed: number,
  update: { duration: number },
  enterDelay: number,
  enterDuration: number,
): void {
  const live = tw.layer.state.gridlines;
  const easedUpdate = cubicOut(Math.min(elapsed / update.duration, 1));
  // Enters share the point tween's delayed-fade clock so the whole update
  // reads as one motion.
  const tEnter = elapsed < enterDelay ? 0 : Math.min((elapsed - enterDelay) / enterDuration, 1);
  const easedEnter = cubicOut(tEnter);

  for (let i = 0; i < tw.index.length; i++) {
    const g = live[tw.index[i]];
    g.position = tw.fromPos[i] + (tw.toPos[i] - tw.fromPos[i]) * easedUpdate;
    const from = tw.fromAlpha[i];
    const to = tw.toAlpha[i];
    g.alpha = from === to ? to : from + (to - from) * easedEnter;
  }
}

/** Snap a canvas gridline tween to its exact destination. */
export function snapCanvasGridlinesToFinal(tw: CanvasGridlinesTween): void {
  const live = tw.layer.state.gridlines;
  for (let i = 0; i < tw.index.length; i++) {
    const g = live[tw.index[i]];
    g.position = tw.toPos[i];
    g.alpha = tw.toAlpha[i];
  }
}

/** Snap a canvas point tween to its exact destination and drop the ghosts. */
export function snapCanvasPointsToFinal(tw: CanvasPointsTween): void {
  const soa = tw.layer.state.marks;
  for (let s = 0; s < tw.soaIndex.length; s++) {
    const i = tw.soaIndex[s];
    soa.x[i] = tw.toCx[s];
    soa.y[i] = tw.toCy[s];
    soa.r[i] = tw.toR[s];
  }
  tw.layer.state.exiting = null;
  // Null rather than fill(1): the renderer skips the alpha multiply entirely
  // when this is null, and every point is at full alpha once the fade lands.
  // Safe to clobber unconditionally -- gate 6 bars a transition while an
  // entrance is in flight, so nothing else owns this array.
  tw.layer.state.enterAlpha = null;
}
