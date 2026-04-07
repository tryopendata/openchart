/**
 * Ladle global provider: imports viz CSS, provides a refined floating
 * theme switcher, and injects CSS overrides for Ladle's sidebar.
 */
import { useEffect, useRef, useState } from 'react';
import '@opendata-ai/openchart-core/styles.css';
import '../src/stories.css';

import type { GlobalProvider } from '@ladle/react';
import type { DarkMode, ThemeConfig } from '@opendata-ai/openchart-core';
import { VizThemeProvider } from '@opendata-ai/openchart-react';

// ---------------------------------------------------------------------------
// Theme registry
// ---------------------------------------------------------------------------

const themes: Record<string, ThemeConfig | undefined> = {
  Default: undefined,
  Warm: {
    colors: {
      categorical: ['#e76f51', '#f4a261', '#e9c46a', '#2a9d8f', '#264653'],
      background: '#fdf6ec',
      text: '#3d2c1e',
    },
    fonts: { family: 'Georgia, "Times New Roman", serif' },
  },
  Monospace: {
    colors: {
      categorical: ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd'],
      background: '#f8f9ff',
      text: '#1e1b4b',
      gridline: '#c7d2fe',
    },
    fonts: { family: '"JetBrains Mono", "Fira Code", monospace' },
  },
  Midnight: {
    colors: {
      categorical: ['#38bdf8', '#f472b6', '#34d399', '#fbbf24', '#a78bfa', '#fb923c'],
      background: '#0f172a',
      text: '#e2e8f0',
      gridline: '#1e293b',
      axis: '#64748b',
    },
    fonts: { family: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  },
  Ink: {
    colors: {
      categorical: ['#c0392b', '#2c3e50', '#7f8c8d', '#27ae60', '#d4880f', '#6c3483'],
      background: '#faf9f6',
      text: '#111111',
      gridline: '#d5d2cb',
      axis: '#555555',
    },
    fonts: { family: 'Charter, Georgia, "Times New Roman", serif' },
  },
  Ocean: {
    colors: {
      categorical: ['#0077b6', '#e76f51', '#00b4d8', '#f4a261', '#2a9d8f', '#264653'],
      background: '#f0f7fa',
      text: '#0c2d3f',
      gridline: '#d1e6ee',
      axis: '#5a8a9f',
    },
    fonts: { family: 'Optima, Candara, "Noto Sans", "Trebuchet MS", sans-serif' },
  },
  Botanical: {
    colors: {
      categorical: ['#5f7c43', '#bc4749', '#386641', '#c68b59', '#7b2d8e', '#457b9d'],
      background: '#f7f5ef',
      text: '#2b331e',
      gridline: '#ddd9cb',
      axis: '#7a7560',
    },
    fonts: { family: 'Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif' },
  },
  Neon: {
    colors: {
      categorical: ['#00f5d4', '#f15bb5', '#fee440', '#00bbf9', '#9b5de5', '#ff6b6b'],
      background: '#0a0a12',
      text: '#e8e8f0',
      gridline: '#1a1a2e',
      axis: '#555566',
    },
    fonts: { family: '"SF Mono", Menlo, Monaco, "Courier New", monospace' },
  },
  Pastel: {
    colors: {
      categorical: ['#6c8ebf', '#c97c7c', '#7ab68c', '#c9a050', '#9b7bc0', '#cc8963'],
      background: '#fefcfa',
      text: '#3a3535',
      gridline: '#ece6e0',
      axis: '#998f88',
    },
    fonts: { family: '"Avenir Next", Avenir, Montserrat, "Gill Sans", sans-serif' },
  },
  Copper: {
    colors: {
      categorical: ['#d4956a', '#8bb174', '#d4b453', '#7e9bb5', '#c47979', '#b8a99a'],
      background: '#1c1917',
      text: '#e7e0d8',
      gridline: '#302a24',
      axis: '#7a7068',
    },
    fonts: { family: 'Didot, "Bodoni MT", "Playfair Display", Georgia, serif' },
  },
  'Gen Z': {
    colors: {
      categorical: ['#ff6b00', '#a855f7', '#22d3ee', '#facc15', '#f43f5e', '#84cc16'],
      background: '#fffbeb',
      text: '#1c1917',
      gridline: '#fde68a',
      axis: '#92400e',
    },
    fonts: { family: '"DM Sans", "Nunito", "Poppins", system-ui, sans-serif' },
    borderRadius: 12,
  },
};

const themeNames = Object.keys(themes);

// ---------------------------------------------------------------------------
// Ladle CSS overrides
// ---------------------------------------------------------------------------

const ladleOverrides = `
  /* ── Story root ── */
  .ladle-story-root {
    height: calc(100vh - 60px);
    transition: background 0.25s ease, color 0.25s ease;
  }

  /* ── Variables ── */
  :root {
    --ladle-bg-color-primary: #ffffff !important;
    --ladle-bg-color-secondary: #f4f5f7 !important;
    --ladle-color-primary: #1f2937 !important;
    --ladle-color-hover: #6366f1 !important;
    --ladle-color-accent: #4f46e5 !important;
  }

  [data-theme="dark"] {
    --ladle-bg-color-primary: #0f1117 !important;
    --ladle-bg-color-secondary: #181b24 !important;
    --ladle-color-primary: #d1d5db !important;
    --ladle-color-hover: #a5b4fc !important;
    --ladle-color-accent: #818cf8 !important;
  }

  /* Strip wrapper backgrounds so theme shows through */
  html, body, #root, .ladle-main, .ladle-background {
    background: transparent !important;
  }

  /* ── Sidebar ── */
  .ladle-aside {
    font-family: 'Bricolage Grotesque', system-ui, -apple-system, sans-serif !important;
    font-size: 13px !important;
    border-left: 1px solid rgba(0,0,0,0.08) !important;
    background-color: #f8f9fb !important;
    padding: 20px 14px 20px 12px !important;
    overflow-x: hidden !important;
    scrollbar-width: thin !important;
    scrollbar-color: rgba(0,0,0,0.12) transparent !important;
  }

  /* Search input: replace underline with a proper field */
  .ladle-aside input {
    font-family: 'Bricolage Grotesque', system-ui, -apple-system, sans-serif !important;
    font-size: 12.5px !important;
    border: 1px solid rgba(0,0,0,0.1) !important;
    border-width: 1px !important;
    border-radius: 8px !important;
    padding: 8px 12px !important;
    background: #ffffff !important;
    color: #1f2937 !important;
    transition: border-color 0.15s, box-shadow 0.15s !important;
    margin-bottom: 4px !important;
  }

  .ladle-aside input::placeholder {
    color: #9ca3af !important;
    font-weight: 400 !important;
  }

  .ladle-aside input:focus {
    border-color: #818cf8 !important;
    box-shadow: 0 0 0 3px rgba(129,140,248,0.12) !important;
    outline: none !important;
    color: #1f2937 !important;
  }

  /* Tree list */
  .ladle-aside ul {
    margin: 8px 0 0 0 !important;
    padding: 0 !important;
  }

  .ladle-aside li {
    margin: 1px 0 !important;
    font-size: 13px !important;
    border-radius: 6px !important;
    transition: background 0.1s !important;
  }

  .ladle-aside li > div {
    padding: 5px 8px !important;
    border-radius: 6px !important;
  }

  .ladle-aside li > div:hover {
    background: rgba(0,0,0,0.04) !important;
  }

  /* Expanded group items: bolder label */
  .ladle-aside li[aria-expanded] > div > div:last-child {
    font-weight: 600 !important;
    color: #374151 !important;
    letter-spacing: -0.01em !important;
  }

  /* Collapsed chevrons: muted */
  .ladle-aside li[aria-expanded="false"] svg {
    opacity: 0.4 !important;
  }

  .ladle-aside li[aria-expanded="true"] svg {
    opacity: 0.6 !important;
  }

  /* Nested story links */
  .ladle-aside .ladle-linkable {
    margin-left: 2px !important;
  }

  .ladle-aside .ladle-linkable a {
    font-size: 13px !important;
    font-weight: 400 !important;
    color: #4b5563 !important;
    padding: 4px 8px !important;
    border-radius: 6px !important;
    display: block !important;
    transition: background 0.1s, color 0.1s !important;
  }

  .ladle-aside .ladle-linkable a:hover {
    background: rgba(79,70,229,0.06) !important;
    color: #4338ca !important;
  }

  /* Active story */
  .ladle-aside .ladle-active {
    background: rgba(79,70,229,0.08) !important;
  }

  .ladle-aside .ladle-active a {
    color: #4338ca !important;
    font-weight: 600 !important;
  }

  /* File icons in story links */
  .ladle-aside .ladle-linkable svg {
    opacity: 0.35 !important;
    width: 14px !important;
    height: 14px !important;
  }

  .ladle-aside .ladle-active svg {
    opacity: 0.55 !important;
    color: #4338ca !important;
  }

  /* ── Bottom addons bar ── */
  .ladle-addons {
    font-family: 'Bricolage Grotesque', system-ui, -apple-system, sans-serif !important;
    background: rgba(248,249,251,0.92) !important;
    backdrop-filter: blur(12px) !important;
    -webkit-backdrop-filter: blur(12px) !important;
    border-top: 1px solid rgba(0,0,0,0.06) !important;
    padding: 6px 8px !important;
    margin: 0 !important;
    margin-inline: 0 !important;
    width: auto !important;
    left: 0 !important;
    right: 0 !important;
  }

  .ladle-addons ul {
    gap: 2px !important;
    align-items: center !important;
  }

  .ladle-addons li {
    background: transparent !important;
    box-shadow: none !important;
    border-radius: 8px !important;
    margin: 0 1px !important;
    width: auto !important;
    height: auto !important;
  }

  .ladle-addons > ul > li > button {
    border-radius: 8px !important;
    padding: 7px !important;
    color: #9ca3af !important;
    transition: background 0.12s, color 0.12s, transform 0.12s !important;
  }

  .ladle-addons > ul > li > button:hover {
    background: rgba(79,70,229,0.08) !important;
    color: #4f46e5 !important;
    transform: translateY(-1px) !important;
  }

  .ladle-addons > ul > li > button:active {
    transform: translateY(0) !important;
  }

  .ladle-addons > ul > li > button > label {
    display: none !important;
  }

  .ladle-addons > ul > li > button svg {
    width: 18px !important;
    height: 18px !important;
    stroke-width: 1.75 !important;
  }

  /* Tooltip styling */
  .ladle-addon-tooltip {
    font-family: 'Bricolage Grotesque', system-ui, -apple-system, sans-serif !important;
    font-size: 11px !important;
    border-radius: 6px !important;
    padding: 4px 8px !important;
    letter-spacing: -0.01em !important;
  }

  /* Resize handle */
  .ladle-resize-handle {
    width: 1px !important;
    background: rgba(0,0,0,0.06) !important;
  }

  /* ── Dark mode ── */
  [data-theme="dark"] .ladle-aside {
    background-color: #0f1117 !important;
    border-left-color: rgba(255,255,255,0.06) !important;
    scrollbar-color: rgba(255,255,255,0.1) transparent !important;
  }

  [data-theme="dark"] .ladle-aside input {
    background: #181b24 !important;
    border-color: rgba(255,255,255,0.08) !important;
    color: #e5e7eb !important;
  }

  [data-theme="dark"] .ladle-aside input::placeholder {
    color: #6b7280 !important;
  }

  [data-theme="dark"] .ladle-aside input:focus {
    border-color: #6366f1 !important;
    box-shadow: 0 0 0 3px rgba(99,102,241,0.12) !important;
  }

  [data-theme="dark"] .ladle-aside li > div:hover {
    background: rgba(255,255,255,0.03) !important;
  }

  [data-theme="dark"] .ladle-aside li[aria-expanded] > div > div:last-child {
    color: #e5e7eb !important;
  }

  [data-theme="dark"] .ladle-aside .ladle-linkable a {
    color: #9ca3af !important;
  }

  [data-theme="dark"] .ladle-aside .ladle-linkable a:hover {
    background: rgba(129,140,248,0.08) !important;
    color: #a5b4fc !important;
  }

  [data-theme="dark"] .ladle-aside .ladle-active {
    background: rgba(99,102,241,0.1) !important;
  }

  [data-theme="dark"] .ladle-aside .ladle-active a {
    color: #a5b4fc !important;
  }

  [data-theme="dark"] .ladle-aside .ladle-active svg {
    color: #a5b4fc !important;
  }

  [data-theme="dark"] .ladle-addons {
    background: rgba(15,17,23,0.92) !important;
    border-top-color: rgba(255,255,255,0.06) !important;
  }

  [data-theme="dark"] .ladle-addons > ul > li > button {
    color: #6b7280 !important;
  }

  [data-theme="dark"] .ladle-addons > ul > li > button:hover {
    background: rgba(129,140,248,0.1) !important;
    color: #a5b4fc !important;
  }

  [data-theme="dark"] .ladle-resize-handle {
    background: rgba(255,255,255,0.06) !important;
  }
`;

function useLadleOverrides() {
  useEffect(() => {
    const id = 'ladle-style-overrides';
    let style = document.getElementById(id) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = id;
      document.head.appendChild(style);
    }
    style.textContent = ladleOverrides;
  }, []);
}

