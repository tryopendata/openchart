/**
 * Demo card: the atomic unit of a gallery page.
 *
 * - Card per the design system (1px border, 8px radius, header + viz + spec).
 * - Lazy-mounts the viz via IntersectionObserver (~200px rootMargin) behind a
 *   fixed-height placeholder so page length and anchor positions stay stable.
 *   Chart entrance animations then fire naturally on scroll-in.
 * - Dispatches by spec shape to the right openchart-react component.
 * - Spec panel: "View spec" expander with data-row folding and copy.
 * - Anchor: header anchor icon copies `<page-url>#<id>`; self-scrolls on mount
 *   when `location.hash === '#' + id` (Ladle strips the hash on later toggles,
 *   which is accepted — see 00-overview.md C3).
 */

import type { VizSpec } from '@opendata-ai/openchart-core';
import { BarList, Chart, DataTable, Graph, Sankey, TileMap } from '@opendata-ai/openchart-react';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

export type DemoProps = {
  /** Anchor slug, unique per page. */
  id: string;
  title: string;
  /** One line: when/why to use this pattern. */
  description?: string;
  /** Any VizSpec. Omit when using `children`. */
  spec?: VizSpec;
  /** Fixed wrapper height in px; omit for auto-height. */
  height?: number;
  maxWidth?: number;
  /** Escape hatch for interactive demos. Renders instead of the dispatched viz. */
  children?: ReactNode;
  /**
   * When `children` is an interactive demo built around a spec, pass
   * `specForPanel` so the spec panel still shows/copies the base spec.
   */
  specForPanel?: VizSpec;
  /**
   * For huge generated specs (> ~200KB serialized), pass a snippet the copy
   * button emits instead of megabytes of JSON, plus a short data stub note.
   */
  generatorSnippet?: string;
};

const DEFAULT_AUTO_HEIGHT = 420;
const LARGE_SPEC_BYTES = 200_000;
const DATA_FOLD_ROWS = 12;

// ---------------------------------------------------------------------------
// Viz dispatch
// ---------------------------------------------------------------------------

function renderViz(spec: VizSpec) {
  // ChartSpec/LayerSpec have no `type`; the non-chart specs are discriminated
  // by their `type` field.
  if ('type' in spec) {
    switch (spec.type) {
      case 'table':
        return <DataTable spec={spec} />;
      case 'graph':
        return <Graph spec={spec} />;
      case 'sankey':
        return <Sankey spec={spec} />;
      case 'tilemap':
        return <TileMap spec={spec} />;
      case 'barlist':
        return <BarList spec={spec} />;
    }
  }
  // ChartSpec | LayerSpec
  return <Chart spec={spec} />;
}

// ---------------------------------------------------------------------------
// Spec serialization + folding + lightweight tokenizer
// ---------------------------------------------------------------------------

type SpecView = {
  /** Display string (data folded past 12 rows), or null for large-spec stub. */
  display: string;
  /** Text the copy button emits (complete runnable spec, or generator call). */
  copyText: string;
  /** True when the spec is over the size cap and only a stub is shown. */
  large: boolean;
};

/** Extract the row-bearing data array from any spec shape, if present. */
function getDataArray(spec: VizSpec): unknown[] | null {
  const s = spec as unknown as Record<string, unknown>;
  if (Array.isArray(s.data)) return s.data as unknown[];
  // Graphs carry `nodes`/`edges` instead of `data`.
  if (Array.isArray(s.nodes)) return s.nodes as unknown[];
  return null;
}

