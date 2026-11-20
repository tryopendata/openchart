/** The landing page's agent session: its specs, and the script built from what the validator says. */
import { validateSpec } from "@opendata-ai/openchart-engine";
import type { Step } from "@steamfield/ui/script";
import { describe, expect, it } from "vitest";
import { AGENT_SPEC_FILE, type AgentSession, agentSession } from "../../../landing/agents";
import {
  AgentSessionError,
  buildSessionScript,
  changedLines,
  type SessionData,
  specSource,
} from "./session-script";

const LLMS =
  "# OpenChart\n\n> Charts, tables and maps from a JSON spec.\n\n## Guides\n\n### Get started\n\n- [Getting started](https://example.test/a.md): First chart.\n";
const INPUTS = { llms: LLMS, llmsUrl: "https://example.test/llms.txt", file: AGENT_SPEC_FILE };

type ToolCall = Extract<Step<SessionData>, { kind: "tool-call" }>;
const toolCalls = (session: AgentSession) =>
  buildSessionScript(session, INPUTS).steps.filter(
    (step): step is ToolCall => step.kind === "tool-call",
  );
const lineText = (line: string | { text: string }) => (typeof line === "string" ? line : line.text);

describe("the agent session's specs", () => {
  it("has a request, a first spec the validator rejects and a fixed spec it accepts", () => {
    expect(agentSession.request.length).toBeGreaterThan(0);
    expect(validateSpec(agentSession.firstSpec).errors).toHaveLength(1);
    expect(validateSpec(agentSession.fixedSpec)).toMatchObject({ valid: true, errors: [] });
  });

  it("differs between the two specs by one line, the field the error names", () => {
    const [error] = validateSpec(agentSession.firstSpec).errors;
    const edit = changedLines(
      specSource(agentSession.firstSpec),
      specSource(agentSession.fixedSpec),
    );
    expect(edit.map(lineText)).toEqual(['- "field": "payrolls",', '+ "field": "jobs",']);
    expect(error?.path).toBe("/encoding/y/field");
  });
});

describe("buildSessionScript", () => {
  it("plays request, llms.txt, first spec, the validator's real error, the edit, the verdict and the chart", () => {
    const script = buildSessionScript(agentSession, INPUTS);
    expect(script.steps.map((step) => (step.kind === "tool-call" ? step.name : step.kind))).toEqual(
      ["user", "fetch", "write", "validateSpec", "agent-text", "edit", "validateSpec", "render"],
    );
    const [, , rejected, , verdict, render] = toolCalls(agentSession);
    const [error] = validateSpec(agentSession.firstSpec).errors;
    expect(rejected?.status).toBe("error");
    expect(rejected?.output?.map(lineText)).toEqual([error?.message, error?.suggestion]);
    expect(verdict?.output?.map(lineText)).toEqual(["valid, 0 errors"]);
    expect(render?.body).toEqual({ kind: "custom", data: { chart: true } });
  });

  it("shows the first lines of llms.txt as fetched, with the rest counted", () => {
    const [read] = toolCalls(agentSession);
    expect(read).toMatchObject({ args: INPUTS.llmsUrl, meta: "5 lines", more: 3 });
    expect(read?.output?.map(lineText)).toEqual([
      "# OpenChart",
      "> Charts, tables and maps from a JSON spec.",
    ]);
  });

  it("writes the whole first spec compactly, with its data rows folded to one line", () => {
    const [, write] = toolCalls(agentSession);
    const code = write?.body?.kind === "code" ? write.body.code : "";
    const { data: _rows, ...rest } = agentSession.firstSpec;
    expect(JSON.parse(code.replace("[ … 12 rows ]", '"folded"'))).toEqual({
      ...rest,
      data: "folded",
    });
    expect(code).toContain('"x": { "field": "month", "type": "ordinal" }');
    expect(code).not.toContain('"Jan"');
    expect(code.split("\n").every((line) => line.length <= 76)).toBe(true);
  });

  it("refuses a first spec that validates, since there would be no error to show", () => {
    const valid = { ...agentSession, firstSpec: { ...agentSession.fixedSpec } };
    expect(() => buildSessionScript(valid, INPUTS)).toThrow(AgentSessionError);
  });

  it("refuses a fixed spec the validator rejects, naming the error", () => {
    const broken = { ...agentSession, fixedSpec: agentSession.firstSpec as never };
    expect(() => buildSessionScript(broken, INPUTS)).toThrow(
      /fixedSpec fails validateSpec: .*payrolls/,
    );
  });

  it("refuses a fix that adds or removes lines instead of changing one", () => {
    const fixedSpec = { ...agentSession.fixedSpec, width: 640 } as never;
    expect(() => buildSessionScript({ ...agentSession, fixedSpec }, INPUTS)).toThrow(
      /one-line edit/,
    );
  });
});
