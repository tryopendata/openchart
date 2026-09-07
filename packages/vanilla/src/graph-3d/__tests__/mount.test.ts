/**
 * Integration tests for the 3D renderer against mocked `three` and
 * `3d-force-graph`.
 *
 * These assert observable outcomes — what an accessor returns for a compiled
 * node, what the handle reports, which material carries which opacity — rather
 * than mock call sequences, so a refactor inside the adapter doesn't rewrite
 * the suite.
 */

import type { GraphSpec } from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('three', async () => await import('./three-fake'));
vi.mock('three-spritetext', async () => await import('./spritetext-fake'));
vi.mock('3d-force-graph', async () => {
  const mod = await import('./force-graph-fake');
  return { default: mod.FakeForceGraph3D };
});

import { entranceOrder } from '../../graph/entrance';
import type { GraphInstance } from '../../graph-mount';
import { createGraph3D } from '../index';
import { LABEL_BUDGET_3D } from '../labels';
import { FIT_DISTANCE } from '../mount';
import type { Link3D, Node3D } from '../types';
import {
  type FakeForceGraph3D,
  forceGraphInstances,
  resetForceGraphFakes,
} from './force-graph-fake';
import { allocations, type Group, type Line, raycasters, resetAllocations } from './three-fake';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NODES = [
  { id: 'a', label: 'Alpha', kind: 'lab', weight: 1, rel: 1 },
  { id: 'b', label: 'Beta', kind: 'lab', weight: 0.6, rel: 0.5 },
  { id: 'c', label: 'Gamma', kind: 'dataset', weight: 0.2, rel: 0.2 },
];
const EDGES = [
  { source: 'a', target: 'b', confidence: 0.9 },
  { source: 'b', target: 'c', confidence: 0.2 },
];

function spec(overrides: Partial<GraphSpec> = {}): GraphSpec {
  return {
    type: 'graph',
    dimensions: 3,
    nodes: NODES,
    edges: EDGES,
    encoding: {
      nodeColor: { field: 'kind', type: 'nominal' },
      nodeSize: { field: 'weight', type: 'quantitative' },
      nodeOpacity: { field: 'rel', type: 'quantitative' },
      nodeLabel: { field: 'label' },
      edgeWidth: { field: 'confidence', type: 'quantitative' },
    },
    // Hover choreography off by default so emphasis snaps and assertions on
    // material.opacity don't have to wait for a tween.
    animation: false,
    ...overrides,
  } as GraphSpec;
}

function mount(s: GraphSpec = spec(), options?: Parameters<typeof createGraph3D>[2], flush = true) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const instance = createGraph3D(container, s, options);
  const fake = forceGraphInstances[forceGraphInstances.length - 1];
  // The library's digest is debounced; every test but the deferred-creation
  // one wants the steady state where the objects exist.
  if (flush) fake.flush();
  return { container, instance, fake };
}

function nodeDatum(fake: FakeForceGraph3D, id: string): Node3D {
  return fake.graph.nodes.find((n) => (n as unknown as Node3D).id === id) as unknown as Node3D;
}

function nodeGroup(fake: FakeForceGraph3D, id: string): Group {
  const accessor = fake.props.nodeThreeObject as (d: Node3D) => Group;
  return accessor(nodeDatum(fake, id));
}

function nodeMaterial(fake: FakeForceGraph3D, id: string) {
  return (nodeGroup(fake, id).children[0] as unknown as { material: { opacity: number } }).material;
}

function linkObject(fake: FakeForceGraph3D, index: number) {
  const accessor = fake.props.linkThreeObject as (d: Link3D) => Line;
  return accessor(fake.graph.links[index] as unknown as Link3D);
}

beforeEach(() => {
  resetForceGraphFakes();
  resetAllocations();
  raycasters.length = 0;
  document.body.replaceChildren();
});

// ---------------------------------------------------------------------------

describe('construction', () => {
  it('passes controlType and rendererConfig as constructor options, not setters', () => {
    const { fake } = mount();
    expect(fake.config.controlType).toBe('trackball');
    expect(fake.config.rendererConfig).toEqual({ alpha: true, antialias: true });
    expect(fake.props.controlType).toBeUndefined();
    expect(fake.props.rendererConfig).toBeUndefined();
  });

  it('mounts its surface inside the shared shell wrapper', () => {
    const { container } = mount();
    const wrapper = container.querySelector('.oc-graph-wrapper');
    expect(wrapper?.querySelector('.oc-graph-3d')).not.toBeNull();
  });

  it('disables the nav overlay, node drag and the library tooltip', () => {
    const { fake } = mount();
    expect(fake.props.showNavInfo).toBe(false);
    expect(fake.props.enableNodeDrag).toBe(false);
    expect(fake.props.nodeLabel).toBe('');
    expect(fake.props.linkLabel).toBe('');
  });

  it('sizes the scene from the shell', () => {
    const { fake } = mount();
    expect(fake.props.width).toBe(600);
    expect(fake.props.height).toBe(400);
  });

  it('re-applies the device pixel ratio, clamped like the library does', () => {
    const { instance, fake } = mount();
    const original = globalThis.devicePixelRatio;
    Object.defineProperty(globalThis, 'devicePixelRatio', { value: 3, configurable: true });
    instance.resize();
    expect(fake.renderer().getPixelRatio()).toBe(2);
    Object.defineProperty(globalThis, 'devicePixelRatio', {
      value: original,
      configurable: true,
    });
  });
});

