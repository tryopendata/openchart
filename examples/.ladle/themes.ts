/**
 * Named theme registry for the gallery's floating theme picker.
 *
 * These 11 named ThemeConfigs moved verbatim from the old
 * `.ladle/components.tsx` inline registry. The provider imports `themes` and
 * `themeNames` from here. `Default` is `undefined` (library defaults).
 */
import type { ThemeConfig } from '@opendata-ai/openchart-core';

export const themes: Record<string, ThemeConfig | undefined> = {
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

export const themeNames = Object.keys(themes);
