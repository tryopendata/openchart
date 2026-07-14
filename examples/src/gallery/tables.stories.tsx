/**
 * Tables — the data-table gallery page.
 *
 * Eight demos across three sections (Basics, Cell types, Interactivity). Each
 * table carries editorial chrome and pulls from the shared dataset pool. Cell
 * types (heatmap, inline bar, sparkline, flag, image, category color) come
 * straight from `ColumnConfig` in `packages/core/src/types/table.ts`. The last
 * demo drives the table from external controls via `useTableState`.
 */

import type { SortState, TableSpec } from '@opendata-ai/openchart-core';
import { DataTable, useTableState } from '@opendata-ai/openchart-react';
import { Demo, GalleryPage, Section } from '../components';
import { companyBrands, countryIndicators, electionMargins, stockPerformance } from '../data';

// ---------------------------------------------------------------------------
// 1. Basic table — editorial chrome, formats, sort, search, pagination
// ---------------------------------------------------------------------------

const basicSpec: TableSpec = {
  type: 'table',
  data: [...countryIndicators.data],
  columns: [
    { key: 'country', label: 'Country', sortable: true },
    { key: 'population', label: 'Population', format: ',.0f', sortable: true, align: 'right' },
    {
      key: 'gdpPerCapita',
      label: 'GDP/capita (PPP)',
      format: '$,.0f',
      sortable: true,
      align: 'right',
    },
    { key: 'lifeExpectancy', label: 'Life exp.', format: '.1f', sortable: true, align: 'right' },
  ],
  chrome: {
    title: 'The World Through Twelve Economies',
    subtitle: 'Population, income, and longevity for the largest economies',
    source: countryIndicators.source,
  },
  search: true,
  pagination: { pageSize: 8 },
};

// ---------------------------------------------------------------------------
// 2. Heatmap cells — color the cell background by value
// ---------------------------------------------------------------------------

const heatmapSpec: TableSpec = {
  type: 'table',
  data: [...electionMargins.data],
  columns: [
    { key: 'state', label: 'State', sortable: true },
    {
      key: 'winner',
      label: 'Winner',
      sortable: true,
      categoryColors: { Democrat: '#2166ac', Republican: '#b2182b' },
    },
    {
      key: 'margin',
      label: 'Margin (%)',
      format: '.1f',
      sortable: true,
      align: 'right',
      heatmap: { palette: 'orange' },
    },
    {
      key: 'electoralVotes',
      label: 'Electoral votes',
      sortable: true,
      align: 'right',
      bar: {},
    },
  ],
  chrome: {
    title: 'The Race Was Won on the Margins',
    subtitle: 'Battleground states by margin of victory and electoral weight',
    source: electionMargins.source,
  },
  animation: true,
};

// ---------------------------------------------------------------------------
// 3. Inline bar cells — a proportional bar drawn inside the cell
// ---------------------------------------------------------------------------

const inlineBarSpec: TableSpec = {
  type: 'table',
  data: [...companyBrands.data],
  columns: [
    { key: 'company', label: 'Company', sortable: true },
    {
      key: 'revenue',
      label: 'FY24 revenue ($B)',
      format: ',.0f',
      sortable: true,
      align: 'right',
      bar: { color: '#0e7490' },
    },
  ],
  chrome: {
    title: 'Amazon Still Tops Big Tech by Revenue',
    subtitle: 'Full-year 2024 revenue, with an inline bar scaled to the largest value',
    source: companyBrands.source,
  },
  animation: true,
};

// ---------------------------------------------------------------------------
// 4. Sparkline cells — mini charts in a cell (line / bar / column)
// ---------------------------------------------------------------------------

const sparklineSpec: TableSpec = {
  type: 'table',
  data: [...stockPerformance.data].slice(0, 8),
  columns: [
    { key: 'ticker', label: 'Ticker', sortable: true },
    { key: 'price', label: 'Price', format: '$,.2f', sortable: true, align: 'right' },
    { key: 'trend', label: '8-week trend', sparkline: { type: 'line' } },
    { key: 'flows', label: 'Fund flows', sparkline: { type: 'column' } },
    { key: 'flows', label: 'Volume', sparkline: { type: 'bar' } },
  ],
  chrome: {
    title: 'Three Ways to Draw a Series in a Cell',
    subtitle: 'The same sparkline column config with type line, column, and bar',
    source: stockPerformance.source,
  },
  animation: true,
};

// ---------------------------------------------------------------------------
// 5. Flag + image cells — country flags and inline logos
// ---------------------------------------------------------------------------

const flagsSpec: TableSpec = {
  type: 'table',
  data: [...countryIndicators.data],
  columns: [
    { key: 'code', label: '', flag: true },
    { key: 'country', label: 'Country', sortable: true },
    {
      key: 'gdpPerCapita',
      label: 'GDP/capita (PPP)',
      format: '$,.0f',
      sortable: true,
      align: 'right',
      heatmap: { palette: 'green' },
    },
    { key: 'lifeExpectancy', label: 'Life exp.', format: '.1f', sortable: true, align: 'right' },
  ],
  chrome: {
    title: 'Flags Read Faster Than Names',
    subtitle: 'A flag cell turns a two-letter ISO code into a country marker',
    source: countryIndicators.source,
  },
};