describe('accessor mapping', () => {
  it('maps every compiled node channel', () => {
    const { fake } = mount();
    const datum = nodeDatum(fake, 'a');
    expect((fake.props.nodeVal as (d: Node3D) => number)(datum)).toBe(datum.node.radius);
    expect((fake.props.nodeColor as (d: Node3D) => string)(datum)).toBe(datum.node.fill);
    expect(fake.props.nodeId).toBe('id');
  });

  it('maps every compiled edge channel', () => {
    const { fake } = mount();
    const link = fake.graph.links[0] as unknown as Link3D;
    expect((fake.props.linkColor as (d: Link3D) => string)(link)).toBe(link.edge.stroke);
    expect((fake.props.linkWidth as (d: Link3D) => number)(link)).toBe(link.edge.strokeWidth);
  });

  it('builds a sphere of the compiled radius with its own material', () => {
    const { fake } = mount();
    const datum = nodeDatum(fake, 'a');
    const mesh = nodeGroup(fake, 'a').children[0] as unknown as {
      geometry: { parameters: { radius: number } };
      material: { color: { value: string }; opacity: number; transparent: boolean };
    };
    expect(mesh.geometry.parameters.radius).toBe(datum.node.radius);
    expect(mesh.material.color.value).toBe(datum.node.fill);
    expect(mesh.material.transparent).toBe(true);
    // The compiled nodeOpacity encoding lands on the material, not on the
    // library's global nodeOpacity.
    expect(mesh.material.opacity).toBeCloseTo(datum.node.opacity);
    expect(fake.props.nodeOpacity).toBeUndefined();
  });

  it('gives each node its own material instance', () => {
    const { fake } = mount();
    expect(nodeMaterial(fake, 'a')).not.toBe(nodeMaterial(fake, 'b'));
  });

  it('adds a non-raycasting label sprite carrying the compiled label', () => {
    const { fake } = mount();
    // Sprites are built by the label rank, which needs the node objects to
    // exist: the library's digest is debounced, so the first rank that can see
    // them is the one on the first engine tick.
    (fake.handlers.onEngineTick as () => void)();
    const sprite = nodeGroup(fake, 'a').children[1] as unknown as {
      text: string;
      raycast: () => void;
    };
    expect(sprite.text).toBe('Alpha');
    // A label must never intercept a hover meant for the node behind it.
    expect(sprite.raycast()).toBeUndefined();
  });

  it('renders cylinders below the edge threshold and lines with dashes above style', () => {
    const { fake } = mount();
    // edgeWidth is encoded and there are 2 edges, so cylinders.
    expect(linkObject(fake, 0).type).toBe('Mesh');

    // edgeStyle is an ordinal channel: the first domain value takes 'solid',
    // the second 'dashed'.
    const dashed = mount(
      spec({ encoding: { edgeStyle: { field: 'confidence', type: 'nominal' } } }),
    );
    const materials = [0, 1].map((i) => {
      const obj = linkObject(dashed.fake, i);
      expect(obj.type).toBe('Line');
      return (obj.material as unknown as { type: string }).type;
    });
    expect(materials).toContain('LineDashedMaterial');
    expect(materials).toContain('LineBasicMaterial');
  });
});

describe('background', () => {
  it('clears to fully transparent for a transparent theme', () => {
    const { fake, container } = mount(
      spec({
        theme: { colors: { background: 'transparent', text: '#111' } },
      } as Partial<GraphSpec>),
    );
    expect(fake.props.backgroundColor).toBe('rgba(0,0,0,0)');
    const wrapper = container.querySelector('.oc-graph-wrapper') as HTMLElement;
    expect(wrapper.style.background).toBe('transparent');
  });

  it('clears to the resolved surface when the spec did not ask for transparency', () => {
    const { fake } = mount();
    expect(fake.props.backgroundColor).not.toBe('rgba(0,0,0,0)');
    expect(typeof fake.props.backgroundColor).toBe('string');
  });
});

