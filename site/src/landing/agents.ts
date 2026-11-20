/**
 * The scripted agent session on the landing page: what the user asks for, the
 * spec the agent writes first (with one mistake) and the spec it writes after
 * reading the validator's error. The error text is never written here: it comes
 * from calling `validateSpec` on `firstSpec`. Lane 2/d fills it; the scaffold
 * fixes the shape.
 */
import type { VizSpec } from "@opendata-ai/openchart-core";

/** The data the session is built from. */
export type AgentSession = {
  /** The user's request, naming a real dataset. */
  request: string;
  /** The agent's first spec as written. `validateSpec` must reject it, so it need not type as a VizSpec. */
  firstSpec: Record<string, unknown>;
  /** The corrected spec. `validateSpec` must accept it. */
  fixedSpec: VizSpec;
};

/** Placeholder until lane 2/d writes the session: an empty request and an empty chart. */
export const agentSession: AgentSession = {
  request: "",
  firstSpec: {},
  fixedSpec: {
    mark: "bar",
    data: [],
    encoding: {
      x: { field: "label", type: "nominal" },
      y: { field: "value", type: "quantitative" },
    },
  },
};
