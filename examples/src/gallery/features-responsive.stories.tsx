/**
 * Features / Responsive.
 *
 * OpenChart charts adapt to their container, not the viewport. The engine reads
 * the mounted width/height and picks a layout strategy per breakpoint (compact
 * < 400px, medium 400-700px, full > 700px) and height class (cramped < 200px,
 * short 200-350px, normal > 350px). Every demo here lives in a container you can
 * resize so the adaptation is visible: legend position, axis density, chrome
 * mode, and label rotation all shift as space runs out.
 *
 * Absorbs and deletes: examples/src/responsive.stories.tsx.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { getBreakpoint, getHeightClass } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import { useEffect, useRef, useState } from 'react';
import { Demo, GalleryPage, Section } from '../components';
import { departmentBudgets, energyMix, gdpGrowthByCountry } from '../data';

const ACCENT = '#0e7490';

// ---------------------------------------------------------------------------
// A small resize frame: a container whose width (and optionally height) you
// drag, with a live breakpoint/height-class readout above it. The chart inside
// reads its own container size, so the readout and the chart adapt together.
// ---------------------------------------------------------------------------

function ResizeFrame({
  spec,
  min = 200,
  max = 900,
  initial = 640,
  showHeight = false,
  heightValue = 380,
  minHeight = 120,
  maxHeight = 520,
  initialHeight = 380,
}: {
  spec: ChartSpec;
  min?: number;
  max?: number;
  initial?: number;
  showHeight?: boolean;
  heightValue?: number;
  minHeight?: number;
  maxHeight?: number;
  initialHeight?: number;
}) {
  const [width, setWidth] = useState(initial);
  const [height, setHeight] = useState(initialHeight);
  const draggingRef = useRef<null | 'x' | 'y' | 'xy'>(null);
  const startRef = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const clampW = (w: number) => Math.max(min, Math.min(max, Math.round(w)));

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const mode = draggingRef.current;
      if (!mode) return;
      if (mode === 'x' || mode === 'xy') {
        const next = startRef.current.w + (e.clientX - startRef.current.x);
        setWidth(Math.max(min, Math.min(max, Math.round(next))));
      }
      if (showHeight && (mode === 'y' || mode === 'xy')) {
        const next = startRef.current.h + (e.clientY - startRef.current.y);
        setHeight(Math.max(minHeight, Math.min(maxHeight, Math.round(next))));
      }
    };
    const onUp = () => {
      draggingRef.current = null;
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [showHeight, min, max, minHeight, maxHeight]);

  const beginDrag = (mode: 'x' | 'y' | 'xy') => (e: React.PointerEvent) => {
    e.preventDefault();
    draggingRef.current = mode;
    startRef.current = { x: e.clientX, y: e.clientY, w: width, h: height };
    document.body.style.userSelect = 'none';
  };

  const bp = getBreakpoint(width);
  const hc = getHeightClass(showHeight ? height : heightValue);
  const bpColor = bp === 'compact' ? '#d1495b' : bp === 'medium' ? '#c2830a' : ACCENT;

  const chip = (label: string, value: string, color?: string): React.ReactNode => (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 6,
        fontFamily:
          'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
        fontSize: 'var(--oc-type-caption)',
      }}
    >
      <span style={{ color: 'var(--oc-text-faint)' }}>{label}</span>
      <span style={{ color: color ?? 'var(--oc-text)', fontWeight: 600 }}>{value}</span>
    </span>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-3)' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 'var(--oc-space-4)',
          padding: 'var(--oc-space-2) var(--oc-space-4)',
          border: '1px solid var(--oc-border)',
          borderRadius: 'var(--oc-radius-control)',
          background: 'var(--oc-surface-raised)',
        }}
      >
        {chip('breakpoint', bp, bpColor)}
        {chip('width', `${width}px`)}
        {showHeight ? chip('height', `${height}px`) : null}
        {showHeight ? chip('height class', hc) : null}
        <span style={{ marginLeft: 'auto' }}>
          <input
            type="range"
            min={min}
            max={max}
            value={width}
            onChange={(e) => setWidth(clampW(Number(e.target.value)))}
            aria-label="Container width"
            style={{ width: 180, verticalAlign: 'middle' }}
          />
        </span>
      </div>

      <div
        style={{
          position: 'relative',
          width,
          height: showHeight ? height : heightValue,
          maxWidth: '100%',
          border: '1px dashed var(--oc-border)',
          borderRadius: 'var(--oc-radius-control)',
          padding: 4,
          boxSizing: 'border-box',
          transition: draggingRef.current ? 'none' : 'width 0.12s ease, height 0.12s ease',
        }}
      >
        <Chart spec={spec} />

        {/* Right edge: horizontal drag handle. The range slider above is the
            keyboard-accessible width control; this is a pointer affordance. */}
        <div
          onPointerDown={beginDrag('x')}
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            right: -6,
            width: 12,
            height: '100%',
            cursor: 'ew-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            touchAction: 'none',
          }}
        >
          <span
            style={{
              width: 4,
              height: 40,
              borderRadius: 2,
              background: 'var(--oc-border-strong, var(--oc-border))',
            }}
          />
        </div>

        {/* Corner: both-axis drag handle (only when height is draggable). */}
        {showHeight ? (
          <div
            onPointerDown={beginDrag('xy')}
            aria-hidden="true"
            style={{
              position: 'absolute',
              right: -4,
              bottom: -4,
              width: 16,
              height: 16,
              cursor: 'nwse-resize',
              touchAction: 'none',
              borderRight: '2px solid var(--oc-border-strong, var(--oc-border))',
              borderBottom: '2px solid var(--oc-border-strong, var(--oc-border))',
              borderBottomRightRadius: 3,
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. Drag-resizable container (flagship) — multi-series line with legend.
// ---------------------------------------------------------------------------

const flagshipSpec: ChartSpec = {
  animation: true,
  mark: 'line',
  data: [...gdpGrowthByCountry.data],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'gdp', type: 'quantitative', axis: { title: 'Real GDP growth (%)' } },
    color: { field: 'country', type: 'nominal' },
  },
  chrome: {
    title: 'One Spec, Every Width',
    subtitle: 'Drag the right edge: legend, axes, and chrome adapt to the container',
    source: gdpGrowthByCountry.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 2. Auto-height — no fixed height; chrome + legend grow the figure (#102).
// ---------------------------------------------------------------------------

const autoHeightSpec: ChartSpec = {
  animation: true,
  mark: 'bar',
  data: [...energyMix.data],
  encoding: {
    x: { field: 'year', type: 'nominal' },
    y: {
      field: 'energy',
      type: 'quantitative',
      stack: 'zero',
      axis: { title: 'Share of primary energy (%)' },
    },
    color: { field: 'source', type: 'nominal' },
  },
  chrome: {
    title: 'Fossil Fuels Still Dominate the Global Energy Mix',
    subtitle: 'Share of primary energy by source, 2015-2022 (%)',
    source: energyMix.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 3. Label rotation ladder — long x labels step flat -> 45 -> 90 as width shrinks.
// ---------------------------------------------------------------------------

const rotationSpec: ChartSpec = {
  animation: true,
  mark: { type: 'bar', fill: ACCENT },
  data: [...departmentBudgets.data],
  encoding: {
    x: { field: 'department', type: 'nominal' },
    y: { field: 'budget', type: 'quantitative', axis: { title: 'Budget ($M)' } },
  },
  chrome: {
    title: 'Long Labels Rotate Before They Drop',
    subtitle: 'Narrow the container and watch the x-axis walk the rotation ladder',
    source: departmentBudgets.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 4. Extreme ratios — very wide, very tall, tiny (fixed sizes side by side).
// ---------------------------------------------------------------------------

const ratioSpec: ChartSpec = {
  mark: 'line',
  data: [...gdpGrowthByCountry.data],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'gdp', type: 'quantitative' },
    color: { field: 'country', type: 'nominal' },
  },
  chrome: {
    title: 'GDP growth',
    source: gdpGrowthByCountry.source,
  },
};

function ExtremeRatios() {
  const frame = (label: string, w: number, h: number): React.ReactNode => (
    <figure style={{ margin: 0 }}>
      <figcaption
        style={{
          fontSize: 'var(--oc-type-caption)',
          color: 'var(--oc-text-muted)',
          marginBottom: 'var(--oc-space-2)',
          fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
        }}
      >
        {label} — {w}×{h} · {getBreakpoint(w)} / {getHeightClass(h)}
      </figcaption>
      <div
        style={{
          width: w,
          height: h,
          maxWidth: '100%',
          border: '1px dashed var(--oc-border)',
          borderRadius: 'var(--oc-radius-control)',
          padding: 4,
          boxSizing: 'border-box',
        }}
      >
        <Chart spec={ratioSpec} />
      </div>
    </figure>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-5)' }}>
      {frame('Ultra-wide banner', 900, 130)}
      <div
        style={{
          display: 'flex',
          gap: 'var(--oc-space-5)',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
        }}
      >
        {frame('Tall + narrow', 240, 420)}
        {frame('Tiny thumbnail', 220, 160)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. Facet column degradation — a facet grid stacking as width shrinks.
// ---------------------------------------------------------------------------

const facetSpec: ChartSpec = {
  animation: true,
  mark: { type: 'line', stroke: ACCENT },
  data: [...energyMix.data],
  encoding: {
    x: { field: 'year', type: 'ordinal' },
    y: { field: 'energy', type: 'quantitative' },
    facet: { field: 'source', type: 'nominal' },
  },
  chrome: {
    title: 'Small Multiples Reflow as the Grid Narrows',
    subtitle: 'Primary energy share by source, 2015-2022 (%)',
    source: energyMix.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default { title: 'Features' };

export const Responsive = () => (
  <GalleryPage
    title="Responsive"
    lede={
      <>
        OpenChart adapts to its container, not the viewport. The engine reads the mounted width and
        height and chooses a layout strategy per breakpoint — compact (&lt; 400px), medium
        (400-700px), full (&gt; 700px) — and height class — cramped (&lt; 200px), short (200-350px),
        normal (&gt; 350px). Legend position, axis density, chrome, and label rotation all follow.
        Drag any frame below to watch a single spec re-lay-out, or use the{' '}
        <strong>width preset</strong> in the toolbar to test whole pages at phone, tablet, and
        laptop sizes.
      </>
    }
  >
    <Section
      id="resizable"
      title="Resizable containers"
      lede="Every chart reads its own container size. Drag the right edge (or the corner) and the breakpoint readout, legend, axes, and chrome all shift together."
    >
      <Demo
        id="drag-resizable"
        title="Drag-resizable container"
        description="The flagship: one spec, a draggable frame, and a live breakpoint readout. Watch the legend move from the right rail to the top and the axis density drop as the container crosses each breakpoint."
        specForPanel={flagshipSpec}
        height={500}
      >
        <ResizeFrame spec={flagshipSpec} showHeight initial={680} initialHeight={400} />
      </Demo>

      <Demo
        id="rotation-ladder"
        title="Label rotation ladder"
        description="Long category labels step from horizontal to angled to vertical, then truncate, before the axis starts dropping ticks — so names stay readable as the container shrinks."
        specForPanel={rotationSpec}
        height={460}
      >
        <ResizeFrame spec={rotationSpec} min={240} max={840} initial={700} heightValue={400} />
      </Demo>
    </Section>

    <Section
      id="fit"
      title="Fitting the space"
      lede="Charts fill the width you give them. Omit a fixed height and the figure grows to fit its own chrome; push the ratio to extremes and the layout still holds."
    >
      <Demo
        id="auto-height"
        title="Auto-height"
        description="No fixed height on this card. The chart claims the full content width and the figure grows to fit its chrome and legend, so it never squishes the plot to fit a preset box (the #102 behavior)."
        spec={autoHeightSpec}
      />

      <Demo
        id="extreme-ratios"
        title="Extreme ratios"
        description="The same spec at an ultra-wide banner, a tall narrow column, and a tiny thumbnail. Chrome compacts or hides and axes thin out as the height class drops to short then cramped."
        specForPanel={ratioSpec}
        height={640}
      >
        <ExtremeRatios />
      </Demo>
    </Section>

    <Section
      id="faceting"
      title="Faceting"
      lede="Small-multiple grids reflow with the container: the panel grid drops columns and stacks toward a single column as width runs out."
    >
      <Demo
        id="facet-stacking"
        title="Facet column degradation"
        description="A faceted small-multiples grid. Drag the frame narrower and the auto-computed column count falls, stacking panels toward a single column at compact widths."
        specForPanel={facetSpec}
        height={560}
      >
        <ResizeFrame spec={facetSpec} min={260} max={900} initial={760} heightValue={480} />
      </Demo>
    </Section>
  </GalleryPage>
);