describe('camera', () => {
  it('fits on the first engine tick', () => {
    const { fake } = mount();
    expect(fake.cameraPositionCalls).toHaveLength(0);
    (fake.handlers.onEngineTick as () => void)();
    expect(fake.cameraPositionCalls).toHaveLength(1);
  });

  it('frames the node cloud rather than the library bbox', () => {
    const { fake } = mount();
    // Push the cloud out along one axis: the fit distance has to grow with it.
    for (const node of fake.graph.nodes as unknown as Node3D[]) node.x = (node.x ?? 0) * 4;
    (fake.handlers.onEngineTick as () => void)();
    const first = fake.cameraPositionCalls[0];
    const spread = Math.max(
      ...(fake.graph.nodes as unknown as Node3D[]).map((n) => Math.abs(n.x ?? 0)),
    );
    const distance = Math.hypot(
      first.position.x - (first.lookAt?.x ?? 0),
      first.position.y - (first.lookAt?.y ?? 0),
      first.position.z - (first.lookAt?.z ?? 0),
    );
    // Comfortably outside the cloud, and not the ~2x overshoot the library's
    // own zoomToFit produces.
    expect(distance).toBeGreaterThan(spread);
    expect(distance).toBeLessThan(spread * 6);
  });

  it('stops auto-fitting once the viewer moves the camera', () => {
    const { fake } = mount();
    const canvas = fake.renderer().domElement as unknown as HTMLCanvasElement;
    canvas.dispatchEvent(new Event('pointerdown'));
    (fake.handlers.onEngineTick as () => void)();
    (fake.handlers.onEngineStop as () => void)();
    expect(fake.cameraPositionCalls).toHaveLength(0);
  });

  it('stops auto-fitting once the host moves the camera itself', () => {
    const { instance, fake } = mount();
    instance.zoomToNode('a', { duration: 0 });
    const after = fake.cameraPositionCalls.length;
    (fake.handlers.onEngineTick as () => void)();
    (fake.handlers.onEngineStop as () => void)();
    expect(fake.cameraPositionCalls).toHaveLength(after);
  });

  it('skips the initial fit when fitOnLoad is false', () => {
    const { fake } = mount(spec(), { fitOnLoad: false });
    (fake.handlers.onEngineTick as () => void)();
    (fake.handlers.onEngineStop as () => void)();
    expect(fake.cameraPositionCalls).toHaveLength(0);
  });

  it('round-trips getCamera through flyTo', () => {
    const { instance, fake } = mount();
    fake.cameraPosition({ x: 30, y: 40, z: 500 }, { x: 5, y: 6, z: 7 }, 0);
    const saved = instance.getCamera();

    fake.cameraPosition({ x: 0, y: 0, z: 1000 }, { x: 0, y: 0, z: 0 }, 0);
    instance.flyTo(saved);

    const restored = instance.getCamera();
    expect(restored.position).toEqual(saved.position);
    expect(restored.target).toEqual(saved.target);
    expect(restored.k).toBeCloseTo(saved.k);
    expect(restored.x).toBeCloseTo(saved.x);
  });

  it('flies to a node with a standoff along its radial direction', () => {
    const { instance, fake } = mount();
    const datum = nodeDatum(fake, 'a');
    datum.x = 0;
    datum.y = 0;
    datum.z = 100;
    instance.zoomToNode('a');
    const call = fake.cameraPositionCalls[fake.cameraPositionCalls.length - 1];
    expect(call.lookAt).toEqual({ x: 0, y: 0, z: 100 });
    expect(call.position.z).toBeGreaterThan(100);
  });

  it('stops auto-fitting once the host calls zoomToFit itself', () => {
    const { instance, fake } = mount();
    instance.zoomToFit({ duration: 0 });
    const after = fake.cameraPositionCalls.length;
    expect(after).toBeGreaterThan(0);
    (fake.handlers.onEngineTick as () => void)();
    (fake.handlers.onEngineStop as () => void)();
    expect(fake.cameraPositionCalls).toHaveLength(after);
  });

  it('reports a full 3D pose through onCameraChange', async () => {
    const onCameraChange = vi.fn();
    const { instance, fake } = mount(spec(), { onCameraChange });
    instance.zoomToNode('a', { duration: 0 });
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

    expect(onCameraChange).toHaveBeenCalled();
    const cam = onCameraChange.mock.calls[onCameraChange.mock.calls.length - 1][0];
    const call = fake.cameraPositionCalls[fake.cameraPositionCalls.length - 1];
    expect(cam.position).toEqual(call.position);
    expect(cam.target).toEqual(call.lookAt);
    const distance = Math.hypot(
      cam.position.x - cam.target.x,
      cam.position.y - cam.target.y,
      cam.position.z - cam.target.z,
    );
    // 3D has no zoom scalar, so `k` is the reference distance over the current one.
    expect(cam.k).toBeCloseTo(FIT_DISTANCE / distance);
  });

  it('snaps camera flights under reduced motion', () => {
    const matchMedia = vi
      .spyOn(window, 'matchMedia')
      .mockReturnValue({ matches: true } as MediaQueryList);
    const { instance, fake } = mount(
      spec({ animation: { camera: { duration: 900 } } } as Partial<GraphSpec>),
    );
    instance.zoomToNode('a');
    expect(fake.cameraPositionCalls[fake.cameraPositionCalls.length - 1].ms).toBe(0);
    matchMedia.mockRestore();
  });

  it('centerAt keeps the current zoom and recentres', () => {
    const { instance, fake } = mount();
    instance.centerAt(50, 60);
    const call = fake.cameraPositionCalls[fake.cameraPositionCalls.length - 1];
    expect(call.lookAt).toEqual({ x: 50, y: 60, z: 0 });
  });
});

describe('emphasis and hover', () => {
  it('dims non-neighbors on hover without rebuilding the scene', () => {
    const { fake } = mount();
    (fake.handlers.onNodeHover as (n: Node3D | null) => void)(nodeDatum(fake, 'a'));

    // 'a' and its neighbor 'b' stay lit (scaled by their compiled opacity);
    // 'c' is outside the neighborhood and dims.
    expect(nodeMaterial(fake, 'a').opacity).toBeCloseTo(nodeDatum(fake, 'a').node.opacity);
    expect(nodeMaterial(fake, 'c').opacity).toBeCloseTo(0.3 * nodeDatum(fake, 'c').node.opacity);
    // refresh() rebuilds every node and link object; hover must never call it.
    expect(fake.refreshCount).toBe(0);
  });

  it('restores on hover-out', () => {
    const { fake } = mount();
    const hover = fake.handlers.onNodeHover as (n: Node3D | null) => void;
    hover(nodeDatum(fake, 'a'));
    hover(null);
    expect(nodeMaterial(fake, 'c').opacity).toBeCloseTo(nodeDatum(fake, 'c').node.opacity);
  });

  it('exempts the seed node from highlight dimming', () => {
    const { instance, fake } = mount(spec({ seedNode: 'c' }));
    instance.highlight({ nodeIds: ['a'] });
    expect(nodeMaterial(fake, 'c').opacity).toBeCloseTo(nodeDatum(fake, 'c').node.opacity);
  });

  it('composes highlight over the standing category filter', () => {
    const { instance } = mount();
    instance.setActiveCategories(['lab']);
    expect(instance.getActiveCategories()).toEqual(['lab']);
    expect(instance.getHighlight()?.sort()).toEqual(['a', 'b']);

    instance.highlight({ nodeIds: ['b', 'c'] });
    // Intersection with the standing filter, not a replacement.
    expect(instance.getHighlight()).toEqual(['b']);

    instance.clearHighlight();
    expect(instance.getHighlight()?.sort()).toEqual(['a', 'b']);
  });

  it('snaps the hover crossfade under reduced motion instead of tweening it', () => {
    const matchMedia = vi
      .spyOn(window, 'matchMedia')
      .mockReturnValue({ matches: true } as MediaQueryList);
    // A hover choreography IS configured; reduced motion is what collapses it.
    const { fake } = mount(spec({ animation: { hover: { duration: 400 } } } as Partial<GraphSpec>));
    (fake.handlers.onNodeHover as (n: Node3D | null) => void)(nodeDatum(fake, 'a'));
    // No frame has been pumped, so a tweened value would still be at its start.
    expect(nodeMaterial(fake, 'c').opacity).toBeCloseTo(0.3 * nodeDatum(fake, 'c').node.opacity);
    matchMedia.mockRestore();
  });

  it('reports highlight changes through onHighlightChange', () => {
    const onHighlightChange = vi.fn();
    const { instance } = mount(spec(), { onHighlightChange });
    instance.highlight({ nodeIds: ['a'] });
    expect(onHighlightChange).toHaveBeenLastCalledWith(['a']);
    instance.clearHighlight();
    expect(onHighlightChange).toHaveBeenLastCalledWith(null);
  });
});