const imageSpec: TableSpec = {
  type: 'table',
  data: [...companyBrands.data],
  columns: [
    { key: 'logo', label: '', image: { width: 28, height: 28, rounded: true } },
    { key: 'company', label: 'Company', sortable: true },
    {
      key: 'revenue',
      label: 'FY24 revenue ($B)',
      format: ',.0f',
      sortable: true,
      align: 'right',
      bar: {},
    },
    { key: 'quarterly', label: 'By quarter', sparkline: { type: 'column' } },
  ],
  chrome: {
    title: 'Any URL Becomes a Logo Cell',
    subtitle: 'Image cells render the column value as an <img>; here, inline SVG monograms',
    source: companyBrands.source,
  },
};

// ---------------------------------------------------------------------------
// 6. Category color cells — color-code a categorical column
// ---------------------------------------------------------------------------

const categorySpec: TableSpec = {
  type: 'table',
  data: [...stockPerformance.data],
  columns: [
    { key: 'ticker', label: 'Ticker', sortable: true },
    { key: 'name', label: 'Company', sortable: true },
    {
      key: 'sector',
      label: 'Sector',
      sortable: true,
      categoryColors: {
        Technology: '#0e7490',
        Communication: '#7c3aed',
        Consumer: '#c2410c',
        Financials: '#15803d',
        Healthcare: '#be123c',
      },
    },
    { key: 'ytdChange', label: 'YTD %', format: '+.1f', sortable: true, align: 'right' },
  ],
  chrome: {
    title: 'Category Colors Turn a Column Into a Legend',
    subtitle: 'Each sector value maps to a fixed color chip',
    source: stockPerformance.source,
  },
  search: true,
  pagination: { pageSize: 10 },
};

// ---------------------------------------------------------------------------
// 7. Sort, search, pagination — built-in on a larger dataset
// ---------------------------------------------------------------------------

const builtinSpec: TableSpec = {
  type: 'table',
  data: [...stockPerformance.data],
  columns: [
    { key: 'ticker', label: 'Ticker', sortable: true },
    { key: 'name', label: 'Company', sortable: true },
    { key: 'sector', label: 'Sector', sortable: true },
    { key: 'price', label: 'Price', format: '$,.2f', sortable: true, align: 'right' },
    {
      key: 'ytdChange',
      label: 'YTD %',
      format: '+.1f',
      sortable: true,
      align: 'right',
      bar: {},
    },
    { key: 'trend', label: '8-week trend', sparkline: { type: 'line' } },
  ],
  chrome: {
    title: 'Twenty Stocks, One Search Box',
    subtitle: 'Click a header to sort, type to filter, page through the rest — all built in',
    source: stockPerformance.source,
  },
  search: true,
  pagination: { pageSize: 8 },
  animation: true,
};

// ---------------------------------------------------------------------------
// 8. Interactive — controlled state via useTableState + external controls
// ---------------------------------------------------------------------------

const controlledSpec: TableSpec = {
  type: 'table',
  data: [...stockPerformance.data],
  columns: [
    { key: 'ticker', label: 'Ticker', sortable: true },
    { key: 'name', label: 'Company', sortable: true },
    { key: 'sector', label: 'Sector', sortable: true },
    { key: 'price', label: 'Price', format: '$,.2f', sortable: true, align: 'right' },
    {
      key: 'ytdChange',
      label: 'YTD %',
      format: '+.1f',
      sortable: true,
      align: 'right',
      bar: {},
    },
  ],
  chrome: {
    title: 'Drive the Table From Your Own UI',
    subtitle: 'The controls above own the state; the table and its search box just reflect it',
    source: stockPerformance.source,
  },
  // `search` stays enabled so the controlled search prop actually filters
  // (the engine gates filtering on spec.search). The built-in search box and
  // the external one below are bound to the same useTableState, so typing in
  // either updates both.
  search: true,
  pagination: { pageSize: 6 },
};

const PAGE_SIZE = 6;
const controlBtn: React.CSSProperties = {
  padding: 'var(--gx-space-2) var(--gx-space-3)',
  border: '1px solid var(--gx-border)',
  borderRadius: 'var(--gx-radius-control)',
  background: 'var(--gx-surface)',
  color: 'var(--gx-text)',
  font: 'inherit',
  cursor: 'pointer',
};

