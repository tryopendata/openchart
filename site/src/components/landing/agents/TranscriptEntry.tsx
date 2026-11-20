/**
 * One row of the agent session transcript, in the site's own markup: who or
 * what acted in the narrow left column, what they said or got back in the wide
 * right one. Renders whatever part of the step the playback has revealed, so the
 * same component draws the finished transcript on the server and each frame of
 * the replay.
 */
import type { Line, Step } from "@steamfield/ui/script";
import type { DemoEntry } from "@steamfield/ui/sequencer";
import type { ReactNode } from "react";
import type { SessionData } from "./session-script";

type ToolCall = Extract<Step<SessionData>, { kind: "tool-call" }>;

type TranscriptEntryProps = {
  entry: DemoEntry<SessionData>;
  /** Draws the chart a `custom` body stands for. */
  chart: () => ReactNode;
};

const lineText = (line: Line) => (typeof line === "string" ? line : line.text);
const lineTone = (line: Line) => (typeof line === "string" ? "default" : (line.tone ?? "default"));

/** The word under a tool's name: what state the call is in. */
function statusWord(entry: DemoEntry<SessionData>): string | null {
  if (entry.status === "running") return "running";
  if (entry.status === "error") return "rejected";
  return null;
}

function OutputLines({ lines, more }: { lines: readonly Line[]; more: number | undefined }) {
  return (
    <div className="agent-output">
      {lines.map((line, index) => (
        // Lines only ever append, so the index is a stable key.
        // biome-ignore lint/suspicious/noArrayIndexKey: output lines have no identity besides their order
        <p key={index} className="agent-line" data-tone={lineTone(line)}>
          {lineText(line)}
        </p>
      ))}
      {more ? <p className="agent-line agent-more">… {more} more lines</p> : null}
    </div>
  );
}

function ToolBody({
  entry,
  step,
  chart,
}: {
  entry: DemoEntry<SessionData>;
  step: ToolCall;
  chart: () => ReactNode;
}) {
  const { body } = step;
  if (!body || !entry.bodyVisible) return null;
  if (body.kind === "custom") return <>{chart()}</>;
  if (body.kind === "code") {
    // The block scrolls on narrow screens, so keyboard users need to be able to focus it.
    return (
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable to scroll by keyboard
      <pre className="agent-code" tabIndex={0}>
        {body.code}
      </pre>
    );
  }
  return null;
}

function ToolCallRow({
  entry,
  step,
  chart,
}: {
  entry: DemoEntry<SessionData>;
  step: ToolCall;
  chart: () => ReactNode;
}) {
  const status = statusWord(entry);
  return (
    <>
      <div className="agent-role">
        <span className="agent-tool">{step.name}</span>
        {status ? (
          <span className="agent-status" data-status={entry.status}>
            {status}
          </span>
        ) : null}
      </div>
      <div className="agent-body">
        <p className="agent-args">
          <span>{step.args}</span>
          {step.meta && entry.status !== "running" ? (
            <span className="agent-meta">{step.meta}</span>
          ) : null}
        </p>
        {entry.visibleLines?.length ? (
          <OutputLines lines={entry.visibleLines} more={entry.more} />
        ) : null}
        <ToolBody entry={entry} step={step} chart={chart} />
      </div>
    </>
  );
}

/** One transcript row, as `<li>` in the session's list. Thinking and pauses take time but show nothing. */
export function TranscriptEntry({ entry, chart }: TranscriptEntryProps) {
  const { step } = entry;
  if (step.kind === "user" || step.kind === "agent-text") {
    const who = step.kind === "user" ? "Reporter" : "Agent";
    return (
      <li className="agent-row" data-kind={step.kind}>
        <div className="agent-role">{who}</div>
        <p className="agent-body agent-message">{entry.visibleText ?? step.text}</p>
      </li>
    );
  }
  if (step.kind === "tool-call") {
    return (
      <li className="agent-row" data-kind="tool-call" data-status={entry.status}>
        <ToolCallRow entry={entry} step={step} chart={chart} />
      </li>
    );
  }
  return null;
}