describe('search', () => {
  it('reports matches and dims the rest', () => {
    const { instance, fake } = mount();
    instance.search('alph');
    expect(instance.getSearchMatches()).toEqual(['a']);
    expect(nodeMaterial(fake, 'b').opacity).toBeLessThan(nodeMaterial(fake, 'a').opacity);
    instance.clearSearch();
    expect(instance.getSearchMatches()).toEqual([]);
  });
});

describe('selection and clicks', () => {
  it('fires onNodeClick on every click and tracks selection', () => {
    const onNodeClick = vi.fn();
    const onSelectionChange = vi.fn();
    const { instance, fake } = mount(spec(), { onNodeClick, onSelectionChange });
    const click = fake.handlers.onNodeClick as (n: Node3D, e: MouseEvent) => void;

    click(nodeDatum(fake, 'a'), new MouseEvent('click'));
    click(nodeDatum(fake, 'a'), new MouseEvent('click'));
    expect(onNodeClick).toHaveBeenCalledTimes(2);
    expect(instance.getSelectedNodes()).toEqual(['a']);
    expect(onSelectionChange).toHaveBeenLastCalledWith(['a']);
  });

  it('fires onNodeDoubleClick in addition to the clicks, via a canvas raycast', () => {
    const onNodeDoubleClick = vi.fn();
    const { fake } = mount(spec(), { onNodeDoubleClick });
    const mesh = nodeGroup(fake, 'b').children[0];
    raycasters[raycasters.length - 1].setHits([mesh]);
    fake.canvas.dispatchEvent(new MouseEvent('dblclick'));
    expect(onNodeDoubleClick).toHaveBeenCalledTimes(1);
    expect(onNodeDoubleClick.mock.calls[0][0].id).toBe('b');
  });

  it('selectNode sets the selection and reports it', () => {
    const { instance } = mount();
    instance.selectNode('b');
    expect(instance.getSelectedNodes()).toEqual(['b']);
  });

  it('clears the selection on a background click', () => {
    const onSelectionChange = vi.fn();
    const { instance, fake } = mount(spec(), { onSelectionChange });
    instance.selectNode('b');
    (fake.handlers.onBackgroundClick as () => void)();
    expect(instance.getSelectedNodes()).toEqual([]);
    expect(onSelectionChange).toHaveBeenLastCalledWith([]);
  });
});

describe('legend', () => {
  it('exposes the headless legend and renders the built-in one', () => {
    const { instance, container } = mount();
    const legend = instance.getLegend();
    expect(legend.field).toBe('kind');
    expect(legend.nodes.map((n) => n.label).sort()).toEqual(['dataset', 'lab']);
    expect(container.querySelectorAll('.oc-graph-legend-item').length).toBeGreaterThan(0);
  });

  it('honours legend: false', () => {
    const { container } = mount(spec({ legend: false }));
    expect(container.querySelector('.oc-graph-legend')).toBeNull();
  });

  it('fires onLegendHover with the legend field and value, and null on leave', () => {
    const onLegendHover = vi.fn();
    const { container } = mount(spec(), { onLegendHover });
    const row = container.querySelector('.oc-graph-legend-item') as HTMLButtonElement;
    row.dispatchEvent(new MouseEvent('mouseenter'));
    expect(onLegendHover).toHaveBeenLastCalledWith({
      field: 'kind',
      value: expect.stringMatching(/lab|dataset/),
    });
    row.dispatchEvent(new MouseEvent('mouseleave'));
    expect(onLegendHover).toHaveBeenLastCalledWith(null);
  });

  it('fires onLegendToggle when a legend row is clicked', () => {
    const onLegendToggle = vi.fn();
    const { container } = mount(spec(), { onLegendToggle });
    const row = container.querySelector('.oc-graph-legend-item') as HTMLButtonElement;
    row.click();
    expect(onLegendToggle).toHaveBeenCalledTimes(1);
  });
});

