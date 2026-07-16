/**
 * Features / Edit Mode — the interactive editing experience.
 *
 * A first-class, single cohesive editor (not a card stack): a live chart wired
 * to the full edit API on the left, a controlled inspector on the right that
 * shows the spec mutating as you edit, an event console, and a reset. This is
 * the library's differentiator for chart-builder host apps, so the page
 * demonstrates the whole round-trip: click to select, drag an annotation to
 * reposition it, double-click text to rewrite it, and watch each edit come back
 * as a spec update you could persist. Escape deselects.
 *
 * Absorbs and replaces the old annotation-editing story.
 */

import type {
  AnnotationOffset,
  ChartSpec,
  ElementEdit,
  ElementRef,
  RangeAnnotation,
  RefLineAnnotation,
  TextAnnotation,
} from '@opendata-ai/openchart-core';
import { Chart, type ChartHandle } from '@opendata-ai/openchart-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GalleryPage, Section } from '../components';
import { segmentRevenue } from '../data';

// ---------------------------------------------------------------------------
// Scoped styles. Keyed off the shared `--gx-*` tokens (defined under
// `[data-oc-mode]` on the GalleryPage root, so they resolve in light/dark AND
// inside the width-addon iframe). Injected once via a <style> tag rather than
// touching the shared gallery.css that sibling pages also edit.
// ---------------------------------------------------------------------------

const STUDIO_CSS = `
.ocem-inline-code {
  font-family: var(--gx-font-mono);
  font-size: 0.85em;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--gx-accent-soft);
  color: var(--gx-accent-text);
}
.ocem-studio {
  border: 1px solid var(--gx-border);
  border-radius: var(--gx-radius-card);
  background: var(--gx-surface);
  overflow: hidden;
}
.ocem-toolbar {
  display: flex;
  align-items: center;
  gap: var(--gx-space-4);
  flex-wrap: wrap;
  padding: var(--gx-space-3) var(--gx-space-5);
  border-bottom: 1px solid var(--gx-border);
  background: var(--gx-surface-raised);
}
.ocem-selected {
  display: flex;
  align-items: center;
  gap: var(--gx-space-2);
  min-width: 0;
}
.ocem-selected-label {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--gx-text-faint);
}
.ocem-selected-ref {
  font-family: var(--gx-font-mono);
  font-size: var(--gx-type-mono);
  color: var(--gx-accent-text);
  background: var(--gx-accent-soft);
  padding: 2px 8px;
  border-radius: var(--gx-radius-control);
}
.ocem-selected-none {
  font-size: var(--gx-type-caption);
  color: var(--gx-text-faint);
}
.ocem-reset {
  margin-left: auto;
  appearance: none;
  border: 1px solid var(--gx-border-strong);
  background: var(--gx-surface);
  color: var(--gx-text-muted);
  font-family: var(--gx-font-body);
  font-size: var(--gx-type-caption);
  font-weight: 500;
  padding: 5px 12px;
  border-radius: var(--gx-radius-control);
  cursor: pointer;
  transition: border-color 0.12s, color 0.12s, background 0.12s, opacity 0.12s;
}
.ocem-reset:not(:disabled):hover {
  border-color: var(--gx-accent);
  color: var(--gx-accent-text);
  background: var(--gx-accent-soft);
}
.ocem-reset:disabled {
  opacity: 0.45;
  cursor: default;
}
.ocem-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
}
@media (min-width: 900px) {
  .ocem-grid {
    grid-template-columns: minmax(0, 1.35fr) minmax(320px, 1fr);
  }
}
.ocem-chart-card {
  padding: var(--gx-space-4) var(--gx-space-5) var(--gx-space-5);
  min-width: 0;
}
.ocem-chart-card > .story-chart {
  max-width: 100%;
}
.ocem-hint {
  margin: var(--gx-space-3) 0 0;
  font-size: var(--gx-type-caption);
  line-height: 1.5;
  color: var(--gx-text-muted);
}
.ocem-kbd {
  font-family: var(--gx-font-mono);
  font-size: 0.75em;
  padding: 1px 5px;
  border-radius: 4px;
  border: 1px solid var(--gx-border-strong);
  background: var(--gx-surface-raised);
  color: var(--gx-text);
}
.ocem-rail {
  display: flex;
  flex-direction: column;
  gap: 0;
  border-top: 1px solid var(--gx-border);
  background: var(--gx-surface-raised);
}
@media (min-width: 900px) {
  .ocem-rail {
    border-top: none;
    border-left: 1px solid var(--gx-border);
  }
}
.ocem-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.ocem-panel + .ocem-panel {
  border-top: 1px solid var(--gx-border);
}
.ocem-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--gx-space-3) var(--gx-space-4);
}
.ocem-panel-title {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--gx-text-muted);
  font-family: var(--gx-font-mono);
}
.ocem-panel-meta {
  font-size: 0.6875rem;
  color: var(--gx-text-faint);
  font-family: var(--gx-font-mono);
}
.ocem-diff {
  margin: 0;
  padding: 0 var(--gx-space-4) var(--gx-space-4);
  font-family: var(--gx-font-mono);
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--gx-text-muted);
  overflow: auto;
  max-height: 340px;
  white-space: pre;
  tab-size: 2;
}
.ocem-diff-line {
  display: block;
}
.ocem-diff-changed {
  color: var(--gx-accent-text);
  background: var(--gx-accent-soft);
  font-weight: 600;
}
.ocem-log {
  padding: 0 var(--gx-space-4) var(--gx-space-4);
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: 240px;
  overflow-y: auto;
}
.ocem-log-empty {
  margin: 0;
  font-size: var(--gx-type-caption);
  color: var(--gx-text-faint);
  line-height: 1.5;
}
.ocem-log-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-family: var(--gx-font-mono);
  font-size: 0.75rem;
  padding: 1px 0;
}
.ocem-log-dot {
  width: 6px;
  height: 6px;
  border-radius: 2px;
  flex-shrink: 0;
  position: relative;
  top: 1px;
}
.ocem-log-cb {
  font-weight: 600;
  flex-shrink: 0;
}
.ocem-log-detail {
  color: var(--gx-text);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (prefers-reduced-motion: reduce) {
  .ocem-reset {
    transition: none;
  }
}
`;

