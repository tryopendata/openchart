/**
 * AgentReplay: plays a scripted agent session against the real engine.
 *
 * The clock, play/pause, speed, in-view start, reduced motion and the position
 * come from `@steamfield/ui`'s `useAgentDemo` (headless: the markup and the
 * look are this gallery's own). Everything on screen comes from `viewFrom` on
 * the hook's view, so scrubbing to a turn, replaying, and the reduced-motion
 * path are all just different positions. Charts receive the same spec object
 * for as long as it's current, and `<Chart>` calls `update()` when it changes,
 * so refinements animate from the previous layout instead of remounting.
 */

import type { VizSpec } from '@opendata-ai/openchart-core';
import { Visualization } from '@opendata-ai/openchart-react';
import { useAgentDemo } from '@steamfield/ui/react/agent-demo';
import { useMemo } from 'react';
import { Conversation } from './Conversation';
import { DashboardStage } from './DashboardStage';
import type { Scenario } from './replay';
import {
  buildTimeline,
  DEMO_TIMING,
  firstTurnOnly,
  nextTarget,
  type StepData,
  turnTarget,
  viewFrom,
} from './replay';
import { SpecPane } from './SpecPane';

function VizSlot({
  spec,
  height,
  placeholder,
}: {
  spec?: VizSpec;
  height?: number;
  placeholder: string;
}) {
  return (
    <div className="oca-viz" style={height ? { height } : undefined}>
      {spec ? (
        <Visualization spec={spec} style={height ? { height: '100%' } : undefined} />
      ) : (
        <div className="oca-viz-empty">{placeholder}</div>
      )}
    </div>
  );
}

export type AgentReplayProps = {
  scenario: Scenario;
  /** `single` renders one chart; `dashboard` renders the SaaS dashboard layout. */
  layout: 'single' | 'dashboard';
  /** Render the finished session with no motion (visual baselines). */
  final?: boolean;
};

export function AgentReplay({ scenario, layout, final = false }: AgentReplayProps) {
  const timeline = useMemo(() => buildTimeline(scenario), [scenario]);
  const demo = useAgentDemo<StepData>(timeline.script, {
    scriptKey: scenario.id,
    timing: DEMO_TIMING,
    // Motion off shows the first turn finished (a jump moves on from there);
    // `final` shows the whole session, which is what the visual baseline wants.
    finalPolicy: final ? 'all' : firstTurnOnly(timeline),
    reducedPolicy: 'hold',
    motion: final ? 'reduce' : 'auto',
    // Autoplay the first time the player scrolls into view, unless the reader
    // already took over with the controls.
    threshold: 0.25,
  });
  const { controls, speed } = demo;
  const still = demo.reduced;
  const view = useMemo(() => viewFrom(timeline, demo.view), [timeline, demo.view]);
  // Motion off shows whole finished turns, so the position is the end of the
  // turn on screen. Otherwise it's the clock, and the controls read a session
  // that hasn't started as sitting at 0.
  const engaged = demo.started || demo.playing || demo.complete;
  const elapsed = still ? (timeline.turnEnds[view.turn] ?? 0) : engaged ? demo.view.elapsed : 0;
  const atEnd = elapsed >= timeline.total;
  const turnCount = timeline.turnStarts.length;

  const goToTurn = (i: number) => {
    controls.seek(turnTarget(timeline, i, still));
    if (!still) controls.play();
  };
  const next = () => {
    const target = nextTarget(timeline, elapsed, still);
    controls.seek(target);
    if (!still && target < timeline.total) controls.play();
  };
  const togglePlay = () => {
    if (atEnd) controls.replay();
    else controls.toggle();
  };

  return (
    <div className={`oca-player oca-layout-${layout}`} ref={demo.ref}>
      <div className="oca-toolbar">
        <span className="oca-caption">
          Scripted replay · validation, diffs, and rendering run live
        </span>
        <div className="oca-controls">
          {turnCount > 1 && (
            <fieldset className="oca-turns" aria-label="Jump to turn">
              {timeline.turnStarts.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  className="oca-turn"
                  aria-current={view.turn === i && elapsed > 0 ? 'step' : undefined}
                  onClick={() => goToTurn(i)}
                >
                  {i + 1}
                </button>
              ))}
            </fieldset>
          )}
          {!still && (
            <button type="button" className="oca-btn" onClick={togglePlay}>
              {atEnd ? 'Replay' : demo.playing ? 'Pause' : 'Play'}
            </button>
          )}
          {turnCount > 1 && (
            <button type="button" className="oca-btn" onClick={next} disabled={atEnd}>
              Next
            </button>
          )}
          {!still && (
            <button
              type="button"
              className="oca-btn oca-btn-speed"
              aria-label={`Playback speed ${speed}x`}
              onClick={() => controls.setSpeed(speed === 1 ? 2 : 1)}
            >
              {speed}x
            </button>
          )}
        </div>
      </div>

      {layout === 'single' ? (
        <div className="oca-split">
          <Conversation visible={view.visible} />
          <div className="oca-stage">
            <VizSlot
              spec={view.slots.main}
              height={420}
              placeholder="The chart renders here once the spec validates."
            />
            <SpecPane paneBeat={view.paneBeat} />
          </div>
        </div>
      ) : (
        // The transcript comes first so the agent is what the reader sees;
        // the dashboard fills in below it at full width (a table under 400px
        // collapses to cards, so the panels can't share a column).
        <>
          <div className="oca-split">
            <Conversation visible={view.visible} />
            <div className="oca-stage">
              <SpecPane paneBeat={view.paneBeat} />
            </div>
          </div>
          <div className="oca-dash-wrap">
            <DashboardStage slots={view.slots} />
          </div>
        </>
      )}
    </div>
  );
}
