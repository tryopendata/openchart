/**
 * Ladle global provider for the OpenChart gallery.
 *
 * Responsibilities:
 * 1. Corrected dark bridge: Ladle leaves `globalState.theme === 'auto'` and
 *    stamps the literal `data-theme="auto"` on the documentElement (verified
 *    in the 01b spike), so dark must be resolved from `globalState.theme` plus
 *    `matchMedia`, NOT from the DOM attribute. Resolved mode is published via
 *    OcModeContext so GalleryPage can stamp `[data-oc-mode]` (crosses the
 *    width iframe; C3).
 * 2. Legacy-slug redirect map (`.ladle/redirects.ts`).
 * 3. `document.title` override (Ladle rewrites it on every navigation).
 * 4. Unified floating toolbar: theme picker (`.ladle-theme-picker`) + GitHub
 *    link (`.oc-github-link`) — those class names are load-bearing; e2e
 *    capture.ts hides them (C1).
 * 5. Shell chrome styling via `.ladle/shell.css` (imported here).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import '@opendata-ai/openchart-core/styles.css';
import '../src/stories.css';
import './shell.css';

import type { GlobalProvider } from '@ladle/react';
import type { DarkMode } from '@opendata-ai/openchart-core';
import { VizThemeProvider } from '@opendata-ai/openchart-react';
import { OcModeContext } from '../src/components/mode-context';
import { redirects } from './redirects';
import { themeNames, themes } from './themes';

// ---------------------------------------------------------------------------
// Design tokens (JS side) — single source for all inline styles.
// CSS tokens live in src/tokens.css + shell.css + gallery.css.
// ---------------------------------------------------------------------------

const PALETTE = {
  light: {
    bg: '#ffffff',
    bgCanvas: '#fafafa',
    border: '#d4d4d8',
    text: '#09090b',
    textMuted: '#71717a',
    hoverBg: '#f4f4f5',
    activeBg: 'rgba(6,182,212,0.1)',
    accent: '#0e7490',
  },
  dark: {
    bg: '#191a1b',
    bgCanvas: '#0f1011',
    border: 'rgba(255,255,255,0.08)',
    text: '#f7f8f8',
    textMuted: '#8a8f98',
    hoverBg: 'rgba(6,182,212,0.12)',
    activeBg: 'rgba(6,182,212,0.14)',
    accent: '#67e8f9',
  },
} as const;

type OcMode = 'light' | 'dark';

// ---------------------------------------------------------------------------
// Dark bridge: resolve dark from globalState + matchMedia
// ---------------------------------------------------------------------------

function useResolvedDark(ladleTheme: string | undefined): boolean {
  const [prefersDark, setPrefersDark] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return ladleTheme === 'dark' || (ladleTheme === 'auto' && prefersDark);
}

/**
 * Stamp the RESOLVED mode onto `<html data-theme>`.
 *
 * Ladle writes the literal `data-theme="auto"` when the theme addon is in auto
 * mode — it never resolves the OS preference itself. shell.css binds its tokens
 * under `[data-theme='light']` / `[data-theme='dark']`, so `auto` matches
 * neither: on a dark-mode OS the Ladle shell (sidebar, search, addons bar)
 * stayed light while the story content correctly went dark, and the two
 * disagreed. Rewriting the attribute to the resolved value keeps shell.css a
 * clean two-value contract and needs no CSS change.
 *
 * Ladle re-stamps `auto` whenever it re-renders, and this Provider is a CHILD of
 * Ladle's App, so our effect runs BEFORE App's and a plain effect loses the
 * race — the same hazard `useTitleOverride` below documents. So observe the
 * attribute and re-assert whenever anything else changes it, with the keyed
 * effect as a cheap fast-path. The observer must ignore its own writes or it
 * would loop.
 */
