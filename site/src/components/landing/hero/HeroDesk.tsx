/**
 * The HeroDesk island: the step list and a caption for the current step, the
 * chart at full width, and the spec closed in a disclosure under it, wired to
 * the desk reducer. The graphic is the story; the spec is the second one. The
 * server renders the last step with the static SVG of the finished chart
 * (passed in as children), the steps as a plain list and the spec closed.
 *
 * `usePlayback` gates the sequence: it plays only while the desk is in view,
 * the tab is visible and motion is allowed. The live chart mounts the first
 * time the gate plays, in the same render as autoplay rewinds to step 1, so the
 * chart's own entrance draws step 1. Under reduced motion it mounts at once on
 * the last step and nothing advances. Until it has mounted the steps stay a
 * plain list; if the library never loads they stay that way, on the last step.
 */
import { usePlayback } from "@steamfield/ui/react/playback";
import type { ReactNode } from "react";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { heroChartTheme } from "../../../landing/hero-theme";
import { LiveChart, loadChartLibrary } from "../../shared/LiveChart";
import { usePageDark } from "../../shared/page-theme";
import { useMotionTools } from "../../shared/use-motion-tools";
import { deskReducer, initialDeskState } from "./desk-state";
import type { DeskStep } from "./desk-step";
import { SpecDisclosure } from "./SpecDisclosure";
import { StepList } from "./StepList";
import { revealAddedLines } from "./spec-reveal";
import { Transport } from "./Transport";

/** How long each step shows while the sequence plays. */
export const STEP_MS = 3200;

/**
 * Any part of the desk on screen counts as seen. On a phone the desk starts at
 * the bottom of the first screen, and the chart's own entrance already waits
 * until a quarter of the chart is visible.
 */
const IN_VIEW_THRESHOLD = 0;

export type HeroDeskProps = {
  steps: DeskStep[];
  /** The static SVGs of the finished chart, shown until the live chart has drawn. */
  children?: ReactNode;
};

/** True once the chart library has loaded. */
function useLibraryReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    loadChartLibrary().then(
      () => {
        if (active) setReady(true);
      },
      (error: unknown) => {
        // The static chart and the plain step list stay; nothing pretends to work.
        console.error(
          "HeroDesk: the chart library failed to load; showing the static chart.",
          error,
        );
      },
    );
    return () => {
      active = false;
    };
  }, []);
  return ready;
}

export default function HeroDesk({ steps, children }: HeroDeskProps) {
  const [state, dispatch] = useReducer(deskReducer, steps.length, initialDeskState);
  const gate = usePlayback<HTMLDivElement>({ reducedPolicy: "hold", threshold: IN_VIEW_THRESHOLD });
  const libraryReady = useLibraryReady();
  const dark = usePageDark();
  const tools = useMotionTools("the hero desk");
  const pane = useRef<HTMLElement>(null);
  const [mounted, setMounted] = useState(false);
  const step = steps[state.step] ?? steps[steps.length - 1];

  // The first time the gate plays (or at once under reduced motion), mount the
  // chart and start the sequence in one render.
  const [mountLive, setMountLive] = useState(false);
  useEffect(() => {
    if (mountLive || !libraryReady || !gate.ready) return;
    if (gate.playing) dispatch({ type: "autoplay" });
    if (gate.playing || gate.reduced) setMountLive(true);
  }, [mountLive, libraryReady, gate.ready, gate.playing, gate.reduced]);

  // Reduced motion switched on mid-sequence: stop, and stay stopped.
  useEffect(() => {
    if (gate.reduced && state.playing) dispatch({ type: "pause" });
  }, [gate.reduced, state.playing]);

  // One timer per shown step while the sequence and the gate both play.
  const timerKey = state.playing && gate.playing ? `${state.step}:${state.remaining}` : null;
  useEffect(() => {
    if (timerKey === null) return;
    const timer = setTimeout(() => dispatch({ type: "tick" }), STEP_MS);
    return () => clearTimeout(timer);
  }, [timerKey]);

  // While the spec is open, write in the added lines on every step change.
  // Closed, nothing runs: the lines are written when the reader looks.
  const [specOpen, setSpecOpen] = useState(false);
  const shownStep = useRef(state.step);
  useEffect(() => {
    if (!pane.current || shownStep.current === state.step) return;
    shownStep.current = state.step;
    if (!specOpen) return;
    return revealAddedLines(pane.current, tools);
  }, [state.step, tools, specOpen]);

  const onSpecToggle = useCallback((open: boolean) => {
    setSpecOpen(open);
    // Opening lands on the current step's added lines, without motion.
    if (open && pane.current) revealAddedLines(pane.current, null);
  }, []);

  const stopForGood = useCallback(() => dispatch({ type: "pause" }), []);
  const onMounted = useCallback(() => setMounted(true), []);
  const themeOverride = {
    theme: heroChartTheme,
    darkMode: dark ? ("force" as const) : ("off" as const),
  };

  if (!step) return null;
  return (
    <div ref={gate.ref} className="hero-desk">
      <StepList
        interactive={mounted}
        labels={steps.map((item) => item.label)}
        current={state.step}
        playing={state.playing && gate.playing}
        stepMs={STEP_MS}
        onSelect={(index) => dispatch({ type: "select", step: index })}
      />
      <div className="hero-step-row">
        <p className="hero-step-caption">{step.caption}</p>
        {mounted ? (
          <Transport
            playing={state.playing && gate.playing}
            onPrevious={() => dispatch({ type: "previous" })}
            onNext={() => dispatch({ type: "next" })}
            onTogglePlay={() => dispatch({ type: state.playing ? "pause" : "play" })}
          />
        ) : null}
      </div>
      <div className="hero-chart" data-hero-chart>
        {mountLive ? (
          <LiveChart
            spec={step.spec}
            className="hero-chart-live"
            onMounted={onMounted}
            themeOverride={themeOverride}
          >
            {children}
          </LiveChart>
        ) : (
          <div className="hero-chart-live">{children}</div>
        )}
      </div>
      <SpecDisclosure
        ref={pane}
        step={step}
        hydrated={gate.ready}
        onInteract={stopForGood}
        onToggle={onSpecToggle}
      />
    </div>
  );
}