describe('labels', () => {
  it('always shows forced labels and re-ranks the rest by camera distance', () => {
    const { fake } = mount(
      spec({ seedNode: 'c', nodeOverrides: { a: { alwaysShowLabel: true } } }),
    );
    (fake.handlers.onEngineTick as () => void)();
    const sprite = (id: string) =>
      nodeGroup(fake, id).children[1] as unknown as { visible: boolean };
    expect(sprite('a').visible).toBe(true);
    expect(sprite('c').visible).toBe(true);
  });

  it('scales visible labels toward a constant on-screen size', () => {
    const { fake } = mount();
    (fake.handlers.onEngineTick as () => void)();
    const cam = fake.camera().position;
    const measure = (id: string) => {
      const datum = nodeDatum(fake, id);
      const sprite = nodeGroup(fake, id).children[1] as unknown as {
        visible: boolean;
        scale: { y: number };
      };
      return {
        dist: Math.hypot((datum.x ?? 0) - cam.x, (datum.y ?? 0) - cam.y, (datum.z ?? 0) - cam.z),
        scale: sprite.scale.y,
      };
    };
    const a = measure('a');
    const b = measure('b');
    // Farther node, larger sprite: the two cancel out on screen.
    const [near, far] = a.dist <= b.dist ? [a, b] : [b, a];
    expect(far.scale).toBeGreaterThan(near.scale);
    expect(far.scale / near.scale).toBeCloseTo(far.dist / near.dist, 1);
  });

  it('declutters labels that would overlap on screen', () => {
    const { fake } = mount();
    // Stack every node on the same projected point: only the first label in the
    // ranking can hold that box.
    for (const n of fake.graph.nodes as unknown as Node3D[]) {
      n.x = 0;
      n.y = 0;
      n.z = 0;
    }
    (fake.handlers.onEngineTick as () => void)();
    const shown = (['a', 'b', 'c'] as const).filter(
      (id) =>
        (nodeGroup(fake, id).children[1] as unknown as { visible: boolean } | undefined)?.visible,
    );
    expect(shown).toHaveLength(1);
  });

  it('builds sprites only for labels that win a slot', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      id: `n${i}`,
      label: `Node ${i}`,
      kind: 'lab',
      weight: 1,
      rel: 1,
    }));
    const { fake } = mount(
      spec({
        nodes: many,
        edges: [{ source: 'n0', target: 'n1', confidence: 1 }],
      }),
    );
    (fake.handlers.onEngineTick as () => void)();
    const withSprite = many.filter((n) => nodeGroup(fake, n.id).children.length > 1);
    // A sprite per node costs a third of the frame budget at scale, so only the
    // budgeted labels ever exist.
    expect(withSprite.length).toBeLessThanOrEqual(LABEL_BUDGET_3D);
    expect(withSprite.length).toBeLessThan(many.length);
  });

  it('shows the hovered node label even when the budget is full', () => {
    const { fake } = mount();
    (fake.handlers.onNodeHover as (n: Node3D | null) => void)(nodeDatum(fake, 'b'));
    const sprite = nodeGroup(fake, 'b').children[1] as unknown as { visible: boolean };
    expect(sprite.visible).toBe(true);
  });
});

describe('tooltips', () => {
  it('anchors a node tooltip at the projected node position', () => {
    const { fake, container } = mount();
    (fake.handlers.onNodeHover as (n: Node3D | null) => void)(nodeDatum(fake, 'a'));
    const tooltip = container.querySelector('.oc-tooltip') as HTMLElement;
    expect(tooltip.style.display).toBe('block');
    expect(tooltip.textContent).toContain('Alpha');
  });

  it('fires onEdgeHover with the edge data and clears it on leave', () => {
    const onEdgeHover = vi.fn();
    const { fake } = mount(spec(), { onEdgeHover });
    const hover = fake.handlers.onLinkHover as (l: Link3D | null) => void;
    hover(fake.graph.links[0] as unknown as Link3D);
    expect(onEdgeHover).toHaveBeenLastCalledWith(expect.objectContaining({ confidence: 0.9 }));
    hover(null);
    expect(onEdgeHover).toHaveBeenLastCalledWith(null);
  });

  it('lets a node hover own the tooltip over an edge hover', () => {
    const onEdgeHover = vi.fn();
    const { fake } = mount(spec(), { onEdgeHover });
    (fake.handlers.onNodeHover as (n: Node3D | null) => void)(nodeDatum(fake, 'a'));
    (fake.handlers.onLinkHover as (l: Link3D | null) => void)(
      fake.graph.links[0] as unknown as Link3D,
    );
    expect(onEdgeHover).not.toHaveBeenCalled();
  });

  it('shows an edge tooltip from the compiled edge', () => {
    const { fake, container } = mount();
    (fake.handlers.onLinkHover as (l: Link3D | null) => void)(
      fake.graph.links[0] as unknown as Link3D,
    );
    const tooltip = container.querySelector('.oc-tooltip') as HTMLElement;
    expect(tooltip.style.display).toBe('block');
  });

  it('routes through a custom formatter', () => {
    const formatter = vi.fn(() => 'custom text');
    const { fake, container } = mount(spec(), { tooltip: { formatter } });
    (fake.handlers.onNodeHover as (n: Node3D | null) => void)(nodeDatum(fake, 'a'));
    expect(formatter).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'node' }),
      expect.anything(),
    );
    expect((container.querySelector('.oc-tooltip') as HTMLElement).textContent).toBe('custom text');
  });

  it('re-anchors on every tick without re-running the formatter', () => {
    const formatter = vi.fn(() => 'custom text');
    const { fake, container } = mount(spec(), { tooltip: { formatter } });
    (fake.handlers.onNodeHover as (n: Node3D | null) => void)(nodeDatum(fake, 'a'));
    expect(formatter).toHaveBeenCalledTimes(1);

    // The node moves under a still pointer while the layout settles, so the
    // tooltip has to follow it -- but the content has not changed.
    const tick = fake.handlers.onEngineTick as () => void;
    for (let i = 0; i < 20; i++) tick();
    fake.controls().emit('change');

    expect(formatter).toHaveBeenCalledTimes(1);
    const tooltip = container.querySelector('.oc-tooltip') as HTMLElement;
    expect(tooltip.style.display).toBe('block');
    expect(tooltip.textContent).toBe('custom text');
  });

  it('re-renders when the hover moves to a different node', () => {
    const formatter = vi.fn((ctx: { data: Record<string, unknown> }) => String(ctx.data.label));
    const { fake, container } = mount(spec(), { tooltip: { formatter } });
    const hover = fake.handlers.onNodeHover as (n: Node3D | null) => void;
    hover(nodeDatum(fake, 'a'));
    hover(nodeDatum(fake, 'b'));
    expect(formatter).toHaveBeenCalledTimes(2);
    expect((container.querySelector('.oc-tooltip') as HTMLElement).textContent).toBe('Beta');
  });

  it('creates no tooltip manager when tooltip is false', () => {
    const { container } = mount(spec(), { tooltip: false });
    expect(container.querySelector('.oc-tooltip')).toBeNull();
  });
});

