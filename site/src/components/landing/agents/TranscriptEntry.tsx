/**
 * One row of the condensed agent transcript, in the site's own markup: the tool
 * (or who spoke) in the narrow left column, one line of what happened in the
 * wide right one. Bulk stays behind a collapsed disclosure (the llms.txt excerpt,
 * the spec as written); the validator's error and the edit are shown in full,
 * since they are the point. Renders whatever part of the step the playback has
 * revealed, so the same component draws the finished transcript on the server
 * and each frame of the replay.
 */
import type { Line, Step } from "@steamfield/ui/script";
import type { DemoEntry } from "@steamfield/ui/sequencer";
import type { SessionData } from "./session-script";

type ToolCall = Extract<Step<SessionData>, { kind: "tool-call" }>;
type Entry = DemoEntry<SessionData>;

const lineText = (line: Line) => (typeof line === "string" ? line : line.text);
const lineTone = (line: Line) => (typeof line === "string" ? "default" : (line.tone ?? "default"));
/** A diff line without its leading "- " or "+ ". */
const diffText = (line: Line) => lineText(line).replace(/^[-+] /, "");

/** The word under a tool's name: what state the call is in. */
function statusWord(entry: Entry): string | null {
  if (entry.status === "running") return "running";
  if (entry.status === "error") return "rejected";
  return null;
}

/** An edit's output: removed and added lines, every one toned fail or ok. */
function isDiff(lines: readonly Line[]): boolean {
  return lines.length > 0 && lines.every((line) => ["fail", "ok"].includes(lineTone(line)));
}

/** The removed and added text on one line, as an editor marks a correction. */
function DiffLine({ lines }: { lines: readonly Line[] }) {
  return (
    <p className="agent-diff">
      {lines.map((line) =>
        lineTone(line) === "fail" ? (
          <del key={`del-${lineText(line)}`}>{diffText(line)}</del>
        ) : (
          <ins key={`ins-${lineText(line)}`}>{diffText(line)}</ins>
        ),
      )}
    </p>
  );
}

/** The step's extra detail, if any, under its one line. */
function ToolDetail({ entry, step }: { entry: Entry; step: ToolCall }) {
  const lines = entry.visibleLines ?? [];
  if (step.body?.kind === "code" && entry.bodyVisible) {
    return (
      <details className="agent-disclosure">
        <summary>Show the spec</summary>
        <section
          className="agent-code"
          aria-label={`${step.args ?? "Spec"} as written`}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable to scroll by keyboard
          tabIndex={0}
        >
          <pre>{step.body.code}</pre>
        </section>
      </details>
    );
  }
  if (lines.length === 0) return null;
  // The validator's error is the point of the session: its first line always shows.
  if (entry.status === "error") {
    const [message] = lines;
    return message ? <p className="agent-error">{lineText(message)}</p> : null;
  }
  if (isDiff(lines)) return <DiffLine lines={lines} />;
  if (step.more !== undefined) {
    return (
      <details className="agent-disclosure">
        <summary>Show the first lines</summary>
        <div className="agent-excerpt">
          {lines.map((line) => (
            <p key={lineText(line)}>{lineText(line)}</p>
          ))}
          {entry.more ? <p>… {entry.more} more lines</p> : null}
        </div>
      </details>
    );
  }
  return <p className="agent-result">{lines.map(lineText).join(" ")}</p>;
}

function ToolCallRow({ entry, step }: { entry: Entry; step: ToolCall }) {
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
          <span className="agent-target" title={step.args}>
            {step.args}
          </span>
          {step.meta && entry.status !== "running" ? (
            <span className="agent-meta">{step.meta}</span>
          ) : null}
        </p>
        <ToolDetail entry={entry} step={step} />
      </div>
    </>
  );
}

/** One transcript row, as `<li>` in the session's list. Thinking and pauses take time but show nothing. */
export function TranscriptEntry({ entry }: { entry: Entry }) {
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
        <ToolCallRow entry={entry} step={step} />
      </li>
    );
  }
  return null;
}
