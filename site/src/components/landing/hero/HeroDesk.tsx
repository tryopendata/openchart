/**
 * The HeroDesk island: the step list, the spec pane and the chart, wired to the
 * desk reducer. The server renders the last step with the static SVG of the
 * finished chart (passed in as children). After hydration the live chart loads
 * with `import()`. If the reader has not asked for reduced motion and the desk
 * is on screen, the sequence rewinds to the first step, which the chart draws
 * with its own entrance, and plays one step every 3.2s. The static SVG goes once
 * the live chart has drawn.
 */
import type { ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { prefersReducedMotion } from "../../../scripts/motion/reduced";
import { deskReducer, initialDeskState } from "./desk-state";
import type { DeskStep } from "./desk-step";
import type { HeroChartProps } from "./HeroChart";
import { SpecPane } from "./SpecPane";
import { StepList } from "./StepList";
import { revealAddedLines } from "./spec-reveal";
import { useMotionTools } from "./use-motion-tools";
import { usePageDark } from "./use-page-dark";

/** How long each step shows while the sequence plays. */
export const STEP_MS = 3200;

export type HeroDeskProps = {
  steps: DeskStep[];
  /** The static SVGs of the finished chart, shown until the live chart has drawn. */
  children?: ReactNode;
};

type LiveChart = ComponentType<HeroChartProps>;

/** Loads the live chart module once the island has hydrated. */
function useLiveChart(): LiveChart | null {
  const [chart, setChart] = useState<LiveChart | null>(null);
  useEffect(() => {
    let active = true;
    import("./HeroChart").then(
      (module) => {
        if (active) setChart(() => module.default);
      },
      (error: unknown) => {
        // The static chart stays; the steps still change the spec pane.
        console.error("HeroDesk: the live chart failed to load; showing the static chart.", error);
      },
    );
    return () => {
      active = false;
    };
  }, []);
  return chart;
}

/** True once `element` has been at least partly on screen. */
function useSeen(element: HTMLElement | null): boolean {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!element || seen) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setSeen(true);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, seen]);
  return seen;
}

export default function HeroDesk({ steps, children }: HeroDeskProps) {
  const [state, dispatch] = useReducer(deskReducer, steps.length, initialDeskState);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const pane = useRef<HTMLElement>(null);
  const LiveChart = useLiveChart();
  const [liveDrawn, setLiveDrawn] = useState(false);
  const seen = useSeen(root);
  const dark = usePageDark();
  const tools = useMotionTools();
  const step = steps[state.step] ?? steps[steps.length - 1];
  const onMounted = useCallback(() => setLiveDrawn(true), []);

  // Autoplay starts as the live chart mounts, and both updates land in one render,
  // so the chart's entrance draws the first step rather than the finished chart.
  const [mountLive, setMountLive] = useState(false);
  useEffect(() => {
    if (!LiveChart) return;
    if (seen && !prefersReducedMotion()) dispatch({ type: "autoplay" });
    setMountLive(true);
  }, [LiveChart, seen]);

  // One timer per shown step while playing; a new step or a pause replaces or clears it.
  const timerKey = state.playing ? `${state.step}:${state.remaining}` : null;
  useEffect(() => {
    if (timerKey === null) return;
    const timer = setTimeout(() => dispatch({ type: "tick" }), STEP_MS);
    return () => clearTimeout(timer);
  }, [timerKey]);

  // Reveal the added lines on every step change after the first render.
  const shownStep = useRef(state.step);
  useEffect(() => {
    if (!pane.current || shownStep.current === state.step) return;
    shownStep.current = state.step;
    return revealAddedLines(pane.current, tools);
  }, [state.step, tools]);

  if (!step) return null;
  return (
    <div ref={setRoot} className="hero-desk" data-playing={state.playing ? "" : undefined}>
      <StepList
        labels={steps.map((item) => item.label)}
        current={state.step}
        playing={state.playing}
        stepMs={STEP_MS}
        onSelect={(index) => dispatch({ type: "select", step: index })}
        onPrevious={() => dispatch({ type: "previous" })}
        onNext={() => dispatch({ type: "next" })}
        onTogglePlay={() => dispatch({ type: state.playing ? "pause" : "play" })}
      />
      <div className="hero-panes">
        <SpecPane ref={pane} lines={step.lines} stepLabel={step.label} />
        <div className="hero-chart" data-hero-chart>
          {LiveChart && mountLive ? (
            <LiveChart spec={step.spec} dark={dark} onMounted={onMounted} />
          ) : null}
          {liveDrawn ? null : <div className="hero-chart-static">{children}</div>}
        </div>
      </div>
    </div>
  );
}
