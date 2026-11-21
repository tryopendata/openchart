/**
 * The scripted agent session on the landing page: what the reporter asks for, the
 * spec the agent writes first (with one mistake) and the spec it writes after
 * reading the validator's error. The error text is never written here: it comes
 * from calling `validateSpec` on `firstSpec` (components/landing/agents/session-script.ts).
 */
import { usPayrolls } from "@datasets/us-payrolls";
import type { ChartSpec, VizSpec } from "@opendata-ai/openchart-core";
import { sourceOf } from "../demos/source";

/** The data the session is built from. */
export type AgentSession = {
  /** The user's request, naming a real dataset. */
  request: string;
  /** The agent's first spec as written. `validateSpec` must reject it, so it need not type as a VizSpec. */
  firstSpec: Record<string, unknown>;
  /** The corrected spec. `validateSpec` must accept it. */
  fixedSpec: VizSpec;
};

/** The file the agent writes the spec to; the transcript names it in every tool call. */
export const AGENT_SPEC_FILE = "payrolls-2024.chart.json";

/**
 * The Claude Code skill's install lines as the repository README gives them, each
 * with its Copy button's accessible name. A unit test checks them against README.md.
 */
export const agentSkillLines = [
  { command: "/plugin marketplace add tryopendata/skills", label: "Copy the marketplace command" },
  { command: "/plugin install openchart@openchart", label: "Copy the skill install command" },
];

/** The dataset's citation, for the figure caption's source line under the chart. */
export const agentSource = sourceOf(usPayrolls);

/**
 * The column chart the reporter asked for, measuring `valueField` on the y axis.
 * The agent's one mistake is the field name: it guesses `payrolls` from the file
 * name, while the data's column is `jobs`.
 */
function payrollsChart(valueField: string): ChartSpec {
  return {
    mark: "bar",
    data: usPayrolls.data.map((row) => ({ ...row })),
    encoding: {
      x: { field: "month", type: "ordinal" },
      y: { field: valueField, type: "quantitative", axis: { title: "Jobs added (thousands)" } },
    },
    annotations: [
      {
        type: "text",
        x: "Oct",
        y: 12,
        text: "Hurricanes and strikes\nheld October to 12,000",
        anchor: "top",
        offset: { dy: -235 },
        connector: true,
      },
    ],
    chrome: {
      title: "Hiring slowed through 2024 and stalled once, in October",
      subtitle: "Jobs added to US nonfarm payrolls each month, thousands",
    },
  };
}

/** The corrected spec as the chart type the React `Chart` takes; `agentSession.fixedSpec` is the same object. */
export const agentChart: ChartSpec = payrollsChart("jobs");

export const agentSession: AgentSession = {
  request:
    "Filing the jobs story at 4. I need a column chart of 2024 monthly payroll gains from the BLS numbers in payrolls-2024.json, with October flagged.",
  // The spread is a type conversion: ChartSpec has no index signature, so it can't be
  // assigned to Record<string, unknown> directly, but a fresh object literal can.
  firstSpec: { ...payrollsChart("payrolls") },
  fixedSpec: agentChart,
};