function useResolvedThemeAttr(resolvedDark: boolean) {
  const resolved = resolvedDark ? 'dark' : 'light';

  useEffect(() => {
    const root = document.documentElement;
    const reassert = () => {
      if (root.getAttribute('data-theme') !== resolved) {
        root.setAttribute('data-theme', resolved);
      }
    };
    reassert();
    const obs = new MutationObserver(reassert);
    obs.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, [resolved]);
}

// ---------------------------------------------------------------------------
// Legacy-slug redirects
// ---------------------------------------------------------------------------

function useLegacyRedirect() {
  useEffect(() => {
    if (typeof location === 'undefined') return;
    const params = new URLSearchParams(location.search);
    const story = params.get('story');
    if (!story) return;
    const target = redirects[story];
    if (!target) return;
    params.set('story', target.story);
    const hash = target.hash ? `#${target.hash}` : '';
    history.replaceState(null, '', `${location.pathname}?${params.toString()}${hash}`);
  }, []);
}

// ---------------------------------------------------------------------------
// Title override (Ladle sets "<story> | Ladle" on every navigation)
// ---------------------------------------------------------------------------

const GALLERY_TITLE = 'OpenChart Examples';

/**
 * Hold the browser title at GALLERY_TITLE. A plain `useEffect` loses the race:
 * this Provider renders as a CHILD of Ladle's App, so React runs our effect
 * BEFORE App's, and App resets `document.title` on every story change
 * (app.tsx:108). Instead of racing, observe the `<title>` node and re-assert
 * whenever anything else changes it. A keyed effect still runs first as a cheap
 * fast-path so there's no visible flicker on same-story reloads.
 */
function useTitleOverride(story: string | undefined) {
  useEffect(() => {
    if (document.title !== GALLERY_TITLE) document.title = GALLERY_TITLE;
  }, [story]);

  useEffect(() => {
    const titleEl = document.querySelector('title');
    if (!titleEl) {
      document.title = GALLERY_TITLE;
      return;
    }
    const reassert = () => {
      if (document.title !== GALLERY_TITLE) document.title = GALLERY_TITLE;
    };
    reassert();
    const obs = new MutationObserver(reassert);
    obs.observe(titleEl, { childList: true, characterData: true, subtree: true });
    return () => obs.disconnect();
  }, []);
}

// ---------------------------------------------------------------------------
// Theme picker (floating; keep `.ladle-theme-picker` class — C1)
// ---------------------------------------------------------------------------

/** Resolve a TokenValue (or plain string) to one mode's color. */
function tokenColor(v: unknown, mode: OcMode): string | undefined {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && 'light' in v) {
    return (v as { light: string; dark: string })[mode];
  }
  return undefined;
}

/**
 * Pull the display fields off a named theme. `ThemeConfig.colors` may be the
 * object form or an array palette shortcut, so narrow before reading keys.
 * Surface colors are `TokenValue` pairs on every house style, so the shell
 * canvas has to read the half that matches the current mode — otherwise a dark
 * house style paints its charts dark on a light page.
 */
function themeSwatch(
  name: string,
  mode: OcMode,
): {
  categorical?: string[];
  background?: string;
  text?: string;
} {
  const colors = themes[name]?.colors;
  if (!colors) return {};
  if (Array.isArray(colors)) return { categorical: colors };
  return {
    categorical: colors.categorical,
    background: tokenColor(colors.background, mode),
    text: tokenColor(colors.text, mode),
  };
}

function Swatches({ colors, size = 8 }: { colors?: string[]; size?: number }) {
  if (!colors) return null;
  return (
    <span style={{ display: 'inline-flex', gap: 2, verticalAlign: 'middle' }}>
      {colors.slice(0, 5).map((c, i) => (
        <span
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: size > 8 ? 3 : 2,
            background: c,
            display: 'inline-block',
          }}
        />
      ))}
    </span>
  );
}

