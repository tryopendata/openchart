/**
 * The 3D graph renderer: a `GraphInstance` backed by `3d-force-graph`.
 *
 * Registered against `dimensions: 3` by `./index`. `createGraph()` builds the
 * shared shell (wrapper, chrome, legend slot, tooltip manager, resize wiring)
 * and hands it here; this module owns the WebGL scene, the d3-force-3d
 * simulation the library drives, the per-node and per-link three.js objects,
 * emphasis state, the label budget, tooltip anchoring, and disposal.
 *
 * Three library facts shape almost everything below and are easy to get wrong:
 *
 * 1. `nodeOpacity` and `linkOpacity` are GLOBAL numbers, not accessors. Every
 *    per-object opacity (dim, highlight, entrance, search) therefore needs a
 *    custom object with its own material. See `nodes.ts` / `links.ts`.
 * 2. `refresh()` rebuilds every node and link object. It must never run on
 *    hover; the hover path only writes `material.opacity`.
 * 3. `rendererConfig` and `controlType` are CONSTRUCTOR options, not chained
 *    setters.
 *
 * Differences from 2D that are deliberate and documented in RFC 27: no
 * keyboard navigation, no node drag, no cursor repulsion or springy drag, no
 * wall-clock warmup budget, and a structural `update()` reheats globally
 * (`graphData()` restarts the layout at alpha 1) instead of applying 2D's local
 * impulse.
 */

import type { GraphSpec, ThemeConfig, TooltipContent } from '@opendata-ai/openchart-core';
import type { CompiledGraphNode } from '@opendata-ai/openchart-engine';
import { buildEdgeTooltip } from '@opendata-ai/openchart-engine';
import ForceGraph3D from '3d-force-graph';
import type { Object3D } from 'three';
import { Raycaster, Vector2 } from 'three';
import type { CameraFlightOptions } from '../graph/camera';
import { ENTRANCE_STAGGER_MAX_NODES, popAlpha, popScale } from '../graph/entrance';
import {
  composeStandingFocus,
  type FocusSnapshot,
  layerHoverFocus,
} from '../graph/focus-transition';
import {
  categoryHighlightSet as categoryHighlightIds,
  resolveHighlightTarget as resolveHighlightTargetIds,
} from '../graph/highlight';
import { createGraphLegend, type GraphLegendController } from '../graph/legend';
import { createTween, linear, prefersReducedMotion, resolveEase } from '../graph/motion';
import type { GraphRendererContext } from '../graph/renderer-registry';
import { AnimationScheduler, type GraphAnimation } from '../graph/scheduler';
import { GraphSearchManager } from '../graph/search';
import { seedNodePositions } from '../graph/seed';
import type { PositionedEdge, PositionedNode } from '../graph/types';
import { diffGraphUpdate } from '../graph/update-diff';
import type { SimNode } from '../graph/worker-protocol';
import type {
  GraphHighlightTarget,
  GraphInstance,
  GraphLegendData,
  GraphTooltipFormatter,
} from '../graph-mount';
import { resolvedSurface } from '../theme-tokens';
import { resolveEmphasis } from './emphasis';
import { ENTRANCE_CAMERA_PULLBACK, elementProgress, planEntrance } from './entrance';
import { computeFit, normalize } from './fit';
import { applySimulationConfig } from './forces';
import { LABEL_BUDGET_3D, type LabelBox, labelBox, overlaps, resolveVisibleLabels } from './labels';
import {
  applyLinkVisuals,
  createLinkObject,
  disposeLinkObject,
  LINK_WIDTH_MAX_EDGES,
  type LinkObject3D,
  linkShapeMatches,
  updateLinkPosition,
  widthAsAlpha,
} from './links';
import {
  applyNodeVisuals,
  createNodeObject,
  disposeNodeObject,
  ensureLabelSprite,
  LABEL_TEXT_HEIGHT,
  type NodeObject3D,
} from './nodes';
import type { Graph3D, Link3D, Node3D } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * The camera distance that `getCamera().k === 1` refers to. 3D has no zoom
 * scalar, so `k` is expressed as `FIT_DISTANCE / cameraDistance`: a `k` of 2 is
 * twice as close as the reference framing, matching the 2D sign convention.
 */
export const FIT_DISTANCE = 1000;

/** Default breathing room around a fit, in pixels of viewport height. */
const FIT_PADDING_PX = 40;

/** Target on-screen cap height for a node label, in CSS pixels. */
const LABEL_SCREEN_PX = 11;

/** Bounds on the perspective correction, so a label never vanishes or fills the view. */
const LABEL_SCALE_MIN = 0.4;
const LABEL_SCALE_MAX = 8;

/** The library's own clamp on devicePixelRatio; kept in step on resize. */
const MAX_PIXEL_RATIO = 2;

/** Fallback when the camera has not reported its own field of view yet. */
const DEFAULT_FOV_DEG = 50;

/** Throttle for the settle-phase auto re-fit (ms). */
const AUTO_FIT_INTERVAL_MS = 250;
/** Camera standoff from a node for `zoomToNode`, in scene units. */
export const NODE_FOCUS_DISTANCE = 120;
/** Fallback flight duration when `animation.camera.duration` is `'auto'`. */
const AUTO_FLIGHT_MS = 800;
/**
 * The scale a node holds before its pop starts. Not 0: a zero scale collapses
 * the sphere's bounding box, and three skips frustum culling maths on a
 * degenerate box in ways that vary by build.
 */
const ENTRANCE_MIN_SCALE = 0.01;
/** Entrance alpha below which a node's label stays hidden. */
const LABEL_ENTRANCE_MIN = 0.4;
/** Label re-rank throttle while orbiting. */
const LABEL_RERANK_MS = 100;
/** `k` clamp, mirroring 2D's `clampK`. */
const K_MIN = 0.05;
const K_MAX = 40;
/** Second seed stream for the z axis (golden-ratio salt, as in `seed.ts`). */
const Z_SEED_SALT = 0x9e3779b9;

/** A camera pose, the 3D superset of 2D's `{ x, y, k }`. */
export interface Camera3D {
  x: number;
  y: number;
  k: number;
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
}

