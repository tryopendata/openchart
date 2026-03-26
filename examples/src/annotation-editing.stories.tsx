/**
 * Chart editing demo using the unified onEdit callback for all element types
 * (annotations, connectors, range/refline labels, chrome, legend, series labels).
 * Also demonstrates selection (click), deletion (Delete/Backspace), and
 * inline text editing (double-click) capabilities.
 */

import type {
  AnnotationOffset,
  ChartSpec,
  ChromeKey,
  ElementEdit,
  ElementRef,
  RangeAnnotation,
  RefLineAnnotation,
  TextAnnotation,
} from '@opendata-ai/openchart-core';
import { Chart, useDarkMode, useVizDarkMode, useVizTheme } from '@opendata-ai/openchart-react';
import { useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Font loader
// ---------------------------------------------------------------------------

function useFonts() {
  useEffect(() => {
    const id = 'annotation-demo-fonts';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700&family=IBM+Plex+Mono:wght@400;500&display=swap';
    document.head.appendChild(link);
  }, []);
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function isColorDark(hex: string): boolean {
  const clean = hex.replace('#', '');
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
}

// ---------------------------------------------------------------------------
// Theme-aware color tokens
// ---------------------------------------------------------------------------

function useThemeColors() {
  const theme = useVizTheme();
  const darkMode = useVizDarkMode();

  const bg = theme?.colors?.background ?? (darkMode === 'force' ? '#1a1a2e' : '#ffffff');
  const isDark = isColorDark(bg);
  const text = theme?.colors?.text ?? (isDark ? '#e2e8f0' : '#0f172a');
  const gridline = theme?.colors?.gridline;
  const accent = theme?.colors?.categorical?.[0] ?? (isDark ? '#818cf8' : '#4f46e5');

  return {
    isDark,
    bg,
    surface: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)',
    surfaceElevated: bg,
    border: gridline
      ? hexToRgba(gridline, isDark ? 0.6 : 0.5)
      : isDark
        ? 'rgba(255,255,255,0.06)'
        : 'rgba(0,0,0,0.09)',
    borderAccent: hexToRgba(accent, 0.4),
    text,
    textSecondary: hexToRgba(text, isDark ? 0.65 : 0.6),
    textMuted: hexToRgba(text, isDark ? 0.35 : 0.35),
    accent,
    accentSoft: hexToRgba(accent, 0.1),
    codeBg: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.04)',
    codeBorder: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    toggleTrack: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.15)',
    toggleTrackActive: accent,
    toggleThumb: isDark ? 'rgba(255,255,255,0.5)' : '#fff',
    toggleThumbActive: '#fff',
    btnBg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.7)',
    btnBgHover: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.04)',
    btnBorder: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    shadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.04)',
    badgeBg: hexToRgba(accent, isDark ? 0.15 : 0.1),
    badgeText: accent,
    editHighlight: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
  };
}

// ---------------------------------------------------------------------------
// Toggle switch component
// ---------------------------------------------------------------------------

type Colors = ReturnType<typeof useThemeColors>;

function Toggle({
  checked,
  onChange,
  label,
  c,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  c: Colors;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 13,
        fontWeight: 500,
        color: checked ? c.accent : c.textSecondary,
        transition: 'color 0.2s',
      }}
      aria-pressed={checked}
    >
      <span
        style={{
          position: 'relative',
          display: 'inline-block',
          width: 36,
          height: 20,
          borderRadius: 10,
          background: checked ? c.toggleTrackActive : c.toggleTrack,
          transition: 'background 0.2s ease',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: 8,
            background: checked ? c.toggleThumbActive : c.toggleThumb,
            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
            transition: 'left 0.2s ease, background 0.15s',
          }}
        />
      </span>
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Reusable button component
// ---------------------------------------------------------------------------