function ThemePicker({
  selected,
  onChange,
  mode,
}: {
  selected: string;
  onChange: (name: string) => void;
  mode: OcMode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const p = PALETTE[mode];

  return (
    <div
      ref={ref}
      className="ladle-theme-picker"
      style={{
        position: 'fixed',
        top: 12,
        left: 12,
        zIndex: 9999,
        fontFamily: "'Inter Gallery', 'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: p.bg,
          border: `1px solid ${p.border}`,
          borderRadius: 8,
          padding: '6px 12px',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 510,
          fontFamily: 'inherit',
          color: p.text,
          transition: 'border-color 0.15s',
          outline: 'none',
          lineHeight: 1,
        }}
      >
        <span
          style={{
            color: p.textMuted,
            fontSize: 10,
            fontWeight: 590,
            letterSpacing: '0.04em',
            textTransform: 'uppercase' as const,
          }}
        >
          Theme
        </span>
        <span style={{ width: 1, height: 14, background: p.border, flexShrink: 0 }} />
        <span>{selected}</span>
        <Swatches colors={themeSwatch(selected, mode).categorical} />
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          style={{
            marginLeft: 2,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s',
          }}
        >
          <path
            d="M1 1L5 5L9 1"
            stroke={p.textMuted}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            minWidth: 220,
            background: p.bg,
            border: `1px solid ${p.border}`,
            borderRadius: 10,
            overflow: 'hidden',
            padding: 4,
          }}
        >
          {themeNames.map((name) => {
            const isActive = name === selected;
            return (
              <button
                key={name}
                type="button"
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '7px 10px',
                  border: 'none',
                  borderRadius: 6,
                  background: isActive ? p.activeBg : 'transparent',
                  color: isActive ? p.accent : p.text,
                  fontSize: 12,
                  fontWeight: isActive ? 590 : 400,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  textAlign: 'left' as const,
                  transition: 'background 0.1s',
                  lineHeight: 1,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = p.hoverBg;
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                <span style={{ flex: 1 }}>{name}</span>
                <Swatches colors={themeSwatch(name, mode).categorical} size={7} />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GitHub link (keep `.oc-github-link` class — C1)
// ---------------------------------------------------------------------------

function GitHubLink({ mode }: { mode: OcMode }) {
  const p = PALETTE[mode];
  return (
    <a
      href="https://github.com/tryopendata/openchart"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="OpenChart GitHub repository (opens in new tab)"
      className="oc-github-link"
      style={{
        position: 'fixed',
        top: 14,
        right: 280,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 15,
        fontFamily: "'Inter Gallery', 'Inter', system-ui, -apple-system, sans-serif",
        fontWeight: 510,
        color: p.textMuted,
        textDecoration: 'none',
        opacity: 0.85,
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = '1';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = '0.85';
      }}
    >
      <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
      </svg>
      GitHub
    </a>
  );
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const Provider: GlobalProvider = ({ children, globalState }) => {
  const [selected, setSelected] = useState('Default');
  const theme = themes[selected];
  const resolvedDark = useResolvedDark(globalState.theme);
  const darkMode: DarkMode = resolvedDark ? 'force' : 'off';
  const mode: OcMode = resolvedDark ? 'dark' : 'light';

  useResolvedThemeAttr(resolvedDark);
  useLegacyRedirect();
  useTitleOverride(globalState.story);

  const swatch = themeSwatch(selected, mode);
  const p = PALETTE[mode];
  const bg = swatch.background ?? p.bgCanvas;
  const fg = swatch.text ?? p.text;

  const modeCtx = useMemo(() => mode, [mode]);

  return (
    <OcModeContext.Provider value={modeCtx}>
      <VizThemeProvider theme={theme} darkMode={darkMode}>
        <ThemePicker selected={selected} onChange={setSelected} mode={mode} />
        <div className="ladle-story-root" style={{ background: bg, color: fg }}>
          {children}
        </div>
        <GitHubLink mode={mode} />
      </VizThemeProvider>
    </OcModeContext.Provider>
  );
};
