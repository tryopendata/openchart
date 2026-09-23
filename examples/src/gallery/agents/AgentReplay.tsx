/**
 * AgentReplay: plays a scripted agent session against the real engine.
 *
 * The only state is elapsed time (plus play/pause and speed). Everything on
 * screen comes from `deriveView(timeline, elapsed)`, so scrubbing to a turn,
 * replaying, and the reduced-motion path are all just different `elapsed`
 * values. Charts receive the same spec object for as long as it's current,
 * and `<Chart>` calls `update()` when it changes, so refinements animate from
 * the previous layout instead of remounting.
 */

import type { VizSpec } from '@opendata-ai/openchart-core';
import { Visualization } from '@opendata-ai/openchart-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Conversation } from './Conversation';
import { DashboardStage } from './DashboardStage';
import type { Scenario } from './replay';
import { buildTimeline, deriveView, nextTarget, turnTarget } from './replay';
import { SpecPane } from './SpecPane';

const TICK_MS = 40;
/** Cap one tick's advance so a backgrounded tab doesn't skip ahead on return. */
const MAX_STEP_MS = 250;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

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
  const [reduced] = useState(prefersReducedMotion);
  const still = final || reduced;
  const [elapsed, setElapsed] = useState(() =>
    final ? timeline.total : reduced ? timeline.turnEnds[0] : 0,
  );
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rootRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  // Autoplay the first time the player scrolls into view, unless the reader
  // already took over with the controls.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || still) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        if (!started.current) {
          started.current = true;
          setPlaying(true);
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [still]);

  // Advance by real elapsed time, so a busy main thread (four charts mounting)
  // doesn't slow the replay down.
  useEffect(() => {
    if (!playing) return;
    let prev = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const step = Math.min(now - prev, MAX_STEP_MS) * speed;
      prev = now;
      setElapsed((e) => Math.min(timeline.total, e + step));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [playing, speed, timeline.total]);

  useEffect(() => {
    if (elapsed >= timeline.total) setPlaying(false);
  }, [elapsed, timeline.total]);

  const view = deriveView(timeline, elapsed);
  const atEnd = elapsed >= timeline.total;
  const turnCount = timeline.turnStarts.length;

  const goToTurn = (i: number) => {
    started.current = true;
    setElapsed(turnTarget(timeline, i, still));
    if (!still) setPlaying(true);
  };
  const next = () => {
    started.current = true;
    const target = nextTarget(timeline, elapsed, still);
    setElapsed(target);
    if (!still && target < timeline.total) setPlaying(true);
  };
  const replay = () => goToTurn(0);
  const togglePlay = () => {
    started.current = true;
    if (atEnd) replay();
    else setPlaying((p) => !p);
  };

  return (
    <div className={`oca-player oca-layout-${layout}`} ref={rootRef}>
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
              {atEnd ? 'Replay' : playing ? 'Pause' : 'Play'}
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
              onClick={() => setSpeed((s) => (s === 1 ? 2 : 1))}
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
