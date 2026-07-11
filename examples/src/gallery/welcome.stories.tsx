/**
 * Welcome — the gallery landing page.
 *
 * Top-to-bottom: a hero with one excellent live chart (the pitch), a quick-start
 * install + copyable snippet, a browse grid of section cards, a generated demo
 * index (built from `registry.ts` so it can't drift), and a footer of links.
 *
 * The page renders inside GalleryPage so the shared `--oc-*` tokens and
 * `[data-oc-mode]` resolve (light/dark, and inside the width-addon iframe).
 * Everything below the header is bespoke JSX passed through GalleryPage's
 * children escape hatch — no Sections, so no right-rail TOC.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import { Demo, GalleryPage } from '../components';
import { bigTechRevenue, browserShare, electricityMix, evFleet, usInflation } from '../data';
import { GALLERY, type PageEntry } from './registry';

// ---------------------------------------------------------------------------
// Scoped styles. Keyed off the shared `--oc-*` tokens (defined under
// `[data-oc-mode]` on the GalleryPage root), so they resolve in light/dark and
// inside the width-addon iframe. Injected once rather than editing the shared
// gallery.css that sibling pages also touch.
// ---------------------------------------------------------------------------

const WELCOME_CSS = `
.ocw-hero {
  margin: 0 0 var(--oc-space-8);
}
.ocw-hero-chart {
  margin-top: var(--oc-space-5);
  border: 1px solid var(--oc-border);
  border-radius: var(--oc-radius-card);
  background: var(--oc-surface);
  padding: var(--oc-space-5);
}
.ocw-hero-chart > .story-chart {
  height: 440px;
}
.ocw-block {
  margin: 0 0 var(--oc-space-10);
}
.ocw-block-head {
  margin: 0 0 var(--oc-space-5);
}
.ocw-block-title {
  font-family: var(--oc-font-display);
  font-size: var(--oc-type-section-title);
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--oc-text-strong);
  margin: 0 0 var(--oc-space-2);
}
.ocw-block-lede {
  font-size: var(--oc-type-body);
  line-height: 1.6;
  color: var(--oc-text-muted);
  margin: 0;
  max-width: 62ch;
}
.ocw-install {
  display: flex;
  flex-direction: column;
  gap: var(--oc-space-3);
}
.ocw-install-cmd {
  font-family: var(--oc-font-mono);
  font-size: var(--oc-type-mono);
  color: var(--oc-text);
  background: var(--oc-surface-raised);
  border: 1px solid var(--oc-border);
  border-radius: var(--oc-radius-control);
  padding: var(--oc-space-3) var(--oc-space-4);
}
.ocw-install-cmd .ocw-prompt {
  color: var(--oc-text-faint);
  user-select: none;
}
.ocw-install-note {
  font-size: var(--oc-type-caption);
  line-height: 1.6;
  color: var(--oc-text-muted);
  margin: 0;
}
.ocw-install-note code {
  font-family: var(--oc-font-mono);
  font-size: 0.85em;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--oc-accent-soft);
  color: var(--oc-accent-text);
}
.ocw-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--oc-space-4);
}
.ocw-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--oc-border);
  border-radius: var(--oc-radius-card);
  background: var(--oc-surface);
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.12s, transform 0.12s, box-shadow 0.12s;
}
.ocw-card:hover {
  border-color: var(--oc-accent);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.08);
}
.ocw-card-chart {
  height: 120px;
  padding: var(--oc-space-3) var(--oc-space-4) 0;
  min-width: 0;
}
.ocw-card-chart > .story-chart {
  height: 100%;
}
.ocw-card-body {
  padding: var(--oc-space-3) var(--oc-space-4) var(--oc-space-4);
}
.ocw-card-title {
  font-family: var(--oc-font-display);
  font-size: 1.0625rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--oc-text-strong);
  margin: 0 0 4px;
}
.ocw-card-desc {
  font-size: var(--oc-type-caption);
  line-height: 1.5;
  color: var(--oc-text-muted);
  margin: 0;
}
.ocw-card-count {
  margin-top: var(--oc-space-2);
  font-family: var(--oc-font-mono);
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--oc-accent-text);
}
.ocw-index {
  columns: 3 220px;
  column-gap: var(--oc-space-6);
}
.ocw-index-group {
  break-inside: avoid;
  margin: 0 0 var(--oc-space-5);
}
.ocw-index-group-title {
  font-family: var(--oc-font-mono);
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  /* text-muted (not text-faint): faint fails WCAG AA contrast on this small
     uppercase label in both light and dark modes. */
  color: var(--oc-text-muted);
  margin: 0 0 var(--oc-space-2);
}
.ocw-index-page {
  margin: 0 0 var(--oc-space-3);
}
.ocw-index-page-title {
  font-size: var(--oc-type-caption);
  font-weight: 600;
  color: var(--oc-text);
  margin: 0 0 2px;
}
.ocw-index ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
.ocw-index li {
  margin: 0;
}
.ocw-index a {
  display: block;
  font-size: var(--oc-type-caption);
  line-height: 1.5;
  color: var(--oc-text-muted);
  text-decoration: none;
  padding: 1px 0;
}
.ocw-index a:hover {
  color: var(--oc-accent-text);
}
.ocw-footer {
  border-top: 1px solid var(--oc-border);
  padding-top: var(--oc-space-5);
  margin-top: var(--oc-space-8);
  display: flex;
  flex-direction: column;
  gap: var(--oc-space-3);
}
.ocw-footer-links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--oc-space-4);
  align-items: center;
}
.ocw-footer-links a {
  font-size: var(--oc-type-caption);
  font-weight: 500;
  color: var(--oc-text);
  text-decoration: none;
}
.ocw-footer-links a:hover {
  color: var(--oc-accent-text);
}
.ocw-footer-note {
  font-size: var(--oc-type-caption);
  line-height: 1.6;
  color: var(--oc-text-muted);
  margin: 0;
  max-width: 74ch;
}
.ocw-footer-note a {
  color: var(--oc-accent-text);
  /* Inline links inside a paragraph must be distinguishable without relying on
     color alone (WCAG 1.4.1); underline them. */
  text-decoration: underline;
  text-underline-offset: 2px;
}
.ocw-footer-note a:hover {
  text-decoration-thickness: 2px;
}
/* Keyboard focus ring for every reachable link on the welcome page. */
.ocw-index a:focus-visible,
.ocw-footer-links a:focus-visible,
.ocw-footer-note a:focus-visible {
  outline: 2px solid var(--oc-accent);
  outline-offset: 2px;
  border-radius: var(--oc-radius-control);
}
.ocw-footer-meta {
  font-size: 0.6875rem;
  /* text-muted (not text-faint): faint fails WCAG AA contrast at this size. */
  color: var(--oc-text-muted);
  margin: 0;
}
`;

function WelcomeStyles() {
  return (
    // biome-ignore lint/security/noDangerouslySetInnerHtml: static CSS constant, no user input
    <style dangerouslySetInnerHTML={{ __html: WELCOME_CSS }} />
  );
}

// ---------------------------------------------------------------------------
// 1. Hero chart — an annotated multi-series line, animated on load.
// ---------------------------------------------------------------------------

const heroSpec: ChartSpec = {
  animation: true,
  mark: 'line',
  data: [...bigTechRevenue.data],
  encoding: {
    x: { field: 'year', type: 'temporal', axis: { tickCount: 6 } },
    y: {
      field: 'revenue',
      type: 'quantitative',
      axis: { title: 'Annual revenue ($B)', format: ',.0f', grid: true },
    },
    color: { field: 'company', type: 'nominal' },
  },
  legend: { position: 'top' },
  endpointLabels: false,
  labels: { density: 'none' },
  annotations: [
    {
      type: 'text',
      x: '2024-01-01',
      y: 638,
      text: 'Amazon crosses\n$600B in 2024',
      anchor: 'right',
      offset: { dx: -8, dy: -28 },
      connector: true,
    },
  ],
  chrome: {
    title: 'Amazon Pulls Away at the Top of Big Tech',
    subtitle: 'Annual revenue by company, 2019-2024 (billions USD)',
    source: bigTechRevenue.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 2. Quick-start snippet — a minimal, complete, copyable spec.
// ---------------------------------------------------------------------------

const quickStartSpec: ChartSpec = {
  mark: 'bar',
  data: [
    { language: 'Python', popularity: 29 },
    { language: 'JavaScript', popularity: 24 },
    { language: 'TypeScript', popularity: 17 },
    { language: 'Java', popularity: 14 },
    { language: 'Go', popularity: 10 },
  ],
  encoding: {
    x: { field: 'popularity', type: 'quantitative', axis: { title: 'Popularity (%)' } },
    y: { field: 'language', type: 'nominal' },
  },
  chrome: {
    title: 'Python Leads Developer Mindshare',
    subtitle: '2024 developer survey results',
    source: 'Source: Illustrative data',
  },
};

// ---------------------------------------------------------------------------
// 3. Section cards — one compact chart per sidebar group.
// ---------------------------------------------------------------------------

/** Flatten one series to the `{ t, value }` shape a sparkline wants. */
function series(values: ReadonlyArray<number>): { t: number; value: number }[] {
  return values.map((value, t) => ({ t, value }));
}

/** A compact sparkline per group, sized to sit in a 120px card. Sparkline
 *  display strips chrome/axes/legend for an edge-to-edge mini chart, so every
 *  card reads as one consistent system. */
function cardSpec(kind: SectionCard['chartKind']): ChartSpec {
  const base = {
    encoding: {
      x: { field: 't', type: 'ordinal' as const },
      y: { field: 'value', type: 'quantitative' as const },
    },
    display: 'sparkline' as const,
  };
  switch (kind) {
    case 'charts':
      return {
        mark: 'line',
        data: series(
          bigTechRevenue.data.filter((d) => d.company === 'Amazon').map((d) => d.revenue),
        ),
        ...base,
      };
    case 'tables':
      return {
        mark: 'area',
        data: series(usInflation.data.slice(-10).map((d) => d.rate)),
        ...base,
      };
    case 'graphs':
      return {
        mark: 'line',
        data: series(evFleet.data.map((d) => d.fleet)),
        ...base,
      };
    case 'sankey':
      return {
        mark: 'area',
        data: series(electricityMix['2023'].map((d) => d.share)),
        ...base,
      };
    case 'dashboards':
      return {
        mark: 'area',
        data: series(usInflation.data.map((d) => d.rate)),
        ...base,
      };
    case 'features':
      return {
        mark: 'line',
        data: series(browserShare.data.map((d) => d.share)),
        ...base,
      };
  }
}

type SectionCard = {
  group: string;
  desc: string;
  chartKind: 'charts' | 'tables' | 'graphs' | 'sankey' | 'dashboards' | 'features';
};

const SECTION_CARDS: SectionCard[] = [
  {
    group: 'Charts',
    desc: 'Line, area, bar, column, scatter, pie, donut, and the raw mark building blocks.',
    chartKind: 'charts',
  },
  {
    group: 'Tables',
    desc: 'First-class tables with heatmap cells, sparklines, inline bars, sort, and search.',
    chartKind: 'tables',
  },
  {
    group: 'Graphs',
    desc: 'Force-directed networks with communities, search, and canvas rendering at scale.',
    chartKind: 'graphs',
  },
  {
    group: 'Sankey & Tile Maps',
    desc: 'Flow diagrams and US state tile grids from the same declarative spec.',
    chartKind: 'sankey',
  },
  {
    group: 'Dashboards',
    desc: 'Sparkline grids, KPI pills, bar lists, and crosshair lines composed into layouts.',
    chartKind: 'dashboards',
  },
  {
    group: 'Features',
    desc: 'Annotations, edit mode, animation, theming, responsive layout, and data transforms.',
    chartKind: 'features',
  },
];

/** First page slug for a group, so the card links to a real story. */
function firstSlugForGroup(group: string): string {
  const entry = GALLERY.find((p) => p.group === group);
  return entry ? entry.slug : GALLERY[0].slug;
}

function SectionCards() {
  return (
    <div className="ocw-cards">
      {SECTION_CARDS.map((card) => (
        <a key={card.group} className="ocw-card" href={`?story=${firstSlugForGroup(card.group)}`}>
          <div className="ocw-card-chart">
            <div className="story-chart">
              <Chart spec={cardSpec(card.chartKind)} />
            </div>
          </div>
          <div className="ocw-card-body">
            <h3 className="ocw-card-title">{card.group}</h3>
            <p className="ocw-card-desc">{card.desc}</p>
            <p className="ocw-card-count">{countDemosForGroup(card.group)} demos</p>
          </div>
        </a>
      ))}
    </div>
  );
}

function countDemosForGroup(group: string): number {
  return GALLERY.filter((p) => p.group === group).reduce((n, p) => n + p.demos.length, 0);
}

// ---------------------------------------------------------------------------
// 4. Demo index — generated from the registry so it can't drift.
// ---------------------------------------------------------------------------

/** Group the registry by sidebar group, preserving first-seen order. */
function groupRegistry(): { group: string; pages: PageEntry[] }[] {
  const order: string[] = [];
  const byGroup = new Map<string, PageEntry[]>();
  for (const page of GALLERY) {
    if (!byGroup.has(page.group)) {
      byGroup.set(page.group, []);
      order.push(page.group);
    }
    byGroup.get(page.group)?.push(page);
  }
  return order.map((group) => ({ group, pages: byGroup.get(group) ?? [] }));
}

function DemoIndex() {
  const groups = groupRegistry();
  return (
    <div className="ocw-index">
      {groups.map(({ group, pages }) => (
        <div key={group} className="ocw-index-group">
          <p className="ocw-index-group-title">{group}</p>
          {pages.map((page) => (
            <div key={page.slug} className="ocw-index-page">
              <p className="ocw-index-page-title">{page.export}</p>
              <ul>
                {page.demos.map((demo) => (
                  <li key={demo.id}>
                    <a href={`?story=${page.slug}#${demo.id}`}>{demo.title}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default { title: 'Welcome' };

