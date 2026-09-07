/**
 * Chain-recording stand-in for `3d-force-graph`.
 *
 * Models the two halves of the real API separately, because conflating them is
 * the mistake RFC 27 called out: `controlType` and `rendererConfig` arrive as
 * CONSTRUCTOR options, everything else is a chainable setter. Accessor values
 * and functions are recorded verbatim so tests can call them with a compiled
 * datum and assert on what comes back, rather than on call sequences.
 *
 * `graphData()` models the real digest rather than just calling the accessors,
 * because the shape of that digest is what the adapter has to be correct
 * against. Specifically, three-forcegraph binds objects to datums through a
 * `DataBindMapper` whose id accessor is IDENTITY (`d => d`) and never clears
 * the node mapper on a `graphData()` call, so:
 *
 * - a datum already in the binding is left alone (no object is created);
 * - a datum that has left the set runs the remove hook on ITS bound object:
 *   the object leaves the scene, is deallocated, and `datum.__threeObj` goes;
 * - creation is deferred behind Kapsule's debounced digest, so objects do not
 *   exist the instant `graphData()` returns. {@link FakeForceGraph3D.flush}
 *   stands in for that.
 *
 * Handing the digest a fresh datum literal for a node whose CACHED object the
 * accessor still returns therefore rebinds that object to the new datum and
 * then removes it on behalf of the old one. That is a real failure mode of the
 * adapter's structural `update()`, and a fake that only called the accessors
 * could not see it.
 */

import type { Object3D } from './three-fake';

interface FakeForce {
  strength: (v: number) => FakeForce;
  distance: (v: number) => FakeForce;
  /** Last value passed to `strength`, or undefined. */
  strengthValue?: number;
  /** Last value passed to `distance`, or undefined. */
  distanceValue?: number;
}

function makeForce(): FakeForce {
  const f: FakeForce = {
    strength(v: number) {
      f.strengthValue = v;
      return f;
    },
    distance(v: number) {
      f.distanceValue = v;
      return f;
    },
  };
  return f;
}

export interface FakeControls {
  target: { x: number; y: number; z: number };
  addEventListener(type: string, fn: () => void): void;
  removeEventListener(type: string, fn: () => void): void;
  emit(type: string): void;
}

/** Every instance constructed since the last {@link resetForceGraphFakes}. */
export const forceGraphInstances: FakeForceGraph3D[] = [];

export function resetForceGraphFakes(): void {
  forceGraphInstances.length = 0;
}

export class FakeForceGraph3D {
  /** Second constructor argument: `controlType` / `rendererConfig`. */
  readonly config: Record<string, unknown>;
  readonly el: HTMLElement;

  /** Every chained setter's last value, keyed by setter name. */
  readonly props: Record<string, unknown> = {};
  /** Every registered lifecycle/interaction handler, keyed by setter name. */
  readonly handlers: Record<string, (...args: never[]) => void> = {};
  /** Forces set through `d3Force(name, fn)`. */
  readonly forces = new Map<string, unknown>();

  readonly canvas: HTMLCanvasElement;
  readonly fakeRenderer: {
    domElement: HTMLCanvasElement;
    dispose: () => void;
    forceContextLoss: () => void;
    disposeCount: number;
    contextLossCount: number;
    pixelRatio: number;
    getPixelRatio: () => number;
    setPixelRatio: (v: number) => void;
  };
  readonly fakeCamera = { position: { x: 0, y: 0, z: 1000 } };
  readonly fakeControls: FakeControls;
  readonly fakeScene = { children: [] as Object3D[] };

  graph: { nodes: Array<Record<string, unknown>>; links: Array<Record<string, unknown>> } = {
    nodes: [],
    links: [],
  };
  /** Number of `refresh()` calls. The hover path must never increment this. */
  refreshCount = 0;
  destructorCount = 0;
  zoomToFitCalls: Array<[number | undefined, number | undefined]> = [];
  cameraPositionCalls: Array<{
    position: { x: number; y: number; z: number };
    lookAt?: { x: number; y: number; z: number };
    ms?: number;
  }> = [];
  /** Where `graph2ScreenCoords` should say scene points project to. */
  projection = { x: 100, y: 50, z: 0 };

