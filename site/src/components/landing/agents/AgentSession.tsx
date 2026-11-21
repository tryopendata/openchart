/**
 * The AgentSession island (client:visible): the scripted agent session as a
 * two-column transcript that ends in the chart the agent's spec renders. Built on
 * `useAgentDemo` from @steamfield/ui for the clock, visibility and motion gating,
 * drawn in the site's own markup. The server, and the page before Play, show the
 * finished transcript with the static chart; Play replays it from the start and
 * the chart arrives live, with the library's own entrance.
 */

import { useAgentDemo } from "@steamfield/ui/react/agent-demo";
import type { DemoView, Timing } from "@steamfield/ui/sequencer";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { agentChart, agentSource } from "../../../landing/agents";
import { LiveChart, loadChartLibrary } from "../../shared/LiveChart";
import type { SessionData, SessionScript } from "./session-script";
import { TranscriptEntry } from "./TranscriptEntry";

type AgentSessionProps = {
  /** The script Agents.astro built with the validator's real output. */
  script: SessionScript;
  /** The chart as static SVG in both themes (an Astro slot), for the server render and while the library loads. */
  chart?: ReactNode;
};

/** Quicker tool calls than the chat preset (which `compile` starts from): the reader waits on the validator, not on a spinner. */
const TIMING: Partial<Timing<SessionData>> = { toolMs: () => 650 };

/** Playback time as m:ss, the way the progress readout shows it. */
function clock(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function playLabel(demo: { complete: boolean; started: boolean; playing: boolean }): string {
  if (demo.complete) return "Replay";
  return demo.started && demo.playing ? "Pause" : "Play";
}

/** The progress rule: an axis with a tick where each step starts, filled to the playback position. */
function ProgressAxis({ view, steps }: { view: DemoView<SessionData>; steps: readonly number[] }) {
  const share = view.duration > 0 ? view.elapsed / view.duration : 1;
  return (
    <div className="agent-progress" aria-hidden="true">
      <span className="agent-progress-fill" style={{ transform: `scaleX(${share})` }} />
      {steps.map((start) => (
        <span
          key={start}
          className="agent-progress-tick"
          style={{ left: `${(start / Math.max(1, view.duration)) * 100}%` }}
        />
      ))}
    </div>
  );
}

export function AgentSession({ script, chart }: AgentSessionProps) {
  const demo = useAgentDemo(script, {
    scriptKey: script.id,
    timing: TIMING,
    autoStart: false,
    beforeStart: "final",
  });
  const list = useRef<HTMLOListElement>(null);
  // Held at the finished transcript's height while it replays, so the page below never
  // jumps. Measured at each start and cleared at the end, so a resize never leaves it stale.
  const [minHeight, setMinHeight] = useState<number | undefined>(undefined);
  const live = demo.animating;
  // Reduced motion shows the finished transcript without playing it; the chart is
  // still the live one, for its data table and keyboard navigation.
  const liveChart = live || (demo.ready && demo.reduced);

  useEffect(() => {
    // LiveChart reports a failed load itself; this call only warms the chunk.
    if (demo.started) loadChartLibrary().catch(() => {});
  }, [demo.started]);

  useEffect(() => {
    if (demo.complete) setMinHeight(undefined);
  }, [demo.complete]);

  const onPlay = () => {
    const starting = !demo.started || demo.complete;
    if (starting && list.current) setMinHeight(list.current.offsetHeight);
    if (demo.complete) demo.controls.replay();
    else demo.controls.toggle();
  };

  // PublishedFigure's markup and classes, written out here because an Astro component
  // can't render inside a React island. The reveal attributes are left off: the island
  // re-creates this figure on every replay, after the reveal script has run.
  const drawChart = () => (
    <figure className="pub-figure agent-chart" data-agent-chart>
      <div className="rule-axis" />
      <div className="pub-figure-body agent-chart-stage">
        {liveChart ? (
          <LiveChart spec={agentChart} className="agent-chart-live">
            {chart}
          </LiveChart>
        ) : (
          chart
        )}
      </div>
      <figcaption className="figure-caption pub-figure-caption">
        <span>The chart the corrected spec renders. </span>
        Source:{" "}
        {agentSource.url ? <a href={agentSource.url}>{agentSource.label}</a> : agentSource.label}.
      </figcaption>
    </figure>
  );

  const { view } = demo;
  const showControls = demo.ready && !demo.reduced;
  return (
    <div ref={demo.ref} className="agent-session" data-live={live ? "" : undefined}>
      {showControls ? (
        <div className="agent-controls">
          <button type="button" className="btn agent-play" onClick={onPlay}>
            {playLabel(demo)}
          </button>
          <ProgressAxis view={view} steps={demo.timeline.steps.map((step) => step.start)} />
          <span className="agent-clock">
            {clock(live ? view.elapsed : view.duration)} / {clock(view.duration)}
          </span>
        </div>
      ) : null}
      <ol
        ref={list}
        className="agent-transcript"
        aria-label="Agent session transcript"
        style={live && minHeight ? { minHeight } : undefined}
      >
        {view.entries.map((entry) => (
          <TranscriptEntry key={entry.key} entry={entry} chart={drawChart} />
        ))}
      </ol>
      <p className="sr-only" role="status">
        {demo.complete ? "The session has finished and the chart is rendered." : ""}
      </p>
    </div>
  );
}