function buildSpecView(spec: VizSpec, generatorSnippet?: string): SpecView {
  const full = JSON.stringify(spec, null, 2);
  const copyText = generatorSnippet ?? full;

  if (full.length > LARGE_SPEC_BYTES) {
    const rows = getDataArray(spec)?.length ?? 0;
    const stub = generatorSnippet
      ? generatorSnippet
      : `{ /* spec omitted — ${rows.toLocaleString()} rows, ${(full.length / 1024).toFixed(0)} KB */ }`;
    return { display: stub, copyText, large: true };
  }

  // Fold the data array past DATA_FOLD_ROWS rows for display only. Serialize a
  // shallow copy whose data key holds a unique sentinel token, then swap the
  // token for the folded rows + an "N more rows" comment. This avoids matching
  // a multiline array literal with a regex.
  const data = getDataArray(spec);
  if (data && data.length > DATA_FOLD_ROWS) {
    const specObj = spec as unknown as Record<string, unknown>;
    const key = Array.isArray(specObj.nodes) ? 'nodes' : 'data';
    const remaining = data.length - DATA_FOLD_ROWS;
    const token = '__OC_FOLD_SENTINEL__';
    const shallow = { ...specObj, [key]: token };
    // Fold rows indented to sit inside the `"data": [ ... ]` block (4 spaces).
    const head = data.slice(0, DATA_FOLD_ROWS);
    const rowsJson = head.map((row) => `    ${JSON.stringify(row)}`).join(',\n');
    const foldedBlock = `[\n${rowsJson},\n    /* ...${remaining} more rows */\n  ]`;
    const display = JSON.stringify(shallow, null, 2).replace(`"${token}"`, foldedBlock);
    return { display, copyText, large: false };
  }

  return { display: full, copyText, large: false };
}

/** Tokenize a JSON-ish string into muted-punctuation spans (no dependency). */
function Tokenized({ text }: { text: string }) {
  // Split on strings, comments, numbers, punctuation. Key strings are those
  // immediately followed by a colon.
  const parts: ReactNode[] = [];
  const re =
    /("(?:[^"\\]|\\.)*"\s*:)|("(?:[^"\\]|\\.)*")|(\/\*[\s\S]*?\*\/)|(-?\b\d+\.?\d*(?:e[+-]?\d+)?\b)|([{}[\],:])/gi;
  let last = 0;
  let k = 0;
  let m = re.exec(text);
  while (m !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1])
      parts.push(
        <span key={k++} className="oc-tok-key">
          {m[1]}
        </span>,
      );
    else if (m[2])
      parts.push(
        <span key={k++} className="oc-tok-str">
          {m[2]}
        </span>,
      );
    else if (m[3])
      parts.push(
        <span key={k++} className="oc-tok-comment">
          {m[3]}
        </span>,
      );
    else if (m[4])
      parts.push(
        <span key={k++} className="oc-tok-num">
          {m[4]}
        </span>,
      );
    else if (m[5])
      parts.push(
        <span key={k++} className="oc-tok-punct">
          {m[5]}
        </span>,
      );
    last = re.lastIndex;
    m = re.exec(text);
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

// ---------------------------------------------------------------------------
// Small inline icons
// ---------------------------------------------------------------------------

function LinkIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