// ---------------------------------------------------------------------------
// Custom theme picker
// ---------------------------------------------------------------------------

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

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const bg = dark ? 'rgba(15,17,23,0.95)' : 'rgba(255,255,255,0.95)';
  const border = dark ? '#2a2d35' : '#e2e8f0';
  const text = dark ? '#e2e8f0' : '#1e293b';
  const textMuted = dark ? '#94a3b8' : '#64748b';
  const hoverBg = dark ? 'rgba(255,255,255,0.05)' : '#f8fafc';
  const activeBg = dark ? 'rgba(99,102,241,0.1)' : '#eef2ff';
  const accent = dark ? '#a5b4fc' : '#4338ca';

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: 12,
        left: 12,
        zIndex: 9999,
        fontFamily: "'Bricolage Grotesque', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: bg,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: `1px solid ${border}`,
          borderRadius: 8,
          padding: '6px 12px',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 500,
          fontFamily: 'inherit',
          color: text,
          boxShadow: dark
            ? '0 2px 8px rgba(0,0,0,0.3)'
            : '0 1px 4px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.03)',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          outline: 'none',
          lineHeight: 1,
        }}
      >
        <span style={{ color: textMuted, fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>
          Theme
        </span>
        <span style={{ width: 1, height: 14, background: border, flexShrink: 0 }} />
        <span>{selected}</span>
        <Swatches colors={themes[selected]?.colors?.categorical} />
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
          <path d="M1 1L5 5L9 1" stroke={textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            minWidth: 220,
            background: bg,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: `1px solid ${border}`,
            borderRadius: 10,
            boxShadow: dark
              ? '0 8px 24px rgba(0,0,0,0.4)'
              : '0 4px 16px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)',
            overflow: 'hidden',
            padding: 4,
            animation: 'themeDropIn 0.12s ease-out',
          }}
        >
          <style>
            {`@keyframes themeDropIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}
          </style>
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
                <Swatches colors={themes[name]?.colors?.categorical} size={7} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const Provider: GlobalProvider = ({ children, globalState }) => {
  const [selected, setSelected] = useState('Default');
  const theme = themes[selected];
  const darkMode: DarkMode = globalState.theme === 'dark' ? 'force' : 'off';

  const bg = darkMode === 'force'
    ? (theme?.colors?.background ?? '#1a1a2e')
    : (theme?.colors?.background ?? '#ffffff');
  const fg = darkMode === 'force'
    ? (theme?.colors?.text ?? '#e0e0e0')
    : (theme?.colors?.text ?? '#1d1d1d');

  useLadleOverrides();

  // Set backgrounds on html/body/.ladle-main to match theme so no white
  // border shows through. Must use setProperty with 'important' to beat the
  // !important in the Ladle CSS overrides above.
  useEffect(() => {
    for (const el of [
      document.documentElement,
      document.body,
      document.querySelector('.ladle-main') as HTMLElement | null,
    ]) {
      el?.style.setProperty('background', bg, 'important');
    }
  }, [bg]);

  return (
    <VizThemeProvider theme={theme} darkMode={darkMode}>
      <ThemePicker
        selected={selected}
        onChange={setSelected}
        dark={darkMode === 'force'}
      />
      <div
        className="ladle-story-root"
        style={{ background: bg, color: fg }}
      >
        {children}
      </div>
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
          fontSize: 18,
          fontFamily: "'Bricolage Grotesque', system-ui, -apple-system, sans-serif",
          fontWeight: 500,
          color: darkMode === 'force' ? '#94a3b8' : '#64748b',
          textDecoration: 'none',
          opacity: 0.8,
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.8'; }}
      >
        <svg width="28" height="28" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
        GitHub
      </a>
    </VizThemeProvider>
  );
};
