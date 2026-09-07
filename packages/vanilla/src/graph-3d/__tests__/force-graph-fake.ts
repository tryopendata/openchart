/**
 * Chain-recording stand-in for `3d-force-graph`.
 *
 * Models the two halves of the real API separately, because conflating them is
 * the mistake RFC 27 called out: `controlType` and `rendererConfig` arrive as
 * CONSTRUCTOR options, everything else is a chainable setter. Accessor values
 * and functions are recorded verbatim so tests can call them with a compiled
 * datum and assert on what comes back, rather than on call sequences.
 *
 * `graphData()` also invokes `nodeThreeObject` / `linkThreeObject` for each
 * datum, the way the real library's digest cycle does, so scene objects exist
 * in tests without a WebGL frame.
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

  /** Mirrors the real digest: materialize a scene object per node and link. */
  graphData(data?: {
    nodes: Array<Record<string, unknown>>;
    links: Array<Record<string, unknown>>;
  }): unknown {
    if (!data) return this.graph;
    this.graph = data;
    const nodeObj = this.props.nodeThreeObject as ((d: unknown) => Object3D) | undefined;
    const linkObj = this.props.linkThreeObject as ((d: unknown) => Object3D) | undefined;
    if (typeof nodeObj === 'function') for (const n of data.nodes) nodeObj(n);
    if (typeof linkObj === 'function') for (const l of data.links) linkObj(l);
    return this;
  }

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