function ActionButton({
  onClick,
  label,
  c,
  display: displayFont,
}: {
  onClick: () => void;
  label: string;
  c: Colors;
  display?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 14px',
        borderRadius: 6,
        border: `1px solid ${c.btnBorder}`,
        background: c.btnBg,
        color: c.textSecondary,
        cursor: 'pointer',
        fontFamily: displayFont ?? 'inherit',
        fontSize: 12,
        fontWeight: 500,
        transition: 'all 0.15s',
        lineHeight: 1,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = c.btnBgHover;
        e.currentTarget.style.borderColor = c.borderAccent;
        e.currentTarget.style.color = c.text;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = c.btnBg;
        e.currentTarget.style.borderColor = c.btnBorder;
        e.currentTarget.style.color = c.textSecondary;
      }}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Offset display component (reused across both demos)
// ---------------------------------------------------------------------------

function OffsetDisplay({ offset, c }: { offset: AnnotationOffset | undefined; c: Colors }) {
  return (
    <span>
      <span style={{ color: c.textMuted }}>{'{ '}</span>
      <span style={{ color: c.accent }}>dx</span>
      <span style={{ color: c.textMuted }}>: </span>
      <span
        style={{
          color: c.text,
          fontVariantNumeric: 'tabular-nums',
          minWidth: 32,
          display: 'inline-block',
        }}
      >
        {Math.round(offset?.dx ?? 0)}
      </span>
      <span style={{ color: c.textMuted }}>, </span>
      <span style={{ color: c.accent }}>dy</span>
      <span style={{ color: c.textMuted }}>: </span>
      <span
        style={{
          color: c.text,
          fontVariantNumeric: 'tabular-nums',
          minWidth: 32,
          display: 'inline-block',
        }}
      >
        {Math.round(offset?.dy ?? 0)}
      </span>
      <span style={{ color: c.textMuted }}>{' }'}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Multi-series data: quarterly revenue by segment
// ---------------------------------------------------------------------------

const revenueData = [
  { quarter: '2022-Q1', services: 19.82, devices: 51.03, cloud: 12.48 },
  { quarter: '2022-Q2', services: 19.6, devices: 48.96, cloud: 13.12 },
  { quarter: '2022-Q3', services: 19.19, devices: 50.23, cloud: 13.98 },
  { quarter: '2022-Q4', services: 20.77, devices: 65.78, cloud: 14.85 },
  { quarter: '2023-Q1', services: 20.91, devices: 51.33, cloud: 15.65 },
  { quarter: '2023-Q2', services: 21.21, devices: 48.48, cloud: 16.43 },
  { quarter: '2023-Q3', services: 22.31, devices: 49.32, cloud: 17.52 },
  { quarter: '2023-Q4', services: 23.12, devices: 67.44, cloud: 18.66 },
  { quarter: '2024-Q1', services: 23.87, devices: 53.67, cloud: 19.94 },
  { quarter: '2024-Q2', services: 24.21, devices: 52.89, cloud: 21.3 },
  { quarter: '2024-Q3', services: 25.03, devices: 54.11, cloud: 22.17 },
  { quarter: '2024-Q4', services: 26.34, devices: 71.42, cloud: 23.85 },
];

// Flatten for multi-series line chart
const flatRevenueData = revenueData.flatMap((d) => [
  { quarter: d.quarter, revenue: d.services, segment: 'Services' },
  { quarter: d.quarter, revenue: d.devices, segment: 'Devices' },
  { quarter: d.quarter, revenue: d.cloud, segment: 'Cloud' },
]);

// ---------------------------------------------------------------------------
// Edit type colors (for inspector color-coding)
// ---------------------------------------------------------------------------

const EDIT_TYPE_COLORS: Record<ElementEdit['type'], string> = {
  annotation: '#6366f1',
  'annotation-connector': '#8b5cf6',
  'range-label': '#ec4899',
  'refline-label': '#f59e0b',
  chrome: '#06b6d4',
  'series-label': '#10b981',
  legend: '#f97316',
  'legend-toggle': '#f97316',
  delete: '#ef4444',
  'text-edit': '#8b5cf6',
};

const EDIT_TYPE_LABELS: Record<ElementEdit['type'], string> = {
  annotation: 'Annotation',
  'annotation-connector': 'Connector',
  'range-label': 'Range Label',
  'refline-label': 'Refline Label',
  chrome: 'Chrome',
  'series-label': 'Series Label',
  legend: 'Legend',
  'legend-toggle': 'Legend Toggle',
  delete: 'Delete',
  'text-edit': 'Text Edit',
};

// ---------------------------------------------------------------------------
// State shape for the chart editing demo
// ---------------------------------------------------------------------------

interface EditingState {
  annotations: ChartSpec['annotations'];
  chrome: ChartSpec['chrome'];
  legend: ChartSpec['legend'];
  labels: ChartSpec['labels'];
}

function makeInitialEditingState(): EditingState {
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
        label: 'Revenue target: $45B',
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
        anchor: 'top',
        connector: true,
        offset: { dx: 0, dy: -30 },
      },
      {
        type: 'text',
        x: '2024-Q3',
        y: 22.17,
        text: 'Cloud overtakes\n2022 devices floor',
        fontSize: 11,
        anchor: 'top',
        connector: true,
        offset: { dx: 0, dy: 24 },
      },
    ],
    chrome: {
      title: 'Tech Revenue Diverges as Cloud Surges Past Devices Floor',
      subtitle: 'Quarterly segment revenue, 2022-Q1 to 2024-Q4 ($B)',
      source: 'Source: Company filings, SEC 10-Q reports',
      byline: 'Chart: OpenChart',
    },
    legend: { position: 'top' as const },
    labels: { density: 'auto' as const },
  };
}