function ControlledTable() {
  const { sort, search, page, setSort, setSearch, setPage, resetState } = useTableState();

  const total = controlledSpec.data.length;
  const filtered = search
    ? controlledSpec.data.filter((row) =>
        Object.values(row).some((v) => String(v).toLowerCase().includes(search.toLowerCase())),
      ).length
    : total;
  const pageCount = Math.max(1, Math.ceil(filtered / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount - 1);

  const cycleSort = () => {
    const order: (SortState | null)[] = [
      { column: 'ytdChange', direction: 'desc' },
      { column: 'ytdChange', direction: 'asc' },
      { column: 'price', direction: 'desc' },
      null,
    ];
    const idx = order.findIndex(
      (s) => (s?.column ?? null) === (sort?.column ?? null) && s?.direction === sort?.direction,
    );
    setSort(order[(idx + 1) % order.length]);
    setPage(0);
  };

  const sortLabel = sort ? `${sort.column} ${sort.direction === 'desc' ? '↓' : '↑'}` : 'none';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gx-space-3)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--gx-space-3)',
          flexWrap: 'wrap',
        }}
      >
        <input
          type="search"
          value={search}
          placeholder="Filter tickers, companies, sectors…"
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          style={{
            flex: '1 1 220px',
            minWidth: 180,
            padding: 'var(--gx-space-2) var(--gx-space-3)',
            border: '1px solid var(--gx-border)',
            borderRadius: 'var(--gx-radius-control)',
            background: 'var(--gx-surface)',
            color: 'var(--gx-text)',
            font: 'inherit',
          }}
        />
        <button type="button" onClick={cycleSort} style={controlBtn}>
          Sort: {sortLabel}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gx-space-2)' }}>
          <button
            type="button"
            onClick={() => setPage(Math.max(0, clampedPage - 1))}
            disabled={clampedPage <= 0}
            style={{ ...controlBtn, opacity: clampedPage <= 0 ? 0.5 : 1 }}
          >
            Prev
          </button>
          <span style={{ fontSize: 'var(--gx-type-caption)', color: 'var(--gx-text-muted)' }}>
            Page {clampedPage + 1} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage(Math.min(pageCount - 1, clampedPage + 1))}
            disabled={clampedPage >= pageCount - 1}
            style={{ ...controlBtn, opacity: clampedPage >= pageCount - 1 ? 0.5 : 1 }}
          >
            Next
          </button>
        </div>
        <button type="button" onClick={resetState} style={controlBtn}>
          Reset
        </button>
      </div>
      <DataTable
        spec={controlledSpec}
        sort={sort}
        search={search}
        page={clampedPage}
        onSortChange={setSort}
        onSearchChange={setSearch}
        onPageChange={setPage}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default { title: 'Tables' };

export const Tables = () => (
  <GalleryPage
    title="Tables"
    lede="Data tables render to the DOM (not SVG) from a declarative TableSpec: columns carry formats, sort, and one visual feature each — heatmap, inline bar, sparkline, flag, image, or category color. Search, sort, and pagination are built in, and every piece of that state can be lifted into your own React with useTableState."
  >
    <Section
      id="basics"
      title="Basics"
      lede="A column list with d3-format strings, editorial chrome, and the built-in search and pager. This is the whole table API before any cell features."
    >
      <Demo id="basic" spec={basicSpec} />
    </Section>

    <Section
      id="cell-types"
      title="Cell types"
      lede="Each column opts into at most one visual feature. Precedence when several are set: sparkline, bar, heatmap, image, flag, then category colors."
    >
      <Demo
        id="heatmap-cells"
        title="Heatmap cells"
        description="A sequential palette colors the cell background by value, so the tight margins jump out of the column."
        spec={heatmapSpec}
      />
      <Demo
        id="inline-bar-cells"
        title="Inline bar cells"
        description="A proportional bar drawn inside the cell, scaled to the column's largest value — a bar list embedded in a table."
        spec={inlineBarSpec}
      />
      <Demo
        id="sparkline-cells"
        title="Sparkline cells"
        description="An array-valued field becomes a mini chart. The same sparkline config renders line, column, or bar."
        spec={sparklineSpec}
      />
      <Demo
        id="flag-cells"
        title="Flag cells"
        description="A flag column turns a two-letter ISO 3166-1 code into a country flag emoji with an accessible label."
        spec={flagsSpec}
      />
      <Demo
        id="image-cells"
        title="Image cells"
        description="Image cells render the column value as an <img> src. These are self-contained data-URI SVG monograms, so nothing is fetched."
        spec={imageSpec}
      />
      <Demo
        id="category-color-cells"
        title="Category color cells"
        description="Map each categorical value to a fixed color chip, turning the column itself into an inline legend."
        spec={categorySpec}
      />
    </Section>

    <Section
      id="interactivity"
      title="Interactivity"
      lede="Sort, search, and pagination ship built in. When you need them wired to your own UI, useTableState lifts that state into React."
    >
      <Demo
        id="sort-search-pagination"
        title="Sort, search & pagination"
        description="The built-in controls on a twenty-row dataset: click any header to sort, type in the search box, and page through the rest."
        spec={builtinSpec}
      />
      <Demo
        id="controlled-state"
        title="Interactive (controlled state)"
        description="useTableState owns sort, search, and page; an external search box and pager drive the table through its controlled props while the spec panel still shows the base spec."
        specForPanel={controlledSpec}
      >
        <ControlledTable />
      </Demo>
    </Section>
  </GalleryPage>
);
