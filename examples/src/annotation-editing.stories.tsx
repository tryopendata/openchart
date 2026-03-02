/**
 * Annotation drag-editing demo.
 *
 * Demonstrates the onAnnotationEdit callback: toggle edit mode to enable
 * drag-to-reposition on text annotation labels. The updated offset values
 * are shown in a live inspector panel below the chart.
 */

import type { AnnotationOffset, ChartSpec, TextAnnotation } from '@opendata-ai/core';
import { Chart, useDarkMode, useVizDarkMode, useVizTheme } from '@opendata-ai/react';
import { useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const stockData = [
  { date: '2023-01-01', price: 130.21 },
  { date: '2023-02-01', price: 147.41 },
  { date: '2023-03-01', price: 125.07 },
  { date: '2023-04-01', price: 169.68 },
  { date: '2023-05-01', price: 177.25 },
  { date: '2023-06-01', price: 193.97 },
  { date: '2023-07-01', price: 196.45 },
  { date: '2023-08-01', price: 187.87 },
  { date: '2023-09-01', price: 171.21 },
  { date: '2023-10-01', price: 170.77 },
  { date: '2023-11-01', price: 189.95 },
  { date: '2023-12-01', price: 192.53 },
  { date: '2024-01-01', price: 185.85 },
  { date: '2024-02-01', price: 188.28 },
  { date: '2024-03-01', price: 171.48 },
  { date: '2024-04-01', price: 170.33 },
  { date: '2024-05-01', price: 192.35 },
  { date: '2024-06-01', price: 210.62 },
  { date: '2024-07-01', price: 222.08 },
  { date: '2024-08-01', price: 226.84 },
  { date: '2024-09-01', price: 226.21 },
  { date: '2024-10-01', price: 225.91 },
  { date: '2024-11-01', price: 237.33 },
  { date: '2024-12-01', price: 242.84 },
];

// ---------------------------------------------------------------------------
// Spec builder
// ---------------------------------------------------------------------------

function makeSpec(annotations: ChartSpec['annotations'], dark: boolean): ChartSpec {
  return {
    type: 'area',
    data: stockData,
    encoding: {
      x: { field: 'date', type: 'temporal' },
      y: {
        field: 'price',
        type: 'quantitative',
        axis: { label: 'Share Price', format: '$,.0f' },
        scale: { zero: false },
      },
    },
    annotations,
    labels: { density: 'none' },
    chrome: {
      title: 'Apple Shares Hit Record After AI-Fuelled Rally',
      subtitle: 'AAPL monthly closing price, Jan 2023 to Dec 2024',
      source: 'Source: Nasdaq historical data',
      byline: 'Chart: OpenChart',
    },
    darkMode: dark ? 'force' : 'off',
  };
}

// ---------------------------------------------------------------------------
// Shared annotations (used as initial state)
// ---------------------------------------------------------------------------

const initialAnnotations: ChartSpec['annotations'] = [
  {
    type: 'range',
    x1: '2023-02-15',
    x2: '2023-04-01',
    label: 'SVB collapse',
    fill: '#dc2626',
    opacity: 0.08,
  },
  {
    type: 'refline',
    y: 181,
    label: '2-yr avg: $181',
    style: 'dashed',
    stroke: '#94a3b8',
    strokeWidth: 1,
  },
  {
    type: 'text',
    x: '2024-12-01',
    y: 243,
    text: 'Record close: $243',
    fontSize: 11,
    anchor: 'left',
    offset: { dx: -100, dy: -12 },
  },
  {
    type: 'text',
    x: '2023-03-01',
    y: 125,
    text: 'March 2023 low',
    fontSize: 11,
    anchor: 'bottom',
    connector: true,
    offset: { dx: 0, dy: 16 },
  },
];

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
// Demo component
// ---------------------------------------------------------------------------

function AnnotationEditDemo() {
  const contextDarkMode = useVizDarkMode();
  const dark = useDarkMode(contextDarkMode);
  const c = useThemeColors();
  useFonts();

  const [editing, setEditing] = useState(true);
  const [annotations, setAnnotations] = useState(initialAnnotations!);
  const [lastEdit, setLastEdit] = useState<{
    text: string;
    offset: AnnotationOffset;
  } | null>(null);

  const handleAnnotationEdit = (annotation: TextAnnotation, updatedOffset: AnnotationOffset) => {
    setLastEdit({ text: annotation.text, offset: updatedOffset });
    setAnnotations((prev) =>
      prev.map((a) => {
        if (a === annotation || (a.type === 'text' && a.text === annotation.text)) {
          return { ...a, offset: updatedOffset };
        }
        return a;
      }),
    );
  };

  const spec = makeSpec(annotations, dark);
  const mono = "'IBM Plex Mono', 'SF Mono', ui-monospace, monospace";
  const display = "'Bricolage Grotesque', system-ui, sans-serif";

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
          Annotation Editing
        </h1>
        <p
          style={{
            margin: '8px 0 0',
            fontSize: 14,
            color: c.textSecondary,
            lineHeight: 1.5,
            maxWidth: 520,
          }}
        >
          Drag text annotations to reposition them. The{' '}
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
            onAnnotationEdit
          </code>{' '}
          callback returns the updated offset values for persistence.
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

        <button
          type="button"
          onClick={() => {
            setAnnotations(initialAnnotations!);
            setLastEdit(null);
          }}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            border: `1px solid ${c.btnBorder}`,
            background: c.btnBg,
            color: c.textSecondary,
            cursor: 'pointer',
            fontFamily: display,
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
          Reset positions
        </button>

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
          drag annotations to reposition
        </span>
      </div>

      {/* Chart card - uses theme background so there's no color gap */}
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
        <div style={{ height: 440 }}>
          <Chart spec={spec} onAnnotationEdit={editing ? handleAnnotationEdit : undefined} />
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
        </div>

        {/* Last edit highlight */}
        {lastEdit && (
          <div
            style={{
              padding: '10px 16px',
              background: c.editHighlight,
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
              Last edit
            </span>
            <span style={{ color: c.textSecondary }}>
              <span style={{ color: c.text, fontWeight: 500 }}>"{lastEdit.text}"</span>
              {' \u2192 '}
              <span style={{ color: c.textMuted }}>{'{ '}</span>
              <span style={{ color: c.accent }}>dx</span>
              <span style={{ color: c.textMuted }}>: </span>
              <span style={{ color: c.text, fontVariantNumeric: 'tabular-nums' }}>
                {Math.round(lastEdit.offset.dx ?? 0)}
              </span>
              <span style={{ color: c.textMuted }}>, </span>
              <span style={{ color: c.accent }}>dy</span>
              <span style={{ color: c.textMuted }}>: </span>
              <span style={{ color: c.text, fontVariantNumeric: 'tabular-nums' }}>
                {Math.round(lastEdit.offset.dy ?? 0)}
              </span>
              <span style={{ color: c.textMuted }}>{' }'}</span>
            </span>
          </div>
        )}

        {/* Current offsets */}
        <div style={{ padding: '12px 16px' }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: c.textMuted,
              letterSpacing: '0.04em',
              textTransform: 'uppercase' as const,
              fontFamily: mono,
              marginBottom: 8,
            }}
          >
            Annotation offsets
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column' as const,
              gap: 4,
            }}
          >
            {annotations
              .filter((a) => a.type === 'text')
              .map((a) => {
                const t = a as TextAnnotation;
                return (
                  <div
                    key={t.text}
                    style={{
                      fontFamily: mono,
                      fontSize: 12,
                      color: c.textSecondary,
                      padding: '4px 8px',
                      borderRadius: 4,
                      background: c.codeBg,
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 6,
                    }}
                  >
                    <span style={{ color: c.text, fontWeight: 500, minWidth: 160 }}>
                      "{t.text}"
                    </span>
                    <span style={{ color: c.textMuted }}>{'\u2192'}</span>
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
                        {Math.round(t.offset?.dx ?? 0)}
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
                        {Math.round(t.offset?.dy ?? 0)}
                      </span>
                      <span style={{ color: c.textMuted }}>{' }'}</span>
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const EditableAnnotations = () => <AnnotationEditDemo />;