function StudioStyles() {
  return (
    // biome-ignore lint/security/noDangerouslySetInnerHtml: static CSS constant, no user input
    <style dangerouslySetInnerHTML={{ __html: STUDIO_CSS }} />
  );
}

// ---------------------------------------------------------------------------
// The editable spec surface (the parts a host app persists back)
// ---------------------------------------------------------------------------

type EditableState = Pick<ChartSpec, 'annotations' | 'chrome'>;

function makePristineState(): EditableState {
  return {
    annotations: [
      {
        type: 'range',
        x1: '2023-Q4',
        x2: '2024-Q2',
        label: 'AI spending surge',
        fill: '#6366f1',
        opacity: 0.07,
      },
      {
        type: 'refline',
        y: 45,
        label: 'Target: $45B',
        style: 'dashed',
        stroke: '#94a3b8',
        strokeWidth: 1,
      },
      {
        type: 'text',
        x: '2024-Q4',
        y: 71.42,
        text: 'Holiday peak:\n$71.4B devices',
        fontSize: 11,
        anchor: 'left',
        connector: true,
        offset: { dx: -110, dy: -50 },
      },
      {
        type: 'text',
        x: '2024-Q3',
        y: 22.17,
        text: 'Cloud overtakes\n2022 devices floor',
        fontSize: 11,
        anchor: 'left',
        connector: true,
        offset: { dx: -30, dy: -34 },
      },
    ],
    chrome: {
      title: 'Cloud Climbs as Devices Swing With the Holidays',
      subtitle: 'Quarterly segment revenue, 2022-Q1 to 2024-Q4 ($B)',
      source: segmentRevenue.source,
      byline: 'Chart: OpenChart',
    },
  };
}

/** Assemble the full chart spec from the editable surface. Built as one literal
 * so TypeScript checks it directly against ChartSpec (an `Omit<ChartSpec>` base
 * widens `mark` and breaks reassignment back to ChartSpec). */