describe('update', () => {
  it('carries x/y/z and velocities across a structural change', () => {
    const { instance, fake } = mount();
    const a = nodeDatum(fake, 'a');
    a.x = 11;
    a.y = 22;
    a.z = 33;
    a.vx = 1;
    a.vy = 2;
    a.vz = 3;

    instance.update(
      spec({ nodes: [...NODES, { id: 'd', label: 'Delta', kind: 'lab', weight: 0.4, rel: 1 }] }),
    );

    const carried = nodeDatum(fake, 'a');
    expect([carried.x, carried.y, carried.z]).toEqual([11, 22, 33]);
    expect([carried.vx, carried.vy, carried.vz]).toEqual([1, 2, 3]);
  });

  it('spawns entering nodes with a deterministic non-zero z', () => {
    const { instance, fake } = mount();
    instance.update(
      spec({ nodes: [...NODES, { id: 'd', label: 'Delta', kind: 'lab', weight: 0.4, rel: 1 }] }),
    );
    const entered = nodeDatum(fake, 'd');
    expect(entered.z).not.toBe(0);
    expect(Number.isFinite(entered.z)).toBe(true);
  });

  it('never touches graphData for a visual-only change', () => {
    const { instance, fake } = mount();
    const before = fake.graph;
    instance.update(spec({ chrome: { title: 'New title' } }));
    expect(fake.graph).toBe(before);
    expect(document.querySelector('.oc-title')?.textContent).toBe('New title');
  });

  it('drops scene objects for nodes that left', () => {
    const { instance, fake } = mount();
    instance.update(spec({ nodes: NODES.slice(0, 2), edges: [EDGES[0]] }));
    expect(fake.graph.nodes).toHaveLength(2);
    expect(nodeDatum(fake, 'c')).toBeUndefined();
  });

  it('warns and no-ops when the new spec is not 3D', () => {
    const onWarn = vi.fn();
    const { instance, fake } = mount(spec(), { onWarn });
    const before = fake.graph;
    instance.update(spec({ dimensions: 2 }));
    expect(onWarn).toHaveBeenCalledWith(expect.stringContaining('dimensions'));
    expect(fake.graph).toBe(before);
  });

  it('keeps surviving nodes bound to their scene objects across a structural change', () => {
    const { instance, fake } = mount();
    const groupBefore = nodeGroup(fake, 'a');

    instance.update(spec({ nodes: NODES.slice(0, 2), edges: [EDGES[0]] }));
    fake.flush();

    // The digest binds by datum IDENTITY. A fresh datum literal for a survivor
    // would make the digest hand the cached group to the new datum and then run
    // the remove hook for the old one on that same group, taking the survivor
    // out of the scene and out of the position tick loop.
    const datum = nodeDatum(fake, 'a') as unknown as Record<string, unknown>;
    expect(fake.nodeBinding.get(datum)).toBe(groupBefore);
    expect(datum.__threeObj).toBe(groupBefore);
    expect(fake.scene().children).toContain(groupBefore);
    expect(fake.removedFromScene.has(groupBefore)).toBe(false);
    expect(fake.deallocated).not.toContain(groupBefore);
  });

  it('deallocates the scene object of a node that left', () => {
    const { instance, fake } = mount();
    const gone = nodeGroup(fake, 'c');

    instance.update(spec({ nodes: NODES.slice(0, 2), edges: [EDGES[0]] }));
    fake.flush();

    expect(fake.scene().children).not.toContain(gone);
    expect(fake.deallocated).toContain(gone);
  });

  it('carries positions across on the datum itself, without a copy step', () => {
    const { instance, fake } = mount();
    const before = nodeDatum(fake, 'a');
    before.x = 11;
    before.y = 22;
    before.z = 33;
    before.vx = 1;

    instance.update(spec({ nodes: NODES.slice(0, 2), edges: [EDGES[0]] }));

    // Same object, so nothing can be dropped on the way across.
    expect(nodeDatum(fake, 'a')).toBe(before);
    expect([before.x, before.y, before.z, before.vx]).toEqual([11, 22, 33, 1]);
  });

  it('updates link width and dash when the edge encoding changes', () => {
    // No edgeWidth encoding, so links are lines and edgeStyle owns the material.
    const lines = spec({
      encoding: { nodeColor: { field: 'kind', type: 'nominal' } },
    });
    const { instance, fake } = mount(lines);
    const before = linkObject(fake, 0);
    expect((before.material as unknown as { type: string }).type).toBe('LineBasicMaterial');

    instance.update(spec({ encoding: { edgeStyle: { field: 'confidence', type: 'nominal' } } }));
    fake.flush();

    const materials = [0, 1].map(
      (i) => (linkObject(fake, i).material as unknown as { type: string }).type,
    );
    expect(materials).toContain('LineDashedMaterial');
  });

  it('updates cylinder radius when the edgeWidth values change', () => {
    const { instance, fake } = mount();
    const radius = (i: number) =>
      (linkObject(fake, i).geometry as unknown as { parameters: { radiusTop: number } }).parameters
        .radiusTop;
    const before = radius(0);

    // Flip which edge is the heavy one: the compiled strokeWidths swap, so a
    // color-only refresh would leave both cylinders at their old radii.
    instance.update(
      spec({
        edges: [
          { source: 'a', target: 'b', confidence: 0.2 },
          { source: 'b', target: 'c', confidence: 0.9 },
        ],
      }),
    );
    fake.flush();

    expect(radius(0)).not.toBeCloseTo(before);
    expect(radius(0)).toBeLessThan(radius(1));
  });

  it('rebuilds link objects through graphData when the shape class flips', () => {
    const { instance, fake } = mount();
    // edgeWidth encoded -> cylinders.
    expect(linkObject(fake, 0).type).toBe('Mesh');

    instance.update(spec({ encoding: { nodeColor: { field: 'kind', type: 'nominal' } } }));
    fake.flush();

    // A line cannot be a mesh in place, so the change has to go through the
    // digest rather than the visual-only fast path.
    expect(linkObject(fake, 0).type).toBe('Line');
  });

  it('re-runs an active search against the new nodes', () => {
    const { instance } = mount();
    instance.search('a');
    instance.update(
      spec({ nodes: [...NODES, { id: 'd', label: 'Ambient', kind: 'lab', weight: 0.4, rel: 1 }] }),
    );
    // 'Gamma' contains an 'a' too, so every node matches after the insert.
    expect(instance.getSearchMatches().sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('webgl context loss', () => {
  it('preventDefaults the loss so the browser will restore the context', () => {
    const { fake } = mount();
    const event = new Event('webglcontextlost', { cancelable: true });
    fake.canvas.dispatchEvent(event);
    // Without preventDefault the context is gone for good and the canvas
    // stays blank.
    expect(event.defaultPrevented).toBe(true);
  });

  it('rebuilds every scene object when the context comes back', () => {
    const { fake } = mount();
    expect(fake.refreshCount).toBe(0);
    fake.canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(fake.refreshCount).toBe(1);
  });

  it('does not rebuild after destroy', () => {
    const { instance, fake } = mount();
    instance.destroy();
    fake.canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(fake.refreshCount).toBe(0);
  });
});

describe('resize', () => {
  it('pushes the shell size onto the scene', () => {
    const { instance, fake } = mount();
    fake.props.width = 0;
    instance.resize();
    expect(fake.props.width).toBe(600);
    expect(fake.props.height).toBe(400);
  });
});

describe('destroy', () => {
  let instance: GraphInstance;
  let fake: FakeForceGraph3D;
  let container: HTMLElement;

  beforeEach(() => {
    ({ instance, fake, container } = mount());
  });

  it('disposes every geometry, material and sprite texture it created', () => {
    expect(allocations.created.size).toBeGreaterThan(0);
    instance.destroy();
    const leaked = [...allocations.created].filter((o) => !allocations.disposed.has(o));
    expect(leaked).toEqual([]);
  });

  it('forces the WebGL context loss and runs the library destructor', () => {
    instance.destroy();
    expect(fake.destructorCount).toBe(1);
    expect(fake.fakeRenderer.disposeCount).toBe(1);
    expect(fake.fakeRenderer.contextLossCount).toBe(1);
  });

  it('removes the wrapper from the container', () => {
    instance.destroy();
    expect(container.querySelector('.oc-graph-wrapper')).toBeNull();
  });

  it('is idempotent', () => {
    instance.destroy();
    instance.destroy();
    expect(fake.destructorCount).toBe(1);
  });

  it('leaves no dblclick listener behind', () => {
    const onNodeDoubleClick = vi.fn();
    const local = mount(spec(), { onNodeDoubleClick });
    const mesh = nodeGroup(local.fake, 'b').children[0];
    raycasters[raycasters.length - 1].setHits([mesh]);
    local.instance.destroy();
    local.fake.canvas.dispatchEvent(new MouseEvent('dblclick'));
    expect(onNodeDoubleClick).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Entrance choreography
// ---------------------------------------------------------------------------

describe('entrance', () => {
  /**
   * No `nodeOpacity` encoding, so every node's resting alpha is 1 and the
   * material opacity IS the entrance factor. `animation.hover` stays at its
   * default, which is deliberate: the emphasis tween and the entrance tween
   * both write `material.opacity`, and these tests are the guard that they
   * compose rather than fight.
   */
  function enterSpec(enter: Record<string, unknown> = {}): GraphSpec {
    return {
      type: 'graph',
      dimensions: 3,
      nodes: NODES,
      edges: EDGES,
      encoding: { nodeColor: { field: 'kind', type: 'nominal' }, nodeLabel: { field: 'label' } },
      animation: { enter: { duration: 1000, stagger: true, ...enter } },
    } as GraphSpec;
  }

  /** Longest possible offset with these fixtures: last node + the link beat. */
  const SPAN_MS = 1750;

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: [
        'setTimeout',
        'clearTimeout',
        'Date',
        'performance',
        'requestAnimationFrame',
        'cancelAnimationFrame',
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function nodeScale(fake: FakeForceGraph3D, id: string): number {
    return (nodeGroup(fake, id).children[0] as unknown as { scale: { x: number } }).scale.x;
  }

  it('starts every node invisible and collapsed on the first painted frame', () => {
    const { fake } = mount(enterSpec());
    for (const id of ['a', 'b', 'c']) {
      expect(nodeMaterial(fake, id).opacity).toBe(0);
      expect(nodeScale(fake, id)).toBeCloseTo(0.01);
    }
    expect(linkObject(fake, 0).material.opacity).toBe(0);
  });

  it('reveals nodes in entranceOrder rank order', () => {
    const { fake } = mount(enterSpec());
    const rank = entranceOrder(NODES.map((n) => ({ id: n.id, x: 0, y: 0 })));
    vi.advanceTimersByTime(600);
    const byRank = [...rank.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);
    const alphas = byRank.map((id) => nodeMaterial(fake, id).opacity);
    expect(alphas[0]).toBeGreaterThan(alphas[1]);
    expect(alphas[1]).toBeGreaterThan(alphas[2]);
  });

  it('lands every node and link at its target by the end of the span', () => {
    const { fake } = mount(enterSpec());
    vi.advanceTimersByTime(SPAN_MS + 64);
    for (const id of ['a', 'b', 'c']) {
      expect(nodeMaterial(fake, id).opacity).toBeCloseTo(1);
      expect(nodeScale(fake, id)).toBe(1);
    }
    expect(linkObject(fake, 0).material.opacity).toBeGreaterThan(0);
  });

  it('holds links back until after their endpoints', () => {
    const { fake } = mount(enterSpec());
    // 250ms is exactly the link beat, so no link has started while the
    // earliest node is already a quarter of the way through its pop.
    vi.advanceTimersByTime(240);
    expect(linkObject(fake, 0).material.opacity).toBe(0);
    expect(
      Math.max(...['a', 'b', 'c'].map((id) => nodeMaterial(fake, id).opacity)),
    ).toBeGreaterThan(0);
  });

  it('pulls the camera back and flies it in over the entrance window', () => {
    const { fake } = mount(enterSpec());
    vi.advanceTimersByTime(32);
    const first = fake.cameraPositionCalls[0];
    expect(first).toBeDefined();
    vi.advanceTimersByTime(SPAN_MS + 64);
    const last = fake.cameraPositionCalls[fake.cameraPositionCalls.length - 1];
    const dist = (c: typeof first): number =>
      Math.hypot(
        c.position.x - (c.lookAt?.x ?? 0),
        c.position.y - (c.lookAt?.y ?? 0),
        c.position.z - (c.lookAt?.z ?? 0),
      );
    // The cloud never moves in this fake, so the whole difference is the
    // entrance standoff multiplier easing 1.6 -> 1.
    expect(dist(first) / dist(last)).toBeGreaterThan(1.5);
    expect(dist(first) / dist(last)).toBeLessThanOrEqual(1.6);
  });

  it('reveals the whole graph as one when stagger is off', () => {
    const { fake } = mount(enterSpec({ stagger: false }));
    vi.advanceTimersByTime(600);
    const alphas = ['a', 'b', 'c'].map((id) => nodeMaterial(fake, id).opacity);
    expect(new Set(alphas).size).toBe(1);
    expect(alphas[0]).toBeGreaterThan(0);
  });

  it('snaps to full opacity and scale under reduced motion', () => {
    const matchMedia = vi
      .spyOn(window, 'matchMedia')
      .mockReturnValue({ matches: true } as MediaQueryList);
    const { fake } = mount(enterSpec());
    for (const id of ['a', 'b', 'c']) {
      expect(nodeMaterial(fake, id).opacity).toBeCloseTo(1);
      expect(nodeScale(fake, id)).toBe(1);
    }
    matchMedia.mockRestore();
  });

  it('snaps when suppressEntrance is set', () => {
    const { fake } = mount(enterSpec(), { suppressEntrance: true });
    for (const id of ['a', 'b', 'c']) {
      expect(nodeMaterial(fake, id).opacity).toBeCloseTo(1);
      expect(nodeScale(fake, id)).toBe(1);
    }
  });

  it('starts objects created after the entrance began at alpha 0 and collapsed', () => {
    // The library's digest is debounced, so the scene objects for a graph
    // mounted mid-frame are built AFTER `startEntrance()` has already run. They
    // have to pick up the entrance state rather than flash in at full alpha.
    const { fake } = mount(enterSpec(), undefined, false);
    expect(fake.scene().children).toHaveLength(0);

    fake.flush();
    for (const id of ['a', 'b', 'c']) {
      expect(nodeMaterial(fake, id).opacity).toBe(0);
      expect(nodeScale(fake, id)).toBeCloseTo(0.01);
    }
    expect(linkObject(fake, 0).material.opacity).toBe(0);
  });

  it('composes a hover with the entrance instead of fighting it', () => {
    // A snapping hover, so the assertion reads the composed value directly
    // rather than a point on the crossfade.
    const { fake } = mount({
      ...enterSpec(),
      animation: { enter: { duration: 1000, stagger: true }, hover: { duration: 0 } },
    } as GraphSpec);
    vi.advanceTimersByTime(700);
    const entranceAlpha = ['a', 'b', 'c'].map((id) => nodeMaterial(fake, id).opacity);
    // Mid-entrance: 'c' is partway in, so its entrance factor is neither 0 nor 1.
    expect(entranceAlpha[2]).toBeGreaterThan(0);
    expect(entranceAlpha[2]).toBeLessThan(1);

    (fake.handlers.onNodeHover as (n: Node3D | null) => void)(nodeDatum(fake, 'a'));
    // 'c' is outside a's neighbourhood: its alpha is the dim factor TIMES its
    // entrance factor, not one of them replacing the other.
    expect(nodeMaterial(fake, 'c').opacity).toBeCloseTo(0.3 * entranceAlpha[2]);
    // The lit nodes keep the entrance factor they had, undimmed.
    expect(nodeMaterial(fake, 'a').opacity).toBeCloseTo(entranceAlpha[0]);

    // And the entrance still lands on top of the standing hover.
    vi.advanceTimersByTime(SPAN_MS);
    expect(nodeMaterial(fake, 'a').opacity).toBeCloseTo(1);
    expect(nodeMaterial(fake, 'c').opacity).toBeCloseTo(0.3);
  });

  it('never replays on update()', () => {
    const { instance, fake } = mount(enterSpec());
    vi.advanceTimersByTime(SPAN_MS + 64);
    instance.update({
      ...enterSpec(),
      nodes: [...NODES, { id: 'd', label: 'Delta', kind: 'lab', weight: 0.4, rel: 1 }],
    } as GraphSpec);
    for (const id of ['a', 'b', 'c', 'd']) {
      expect(nodeMaterial(fake, id).opacity).toBeCloseTo(1);
      expect(nodeScale(fake, id)).toBe(1);
    }
  });

  it('finishes an in-flight entrance rather than leaving nodes hidden on update()', () => {
    const { instance, fake } = mount(enterSpec());
    vi.advanceTimersByTime(100);
    instance.update(enterSpec());
    for (const id of ['a', 'b', 'c']) {
      expect(nodeMaterial(fake, id).opacity).toBeCloseTo(1);
      expect(nodeScale(fake, id)).toBe(1);
    }
  });
});
