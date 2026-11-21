/**
 * Builds the landing page's agent session script from the session data in
 * src/landing/agents.ts. Everything the agent reads back is real: the lines of
 * llms.txt, the validator's error for the first spec, the edit between the two
 * specs and the validator's verdict on the second. Runs at build time only
 * (Agents.astro), so the engine never reaches the browser through it.
 */
import { validateSpec } from "@opendata-ai/openchart-engine";
import type { DemoScript, Line, Step } from "@steamfield/ui/script";
import type { AgentSession } from "../../../landing/agents";
import { compactJson } from "./compact-json";

/** The custom body of the last step: the rendered chart, which the island draws itself. */
export type SessionData = { chart: true };

/** The script the AgentSession island plays. */
export type SessionScript = DemoScript<SessionData>;

/** What the script needs besides the session: the llms.txt text and where it lives. */
export type SessionInputs = {
  /** The text of /llms.txt as the site serves it. */
  llms: string;
  /** The URL the agent fetches it from, as the transcript shows it. */
  llmsUrl: string;
  /** The file name the agent writes the spec to. */
  file: string;
};

/** Thrown when the session's specs don't behave as the transcript claims. */
export class AgentSessionError extends Error {}

/** How many lines of llms.txt the transcript shows before "… +N lines". */
const LLMS_LINES_SHOWN = 2;
/** Stands in for the data rows while the spec is serialized, so they fold to one line. */
const DATA_FOLD = "\u0000data\u0000";

/** The spec as the agent wrote it, laid out compactly, with the data rows folded to `"data": [ … 12 rows ]`. */
export function specSource(spec: object): string {
  const data = (spec as { data?: unknown }).data;
  if (!Array.isArray(data)) return compactJson(spec);
  const json = compactJson({ ...spec, data: DATA_FOLD });
  return json.replace(JSON.stringify(DATA_FOLD), `[ … ${data.length} rows ]`);
}

/** The lines of `after` that differ from `before`, as a removed/added pair per changed line. */
export function changedLines(before: string, after: string): Line[] {
  const old = before.split("\n");
  const next = after.split("\n");
  if (old.length !== next.length) {
    throw new AgentSessionError(
      `The fixed spec has ${next.length} lines and the first has ${old.length}. The session shows a one-line edit, so change a value, not the shape.`,
    );
  }
  return next.flatMap((line, index): Line[] => {
    const was = old[index] ?? "";
    if (line === was) return [];
    return [
      { text: `- ${was.trim()}`, tone: "fail" },
      { text: `+ ${line.trim()}`, tone: "ok" },
    ];
  });
}

/** The errors of a spec the session expects the validator to reject. */
function rejection(spec: object) {
  const { valid, errors } = validateSpec(spec);
  if (valid || errors.length === 0) {
    throw new AgentSessionError(
      "agentSession.firstSpec passes validateSpec, so the session has no error to show. Give it one mistake.",
    );
  }
  return errors;
}

function acceptance(spec: object): Line[] {
  const { valid, errors } = validateSpec(spec);
  if (!valid) {
    const messages = errors.map((error) => error.message).join("; ");
    throw new AgentSessionError(`agentSession.fixedSpec fails validateSpec: ${messages}`);
  }
  return [{ text: "valid, 0 errors", tone: "ok" }];
}

function llmsRead(llms: string, url: string): Step<SessionData> {
  const lines = llms.split("\n").filter((line) => line.trim() !== "");
  return {
    kind: "tool-call",
    name: "fetch",
    args: url,
    meta: `${lines.length} lines`,
    output: lines.slice(0, LLMS_LINES_SHOWN).map((text) => ({ text, tone: "muted" })),
    more: Math.max(0, lines.length - LLMS_LINES_SHOWN),
  };
}

/**
 * The session as a script: the request, the agent reading llms.txt, writing the
 * first spec, reading the validator's error, editing the one line and rendering.
 *
 * @throws {AgentSessionError} When the first spec validates, the fixed spec does
 * not, or the fix changes more than values on existing lines.
 */
export function buildSessionScript(session: AgentSession, inputs: SessionInputs): SessionScript {
  const errors = rejection(session.firstSpec);
  const verdict = acceptance(session.fixedSpec);
  const edit = changedLines(specSource(session.firstSpec), specSource(session.fixedSpec));
  const errorLines: Line[] = errors.flatMap((error): Line[] => [
    { text: error.message, tone: "fail" },
    ...(error.suggestion ? [{ text: error.suggestion, tone: "muted" as const }] : []),
  ]);
  return {
    id: "openchart-agent-session",
    steps: [
      { kind: "user", text: session.request },
      llmsRead(inputs.llms, inputs.llmsUrl),
      {
        kind: "tool-call",
        name: "write",
        args: inputs.file,
        body: { kind: "code", lang: "json", code: specSource(session.firstSpec) },
      },
      {
        kind: "tool-call",
        name: "validateSpec",
        args: inputs.file,
        status: "error",
        meta: `${errors.length} ${errors.length === 1 ? "error" : "errors"}`,
        output: errorLines,
      },
      {
        kind: "agent-text",
        text: "The error names the field and lists the columns the data has. One line to change.",
      },
      { kind: "tool-call", name: "edit", args: inputs.file, output: edit },
      { kind: "tool-call", name: "validateSpec", args: inputs.file, output: verdict },
      {
        kind: "tool-call",
        name: "render",
        args: "<Chart spec={spec} />",
        body: { kind: "custom", data: { chart: true } },
      },
    ],
  };
}