function buildSpec(state: EditableState): ChartSpec {
  return {
    mark: 'line',
    data: [...segmentRevenue.data],
    encoding: {
      x: { field: 'quarter', type: 'ordinal', axis: { tickCount: 6 } },
      y: {
        field: 'revenue',
        type: 'quantitative',
        axis: { title: 'Revenue ($B)', format: '$.0f' },
        scale: { zero: true },
      },
      color: { field: 'segment', type: 'nominal' },
    },
    legend: { position: 'top' },
    annotations: state.annotations,
    chrome: state.chrome,
  };
}

// ---------------------------------------------------------------------------
// Event-log model
// ---------------------------------------------------------------------------

type LogEntry = {
  callback: 'onSelect' | 'onDeselect' | 'onEdit' | 'onAnnotationEdit' | 'onTextEdit';
  detail: string;
  ts: number;
};

const CALLBACK_COLOR: Record<LogEntry['callback'], string> = {
  onSelect: '#06b6d4',
  onDeselect: '#94a3b8',
  onEdit: '#6366f1',
  onAnnotationEdit: '#8b5cf6',
  onTextEdit: '#ec4899',
};

const oneLine = (s: string) => s.replace(/\n/g, ' ');
const fmtOffset = (o?: AnnotationOffset) =>
  `{ dx: ${Math.round(o?.dx ?? 0)}, dy: ${Math.round(o?.dy ?? 0)} }`;

function describeRef(ref: ElementRef): string {
  switch (ref.type) {
    case 'annotation':
      return `annotation[${ref.index}]`;
    case 'chrome':
      return `chrome.${ref.key}`;
    case 'series-label':
      return `series "${ref.series}"`;
    case 'legend':
      return 'legend';
    case 'legend-entry':
      return `legend "${ref.series}"`;
  }
}

// ---------------------------------------------------------------------------
// Live spec-diff readout: serialize the editable surface and mark changed lines
// ---------------------------------------------------------------------------

