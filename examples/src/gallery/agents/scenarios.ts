/**
 * Scripted agent sessions for the Agents page.
 *
 * Each spec is written the way a model emits it through a tool call: no
 * `data` (the host attaches the query rows) and no `animation` (a host
 * concern). The one deliberate mistake, `capacity_gw` in the chat analyst's
 * second turn, is flagged `expectInvalid`; its error text comes from the real
 * validator at runtime, never from this file.
 */

import { renewableCapacityAdditions } from '../../data';
import {
  saasAccountsSpec,
  saasMrrSpec,
  saasSignupsSpec,
  saasTopPagesSpec,
} from '../dashboards.layouts';
import type { DataRow, Scenario } from './replay';

// ---------------------------------------------------------------------------
// Chat analyst: grouped columns -> stacked (via a repaired mistake) -> callout
// ---------------------------------------------------------------------------

const capacityRows = renewableCapacityAdditions.data;

const capacityChrome = {
  title: 'Solar Added More Capacity in 2023 Than Wind and Hydro Combined',
  subtitle: 'Global renewable capacity additions by source, 2019-2023 (GW)',
  source: renewableCapacityAdditions.source,
};

const stackedChrome = {
  ...capacityChrome,
  subtitle:
    'Global renewable capacity additions by source, 2019-2023 (GW), stacked to show the total',
};

const encodingWith = (y: Record<string, unknown>) => ({
  x: { field: 'year', type: 'ordinal' },
  y,
  color: { field: 'type', type: 'nominal' },
});

export const chatAnalyst: Scenario = {
  id: 'chat-analyst',
  title: 'Chat analyst',
  animation: { enter: true, update: { duration: 900 } },
  turns: [
    {
      user: 'How fast is solar growing compared to other renewables?',
      steps: [
        {
          kind: 'tool',
          label: 'query_data("renewable capacity additions by source")',
          result: '15 rows · year, capacity, type',
        },
        {
          kind: 'spec',
          slot: 'main',
          rows: capacityRows,
          spec: {
            chrome: capacityChrome,
            mark: 'bar',
            encoding: encodingWith({ field: 'capacity', type: 'quantitative', stack: null }),
          },
        },
        {
          kind: 'prose',
          text: "Solar's additions grew from 98 GW to 346 GW between 2019 and 2023, and in 2023 solar alone outbuilt wind and hydro combined.",
        },
      ],
    },
    {
      user: 'Stack them so I can see the total added each year.',
      steps: [
        {
          kind: 'spec',
          slot: 'main',
          rows: capacityRows,
          expectInvalid: true,
          spec: {
            chrome: stackedChrome,
            mark: 'bar',
            encoding: encodingWith({ field: 'capacity_gw', type: 'quantitative', stack: 'zero' }),
          },
        },
        {
          kind: 'spec',
          slot: 'main',
          rows: capacityRows,
          spec: {
            chrome: stackedChrome,
            mark: 'bar',
            encoding: encodingWith({ field: 'capacity', type: 'quantitative', stack: 'zero' }),
          },
        },
        {
          kind: 'prose',
          text: 'Total additions nearly tripled too, from 168 GW in 2019 to 477 GW in 2023.',
        },
      ],
    },
    {
      user: 'Call out the 2023 jump.',
      steps: [
        {
          kind: 'spec',
          slot: 'main',
          rows: capacityRows,
          spec: {
            chrome: stackedChrome,
            mark: 'bar',
            encoding: encodingWith({ field: 'capacity', type: 'quantitative', stack: 'zero' }),
            annotations: [
              {
                type: 'text',
                x: '2023',
                y: 477,
                text: 'Record 477 GW added,\nsolar up 56% on 2022',
                anchor: 'left',
                offset: { dx: -14, dy: -4 },
              },
            ],
          },
        },
        {
          kind: 'prose',
          text: 'Added a callout on 2023, the largest single-year jump: solar went from 222 GW to 346 GW.',
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Dashboard builder: one prompt, the SaaS dashboard from the Dashboards page
// ---------------------------------------------------------------------------

/**
 * Split a finished gallery spec into what the agent writes and what the host
 * attaches. The agent's output is the Dashboards page's own spec, minus the
 * rows and the animation flag.
 */
function asAgentOutput(spec: object): { spec: Record<string, unknown>; rows: DataRow[] } {
  const { data, animation: _animation, ...rest } = spec as Record<string, unknown>;
  return { spec: rest, rows: data as DataRow[] };
}

const mrr = asAgentOutput(saasMrrSpec);
const signups = asAgentOutput(saasSignupsSpec);
const topPages = asAgentOutput(saasTopPagesSpec);
const accounts = asAgentOutput(saasAccountsSpec);

export const dashboardBuilder: Scenario = {
  id: 'dashboard-builder',
  title: 'Dashboard builder',
  animation: true,
  turns: [
    {
      user: 'Build me a SaaS overview: revenue trend, signups by channel, top pages, and our largest accounts.',
      steps: [
        {
          kind: 'tool',
          label: 'query_data("monthly recurring revenue")',
          result: `${mrr.rows.length} rows · month, mrr`,
        },
        { kind: 'spec', slot: 'a', ...mrr },
        {
          kind: 'tool',
          label: 'query_data("signups by channel, last 6 months")',
          result: `${signups.rows.length} rows · month, channel, signups`,
        },
        { kind: 'spec', slot: 'b', ...signups },
        {
          kind: 'tool',
          label: 'query_data("top pages by sessions, last 30 days")',
          result: `${topPages.rows.length} rows · page, sessions`,
        },
        { kind: 'spec', slot: 'c', ...topPages },
        {
          kind: 'tool',
          label: 'query_data("largest accounts by MRR")',
          result: `${accounts.rows.length} rows · account, plan, mrr, delta, trend`,
        },
        { kind: 'spec', slot: 'd', ...accounts },
        {
          kind: 'prose',
          text: 'MRR has nearly tripled in two years, organic leads signups every month, and /pricing is the most-visited page.',
        },
      ],
    },
  ],
};

export const SCENARIOS = [chatAnalyst, dashboardBuilder];