  constructor(el: HTMLElement, config: Record<string, unknown> = {}) {
    this.el = el;
    this.config = config;
    this.canvas = el.ownerDocument.createElement('canvas');
    el.appendChild(this.canvas);
    let disposeCount = 0;
    let contextLossCount = 0;
    this.fakeRenderer = {
      domElement: this.canvas,
      dispose: () => {
        disposeCount++;
        this.fakeRenderer.disposeCount = disposeCount;
      },
      forceContextLoss: () => {
        contextLossCount++;
        this.fakeRenderer.contextLossCount = contextLossCount;
      },
      disposeCount: 0,
      contextLossCount: 0,
      pixelRatio: 1,
      getPixelRatio: () => this.fakeRenderer.pixelRatio,
      setPixelRatio: (v: number) => {
        this.fakeRenderer.pixelRatio = v;
      },
    };
    const listeners = new Map<string, Set<() => void>>();
    this.fakeControls = {
      target: { x: 0, y: 0, z: 0 },
      addEventListener: (type, fn) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(fn);
      },
      removeEventListener: (type, fn) => {
        listeners.get(type)?.delete(fn);
      },
      emit: (type) => {
        for (const fn of listeners.get(type) ?? []) fn();
      },
    };
    this.forces.set('charge', makeForce());
    this.forces.set('link', makeForce());
    // 3d-force-graph installs a centering force of its own; `centerForce: false`
    // has to remove it, so the fake has to have one to remove.
    this.forces.set('center', makeForce());
    forceGraphInstances.push(this);
  }

  // -- Chainable setters ---------------------------------------------------

  private set(name: string, value: unknown): this {
    this.props[name] = value;
    return this;
  }

  private on(name: string, fn: (...args: never[]) => void): this {
    this.handlers[name] = fn;
    return this;
  }

  width(v: number): this {
    return this.set('width', v);
  }
  height(v: number): this {
    return this.set('height', v);
  }
  backgroundColor(v: string): this {
    return this.set('backgroundColor', v);
  }
  showNavInfo(v: boolean): this {
    return this.set('showNavInfo', v);
  }
  enableNodeDrag(v: boolean): this {
    return this.set('enableNodeDrag', v);
  }
  nodeId(v: string): this {
    return this.set('nodeId', v);
  }
  nodeLabel(v: unknown): this {
    return this.set('nodeLabel', v);
  }
  linkLabel(v: unknown): this {
    return this.set('linkLabel', v);
  }
  nodeVal(v: unknown): this {
    return this.set('nodeVal', v);
  }
  nodeColor(v: unknown): this {
    return this.set('nodeColor', v);
  }
  nodeThreeObject(v: unknown): this {
    return this.set('nodeThreeObject', v);
  }
  linkColor(v: unknown): this {
    return this.set('linkColor', v);
  }
  linkWidth(v: unknown): this {
    return this.set('linkWidth', v);
  }
  linkThreeObject(v: unknown): this {
    return this.set('linkThreeObject', v);
  }
  linkPositionUpdate(v: unknown): this {
    return this.set('linkPositionUpdate', v);
  }
  linkHoverPrecision(v: number): this {
    return this.set('linkHoverPrecision', v);
  }
  d3VelocityDecay(v: number): this {
    return this.set('d3VelocityDecay', v);
  }
  d3AlphaDecay(v: number): this {
    return this.set('d3AlphaDecay', v);
  }
  warmupTicks(v: number): this {
    return this.set('warmupTicks', v);
  }
  cooldownTicks(v: number): this {
    return this.set('cooldownTicks', v);
  }

  onNodeHover(fn: (...args: never[]) => void): this {
    return this.on('onNodeHover', fn);
  }
  onLinkHover(fn: (...args: never[]) => void): this {
    return this.on('onLinkHover', fn);
  }
  onNodeClick(fn: (...args: never[]) => void): this {
    return this.on('onNodeClick', fn);
  }
  onBackgroundClick(fn: (...args: never[]) => void): this {
    return this.on('onBackgroundClick', fn);
  }
  onEngineTick(fn: (...args: never[]) => void): this {
    return this.on('onEngineTick', fn);
  }
  onEngineStop(fn: (...args: never[]) => void): this {
    return this.on('onEngineStop', fn);
  }

  d3Force(name: string, fn?: unknown): unknown {
    if (fn === undefined) return this.forces.get(name);
    this.forces.set(name, fn);
    return this;
  }

  /**
   * Queue a digest, exactly as the real library does: the data is swapped
   * immediately, the objects are materialized on the next {@link flush}.
   */
  graphData(data?: {
    nodes: Array<Record<string, unknown>>;
    links: Array<Record<string, unknown>>;
  }): unknown {
    if (!data) return this.graph;
    this.graph = data;
    this.pendingDigest = true;
    return this;
  }

  /** Kapsule's debounced digest, run on demand. */
  flush(): this {
    if (!this.pendingDigest) return this;
    this.pendingDigest = false;
    this.digest(
      this.nodeBinding,
      this.graph.nodes,
      this.props.nodeThreeObject as ((d: unknown) => Object3D) | undefined,
    );
    this.digest(
      this.linkBinding,
      this.graph.links,
      this.props.linkThreeObject as ((d: unknown) => Object3D) | undefined,
    );
    return this;
  }

  /**
   * One `DataBindMapper` cycle. Keyed by datum identity, creates first and
   * removes second, which is the ordering that makes the cached-object collision
   * observable.
   */
  private digest(
    binding: Map<Record<string, unknown>, Object3D>,
    data: Array<Record<string, unknown>>,
    accessor: ((d: unknown) => Object3D) | undefined,
  ): void {
    if (typeof accessor !== 'function') return;
    const objToDatum = new Map<Object3D, Record<string, unknown>>();
    for (const [d, o] of binding) objToDatum.set(o, d);

    for (const d of data) {
      if (binding.has(d)) continue;
      const obj = accessor(d);
      d.__threeObj = obj;
      binding.set(d, obj);
      objToDatum.set(obj, d);
      if (!this.fakeScene.children.includes(obj)) this.fakeScene.children.push(obj);
      this.removedFromScene.delete(obj);
    }

    const present = new Set(data);
    for (const [d, obj] of [...binding]) {
      if (present.has(d)) continue;
      binding.delete(d);
      const bound = objToDatum.get(obj);
      const index = this.fakeScene.children.indexOf(obj);
      if (index >= 0) this.fakeScene.children.splice(index, 1);
      this.removedFromScene.add(obj);
      this.deallocated.push(obj);
      // The library deletes the binding attribute off whichever datum the
      // object currently points at, which is not necessarily `d`.
      if (bound) delete bound.__threeObj;
    }
  }

  /** Datum -> scene object, the node half of the binding. */
  readonly nodeBinding = new Map<Record<string, unknown>, Object3D>();
  /** Datum -> scene object, the link half of the binding. */
  readonly linkBinding = new Map<Record<string, unknown>, Object3D>();
  /** Objects the digest has taken out of the scene. */
  readonly removedFromScene = new Set<Object3D>();
  /** Every object the digest has deallocated, in order. */
  readonly deallocated: Object3D[] = [];
  private pendingDigest = false;

  refresh(): this {
    this.refreshCount++;
    return this;
  }

  zoomToFit(ms?: number, padding?: number): this {
    this.zoomToFitCalls.push([ms, padding]);
    return this;
  }

  cameraPosition(
    position?: { x: number; y: number; z: number },
    lookAt?: { x: number; y: number; z: number },
    ms?: number,
  ): unknown {
    if (!position) return this.fakeCamera.position;
    this.cameraPositionCalls.push({ position, lookAt, ms });
    this.fakeCamera.position = { ...position };
    if (lookAt) this.fakeControls.target = { ...lookAt };
    return this;
  }

  /**
   * Projects with a fixed offset plus the point's own x/y, so screen positions
   * differ per node the way a real projection does (the label declutter pass
   * would be meaningless against a constant).
   */
  graph2ScreenCoords(x = 0, y = 0): { x: number; y: number; z: number } {
    return { x: this.projection.x + x, y: this.projection.y + y, z: 0 };
  }

  camera(): typeof this.fakeCamera {
    return this.fakeCamera;
  }
  controls(): FakeControls {
    return this.fakeControls;
  }
  scene(): typeof this.fakeScene {
    return this.fakeScene;
  }
  renderer(): typeof this.fakeRenderer {
    return this.fakeRenderer;
  }

  _destructor(): void {
    this.destructorCount++;
  }
}

export default FakeForceGraph3D;