function SpecDiff({ pristine, live }: { pristine: EditableState; live: EditableState }) {
  const pristineLines = useMemo(() => JSON.stringify(pristine, null, 2).split('\n'), [pristine]);
  const liveLines = useMemo(() => JSON.stringify(live, null, 2).split('\n'), [live]);

  // Line-level diff: a live line is "changed" when it differs from the pristine
  // line at the same position (or is new). Good enough for a readout — the point
  // is to show that edits flow back into the spec, not to be a merge tool. Keys
  // are content-based (with a per-line occurrence suffix to disambiguate repeats)
  // so we avoid raw array-index keys.
  const seen = new Map<string, number>();
  const rows = liveLines.map((text, i) => {
    const n = seen.get(text) ?? 0;
    seen.set(text, n + 1);
    return { text, changed: pristineLines[i] !== text, key: `${text}#${n}` };
  });
  const changedCount = rows.filter((r) => r.changed).length;

  return (
    <div className="ocem-panel">
      <div className="ocem-panel-head">
        <span className="ocem-panel-title">Live spec</span>
        <span className="ocem-panel-meta">
          {changedCount === 0
            ? 'pristine'
            : `${changedCount} line${changedCount === 1 ? '' : 's'} changed`}
        </span>
      </div>
      <pre className="ocem-diff">
        <code>
          {rows.map((r) => (
            <span
              key={r.key}
              className={r.changed ? 'ocem-diff-line ocem-diff-changed' : 'ocem-diff-line'}
            >
              {r.changed ? '▸ ' : '  '}
              {r.text || ' '}
              {'\n'}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The studio
// ---------------------------------------------------------------------------

function EditModeStudio() {
  const pristine = useMemo(makePristineState, []);
  const [state, setState] = useState<EditableState>(makePristineState);
  const [selected, setSelected] = useState<ElementRef | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const chartRef = useRef<ChartHandle>(null);

  const pushLog = useCallback((callback: LogEntry['callback'], detail: string) => {
    setLog((prev) => [{ callback, detail, ts: Date.now() }, ...prev].slice(0, 24));
  }, []);

  // Escape deselects (keyboard). Uses the imperative handle so the chart's own
  // selection state clears too, which fires onDeselect.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && chartRef.current?.getSelectedElement()) {
        chartRef.current.deselect();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleSelect = useCallback(
    (ref: ElementRef) => {
      setSelected(ref);
      pushLog('onSelect', describeRef(ref));
    },
    [pushLog],
  );

  const handleDeselect = useCallback(
    (ref: ElementRef) => {
      setSelected(null);
      pushLog('onDeselect', describeRef(ref));
    },
    [pushLog],
  );

  // Drag repositioning of a text annotation. This is the narrow, ergonomic
  // callback (fires only for text-annotation drags); persist by writing the new
  // offset back into the matching annotation.
  const handleAnnotationEdit = useCallback(
    (annotation: TextAnnotation, updatedOffset: AnnotationOffset) => {
      setState((prev) => ({
        ...prev,
        annotations: prev.annotations?.map((a) =>
          a.type === 'text' && a.text === annotation.text ? { ...a, offset: updatedOffset } : a,
        ),
      }));
      pushLog('onAnnotationEdit', `"${oneLine(annotation.text)}" → ${fmtOffset(updatedOffset)}`);
    },
    [pushLog],
  );

  // Unified edit callback: covers connector drags, range/refline label drags,
  // chrome/series/legend moves, and text edits. We persist the ones that map to
  // our editable surface (annotations + chrome).
  const handleEdit = useCallback(
    (edit: ElementEdit) => {
      switch (edit.type) {
        case 'annotation':
          // Also flows through onAnnotationEdit above; persisted there.
          pushLog(
            'onEdit',
            `annotation[${'index' in edit.element ? edit.element.index : '?'}] "${oneLine(edit.annotation.text)}" → ${fmtOffset(edit.offset)}`,
          );
          break;
        case 'annotation-connector':
          setState((prev) => ({
            ...prev,
            annotations: prev.annotations?.map((a) => {
              if (a.type === 'text' && a.text === edit.annotation.text) {
                return {
                  ...a,
                  connectorOffset: { ...a.connectorOffset, [edit.endpoint]: edit.offset },
                };
              }
              return a;
            }),
          }));
          pushLog(
            'onEdit',
            `connector[${'index' in edit.element ? edit.element.index : '?'}] ${edit.endpoint} → ${fmtOffset(edit.offset)}`,
          );
          break;
        case 'range-label':
          setState((prev) => ({
            ...prev,
            annotations: prev.annotations?.map((a) =>
              a.type === 'range' && (a as RangeAnnotation).label === edit.annotation.label
                ? { ...a, labelOffset: edit.labelOffset }
                : a,
            ),
          }));
          pushLog(
            'onEdit',
            `range label[${'index' in edit.element ? edit.element.index : '?'}] → ${fmtOffset(edit.labelOffset)}`,
          );
          break;
        case 'refline-label':
          setState((prev) => ({
            ...prev,
            annotations: prev.annotations?.map((a) =>
              a.type === 'refline' && (a as RefLineAnnotation).label === edit.annotation.label
                ? { ...a, labelOffset: edit.labelOffset }
                : a,
            ),
          }));
          pushLog(
            'onEdit',
            `refline label[${'index' in edit.element ? edit.element.index : '?'}] → ${fmtOffset(edit.labelOffset)}`,
          );
          break;
        case 'chrome':
          setState((prev) => ({
            ...prev,
            chrome: { ...prev.chrome, [edit.key]: { text: edit.text, offset: edit.offset } },
          }));
          pushLog('onEdit', `chrome.${edit.key} → ${fmtOffset(edit.offset)}`);
          break;
        case 'text-edit':
          setState((prev) => {
            const annotations = [...(prev.annotations ?? [])];
            const chrome = { ...prev.chrome };
            if (edit.element.type === 'annotation') {
              const ann = annotations[edit.element.index];
              if (ann?.type === 'text')
                annotations[edit.element.index] = { ...ann, text: edit.newText };
              else if (ann?.type === 'range')
                annotations[edit.element.index] = { ...ann, label: edit.newText };
              else if (ann?.type === 'refline')
                annotations[edit.element.index] = { ...ann, label: edit.newText };
            } else if (edit.element.type === 'chrome') {
              const cur = chrome[edit.element.key];
              chrome[edit.element.key] =
                cur && typeof cur === 'object' ? { ...cur, text: edit.newText } : edit.newText;
            }
            return { ...prev, annotations, chrome };
          });
          pushLog('onEdit', `text "${oneLine(edit.oldText)}" → "${oneLine(edit.newText)}"`);
          break;
        default:
          pushLog('onEdit', edit.type);
          break;
      }
    },
    [pushLog],
  );

  // Text-edit callback (also flows through onEdit; logged distinctly here so the
  // console shows both firing).
  const handleTextEdit = useCallback(
    (_element: ElementRef, oldText: string, newText: string) => {
      pushLog('onTextEdit', `"${oneLine(oldText)}" → "${oneLine(newText)}"`);
    },
    [pushLog],
  );

  const reset = useCallback(() => {
    chartRef.current?.deselect();
    setState(makePristineState());
    setSelected(null);
    setLog([]);
  }, []);

  const spec = buildSpec(state);
  const dirty =
    JSON.stringify({ annotations: state.annotations, chrome: state.chrome }) !==
    JSON.stringify(pristine);

  return (
    <div className="ocem-studio">
      <StudioStyles />
      {/* Toolbar */}
      <div className="ocem-toolbar">
        <div className="ocem-selected">
          <span className="ocem-selected-label">Selected</span>
          {selected ? (
            <code className="ocem-selected-ref">{describeRef(selected)}</code>
          ) : (
            <span className="ocem-selected-none">nothing — click an element</span>
          )}
        </div>
        <button type="button" className="ocem-reset" onClick={reset} disabled={!dirty}>
          Reset to pristine
        </button>
      </div>

      <div className="ocem-grid">
        {/* Editor */}
        <div className="ocem-chart-card">
          <div className="story-chart" style={{ height: 460 }}>
            <Chart
              ref={chartRef}
              spec={spec}
              selectedElement={selected ?? undefined}
              onSelect={handleSelect}
              onDeselect={handleDeselect}
              onEdit={handleEdit}
              onAnnotationEdit={handleAnnotationEdit}
              onTextEdit={handleTextEdit}
            />
          </div>
          <p className="ocem-hint">
            Click any title, label, or annotation to select it. Drag an annotation or its connector
            to reposition. Double-click text to rewrite it. Press{' '}
            <kbd className="ocem-kbd">Esc</kbd> to deselect.
          </p>
        </div>

        {/* Inspector rail */}
        <div className="ocem-rail">
          <SpecDiff pristine={pristine} live={state} />

          <div className="ocem-panel">
            <div className="ocem-panel-head">
              <span className="ocem-panel-title">Event log</span>
              <span className="ocem-panel-meta">{log.length ? `${log.length}` : 'waiting'}</span>
            </div>
            <div className="ocem-log">
              {log.length === 0 ? (
                <p className="ocem-log-empty">
                  Edit callbacks appear here as you select, drag, and edit.
                </p>
              ) : (
                log.map((e) => (
                  <div key={e.ts + e.detail} className="ocem-log-row">
                    <span
                      className="ocem-log-dot"
                      style={{ background: CALLBACK_COLOR[e.callback] }}
                    />
                    <span className="ocem-log-cb" style={{ color: CALLBACK_COLOR[e.callback] }}>
                      {e.callback}
                    </span>
                    <span className="ocem-log-detail">{e.detail}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editable toggle demo
// ---------------------------------------------------------------------------

const TOGGLE_CSS = `
.ocem-toggle-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--gx-space-4);
}
.ocem-toggle-bar {
  display: flex;
  align-items: center;
  gap: var(--gx-space-4);
  flex-wrap: wrap;
}
.ocem-toggle-btn {
  appearance: none;
  border: 1px solid var(--gx-border-strong);
  background: var(--gx-surface);
  color: var(--gx-text-muted);
  font-family: var(--gx-font-body);
  font-size: var(--gx-type-caption);
  font-weight: 500;
  padding: 5px 12px;
  border-radius: var(--gx-radius-control);
  cursor: pointer;
  transition: border-color 0.12s, color 0.12s, background 0.12s;
}
.ocem-toggle-btn:hover {
  border-color: var(--gx-accent);
  color: var(--gx-accent-text);
  background: var(--gx-accent-soft);
}
.ocem-toggle-btn[data-active="true"] {
  border-color: var(--gx-accent);
  color: var(--gx-accent-text);
  background: var(--gx-accent-soft);
  font-weight: 600;
}
.ocem-toggle-status {
  font-size: var(--gx-type-caption);
  color: var(--gx-text-faint);
  font-family: var(--gx-font-mono);
}
.ocem-toggle-log {
  font-family: var(--gx-font-mono);
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--gx-text-muted);
  max-height: 120px;
  overflow-y: auto;
  padding: var(--gx-space-3) var(--gx-space-4);
  border: 1px solid var(--gx-border);
  border-radius: var(--gx-radius-control);
  background: var(--gx-surface-raised);
}
.ocem-toggle-log-empty {
  color: var(--gx-text-faint);
}
`;

function EditableToggleDemo() {
  const [editable, setEditable] = useState(false);
  const [eventLog, setEventLog] = useState<Array<{ text: string; ts: number }>>([]);

  const spec: ChartSpec = {
    mark: 'line',
    data: [...segmentRevenue.data],
    encoding: {
      x: { field: 'quarter', type: 'ordinal', axis: { tickCount: 6 } },
      y: {
        field: 'revenue',
        type: 'quantitative',
        axis: { title: 'Revenue ($B)', format: '$.0f' },
        scale: { zero: true },
      },
      color: { field: 'segment', type: 'nominal' },
    },
    legend: { position: 'top' },
    annotations: [
      {
        type: 'text',
        x: '2024-Q4',
        y: 71.42,
        text: 'Holiday peak',
        fontSize: 11,
        anchor: 'left',
        connector: true,
        offset: { dx: -90, dy: -40 },
      },
    ],
    chrome: {
      title: 'Editable Toggle Demo',
      subtitle: 'Toggle editable to enable/disable editing',
    },
  };

  const handleSelect = useCallback((ref: ElementRef) => {
    setEventLog((prev) =>
      [{ text: `onSelect: ${describeRef(ref)}`, ts: Date.now() }, ...prev].slice(0, 20),
    );
  }, []);

  const handleEdit = useCallback((edit: ElementEdit) => {
    setEventLog((prev) => [{ text: `onEdit: ${edit.type}`, ts: Date.now() }, ...prev].slice(0, 20));
  }, []);

  return (
    <div className="ocem-toggle-wrap">
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static CSS constant, no user input */}
      <style dangerouslySetInnerHTML={{ __html: TOGGLE_CSS }} />
      <div className="ocem-toggle-bar">
        <button
          type="button"
          className="ocem-toggle-btn"
          data-active={String(editable)}
          onClick={() => setEditable((v) => !v)}
        >
          editable: {String(editable)}
        </button>
        <span className="ocem-toggle-status">
          {editable ? 'Drag, select, and edit are active' : 'Edit interactions are suppressed'}
        </span>
      </div>
      <div className="story-chart" style={{ height: 400 }}>
        <Chart spec={spec} editable={editable} onSelect={handleSelect} onEdit={handleEdit} />
      </div>
      <div className="ocem-toggle-log">
        {eventLog.length === 0 ? (
          <span className="ocem-toggle-log-empty">
            {editable
              ? 'Try selecting or dragging an element...'
              : 'Enable editable to interact with the chart.'}
          </span>
        ) : (
          eventLog.map((e) => <div key={e.ts + e.text}>{e.text}</div>)
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default { title: 'Features' };

export const EditMode = () => (
  <GalleryPage
    title="Edit Mode"
    lede={
      <>
        OpenChart charts are editable in place. Wire the edit callbacks and every drag, retitle, and
        reposition comes back as a typed event you fold into your spec — the same JSON you persist
        and re-render. Host apps drive selection through the controlled{' '}
        <code className="ocem-inline-code">selectedElement</code> prop and the imperative{' '}
        <code className="ocem-inline-code">ChartHandle</code> (
        <code className="ocem-inline-code">select</code> /{' '}
        <code className="ocem-inline-code">deselect</code>), then persist edited offsets and text
        straight back into the annotations and chrome.
      </>
    }
  >
    <Section
      id="editor"
      title="The editor"
      lede="One live chart, one controlled inspector. Select an element, drag an annotation, or double-click text to edit — the spec on the right updates in real time and every callback fires in the console below it."
    >
      <EditModeStudio />
    </Section>
    <Section
      id="editable-toggle"
      title="The editable prop"
      lede="Decouple edit interactions from callback presence. Toggle editable to enable or disable drag, delete, and text editing independently."
    >
      <EditableToggleDemo />
    </Section>
  </GalleryPage>
);
