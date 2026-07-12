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
    // Replace so the legacy URL doesn't linger in history; Ladle picks up the
    // new ?story= on the resulting location change.
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

/**
 * Pull the display fields off a named theme. `ThemeConfig.colors` may be the
 * object form or an array palette shortcut, so narrow before reading keys.
 */
function themeSwatch(name: string): {
  categorical?: string[];
  background?: string;
  text?: string;
} {
  const colors = themes[name]?.colors;
  if (!colors) return {};
  if (Array.isArray(colors)) return { categorical: colors };
  return {
    categorical: colors.categorical,
    background: typeof colors.background === 'string' ? colors.background : undefined,
    text: typeof colors.text === 'string' ? colors.text : undefined,
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
  dark,
}: {
  selected: string;
  onChange: (name: string) => void;
  dark: boolean;
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

  // Cool/pure neutrals; borders over shadows in dark.
  const bg = dark ? '#10151d' : '#ffffff';
  const border = dark ? '#232b38' : '#e2e8f0';
  const text = dark ? '#e2e8f0' : '#1e293b';
  const textMuted = dark ? '#94a3b8' : '#64748b';
  const hoverBg = dark ? 'rgba(34,211,238,0.12)' : '#f1f5f9';
  const activeBg = dark ? 'rgba(34,211,238,0.14)' : 'rgba(6,182,212,0.1)';
  const accent = dark ? '#5ad3e8' : '#0e7490';

  return (
    <div
      ref={ref}
      className="ladle-theme-picker"
      style={{
        position: 'fixed',
        top: 12,
        left: 12,
        zIndex: 9999,
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: bg,
          border: `1px solid ${border}`,
          borderRadius: 8,
          padding: '6px 12px',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 500,
          fontFamily: 'inherit',
          color: text,
          transition: 'border-color 0.15s',
          outline: 'none',
          lineHeight: 1,
        }}
      >
        <span
          style={{
            color: textMuted,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase' as const,
          }}
        >
          Theme
        </span>
        <span style={{ width: 1, height: 14, background: border, flexShrink: 0 }} />
        <span>{selected}</span>
        <Swatches colors={themeSwatch(selected).categorical} />
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
            stroke={textMuted}
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
            background: bg,
            border: `1px solid ${border}`,
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
                  background: isActive ? activeBg : 'transparent',
                  color: isActive ? accent : text,
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 400,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  textAlign: 'left' as const,
                  transition: 'background 0.1s',
                  lineHeight: 1,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = hoverBg;
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                <span style={{ flex: 1 }}>{name}</span>
                <Swatches colors={themeSwatch(name).categorical} size={7} />
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

function GitHubLink({ dark }: { dark: boolean }) {
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
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        fontWeight: 500,
        color: dark ? '#94a3b8' : '#64748b',
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
  const mode = resolvedDark ? 'dark' : 'light';

  useResolvedThemeAttr(resolvedDark);
  useLegacyRedirect();
  useTitleOverride(globalState.story);

  // Themed canvas so no white/black gutter shows through around stories that
  // don't fill the frame. Uses the theme background when a named theme sets
  // one, else the resolved neutral canvas.
  const swatch = themeSwatch(selected);
  const bg = swatch.background ?? (resolvedDark ? '#0a0e14' : '#ffffff');
  const fg = swatch.text ?? (resolvedDark ? '#e2e8f0' : '#1e293b');

  const modeCtx = useMemo(() => mode, [mode]);

  return (
    <OcModeContext.Provider value={modeCtx}>
      <VizThemeProvider theme={theme} darkMode={darkMode}>
        <ThemePicker selected={selected} onChange={setSelected} dark={resolvedDark} />
        <div className="ladle-story-root" style={{ background: bg, color: fg }}>
          {children}
        </div>
        <GitHubLink dark={resolvedDark} />
      </VizThemeProvider>
    </OcModeContext.Provider>
  );
};