export const Welcome = () => {
  return (
    <GalleryPage
      title="OpenChart"
      lede="Publication-quality data graphics from a JSON spec. Describe what the chart should communicate and the engine handles scales, label placement, accessibility, and responsive layout. The result reads like a polished infographic, not a developer's debug output."
    >
      <WelcomeStyles />

      {/* 1. Hero */}
      <div className="ocw-hero">
        <div className="ocw-hero-chart">
          <div className="story-chart">
            <Chart spec={heroSpec} />
          </div>
        </div>
      </div>

      {/* 2. Install / quick-start */}
      <div className="ocw-block">
        <div className="ocw-block-head">
          <h2 className="ocw-block-title">Quick start</h2>
          <p className="ocw-block-lede">
            One spec, four frameworks. The headless engine renders the same JSON in React, Vue,
            Svelte, or vanilla JS.
          </p>
        </div>
        <div className="ocw-install">
          <div className="ocw-install-cmd">
            <span className="ocw-prompt">$ </span>npm i @opendata-ai/openchart-react
          </div>
          <p className="ocw-install-note">
            Prefer another framework? Swap the package: <code>@opendata-ai/openchart-vue</code>,{' '}
            <code>@opendata-ai/openchart-svelte</code>, or{' '}
            <code>@opendata-ai/openchart-vanilla</code>. The spec is identical across all four.
          </p>
        </div>
        <div style={{ marginTop: 'var(--oc-space-4)' }}>
          <Demo
            id="quick-start"
            title="A complete chart from one spec"
            description="Pass a spec to <Chart>. encoding maps fields to visual channels; chrome adds editorial framing. The engine figures out the rest. Copy the spec to try it."
            spec={quickStartSpec}
            height={360}
          />
        </div>
      </div>

      {/* 3. Section cards */}
      <div className="ocw-block">
        <div className="ocw-block-head">
          <h2 className="ocw-block-title">Browse the gallery</h2>
          <p className="ocw-block-lede">
            Six areas, each a page of live, copyable demos. Start anywhere.
          </p>
        </div>
        <SectionCards />
      </div>

      {/* 4. Demo index */}
      <div className="ocw-block">
        <div className="ocw-block-head">
          <h2 className="ocw-block-title">Every demo</h2>
          <p className="ocw-block-lede">
            The full index, generated from the gallery registry. Each link jumps straight to the
            demo.
          </p>
        </div>
        <DemoIndex />
      </div>

      {/* 5. Footer */}
      <footer className="ocw-footer">
        <div className="ocw-footer-links">
          <a href="https://github.com/tryopendata/openchart" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a
            href="https://github.com/tryopendata/openchart/tree/main/docs"
            target="_blank"
            rel="noreferrer"
          >
            Docs
          </a>
          <a
            href="https://github.com/tryopendata/openchart/blob/main/LICENSE"
            target="_blank"
            rel="noreferrer"
          >
            Apache-2.0
          </a>
        </div>
        <p className="ocw-footer-note">
          Export any chart to SVG, PNG, JPG, or CSV, or render it on the server with{' '}
          <code>renderStaticSVG</code> — see the export patterns across the{' '}
          <a href="?story=dashboards--dashboards">Dashboards</a> and{' '}
          <a href="?story=features--responsive">Responsive</a> pages. Every chart ships an
          accessibility baseline: auto-generated alt text, keyboard navigation, and a screen-reader
          data table — demonstrated on the <a href="?story=tables--tables">Tables</a> and{' '}
          <a href="?story=graphs--graphs">Graphs</a> pages.
        </p>
        <p className="ocw-footer-meta">Built with OpenChart.</p>
      </footer>
    </GalleryPage>
  );
};