// ---------------------------------------------------------------------------
// Inspector section component
// ---------------------------------------------------------------------------

function InspectorSection({
  title,
  color,
  children,
  mono,
  c,
}: {
  title: string;
  color: string;
  children: React.ReactNode;
  mono: string;
  c: Colors;
}) {
  return (
    <div style={{ padding: '10px 16px', borderBottom: `1px solid ${c.border}` }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 2,
            background: color,
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: c.textSecondary,
            letterSpacing: '0.04em',
            textTransform: 'uppercase' as const,
            fontFamily: mono,
          }}
        >
          {title}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 3 }}>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inspector row component
// ---------------------------------------------------------------------------

function InspectorRow({
  label,
  offset,
  mono,
  c,
  highlighted,
}: {
  label: string;
  offset: AnnotationOffset | undefined;
  mono: string;
  c: Colors;
  highlighted?: boolean;
}) {
  return (
    <div
      style={{
        fontFamily: mono,
        fontSize: 12,
        color: c.textSecondary,
        padding: '3px 8px',
        borderRadius: 4,
        background: highlighted ? hexToRgba(c.accent, 0.12) : c.codeBg,
        border: highlighted ? `1px solid ${hexToRgba(c.accent, 0.3)}` : '1px solid transparent',
        display: 'flex',
        alignItems: 'baseline',
        gap: 6,
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      <span
        style={{
          color: highlighted ? c.accent : c.text,
          fontWeight: 500,
          minWidth: 140,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap' as const,
        }}
      >
        {label}
      </span>
      <span style={{ color: c.textMuted, flexShrink: 0 }}>{'\u2192'}</span>
      <OffsetDisplay offset={offset} c={c} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Last edit display for unified demo
// ---------------------------------------------------------------------------

interface EditLogEntry {
  type: ElementEdit['type'];
  label: string;
  offset: AnnotationOffset;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// ElementRef display helper
// ---------------------------------------------------------------------------

function formatElementRef(ref: ElementRef): string {
  switch (ref.type) {
    case 'annotation':
      return `annotation[${ref.index}]${ref.id ? ` (${ref.id})` : ''}`;
    case 'chrome':
      return `chrome.${ref.key}`;
    case 'series-label':
      return `series: ${ref.series}`;
    case 'legend':
      return 'legend';
    case 'legend-entry':
      return `legend[${ref.index}]: ${ref.series}`;
  }
}

// ---------------------------------------------------------------------------
// Selection matching helper
// ---------------------------------------------------------------------------

function isSelectedAnnotation(ref: ElementRef | null, index: number): boolean {
  return ref?.type === 'annotation' && ref.index === index;
}

function isSelectedChrome(ref: ElementRef | null, key: ChromeKey): boolean {
  return ref?.type === 'chrome' && ref.key === key;
}

function isSelectedSeriesLabel(ref: ElementRef | null, series: string): boolean {
  return ref?.type === 'series-label' && ref.series === series;
}

function isSelectedLegend(ref: ElementRef | null): boolean {
  return ref?.type === 'legend';
}

// ---------------------------------------------------------------------------
// Chart Editing demo component
// ---------------------------------------------------------------------------

function ChartEditingDemo() {
  const contextDarkMode = useVizDarkMode();
  const dark = useDarkMode(contextDarkMode);
  const c = useThemeColors();
  useFonts();

  const [editing, setEditing] = useState(true);
  const [state, setState] = useState<EditingState>(makeInitialEditingState);
  const [editLog, setEditLog] = useState<EditLogEntry[]>([]);
  const [selectedRef, setSelectedRef] = useState<ElementRef | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // Resolve a chrome value's offset
  const getChromeOffset = (
    value: string | { text: string; offset?: AnnotationOffset } | undefined,
  ): AnnotationOffset | undefined => {
    if (!value || typeof value === 'string') return undefined;
    return value.offset;
  };

  const handleEdit = (edit: ElementEdit) => {
    // Build log entry
    let label = '';
    let offset: AnnotationOffset = { dx: 0, dy: 0 };

    switch (edit.type) {
      case 'annotation': {
        label = `"${edit.annotation.text.replace(/\n/g, ' ')}"`;
        offset = edit.offset;
        setState((prev) => ({
          ...prev,
          annotations: prev.annotations!.map((a) => {
            if (a.type === 'text' && (a as TextAnnotation).text === edit.annotation.text) {
              return { ...a, offset: edit.offset };
            }
            return a;
          }),
        }));
        break;
      }
      case 'annotation-connector': {
        label = `"${edit.annotation.text.replace(/\n/g, ' ')}" ${edit.endpoint}`;
        offset = edit.offset;
        setState((prev) => ({
          ...prev,
          annotations: prev.annotations!.map((a) => {
            if (a.type === 'text' && (a as TextAnnotation).text === edit.annotation.text) {
              const ta = a as TextAnnotation;
              return {
                ...ta,
                connectorOffset: {
                  ...ta.connectorOffset,
                  [edit.endpoint]: edit.offset,
                },
              };
            }
            return a;
          }),
        }));
        break;
      }
      case 'range-label': {
        label = `"${edit.annotation.label ?? 'range'}"`;
        offset = edit.labelOffset;
        setState((prev) => ({
          ...prev,
          annotations: prev.annotations!.map((a) => {
            if (a.type === 'range' && (a as RangeAnnotation).label === edit.annotation.label) {
              return { ...a, labelOffset: edit.labelOffset };
            }
            return a;
          }),
        }));
        break;
      }
      case 'refline-label': {
        label = `"${edit.annotation.label ?? 'refline'}"`;
        offset = edit.labelOffset;
        setState((prev) => ({
          ...prev,
          annotations: prev.annotations!.map((a) => {
            if (a.type === 'refline' && (a as RefLineAnnotation).label === edit.annotation.label) {
              return { ...a, labelOffset: edit.labelOffset };
            }
            return a;
          }),
        }));
        break;
      }
      case 'chrome': {
        label = edit.key;
        offset = edit.offset;
        setState((prev) => ({
          ...prev,
          chrome: {
            ...prev.chrome,
            [edit.key]: { text: edit.text, offset: edit.offset },
          },
        }));
        break;
      }
      case 'series-label': {
        label = edit.series;
        offset = edit.offset;
        setState((prev) => ({
          ...prev,
          labels: {
            ...prev.labels,
            offsets: {
              ...prev.labels?.offsets,
              [edit.series]: edit.offset,
            },
          },
        }));
        break;
      }
      case 'legend': {
        label = 'legend';
        offset = edit.offset;
        setState((prev) => ({
          ...prev,
          legend: {
            ...prev.legend,
            offset: edit.offset,
          },
        }));
        break;
      }
      case 'legend-toggle': {
        label = `${edit.series} ${edit.hidden ? 'hidden' : 'shown'}`;
        break;
      }
      case 'delete': {
        label = formatElementRef(edit.element);
        // Remove the element from state based on its ref type
        setState((prev) => {
          switch (edit.element.type) {
            case 'annotation': {
              const annotations = [...(prev.annotations ?? [])];
              annotations.splice(edit.element.index, 1);
              return { ...prev, annotations };
            }
            case 'chrome': {
              const chrome = { ...prev.chrome };
              delete chrome[edit.element.key];
              return { ...prev, chrome };
            }
            case 'series-label': {
              const offsets = { ...prev.labels?.offsets };
              delete offsets[edit.element.series];
              return { ...prev, labels: { ...prev.labels, offsets } };
            }
            case 'legend':
              return { ...prev, legend: undefined };
            default:
              return prev;
          }
        });
        setSelectedRef(null);
        break;
      }
      case 'text-edit': {
        label = `"${edit.oldText.replace(/\n/g, ' ')}" -> "${edit.newText.replace(/\n/g, ' ')}"`;
        // Update the text content of the element
        setState((prev) => {
          switch (edit.element.type) {
            case 'annotation': {
              const annotations = [...(prev.annotations ?? [])];
              const ann = annotations[edit.element.index];
              if (ann?.type === 'text') {
                annotations[edit.element.index] = { ...ann, text: edit.newText };
              } else if (ann?.type === 'range') {
                annotations[edit.element.index] = { ...ann, label: edit.newText };
              } else if (ann?.type === 'refline') {
                annotations[edit.element.index] = { ...ann, label: edit.newText };
              }
              return { ...prev, annotations };
            }
            case 'chrome': {
              const chromeVal = prev.chrome?.[edit.element.key];
              const newVal =
                chromeVal && typeof chromeVal === 'object'
                  ? { ...chromeVal, text: edit.newText }
                  : edit.newText;
              return {
                ...prev,
                chrome: { ...prev.chrome, [edit.element.key]: newVal },
              };
            }
            default:
              return prev;
          }
        });
        break;
      }
    }

    setEditLog((prev) => [
      { type: edit.type, label, offset, timestamp: Date.now() },
      ...prev.slice(0, 19), // keep last 20 entries
    ]);
  };

  // Selection handlers
  const handleSelect = (element: ElementRef) => {
    setSelectedRef(element);
  };

  const handleDeselect = (_element: ElementRef) => {
    setSelectedRef(null);
  };

  // Text edit handler (also logged separately from onEdit)
  const handleTextEdit = (_element: ElementRef, oldText: string, newText: string) => {
    setEditLog((prev) => [
      {
        type: 'text-edit',
        label: `"${oldText.replace(/\n/g, ' ')}" -> "${newText.replace(/\n/g, ' ')}"`,
        offset: { dx: 0, dy: 0 },
        timestamp: Date.now(),
      },
      ...prev.slice(0, 19),
    ]);
  };

  // Build the spec
  const spec: ChartSpec = {
    mark: 'line',
    data: flatRevenueData,
    encoding: {
      x: { field: 'quarter', type: 'ordinal', axis: { tickCount: 6 } },
      y: {
        field: 'revenue',
        type: 'quantitative',
        axis: { label: 'Revenue ($B)', format: '$.0f' },
        scale: { zero: true },
      },
      color: { field: 'segment', type: 'nominal' },
    },
    annotations: state.annotations,
    chrome: state.chrome,
    legend: state.legend,
    labels: state.labels,
    darkMode: dark ? 'force' : 'off',
  };

  const mono = "'IBM Plex Mono', 'SF Mono', ui-monospace, monospace";
  const display = "'Bricolage Grotesque', system-ui, sans-serif";

  // Group annotations by type for the inspector, preserving original indices
  const allAnnotations = state.annotations ?? [];
  const textAnnotations = allAnnotations
    .map((a, i) => ({ annotation: a as TextAnnotation, index: i }))
    .filter(({ annotation }) => annotation.type === 'text');
  const rangeAnnotations = allAnnotations
    .map((a, i) => ({ annotation: a as RangeAnnotation, index: i }))
    .filter(({ annotation }) => annotation.type === 'range');
  const reflineAnnotations = allAnnotations
    .map((a, i) => ({ annotation: a as RefLineAnnotation, index: i }))
    .filter(({ annotation }) => annotation.type === 'refline');
  const chromeKeys: ChromeKey[] = ['title', 'subtitle', 'source', 'byline'];
  const seriesNames = ['Services', 'Devices', 'Cloud'];

  return (
    <div
      style={{
        maxWidth: 880,
        margin: '0 auto',
        padding: '40px 32px 64px',
        fontFamily: display,
        color: c.text,
        transition: 'color 0.25s ease',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            display: 'inline-block',
            padding: '3px 10px',
            borderRadius: 100,
            background: c.badgeBg,
            color: c.badgeText,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase' as const,
            marginBottom: 12,
            fontFamily: mono,
          }}
        >
          Interactive Demo
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: c.text,
            lineHeight: 1.2,
          }}
        >
          Chart Editing
        </h1>
        <p
          style={{
            margin: '8px 0 0',
            fontSize: 14,
            color: c.textSecondary,
            lineHeight: 1.5,
            maxWidth: 560,
          }}
        >
          Click any element to select it, drag to reposition, press Delete to remove, or
          double-click text to edit inline. The unified{' '}
          <code
            style={{
              fontFamily: mono,
              fontSize: 12,
              padding: '1px 5px',
              borderRadius: 4,
              background: c.codeBg,
              border: `1px solid ${c.codeBorder}`,
              color: c.accent,
            }}
          >
            onEdit
          </code>{' '}
          callback returns typed edit events for repositioning, deletion, and text editing across
          annotations, connectors, chrome, legend, and series labels.
        </p>
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '12px 16px',
          borderRadius: 10,
          background: c.surface,
          border: `1px solid ${c.border}`,
          marginBottom: 20,
          flexWrap: 'wrap' as const,
        }}
      >
        <Toggle checked={editing} onChange={setEditing} label="Edit mode" c={c} />

        <div
          style={{
            width: 1,
            height: 20,
            background: c.border,
            flexShrink: 0,
          }}
        />

        <ActionButton
          onClick={() => {
            setState(makeInitialEditingState());
            setEditLog([]);
            setSelectedRef(null);
          }}
          label="Reset all positions"
          c={c}
          display={display}
        />

        <span
          style={{
            marginLeft: 'auto',
            fontSize: 11,
            color: c.textMuted,
            fontFamily: mono,
            opacity: editing ? 1 : 0,
            transition: 'opacity 0.25s',
            whiteSpace: 'nowrap' as const,
          }}
        >
          click to select · drag to move · Delete to remove · double-click to edit text
        </span>
      </div>

      {/* Chart card */}
      <div
        style={{
          borderRadius: 12,
          border: `1px solid ${c.border}`,
          background: c.surfaceElevated,
          boxShadow: c.shadow,
          overflow: 'hidden',
          transition: 'background 0.25s ease, border-color 0.25s ease',
        }}
      >
        <div>
          <Chart
            spec={spec}
            onEdit={editing ? handleEdit : undefined}
            onSelect={editing ? handleSelect : undefined}
            onDeselect={editing ? handleDeselect : undefined}
            onTextEdit={editing ? handleTextEdit : undefined}
            selectedElement={selectedRef ?? undefined}
          />
        </div>
      </div>

      {/* Inspector panel */}
      <div
        style={{
          marginTop: 20,
          borderRadius: 10,
          border: `1px solid ${c.border}`,
          background: c.surface,
          overflow: 'hidden',
          transition: 'background 0.25s ease, border-color 0.25s ease',
        }}
      >
        {/* Inspector header */}
        <div
          style={{
            padding: '10px 16px',
            borderBottom: `1px solid ${c.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              background: editing ? '#22c55e' : c.textMuted,
              display: 'inline-block',
              transition: 'background 0.2s',
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: c.textSecondary,
              letterSpacing: '0.04em',
              textTransform: 'uppercase' as const,
              fontFamily: mono,
            }}
          >
            Inspector
          </span>
          {editLog.length > 0 && (
            <span
              style={{
                fontSize: 10,
                color: c.textMuted,
                fontFamily: mono,
                marginLeft: 'auto',
              }}
            >
              {editLog.length} edit{editLog.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Selected element */}
        {selectedRef && (
          <div
            style={{
              padding: '10px 16px',
              background: hexToRgba(c.accent, 0.06),
              borderBottom: `1px solid ${c.border}`,
              borderLeft: `3px solid ${c.accent}`,
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
              fontFamily: mono,
              fontSize: 12,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: c.accent,
                letterSpacing: '0.04em',
                textTransform: 'uppercase' as const,
                flexShrink: 0,
              }}
            >
              Selected
            </span>
            <span style={{ color: c.text, fontWeight: 500 }}>{formatElementRef(selectedRef)}</span>
          </div>
        )}

        {/* Last edit highlight */}
        {editLog.length > 0 && (
          <div
            style={{
              padding: '10px 16px',
              background: c.editHighlight,
              borderBottom: `1px solid ${c.border}`,
              borderLeft: `3px solid ${EDIT_TYPE_COLORS[editLog[0].type]}`,
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
              fontFamily: mono,
              fontSize: 12,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: EDIT_TYPE_COLORS[editLog[0].type],
                letterSpacing: '0.04em',
                textTransform: 'uppercase' as const,
                flexShrink: 0,
              }}
            >
              {EDIT_TYPE_LABELS[editLog[0].type]}
            </span>
            <span style={{ color: c.textSecondary }}>
              <span style={{ color: c.text, fontWeight: 500 }}>{editLog[0].label}</span>
              {' \u2192 '}
              <OffsetDisplay offset={editLog[0].offset} c={c} />
            </span>
          </div>
        )}

        {/* Annotations section */}
        {textAnnotations.length > 0 && (
          <InspectorSection
            title="Text Annotations"
            color={EDIT_TYPE_COLORS.annotation}
            mono={mono}
            c={c}
          >
            {textAnnotations.map(({ annotation: t, index: i }) => (
              <InspectorRow
                key={t.text}
                label={`"${t.text.replace(/\n/g, ' ')}"`}
                offset={t.offset}
                mono={mono}
                c={c}
                highlighted={isSelectedAnnotation(selectedRef, i)}
              />
            ))}
          </InspectorSection>
        )}

        {/* Connectors section */}
        {textAnnotations.filter(({ annotation: t }) => t.connector).length > 0 && (
          <InspectorSection
            title="Connectors"
            color={EDIT_TYPE_COLORS['annotation-connector']}
            mono={mono}
            c={c}
          >
            {textAnnotations
              .filter(({ annotation: t }) => t.connector)
              .map(({ annotation: t, index: i }) => (
                <div
                  key={`conn-${t.text}`}
                  style={{ display: 'flex', flexDirection: 'column' as const, gap: 3 }}
                >
                  <InspectorRow
                    label={`"${t.text.replace(/\n/g, ' ')}" from`}
                    offset={t.connectorOffset?.from}
                    mono={mono}
                    c={c}
                    highlighted={isSelectedAnnotation(selectedRef, i)}
                  />
                  <InspectorRow
                    label={`"${t.text.replace(/\n/g, ' ')}" to`}
                    offset={t.connectorOffset?.to}
                    mono={mono}
                    c={c}
                    highlighted={isSelectedAnnotation(selectedRef, i)}
                  />
                </div>
              ))}
          </InspectorSection>
        )}

        {/* Range labels section */}
        {rangeAnnotations.length > 0 && (
          <InspectorSection
            title="Range Labels"
            color={EDIT_TYPE_COLORS['range-label']}
            mono={mono}
            c={c}
          >
            {rangeAnnotations.map(({ annotation: r, index: i }) => (
              <InspectorRow
                key={`range-${r.label}`}
                label={`"${r.label ?? 'range'}"`}
                offset={r.labelOffset}
                mono={mono}
                c={c}
                highlighted={isSelectedAnnotation(selectedRef, i)}
              />
            ))}
          </InspectorSection>
        )}

        {/* Refline labels section */}
        {reflineAnnotations.length > 0 && (
          <InspectorSection
            title="Refline Labels"
            color={EDIT_TYPE_COLORS['refline-label']}
            mono={mono}
            c={c}
          >
            {reflineAnnotations.map(({ annotation: r, index: i }) => (
              <InspectorRow
                key={`refline-${r.label}`}
                label={`"${r.label ?? 'refline'}"`}
                offset={r.labelOffset}
                mono={mono}
                c={c}
                highlighted={isSelectedAnnotation(selectedRef, i)}
              />
            ))}
          </InspectorSection>
        )}

        {/* Chrome section */}
        <InspectorSection title="Chrome" color={EDIT_TYPE_COLORS.chrome} mono={mono} c={c}>
          {chromeKeys
            .filter((key) => state.chrome?.[key])
            .map((key) => (
              <InspectorRow
                key={`chrome-${key}`}
                label={key}
                offset={getChromeOffset(state.chrome?.[key])}
                mono={mono}
                c={c}
                highlighted={isSelectedChrome(selectedRef, key)}
              />
            ))}
        </InspectorSection>

        {/* Series Labels section */}
        <InspectorSection
          title="Series Labels"
          color={EDIT_TYPE_COLORS['series-label']}
          mono={mono}
          c={c}
        >
          {seriesNames.map((name) => (
            <InspectorRow
              key={`series-${name}`}
              label={name}
              offset={state.labels?.offsets?.[name]}
              mono={mono}
              c={c}
              highlighted={isSelectedSeriesLabel(selectedRef, name)}
            />
          ))}
        </InspectorSection>

        {/* Legend section */}
        <InspectorSection title="Legend" color={EDIT_TYPE_COLORS.legend} mono={mono} c={c}>
          <InspectorRow
            label="legend"
            offset={state.legend?.offset}
            mono={mono}
            c={c}
            highlighted={isSelectedLegend(selectedRef)}
          />
        </InspectorSection>

        {/* Edit log */}
        {editLog.length > 1 && (
          <div style={{ padding: '10px 16px' }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: c.textMuted,
                letterSpacing: '0.04em',
                textTransform: 'uppercase' as const,
                fontFamily: mono,
                marginBottom: 6,
              }}
            >
              Recent edits
            </div>
            <div
              ref={logRef}
              style={{
                display: 'flex',
                flexDirection: 'column' as const,
                gap: 2,
                maxHeight: 120,
                overflowY: 'auto' as const,
              }}
            >
              {editLog.slice(1, 10).map((entry, i) => (
                <div
                  key={`${entry.timestamp}-${i}`}
                  style={{
                    fontFamily: mono,
                    fontSize: 11,
                    color: c.textMuted,
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 6,
                    padding: '2px 0',
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 1,
                      background: EDIT_TYPE_COLORS[entry.type],
                      display: 'inline-block',
                      flexShrink: 0,
                      position: 'relative',
                      top: -1,
                    }}
                  />
                  <span style={{ color: c.textSecondary, minWidth: 80 }}>
                    {EDIT_TYPE_LABELS[entry.type]}
                  </span>
                  <span style={{ color: c.text }}>{entry.label}</span>
                  <span style={{ color: c.textMuted }}>
                    dx:{Math.round(entry.offset.dx ?? 0)} dy:{Math.round(entry.offset.dy ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Story
// ---------------------------------------------------------------------------

export const ChartEditing = () => <ChartEditingDemo />;