export function Demo({
  id,
  title,
  description,
  spec,
  height,
  maxWidth,
  children,
  specForPanel,
  generatorSnippet,
}: DemoProps) {
  const [visible, setVisible] = useState(false);
  const [specOpen, setSpecOpen] = useState(false);
  const [dataExpanded, setDataExpanded] = useState(false);
  const [copied, setCopied] = useState<'idle' | 'spec' | 'link'>('idle');
  const cardRef = useRef<HTMLDivElement>(null);

  // Lazy mount on scroll-in.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    if (visible) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            obs.disconnect();
          }
        }
      },
      { rootMargin: '200px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visible]);

  // Self-scroll to this card when the URL hash targets it (fresh load).
  //
  // On a cold `?story=X#id` load the target card can sit thousands of px down
  // the page, and every card above it lazy-mounts a chart that grows its height
  // AFTER this effect first runs. A single scrollIntoView lands on the card's
  // pre-mount position and drifts as the layout above settles. So we re-scroll
  // across a short window of animation frames until the target's top position
  // stops moving (or the budget runs out), which tracks the settling layout.
  useEffect(() => {
    if (typeof location === 'undefined') return;
    if (location.hash !== `#${id}`) return;
    setVisible(true);

    let raf = 0;
    let frames = 0;
    let lastTop = Number.NaN;
    let stableFrames = 0;
    const MAX_FRAMES = 90; // ~1.5s at 60fps — covers lazy-mount + chart layout
    const STABLE_NEEDED = 4; // consecutive unchanged frames = settled

    const tick = () => {
      const el = cardRef.current;
      if (!el) return;
      el.scrollIntoView({ block: 'start' });
      const top = Math.round(el.getBoundingClientRect().top);
      if (top === lastTop) {
        stableFrames += 1;
        if (stableFrames >= STABLE_NEEDED) return; // settled — stop re-scrolling
      } else {
        stableFrames = 0;
        lastTop = top;
      }
      frames += 1;
      if (frames < MAX_FRAMES) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [id]);

  const panelSpec = spec ?? specForPanel;
  const specView = panelSpec ? buildSpecView(panelSpec, generatorSnippet) : null;

  const copyLink = async () => {
    if (typeof location === 'undefined') return;
    const base = `${location.origin}${location.pathname}${location.search}`;
    const url = `${base.replace(/#.*$/, '')}#${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied('link');
      setTimeout(() => setCopied('idle'), 1400);
    } catch {
      /* clipboard may be blocked; no-op */
    }
  };

  const copySpec = async () => {
    if (!specView) return;
    try {
      await navigator.clipboard.writeText(specView.copyText);
      setCopied('spec');
      setTimeout(() => setCopied('idle'), 1400);
    } catch {
      /* no-op */
    }
  };

  const wrapperStyle: React.CSSProperties = {
    ...(maxWidth ? { maxWidth, marginInline: 'auto' } : null),
  };
  const vizStyle: React.CSSProperties = {
    ...(height ? { height } : null),
    ...(maxWidth ? { maxWidth } : null),
  };
  const placeholderHeight = height ?? DEFAULT_AUTO_HEIGHT;

  // Expanded data view: re-serialize with full data when the user expands.
  const displayText =
    specView && dataExpanded && panelSpec ? JSON.stringify(panelSpec, null, 2) : specView?.display;

  return (
    <div className="oc-demo" id={id} ref={cardRef} style={wrapperStyle}>
      <div className="oc-demo-header">
        <div className="oc-demo-header-text">
          <h3 className="oc-demo-title">{title}</h3>
          {description ? <p className="oc-demo-description">{description}</p> : null}
        </div>
        <button
          type="button"
          className="oc-anchor-btn"
          onClick={copyLink}
          aria-label={copied === 'link' ? 'Link copied' : `Copy link to "${title}"`}
          title={copied === 'link' ? 'Link copied' : 'Copy link to this demo'}
        >
          <LinkIcon />
        </button>
      </div>

      <div className="oc-demo-viz" style={wrapperStyle}>
        {visible ? (
          children ? (
            <div className="story-chart" style={vizStyle}>
              {children}
            </div>
          ) : spec ? (
            <div className="story-chart" style={vizStyle}>
              {renderViz(spec)}
            </div>
          ) : null
        ) : (
          <div
            className="oc-demo-placeholder"
            style={{ height: placeholderHeight, ...(maxWidth ? { maxWidth } : null) }}
            aria-hidden="true"
          />
        )}
      </div>

      {specView ? (
        <div className="oc-spec">
          <div className="oc-spec-summary">
            <button
              type="button"
              className="oc-spec-toggle"
              aria-expanded={specOpen}
              onClick={() => setSpecOpen((o) => !o)}
            >
              <Chevron />
              {specOpen ? 'Hide spec' : 'View spec'}
            </button>
            <button type="button" className="oc-spec-copy" onClick={copySpec}>
              {copied === 'spec' ? 'Copied' : specView.large ? 'Copy generator' : 'Copy spec'}
            </button>
          </div>
          {specOpen ? (
            // tabIndex makes the scrollable code block reachable and scrollable
            // by keyboard (WCAG 2.1.1 / axe scrollable-region-focusable).
            // biome-ignore lint/a11y/noNoninteractiveTabindex: required so keyboard users can scroll the overflowing code block
            <pre className="oc-spec-code" tabIndex={0}>
              <code>
                <Tokenized text={displayText ?? ''} />
              </code>
              {specView.large
                ? null
                : (() => {
                    const data = getDataArray(panelSpec as VizSpec);
                    if (!data || data.length <= DATA_FOLD_ROWS) return null;
                    return (
                      <div style={{ marginTop: 8 }}>
                        <button
                          type="button"
                          className="oc-spec-fold"
                          onClick={() => setDataExpanded((v) => !v)}
                        >
                          {dataExpanded
                            ? 'Collapse data rows'
                            : `Show all ${data.length} data rows`}
                        </button>
                      </div>
                    );
                  })()}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