/** `flyTo` accepts either the 2D shape or a full 3D pose from `getCamera()`. */
export type FlyTarget3D = {
  x: number;
  y: number;
  k?: number;
  position?: { x: number; y: number; z: number };
  target?: { x: number; y: number; z: number };
};

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export function createGraph3DRenderer(ctx: GraphRendererContext): GraphInstance {
  const { shell, options } = ctx;
  let currentSpec = ctx.spec;
  let compilation = ctx.compilation;
  let destroyed = false;

  // -- Scene ---------------------------------------------------------------

  const surfaceEl = document.createElement('div');
  surfaceEl.className = 'oc-graph-3d';
  surfaceEl.setAttribute('role', 'img');
  if (compilation.a11y?.altText) surfaceEl.setAttribute('aria-label', compilation.a11y.altText);
  // Absolute inside the (relative) wrapper, not just width/height 100%.
  // three's `setSize` writes the drawing-buffer size onto the canvas as an
  // inline pixel width, which would otherwise become the min-content width of
  // every flex ancestor: the container could then never shrink below whatever
  // it happened to measure on the first frame. Taking the surface out of flow
  // breaks that feedback loop, and it still fills the wrapper.
  surfaceEl.style.position = 'absolute';
  surfaceEl.style.inset = '0';
  shell.mountSurface(surfaceEl);

  // The library's declaration is not generic at the constructor, so the datum
  // types are asserted here rather than parameterized.
  const graph = new ForceGraph3D(surfaceEl, {
    controlType: 'trackball',
    // `alpha` is what lets a transparent theme show the host page through the
    // canvas; both are constructor-only in 3d-force-graph.
    rendererConfig: { alpha: true, antialias: true },
  }) as unknown as Graph3D;

  // -- Scene object registries ---------------------------------------------

  const nodeObjects = new Map<string, NodeObject3D>();
  /** Keyed by index into `compilation.edges` so parallel edges stay distinct. */
  const linkObjects = new Map<number, LinkObject3D>();
  let nodeData: Node3D[] = [];
  let nodeById = new Map<string, Node3D>();
  let linkData: Link3D[] = [];

  // -- Derived data --------------------------------------------------------

  let adjacency = new Map<string, Set<string>>();
  let nodeDataMap = new Map<string, Record<string, unknown>>();
  let nodeCategory = new Map<string, string>();
  let seedIds = new Set<string>();
  let edgeBaseAlpha: Map<number, number> | undefined;
  let useLinkWidth = false;

  // -- Interaction state ---------------------------------------------------

  const searchManager = new GraphSearchManager();
  let legendController: GraphLegendController | null = null;
  let hoveredNodeId: string | null = null;
  let hoveredLinkIndex: number | null = null;
  let selectedNodeIds = new Set<string>();
  let activeCategories = new Set<string>();
  let transientHighlight: Set<string> | null = null;
  let transientTarget: GraphHighlightTarget | null = null;
  let highlightSet: Set<string> | null = null;
  let highlightDimOpacity: number | null = null;

  // -- Opacity state -------------------------------------------------------
  // `display*` is what the emphasis model says each element should show;
  // `entrance*` is a per-element multiplier on top of it, so the entrance and
  // the emphasis crossfade compose instead of fighting over `material.opacity`.
  // While `entranceActive` is false the multipliers are skipped entirely, which
  // keeps the steady-state paint a plain map read.

  const displayNodeAlpha = new Map<string, number>();
  const displayEdgeAlpha = new Map<number, number>();
  let entranceActive = false;
  const entranceNodeAlpha = new Map<string, number>();
  const entranceNodeScale = new Map<string, number>();
  const entranceEdgeAlpha = new Map<number, number>();
  /** Standoff multiplier the fit is scaled by while the camera flies in. */
  let entranceCameraPull = 1;
  let emphasisTween: GraphAnimation | null = null;

  // -- Frame loop ----------------------------------------------------------
  // The library runs its own render loop; this scheduler only drives our tweens.

  let pumpId: number | null = null;
  const scheduler = new AnimationScheduler(() => pump());

  function pump(): void {
    if (pumpId !== null || destroyed) return;
    pumpId = requestAnimationFrame((now) => {
      pumpId = null;
      if (destroyed) return;
      scheduler.tick(now);
      if (scheduler.active) pump();
    });
  }

  // -- Camera / label bookkeeping ------------------------------------------

  // The layout starts collapsed near the origin, so a single fit on the first
  // tick frames a blob and leaves the camera inside the cloud once it expands.
  // Re-fit on a throttle while the simulation settles, and stop the moment the
  // viewer takes the camera themselves.
  let autoFit = true;
  let lastAutoFit = 0;
  let cameraChangeQueued = false;
  /** Ids whose label won a slot in the last rank. `paint()` reads it so the
   * entrance can hide a label whose node has not popped in yet. */
  const labelShown = new Set<string>();
  let lastLabelRank = 0;
  let labelRankQueued = false;
  let controlsListener: (() => void) | null = null;

  // -- Tooltip state -------------------------------------------------------

  let openTooltip: { kind: 'node'; id: string } | { kind: 'edge'; index: number } | null = null;
  /**
   * The target whose content is currently rendered into the tooltip element.
   * `anchorTooltip()` runs on every engine tick and every camera change, so
   * re-running the host formatter and rewriting the DOM each time would be a
   * per-frame cost for content that only changes when the target does.
   */
  let renderedTooltip: string | null = null;

  // =========================================================================
  // Derived-data builders
  // =========================================================================

  function rebuildDerived(): void {
    adjacency = new Map();
    for (const e of compilation.edges) {
      if (!adjacency.has(e.source)) adjacency.set(e.source, new Set());
      if (!adjacency.has(e.target)) adjacency.set(e.target, new Set());
      adjacency.get(e.source)!.add(e.target);
      adjacency.get(e.target)!.add(e.source);
    }
    nodeDataMap = new Map(compilation.nodes.map((n) => [n.id, n.data ?? {}]));
    nodeCategory = new Map();
    const field = compilation.legendField;
    if (field) {
      for (const n of compilation.nodes) {
        const v = n.data?.[field];
        if (v != null) nodeCategory.set(n.id, String(v));
      }
    }
    seedIds = new Set(compilation.seedNodeIds);

    // Cylinders are only affordable below the edge threshold; above it the
    // width encoding becomes a resting-opacity ramp on plain lines.
    const widthEncoded = currentSpec.encoding?.edgeWidth != null;
    useLinkWidth = widthEncoded && compilation.edges.length <= LINK_WIDTH_MAX_EDGES;
    edgeBaseAlpha = widthEncoded && !useLinkWidth ? widthAsAlpha(compilation.edges) : undefined;
  }

  /** Label sprite color: the theme's text ink, as in 2D's canvas label layer. */
  function labelColor(): string {
    return compilation.theme.colors.text;
  }

  // =========================================================================
  // Seeding
  // =========================================================================

  /**
   * Deterministic 3D start positions. x/y come from the shared 2D seeder so a
   * spec settles to a recognisably similar shape in both dimensions; z reuses
   * the same disc placement under a salted seed and takes its x component.
   */
  function seedPositions(nodes: CompiledGraphNode[]): Map<string, [number, number, number]> {
    const xy: SimNode[] = nodes.map((n) => ({
      id: n.id,
      radius: n.radius,
      community: n.community,
    }));
    const seed = compilation.simulationConfig.seed ?? 0;
    seedNodePositions(xy, seed);
    const z: SimNode[] = nodes.map((n) => ({
      id: n.id,
      radius: n.radius,
      community: n.community,
    }));
    seedNodePositions(z, seed ^ Z_SEED_SALT);

    const out = new Map<string, [number, number, number]>();
    for (let i = 0; i < nodes.length; i++) {
      out.set(nodes[i].id, [xy[i].x ?? 0, xy[i].y ?? 0, z[i].x ?? 0]);
    }
    return out;
  }

  /** The z a single entering node should spawn at (same stream as `seedPositions`). */
  function seedZ(id: string, radius: number, community: string | undefined): number {
    const one: SimNode[] = [{ id, radius, community }];
    seedNodePositions(one, (compilation.simulationConfig.seed ?? 0) ^ Z_SEED_SALT);
    return one[0].x ?? 0;
  }

  // =========================================================================
  // Scene data
  // =========================================================================

  function buildGraphData(positions: Map<string, [number, number, number]>): void {
    nodeData = compilation.nodes.map((node) => {
      const p = positions.get(node.id) ?? [0, 0, 0];
      return { id: node.id, node, x: p[0], y: p[1], z: p[2] };
    });
    linkData = compilation.edges.map((edge, edgeIndex) => ({
      source: edge.source,
      target: edge.target,
      edge,
      edgeIndex,
    }));
    nodeById = new Map(nodeData.map((d) => [d.id, d]));
    graph.graphData({ nodes: nodeData, links: linkData });
  }

  function nodeObjectFor(datum: Node3D): NodeObject3D {
    let obj = nodeObjects.get(datum.id);
    if (!obj) {
      obj = createNodeObject(datum.node, labelColor());
      obj.group.userData.nodeId = datum.id;
      nodeObjects.set(datum.id, obj);
      const base = displayNodeAlpha.get(datum.id) ?? datum.node.opacity;
      if (entranceActive) {
        obj.material.opacity = base * (entranceNodeAlpha.get(datum.id) ?? 0);
        obj.mesh.scale.setScalar(entranceNodeScale.get(datum.id) ?? ENTRANCE_MIN_SCALE);
      } else {
        obj.material.opacity = base;
      }
    }
    return obj;
  }

  /**
   * Same identity contract as {@link nodeObjectFor}: whenever the link datums
   * are rebuilt, `linkObjects` must be cleared first, so the digest never hands
   * a cached object to a new datum while the old datum's remove hook is still
   * pending on it. The structural `update()` clears the map for exactly this
   * reason (the edge renumbering makes it necessary anyway).
   */
  function linkObjectFor(datum: Link3D): LinkObject3D {
    let obj = linkObjects.get(datum.edgeIndex);
    if (!obj) {
      const resting = edgeBaseAlpha?.get(datum.edgeIndex) ?? 0.3;
      obj = createLinkObject(datum.edge, useLinkWidth, resting);
      linkObjects.set(datum.edgeIndex, obj);
      const base = displayEdgeAlpha.get(datum.edgeIndex) ?? resting;
      obj.material.opacity = entranceActive
        ? base * (entranceEdgeAlpha.get(datum.edgeIndex) ?? 0)
        : base;
    }
    return obj;
  }

  // =========================================================================
  // Emphasis
  // =========================================================================

  function hoverConnectedSet(nodeId: string | null): Set<string> | null {
    if (nodeId === null) return null;
    if (compilation.interaction.hoverMode === 'none') return null;
    if (compilation.interaction.hoverMode === 'category') {
      const cat = nodeCategory.get(nodeId);
      const set = new Set<string>([nodeId]);
      if (cat !== undefined) for (const [id, c] of nodeCategory) if (c === cat) set.add(id);
      return set;
    }
    if (compilation.interaction.hoverMode === 'node') return new Set([nodeId]);
    const set = new Set<string>([nodeId]);
    const neighbors = adjacency.get(nodeId);
    if (neighbors) for (const nid of neighbors) set.add(nid);
    return set;
  }

  function currentFocus(): FocusSnapshot {
    const standing = composeStandingFocus(
      highlightSet,
      searchManager.getMatches(),
      selectedNodeIds,
      adjacency,
    );
    return layerHoverFocus(standing, hoveredNodeId, hoverConnectedSet(hoveredNodeId));
  }

  function effectiveDimOpacity(): number {
    const custom = transientHighlight !== null ? highlightDimOpacity : null;
    return custom ?? compilation.interaction.dimOpacity;
  }

  /**
   * Push the composed opacity (and, mid-entrance, the pop scale) onto every
   * material. Called from both the emphasis tween and the entrance tween, so it
   * allocates nothing: every map it reads is preallocated and reused.
   */
  function paint(): void {
    for (const [id, obj] of nodeObjects) {
      const a = displayNodeAlpha.get(id);
      if (a === undefined) continue;
      if (entranceActive) {
        const factor = entranceNodeAlpha.get(id) ?? 0;
        obj.material.opacity = a * factor;
        obj.mesh.scale.setScalar(entranceNodeScale.get(id) ?? ENTRANCE_MIN_SCALE);
        // SpriteText has no opacity channel of its own, so a label whose node
        // has not popped yet would otherwise float over empty space.
        if (obj.sprite) obj.sprite.visible = labelShown.has(id) && factor > LABEL_ENTRANCE_MIN;
      } else {
        obj.material.opacity = a;
      }
    }
    for (const [index, obj] of linkObjects) {
      const a = displayEdgeAlpha.get(index);
      if (a === undefined) continue;
      obj.material.opacity = entranceActive ? a * (entranceEdgeAlpha.get(index) ?? 0) : a;
    }
  }

  /**
   * Retarget every material toward the composed emphasis state.
   *
   * Never calls `refresh()`: that rebuilds every node and link object, which at
   * hover rate would be a full scene teardown per pointer move.
   */
  function armEmphasis(): void {
    const targets = resolveEmphasis({
      nodes: compilation.nodes,
      edges: compilation.edges,
      focus: currentFocus(),
      exemptIds: seedIds,
      dimOpacity: effectiveDimOpacity(),
      edgeBaseAlpha,
    });

    if (emphasisTween) {
      scheduler.remove(emphasisTween);
      emphasisTween = null;
    }

    const hoverCfg = compilation.animation?.hover ?? null;
    const duration = hoverCfg && !prefersReducedMotion() ? hoverCfg.duration : 0;

    if (duration <= 0) {
      for (const [id, a] of targets.nodes) displayNodeAlpha.set(id, a);
      for (const [i, a] of targets.edges) displayEdgeAlpha.set(i, a);
      paint();
      refreshLabels();
      return;
    }

    const fromNodes = new Map(displayNodeAlpha);
    const fromEdges = new Map(displayEdgeAlpha);
    const tween = createTween({
      duration,
      ease: resolveEase(hoverCfg?.ease ?? 'smooth'),
      apply: (t) => {
        for (const [id, to] of targets.nodes) {
          const from = fromNodes.get(id) ?? to;
          displayNodeAlpha.set(id, from + (to - from) * t);
        }
        for (const [i, to] of targets.edges) {
          const from = fromEdges.get(i) ?? to;
          displayEdgeAlpha.set(i, from + (to - from) * t);
        }
        paint();
      },
      onDone: () => {
        emphasisTween = null;
      },
    });
    emphasisTween = tween;
    scheduler.add(tween);
    refreshLabels();
  }

  // =========================================================================
  // Highlight composition (mirrors graph-mount's two-layer model)
  // =========================================================================

  function resolveHighlightTarget(target: GraphHighlightTarget): Set<string> {
    return resolveHighlightTargetIds(target, compilation.nodes, adjacency);
  }

  function categoryHighlightSet(): Set<string> | null {
    return categoryHighlightIds(activeCategories, nodeCategory);
  }

  function recomputeHighlight(): void {
    const filter = categoryHighlightSet();
    const transient =
      transientHighlight !== null && transientHighlight.size > 0 ? transientHighlight : null;
    if (filter !== null && transient !== null) {
      const inter = new Set<string>();
      for (const id of transient) if (filter.has(id)) inter.add(id);
      highlightSet = inter.size > 0 ? inter : transient;
      return;
    }
    highlightSet = filter ?? transient;
  }

  function refreshTransientHighlight(): void {
    if (transientTarget === null) {
      transientHighlight = null;
      return;
    }
    const nextIds = new Set(compilation.nodes.map((n) => n.id));
    const resolved = new Set(
      [...resolveHighlightTarget(transientTarget)].filter((id) => nextIds.has(id)),
    );
    transientHighlight = resolved.size > 0 ? resolved : null;
  }

  function emitHighlightChange(): void {
    options?.onHighlightChange?.(highlightSet ? [...highlightSet] : null);
  }

  // =========================================================================
  // Labels
  // =========================================================================

  /** Labels that are always shown, regardless of the distance budget. */
  function forcedLabelIds(): Set<string> {
    const forced = new Set<string>();
    for (const id of seedIds) forced.add(id);
    for (const [id, override] of Object.entries(currentSpec.nodeOverrides ?? {})) {
      if (override?.alwaysShowLabel) forced.add(id);
    }
    if (hoveredNodeId) forced.add(hoveredNodeId);
    for (const id of selectedNodeIds) forced.add(id);
    const matches = searchManager.getMatches();
    if (matches) for (const id of matches) forced.add(id);
    return forced;
  }

  function refreshLabels(): void {
    if (destroyed || nodeObjects.size === 0) return;
    const camera = graph.camera();
    const cameraPos = camera?.position ?? { x: 0, y: 0, z: FIT_DISTANCE };
    const forced = forcedLabelIds();
    const ranked = resolveVisibleLabels(
      nodeData.map((d) => ({
        id: d.id,
        priority: d.node.labelPriority,
        x: d.x ?? 0,
        y: d.y ?? 0,
        z: d.z ?? 0,
      })),
      forced,
      cameraPos,
      LABEL_BUDGET_3D,
    );

    // Sprites are attenuated by perspective, so a label 2,000 units out is
    // unreadable while one at 200 shouts. Counter it: scale each label so it
    // lands at roughly LABEL_SCREEN_PX on screen whatever the distance. That is
    // also what makes a screen-space declutter pass meaningful — the boxes only
    // mean something once every label is the same size.
    const fov =
      ((camera as { fov?: number } | undefined)?.fov ?? DEFAULT_FOV_DEG) * (Math.PI / 180);
    const viewportHeight = shell.getSize().height || 1;
    const worldPerPixel = (2 * Math.tan(fov / 2)) / viewportHeight;

    labelShown.clear();
    const placed: LabelBox[] = [];
    for (const id of ranked) {
      const obj = nodeObjects.get(id);
      const datum = nodeById.get(id);
      if (!obj || !datum || !obj.labelText) continue;

      const dist = Math.hypot(
        (datum.x ?? 0) - cameraPos.x,
        (datum.y ?? 0) - cameraPos.y,
        (datum.z ?? 0) - cameraPos.z,
      );
      const desiredHeight = LABEL_SCREEN_PX * worldPerPixel * dist;
      const factor = Math.min(
        LABEL_SCALE_MAX,
        Math.max(LABEL_SCALE_MIN, desiredHeight / LABEL_TEXT_HEIGHT),
      );

      // Same declutter contract as 2D's `drawLabels`: forced labels reserve
      // their box unconditionally, everything else takes the first free slot.
      const projected = graph.graph2ScreenCoords(datum.x ?? 0, datum.y ?? 0, datum.z ?? 0);
      const box = labelBox(projected, obj.labelText, LABEL_SCREEN_PX * factor);
      if (box && !forced.has(id) && placed.some((other) => overlaps(box, other))) continue;
      if (box) placed.push(box);

      // Only a label that actually won a slot is worth a sprite.
      const sprite = ensureLabelSprite(obj);
      if (!sprite) continue;
      labelShown.add(id);
      if (obj.labelBaseScale) {
        sprite.scale.set(obj.labelBaseScale.x * factor, obj.labelBaseScale.y * factor, 0);
      }
    }

    for (const [id, obj] of nodeObjects) {
      if (obj.sprite) {
        obj.sprite.visible =
          labelShown.has(id) &&
          (!entranceActive || (entranceNodeAlpha.get(id) ?? 0) > LABEL_ENTRANCE_MIN);
      }
    }
    lastLabelRank = performance.now();
  }

  /** Throttled re-rank, driven by the controls `change` event while orbiting. */
  function scheduleLabelRank(): void {
    if (labelRankQueued || destroyed) return;
    const wait = Math.max(0, LABEL_RERANK_MS - (performance.now() - lastLabelRank));
    labelRankQueued = true;
    setTimeout(() => {
      labelRankQueued = false;
      if (!destroyed) refreshLabels();
    }, wait);
  }

  // =========================================================================
  // Camera
  // =========================================================================

  function controlsTarget(): { x: number; y: number; z: number } {
    const t = (graph.controls() as { target?: { x: number; y: number; z: number } }).target;
    return t ? { x: t.x, y: t.y, z: t.z } : { x: 0, y: 0, z: 0 };
  }

  function getCamera(): Camera3D {
    const pos = graph.cameraPosition();
    const target = controlsTarget();
    const dist = Math.hypot(pos.x - target.x, pos.y - target.y, pos.z - target.z) || FIT_DISTANCE;
    return {
      x: target.x,
      y: target.y,
      k: FIT_DISTANCE / dist,
      position: { x: pos.x, y: pos.y, z: pos.z },
      target,
    };
  }

  /** Flight length in ms; 0 snaps (reduced motion, `animation: false`, `duration: 0`). */
  function flightMs(opts?: CameraFlightOptions): number {
    const cfg = compilation.animation?.camera ?? null;
    if (cfg === null || prefersReducedMotion() || opts?.duration === 0) return 0;
    const requested = opts?.duration ?? cfg.duration;
    return requested === 'auto' ? AUTO_FLIGHT_MS : requested;
  }

  function clampK(k: number): number {
    return Math.min(K_MAX, Math.max(K_MIN, k));
  }

  function flyTo(target: FlyTarget3D, opts?: CameraFlightOptions): void {
    if (destroyed) return;
    autoFit = false;
    const ms = flightMs(opts);
    if (target.position) {
      graph.cameraPosition(
        target.position,
        target.target ?? { x: target.x, y: target.y, z: 0 },
        ms,
      );
      queueCameraChange();
      return;
    }
    const look = { x: target.x, y: target.y, z: 0 };
    const cam = getCamera();
    const dist = FIT_DISTANCE / clampK(target.k ?? cam.k);
    // Keep the current viewing direction so a `{ x, y }` recentre orbits nothing.
    const dir = normalize({
      x: cam.position.x - cam.target.x,
      y: cam.position.y - cam.target.y,
      z: cam.position.z - cam.target.z,
    });
    graph.cameraPosition(
      { x: look.x + dir.x * dist, y: look.y + dir.y * dist, z: look.z + dir.z * dist },
      look,
      ms,
    );
    queueCameraChange();
  }

  /** Frame every node from the current viewing angle. See `computeFit`. */
  function zoomToFit(opts?: CameraFlightOptions & { padding?: number }): void {
    // An explicit fit is the host taking the camera, so the settle-phase
    // auto-fit stops second-guessing it.
    autoFit = false;
    fitNow(opts);
  }

  function fitNow(opts?: CameraFlightOptions & { padding?: number }): void {
    if (destroyed || nodeData.length === 0) return;
    const camera = graph.camera() as { fov?: number; aspect?: number } | undefined;
    const fit = computeFit(
      nodeData.map((d) => ({
        x: d.x ?? 0,
        y: d.y ?? 0,
        z: d.z ?? 0,
        radius: d.node.radius ?? 0,
      })),
      {
        cameraPos: getCamera().position,
        fovDeg: camera?.fov ?? DEFAULT_FOV_DEG,
        aspect: camera?.aspect ?? 1,
        viewportHeight: shell.getSize().height,
        paddingPx: opts?.padding ?? FIT_PADDING_PX,
      },
    );
    if (!fit) return;
    // Mid-entrance the camera stands `entranceCameraPull ×` further back than
    // the true fit, easing to 1. See `startEntrance`.
    const distance = fit.distance * entranceCameraPull;
    graph.cameraPosition(
      {
        x: fit.center.x + fit.dir.x * distance,
        y: fit.center.y + fit.dir.y * distance,
        z: fit.center.z + fit.dir.z * distance,
      },
      fit.center,
      flightMs(opts),
    );
    queueCameraChange();
  }

  function zoomToNode(nodeId: string, opts?: CameraFlightOptions & { scale?: number }): void {
    if (destroyed) return;
    autoFit = false;
    const datum = nodeById.get(nodeId);
    if (!datum) return;
    const at = { x: datum.x ?? 0, y: datum.y ?? 0, z: datum.z ?? 0 };
    // Approach along the node's own radial direction so the camera ends up
    // outside the cloud rather than inside it.
    const dir = normalize(at);
    const dist = opts?.scale ? NODE_FOCUS_DISTANCE / clampK(opts.scale) : NODE_FOCUS_DISTANCE;
    graph.cameraPosition(
      { x: at.x + dir.x * dist, y: at.y + dir.y * dist, z: at.z + dir.z * dist },
      at,
      flightMs(opts),
    );
    queueCameraChange();
  }

  function queueCameraChange(): void {
    if (cameraChangeQueued || destroyed || !options?.onCameraChange) return;
    cameraChangeQueued = true;
    requestAnimationFrame(() => {
      cameraChangeQueued = false;
      if (destroyed) return;
      options.onCameraChange?.(getCamera());
    });
  }

  // =========================================================================
  // Tooltips
  // =========================================================================

  function tooltipFormatter(): GraphTooltipFormatter | null {
    const t = options?.tooltip;
    return t && typeof t === 'object' ? (t.formatter ?? null) : null;
  }

  /**
   * Project a scene point into wrapper-relative pixels. `graph2ScreenCoords` is
   * canvas-relative, and the tooltip manager positions against the wrapper, so
   * the surface's offset inside the wrapper is added here.
   */
  function toWrapperXY(p: { x: number; y: number; z: number }): { x: number; y: number } | null {
    const screen = graph.graph2ScreenCoords(p.x, p.y, p.z);
    if (!screen || !Number.isFinite(screen.x) || !Number.isFinite(screen.y)) return null;
    const s = surfaceEl.getBoundingClientRect();
    const w = shell.wrapper.getBoundingClientRect();
    return { x: screen.x + (s.left - w.left), y: screen.y + (s.top - w.top) };
  }

  function applyFormatterResult(
    result: TooltipContent | string | HTMLElement | null,
    x: number,
    y: number,
  ): void {
    const tm = shell.tooltipManager;
    if (!tm) return;
    if (result === null) tm.hide();
    else if (typeof result === 'string') tm.show({ text: result }, x, y);
    else if (result instanceof HTMLElement) tm.show({ element: result }, x, y);
    else tm.show(result, x, y);
  }

  /**
   * Re-anchor whatever tooltip is open, rendering its content only when the
   * open target has changed since the last render. Everything else is a
   * reposition, which is what the tick and orbit paths actually need.
   */
  function anchorTooltip(): void {
    const tm = shell.tooltipManager;
    if (!tm || openTooltip === null) return;
    const formatter = tooltipFormatter();
    const key =
      openTooltip.kind === 'node' ? `node:${openTooltip.id}` : `edge:${openTooltip.index}`;

    if (openTooltip.kind === 'node') {
      const id = openTooltip.id;
      const datum = nodeById.get(id);
      const defaults = compilation.tooltipDescriptors.get(id);
      if (!datum || !defaults) return;
      const at = toWrapperXY({ x: datum.x ?? 0, y: datum.y ?? 0, z: datum.z ?? 0 });
      if (!at) return;
      if (key === renderedTooltip) {
        tm.move(at.x, at.y);
        return;
      }
      renderedTooltip = key;
      if (!formatter) {
        tm.show(defaults, at.x, at.y);
        return;
      }
      applyFormatterResult(
        formatter({ kind: 'node', data: nodeDataMap.get(id) ?? {} }, defaults),
        at.x,
        at.y,
      );
      return;
    }

    const link = linkData[openTooltip.index];
    if (!link) return;
    const a = endpointPos(link.source);
    const b = endpointPos(link.target);
    const at = toWrapperXY({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });
    if (!at) return;
    if (key === renderedTooltip) {
      tm.move(at.x, at.y);
      return;
    }
    renderedTooltip = key;
    const defaults = buildEdgeTooltip(link.edge);
    if (!formatter) {
      tm.show(defaults, at.x, at.y);
      return;
    }
    applyFormatterResult(
      formatter({ kind: 'edge', data: link.edge.data ?? {} }, defaults),
      at.x,
      at.y,
    );
  }

  function endpointPos(endpoint: string | Node3D): { x: number; y: number; z: number } {
    if (typeof endpoint !== 'string') {
      return { x: endpoint.x ?? 0, y: endpoint.y ?? 0, z: endpoint.z ?? 0 };
    }
    const datum = nodeById.get(endpoint);
    return { x: datum?.x ?? 0, y: datum?.y ?? 0, z: datum?.z ?? 0 };
  }

  function hideTooltip(): void {
    openTooltip = null;
    renderedTooltip = null;
    shell.tooltipManager?.hide();
  }

  // =========================================================================
  // Legend
  // =========================================================================

  function legendSetting(): boolean | { interactive?: boolean; counts?: boolean } | undefined {
    return options?.legend ?? currentSpec.legend;
  }

  function legendConfig(): { interactive: boolean; counts: boolean } {
    const l = legendSetting();
    if (l && typeof l === 'object') {
      return { interactive: l.interactive ?? true, counts: l.counts ?? true };
    }
    return { interactive: true, counts: true };
  }

  function getLegend(): GraphLegendData {
    const nodeEntries = 'entries' in compilation.legend ? compilation.legend.entries : [];
    return {
      field: compilation.legendField,
      nodes: nodeEntries
        .filter((e) => !e.overflow)
        .map((e) => ({
          label: e.label,
          color: e.color,
          count: e.count,
          active: activeCategories.size === 0 || activeCategories.has(e.label),
        })),
      edges: (compilation.edgeLegend ?? []).map((e) => ({
        label: e.label,
        color: e.color,
        count: e.count,
      })),
    };
  }

  function renderLegend(): void {
    if (!shell.legendEl) return;
    const view = { nodes: getLegend().nodes, edges: getLegend().edges };
    if (!legendController) {
      const cfg = legendConfig();
      legendController = createGraphLegend(shell.legendEl, view, {
        interactive: cfg.interactive,
        counts: cfg.counts,
        onToggle: (value) => toggleLegendCategory(value),
        onHover: (value) => {
          const field = compilation.legendField;
          options?.onLegendHover?.(value !== null && field ? { field, value } : null);
        },
      });
    } else {
      legendController.update(view);
    }
    shell.syncChromeInset();
  }

  function toggleLegendCategory(value: string): void {
    if (activeCategories.has(value)) activeCategories.delete(value);
    else activeCategories.add(value);
    recomputeHighlight();
    renderLegend();
    armEmphasis();
    options?.onLegendToggle?.([...activeCategories]);
    emitHighlightChange();
  }

  // =========================================================================
  // Interaction wiring
  // =========================================================================

  function handleNodeClick(nodeId: string, shiftKey: boolean): void {
    if (shiftKey) {
      if (selectedNodeIds.has(nodeId)) selectedNodeIds.delete(nodeId);
      else selectedNodeIds.add(nodeId);
    } else {
      selectedNodeIds = new Set([nodeId]);
    }
    armEmphasis();
    options?.onSelectionChange?.([...selectedNodeIds]);
    options?.onNodeClick?.(nodeDataMap.get(nodeId) ?? {});
  }

  const raycaster = new Raycaster();
  const pointer = new Vector2();

  /** Node id under a mouse event, via a raycast against the node groups. */
  function pickNode(event: MouseEvent): string | null {
    const canvas = graph.renderer()?.domElement;
    const camera = graph.camera();
    if (!canvas || !camera) return null;
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / (rect.width || 1)) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / (rect.height || 1)) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const groups = [...nodeObjects.values()].map((o) => o.group);
    const hits = raycaster.intersectObjects(groups, true);
    for (const hit of hits) {
      // The hit is the sphere mesh; the node id lives on its parent group.
      let obj: Object3D | null = hit.object;
      while (obj) {
        const id = obj.userData?.nodeId;
        if (typeof id === 'string') return id;
        obj = obj.parent;
      }
    }
    return null;
  }

  const onCanvasCameraInput = (): void => {
    autoFit = false;
  };

  const onCanvasDblClick = (event: MouseEvent): void => {
    const id = pickNode(event);
    // Matches 2D exactly: the two clicks already fired, and the double-click
    // fires IN ADDITION rather than suppressing them.
    if (id) options?.onNodeDoubleClick?.(nodeDataMap.get(id) ?? {});
  };

  const onContextLost = (event: Event): void => {
    event.preventDefault();
  };
  const onContextRestored = (): void => {
    if (!destroyed) graph.refresh();
  };

  // =========================================================================
  // Entrance
  // =========================================================================

  /** Drop the entrance multipliers and restore every node to full scale. */
  function endEntrance(): void {
    entranceActive = false;
    entranceCameraPull = 1;
    for (const obj of nodeObjects.values()) obj.mesh.scale.setScalar(1);
    paint();
  }

  /**
   * Nodes pop in (scale 0.01 → 1 with an overshoot, opacity 0 → their emphasis
   * alpha), staggered by `entranceOrder`; links fade in a beat after the later
   * of their endpoints; the camera starts pulled back to
   * `ENTRANCE_CAMERA_PULLBACK ×` the fit and flies in over the same window.
   *
   * The pull-in is expressed as a MULTIPLIER on the fit distance rather than as
   * its own camera flight. The settle-phase auto-fit re-frames the cloud every
   * `AUTO_FIT_INTERVAL_MS` while the layout expands from its seeded blob, and a
   * flight to a distance computed at t=0 would be re-targeting a framing that is
   * already stale. As a multiplier the two compose: the auto-fit keeps deciding
   * WHAT to frame, the entrance only decides how far back to stand.
   *
   * Runs once per mount. `update()` never calls it.
   */
  function startEntrance(): void {
    const enter = compilation.animation?.enter ?? null;
    if (options?.suppressEntrance || !enter || prefersReducedMotion()) {
      endEntrance();
      return;
    }

    // Same gate as 2D: thousands of distinct start times read as noise, so
    // above the cap the whole graph reveals as one.
    const stagger = enter.stagger && compilation.nodes.length <= ENTRANCE_STAGGER_MAX_NODES;
    const plan = planEntrance(
      nodeData.map((d) => ({ id: d.id, x: d.x ?? 0, y: d.y ?? 0 })),
      compilation.edges,
      enter.duration,
      stagger,
    );
    const ease = resolveEase(enter.ease);

    entranceActive = true;
    entranceCameraPull = enter.cameraFit ? ENTRANCE_CAMERA_PULLBACK : 1;
    for (const id of plan.nodeOffset.keys()) {
      entranceNodeAlpha.set(id, 0);
      entranceNodeScale.set(id, ENTRANCE_MIN_SCALE);
    }
    for (const index of plan.linkOffset.keys()) entranceEdgeAlpha.set(index, 0);
    paint();

    // The driver runs linear over the whole span so each element can apply the
    // spec's ease across its OWN window; easing the global clock instead would
    // squeeze the stagger rather than shape each pop.
    const tween = createTween({
      duration: plan.span,
      ease: linear,
      apply: (t) => {
        const elapsed = t * plan.span;
        for (const [id, offset] of plan.nodeOffset) {
          const p = elementProgress(elapsed, offset, enter.duration, ease);
          entranceNodeAlpha.set(id, popAlpha(p));
          entranceNodeScale.set(id, Math.max(ENTRANCE_MIN_SCALE, popScale(p)));
        }
        for (const [index, offset] of plan.linkOffset) {
          entranceEdgeAlpha.set(index, elementProgress(elapsed, offset, enter.duration, ease));
        }
        if (enter.cameraFit) {
          entranceCameraPull = ENTRANCE_CAMERA_PULLBACK + (1 - ENTRANCE_CAMERA_PULLBACK) * ease(t);
          // The auto-fit throttle is too coarse to carry a flight, so the
          // entrance re-fits every frame while it owns the standoff.
          if (autoFit && options?.fitOnLoad !== false) fitNow({ duration: 0 });
        }
        paint();
      },
      onDone: endEntrance,
    });
    scheduler.add(tween);
  }

  // =========================================================================
  // Public handle
  // =========================================================================

  function search(query: string): void {
    if (destroyed) return;
    searchManager.search(query, compilation.nodes);
    armEmphasis();
  }

  function clearSearch(): void {
    if (destroyed) return;
    searchManager.clearSearch();
    armEmphasis();
  }

  function selectNode(nodeId: string, opts?: { fly?: boolean } & CameraFlightOptions): void {
    if (destroyed) return;
    selectedNodeIds = new Set([nodeId]);
    armEmphasis();
    options?.onSelectionChange?.([nodeId]);
    const shouldFly = opts?.fly ?? compilation.interaction.selectFlyTo;
    if (shouldFly) zoomToNode(nodeId, opts);
  }

  function highlight(target: GraphHighlightTarget, opts?: { dimOpacity?: number }): void {
    if (destroyed) return;
    transientTarget = target;
    refreshTransientHighlight();
    highlightDimOpacity = opts?.dimOpacity ?? null;
    recomputeHighlight();
    armEmphasis();
    emitHighlightChange();
  }

  function clearHighlight(): void {
    if (destroyed) return;
    transientTarget = null;
    transientHighlight = null;
    highlightDimOpacity = null;
    recomputeHighlight();
    armEmphasis();
    emitHighlightChange();
  }

  function setActiveCategories(values: string[]): void {
    if (destroyed) return;
    activeCategories = new Set(values);
    recomputeHighlight();
    renderLegend();
    armEmphasis();
    emitHighlightChange();
  }

  function doResize(): void {
    if (destroyed) return;
    // three-render-objects reads devicePixelRatio once, at construction, so a
    // window dragged onto a retina display (or a browser zoom change) would
    // stay soft until remount. Re-apply it before the size, which is what
    // actually reallocates the drawing buffer.
    const renderer = graph.renderer() as
      | { getPixelRatio?(): number; setPixelRatio?(v: number): void }
      | undefined;
    const dpr = Math.min(MAX_PIXEL_RATIO, globalThis.devicePixelRatio || 1);
    if (renderer?.getPixelRatio?.() !== dpr) renderer?.setPixelRatio?.(dpr);
    const { width, height } = shell.getSize();
    graph.width(width).height(height);
    shell.syncChromeInset();
  }

  /**
   * Unified data update.
   *
   * `diffGraphUpdate` classifies the change exactly as in 2D. A visual-only
   * change mutates materials and geometry in place and never touches
   * `graphData()`. A structural change reuses the surviving node datums (so
   * their positions, velocities AND their scene-object bindings all carry
   * over), spawns z for entering nodes from the seeded stream, and then calls
   * `graphData()`.
   *
   * 3D difference: `graphData()` reheats the layout globally (alpha 1). 2D
   * applies a local impulse instead (`initialAlpha` + `suppressCenter`), which
   * 3d-force-graph gives us no seam for. Carried positions stop survivors from
   * respawning, but they do drift; `d3AlphaDecay` from the compiled `settle`
   * bounds how far.
   */
  function update(newSpec: GraphSpec): void {
    if (destroyed) return;

    const next = ctx.compile(newSpec);
    if (next.numDimensions !== 3) {
      shell.warn('createGraph: update() cannot change dimensions; remount the graph');
      return;
    }

    scheduler.finishAll();

    const prevNodes: PositionedNode[] = nodeData.map((d, index) => ({
      ...d.node,
      x: d.x ?? 0,
      y: d.y ?? 0,
      index,
    }));
    const prevEdges: PositionedEdge[] = compilation.edges.map((edge) => {
      const a = endpointPos(edge.source);
      const b = endpointPos(edge.target);
      return { ...edge, sourceX: a.x, sourceY: a.y, targetX: b.x, targetY: b.y };
    });
    const prevConfig = compilation.simulationConfig;
    const prevUseLinkWidth = useLinkWidth;

    currentSpec = newSpec;
    compilation = next;
    // The compiled descriptors behind an open tooltip may have changed, so the
    // next anchor must re-render rather than take the reposition fast path.
    renderedTooltip = null;

    const diff = diffGraphUpdate(
      prevNodes,
      prevEdges,
      compilation,
      prevConfig,
      prevConfig.seed ?? 0,
    );

    rebuildDerived();
    shell.renderChrome(compilation);
    renderLegend();
    refreshTransientHighlight();
    recomputeHighlight();
    reRunSearch();

    // An `edgeWidth` encoding appearing or disappearing swaps every link
    // between a cylinder mesh and a line. The scene binds objects to datums by
    // identity, so a replacement object would never reach the scene: that one
    // change has to go through `graphData()` even though the ids are unchanged.
    const shapeClassChanged = (): boolean =>
      useLinkWidth !== prevUseLinkWidth ||
      [...linkObjects.values()].some((obj) => !linkShapeMatches(obj, useLinkWidth));

    if (diff.visualOnly && !shapeClassChanged()) {
      // Same ids in the same order, so the datum's compiled node/edge can be
      // swapped under the existing scene objects with no layout restart.
      for (let i = 0; i < compilation.nodes.length; i++) {
        const node = compilation.nodes[i];
        nodeData[i].node = node;
        const obj = nodeObjects.get(node.id);
        if (obj) applyNodeVisuals(obj, node, labelColor());
      }
      for (let i = 0; i < compilation.edges.length; i++) {
        const edge = compilation.edges[i];
        linkData[i].edge = edge;
        const obj = linkObjects.get(i);
        // Width, dash pattern and color all move here: color alone would leave
        // a cylinder at its old radius and a line at its old dash geometry.
        if (obj) applyLinkVisuals(obj, edge, useLinkWidth);
      }
      pruneInteractionState();
      armEmphasis();
      return;
    }

    // Structural: dispose the scene objects for everything that left, then
    // rebuild the data arrays with carried-over kinematics.
    const nextNodeIds = new Set(compilation.nodes.map((n) => n.id));
    for (const [id, obj] of nodeObjects) {
      if (!nextNodeIds.has(id)) {
        disposeNodeObject(obj);
        nodeObjects.delete(id);
        displayNodeAlpha.delete(id);
        entranceNodeAlpha.delete(id);
        entranceNodeScale.delete(id);
      }
    }
    // Link objects are keyed by index into the edge list, which the new
    // compilation renumbers, so they all go.
    for (const obj of linkObjects.values()) disposeLinkObject(obj);
    linkObjects.clear();
    displayEdgeAlpha.clear();
    entranceEdgeAlpha.clear();

    // Survivors keep their EXISTING datum OBJECT, mutated in place.
    //
    // This is not a micro-optimisation, it is the only correct thing to do.
    // `graphData()` runs a `DataBindMapper` digest whose id accessor is
    // identity (`d => d`); three-forcegraph never sets one, and `graphData()`
    // does not clear the node mapper. Handing the digest a fresh literal for a
    // node whose cached group `nodeThreeObject` still returns therefore binds
    // that group to the NEW datum, and then the OLD datum -- absent from the
    // new set -- runs the remove hook on the SAME group: `scene.remove`,
    // `_deallocate`, and the binding deleted. Every survivor silently leaves
    // the scene and the tick loop. Reusing the datum keeps the binding, and it
    // already carries the x/y/z and vx/vy/vz that used to be copied out into
    // carry-over maps.
    const survivors = new Map(nodeById);
    nodeData = compilation.nodes.map((node) => {
      const existing = survivors.get(node.id);
      if (existing) {
        existing.node = node;
        return existing;
      }
      const spawn = diff.spawnPositions.get(node.id) ?? { x: 0, y: 0 };
      return {
        id: node.id,
        node,
        x: spawn.x,
        y: spawn.y,
        z: seedZ(node.id, node.radius, node.community),
      };
    });
    linkData = compilation.edges.map((edge, edgeIndex) => ({
      source: edge.source,
      target: edge.target,
      edge,
      edgeIndex,
    }));

    nodeById = new Map(nodeData.map((d) => [d.id, d]));
    applySimulationConfig(graph, compilation.simulationConfig, nodeData.length);
    graph.graphData({ nodes: nodeData, links: linkData });
    pruneInteractionState();
    armEmphasis();
  }

  function pruneInteractionState(): void {
    const ids = new Set(compilation.nodes.map((n) => n.id));
    if (hoveredNodeId && !ids.has(hoveredNodeId)) hoveredNodeId = null;
    hoveredLinkIndex = null;
    selectedNodeIds = new Set([...selectedNodeIds].filter((id) => ids.has(id)));
    if (openTooltip?.kind === 'node' && !ids.has(openTooltip.id)) hideTooltip();
    if (openTooltip?.kind === 'edge') hideTooltip();
  }

  function reRunSearch(): void {
    const q = searchManager.getQuery();
    if (q !== null) searchManager.search(q, compilation.nodes);
  }

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;

    scheduler.cancelAll();
    if (pumpId !== null) {
      cancelAnimationFrame(pumpId);
      pumpId = null;
    }

    const canvas = graph.renderer()?.domElement;
    canvas?.removeEventListener('dblclick', onCanvasDblClick);
    canvas?.removeEventListener('pointerdown', onCanvasCameraInput);
    canvas?.removeEventListener('wheel', onCanvasCameraInput);
    canvas?.removeEventListener('webglcontextlost', onContextLost);
    canvas?.removeEventListener('webglcontextrestored', onContextRestored);
    if (controlsListener) {
      (
        graph.controls() as { removeEventListener?(t: string, f: () => void): void }
      ).removeEventListener?.('change', controlsListener);
      controlsListener = null;
    }
    disconnectResize();

    // Grab the renderer BEFORE _destructor(): it tears down the render loop and
    // the DOM, after which the accessor is no longer reliable.
    const renderer = graph.renderer();
    graph._destructor();

    for (const obj of nodeObjects.values()) disposeNodeObject(obj);
    nodeObjects.clear();
    for (const obj of linkObjects.values()) disposeLinkObject(obj);
    linkObjects.clear();

    // Browsers cap live WebGL contexts (~16). `dispose()` alone does not free
    // one; the context has to be explicitly lost.
    renderer?.dispose();
    (renderer as { forceContextLoss?(): void })?.forceContextLoss?.();

    legendController?.destroy();
    legendController = null;

    shell.destroy();
  }

  // =========================================================================
  // Boot
  // =========================================================================

  rebuildDerived();
  shell.renderChrome(compilation);
  renderLegend();

  const initial = compilation.initialHighlight;
  if (initial) {
    activeCategories = new Set(initial.values);
    recomputeHighlight();
  }

  // Read the SPEC's background, not the resolved theme's: the default resolved
  // theme also reports 'transparent', so keying off the compilation would make
  // every 3D graph see-through. 2D resolves transparent to an opaque surface
  // because it paints on a canvas; 3D honours it only when a host asked for it.
  const requestedBackground = themeBackground(options?.theme) ?? themeBackground(currentSpec.theme);
  if (requestedBackground === 'transparent') {
    graph.backgroundColor('rgba(0,0,0,0)');
    // The shared wrapper paints `--oc-bg` behind the canvas, which would defeat
    // the transparent renderer clear color.
    shell.wrapper.style.background = 'transparent';
  } else {
    graph.backgroundColor(resolvedSurface(compilation.theme));
  }

  graph
    .showNavInfo(false)
    .enableNodeDrag(false)
    .nodeId('id')
    // Our own DOM tooltip owns hover text; the library's built-in label would
    // render a second, unstyled one on top of it.
    .nodeLabel('')
    .linkLabel('')
    .nodeVal((d: Node3D) => d.node.radius)
    .nodeColor((d: Node3D) => d.node.fill)
    .nodeThreeObject((d: Node3D) => nodeObjectFor(d).group)
    .linkColor((d: Link3D) => d.edge.stroke)
    .linkWidth((d: Link3D) => (useLinkWidth ? d.edge.strokeWidth : 0))
    .linkThreeObject((d: Link3D) => linkObjectFor(d).object)
    .linkPositionUpdate((_obj, coords, d: Link3D) => {
      const link = linkObjects.get(d.edgeIndex);
      // Returning false hands cylinder meshes back to the library, which
      // already positions them correctly (translate + scale.z + lookAt).
      return link ? updateLinkPosition(link, coords.start, coords.end) : false;
    })
    // Lines are thin hit targets compared with a 2D 5px hit band.
    .linkHoverPrecision(useLinkWidth ? 4 : 8);

  const { width, height } = shell.getSize();
  graph.width(width).height(height);

  applySimulationConfig(graph, compilation.simulationConfig, compilation.nodes.length);
  buildGraphData(seedPositions(compilation.nodes));

  // Resting opacities before the first frame, so nothing flashes at full alpha.
  for (const n of compilation.nodes) displayNodeAlpha.set(n.id, n.opacity);
  for (let i = 0; i < compilation.edges.length; i++) {
    displayEdgeAlpha.set(i, edgeBaseAlpha?.get(i) ?? 0.3);
  }
  armEmphasis();
  startEntrance();

  graph
    .onNodeHover((node) => {
      const id = node ? node.id : null;
      if (id === hoveredNodeId) return;
      hoveredNodeId = id;
      if (id && hoveredLinkIndex !== null) {
        hoveredLinkIndex = null;
        options?.onEdgeHover?.(null);
      }
      armEmphasis();
      options?.onNodeHover?.(id ? (nodeDataMap.get(id) ?? {}) : null);
      if (id && shell.tooltipManager) {
        openTooltip = { kind: 'node', id };
        anchorTooltip();
      } else {
        hideTooltip();
      }
    })
    .onLinkHover((link) => {
      const index = link ? link.edgeIndex : null;
      if (index === hoveredLinkIndex) return;
      // A live node hover owns the tooltip; don't let an edge steal it.
      if (hoveredNodeId !== null) return;
      hoveredLinkIndex = index;
      options?.onEdgeHover?.(link ? (link.edge.data ?? {}) : null);
      if (index !== null && shell.tooltipManager) {
        openTooltip = { kind: 'edge', index };
        anchorTooltip();
      } else {
        hideTooltip();
      }
    })
    .onNodeClick((node, event) => {
      handleNodeClick(node.id, Boolean(event?.shiftKey));
    })
    .onBackgroundClick(() => {
      if (selectedNodeIds.size === 0) return;
      selectedNodeIds = new Set();
      armEmphasis();
      options?.onSelectionChange?.([]);
    })
    .onEngineTick(() => {
      if (destroyed) return;
      // The node moves under a still pointer while the layout settles, so an
      // open tooltip has to follow it.
      anchorTooltip();
      if (autoFit && options?.fitOnLoad !== false) {
        const now = performance.now();
        if (now - lastAutoFit > AUTO_FIT_INTERVAL_MS) {
          lastAutoFit = now;
          fitNow({ duration: 0 });
          refreshLabels();
        }
      }
    })
    .onEngineStop(() => {
      if (destroyed) return;
      if (autoFit && options?.fitOnLoad !== false) {
        autoFit = false;
        fitNow({ duration: 0 });
      }
      refreshLabels();
    });

  // Orbiting changes both the label ranking and the tooltip anchor.
  controlsListener = (): void => {
    if (destroyed) return;
    scheduleLabelRank();
    anchorTooltip();
    queueCameraChange();
  };
  (graph.controls() as { addEventListener?(t: string, f: () => void): void }).addEventListener?.(
    'change',
    controlsListener,
  );

  const canvasEl = graph.renderer()?.domElement;
  canvasEl?.addEventListener('dblclick', onCanvasDblClick);
  canvasEl?.addEventListener('pointerdown', onCanvasCameraInput);
  canvasEl?.addEventListener('wheel', onCanvasCameraInput, { passive: true });
  canvasEl?.addEventListener('webglcontextlost', onContextLost);
  canvasEl?.addEventListener('webglcontextrestored', onContextRestored);

  const disconnectResize = shell.observeResize(() => doResize());

  return {
    update,
    // `update()` already routes an id-set-preserving change through the
    // material-mutation path, which never touches `graphData()`.
    updateVisuals: update,
    search,
    clearSearch,
    zoomToFit,
    zoomToNode,
    flyTo,
    centerAt: (x, y, opts) => flyTo({ x, y }, opts),
    getCamera,
    selectNode,
    getSelectedNodes: () => [...selectedNodeIds],
    getSearchMatches: () => [...(searchManager.getMatches() ?? [])],
    highlight,
    clearHighlight,
    getHighlight: () => (highlightSet ? [...highlightSet] : null),
    getLegend,
    setActiveCategories,
    getActiveCategories: () => [...activeCategories],
    resize: doResize,
    destroy,
  };
}

/**
 * The background a spec or mount option explicitly asked for.
 *
 * `ThemeConfig.colors` also accepts a bare palette array, which carries no
 * background, hence the shape guard.
 */
function themeBackground(theme: ThemeConfig | undefined): string | undefined {
  const colors = theme?.colors;
  if (!colors || Array.isArray(colors)) return undefined;
  return typeof colors.background === 'string' ? colors.background : undefined;
}
