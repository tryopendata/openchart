/**
 * The scroll story island: paragraphs scroll past a sticky chart, and each one
 * that crosses the trigger line moves the chart to its step through the
 * library's own scrollytelling (`createChartStory`, driven by the library's
 * `createScrollDriver`). The island only owns layout and which paragraph is
 * current; the story API applies the patches and animates the chart.
 *
 * The chart mounts at the first step, whose change is empty, so every change
 * the reader is told about happens on scroll. A theme change or a crossing of
 * the 1024px layout re-creates the story at the current step without replaying
 * the entrance.
 *
 * Server and pre-hydration render: every paragraph in full ink and the static
 * SVG of the finished chart (children), so the story reads without JavaScript.
 * Story.astro sets the whole story in a PublishedFigure, which carries the source.
 */
import type { ChartSpec } from "@opendata-ai/openchart-core";
import type { ChartStoryInstance, ScrollDriver } from "@opendata-ai/openchart-vanilla/story";
import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { LandingStoryStep } from "../../../landing/story";
import { usePageChartTheme } from "../../shared/page-theme";

/** Where the step trigger line sits, as a fraction of the viewport: below the sticky chart on narrow screens. */
const TRIGGER = { wide: 0.5, narrow: 0.78 };
const WIDE_QUERY = "(min-width: 1024px)";

export type ChartStoryScrollProps = {
  spec: ChartSpec;
  steps: LandingStoryStep[];
  /**
   * The muted line under each step's paragraph, or null for none. Story.astro
   * reads them off the steps at build time (`describeChange`), which keeps the
   * chart library out of this island's up-front JavaScript.
   */
  notes: (string | null)[];
  /** The static SVGs of the finished chart. */
  children?: ReactNode;
};

type StoryParts = { story: ChartStoryInstance; driver: ScrollDriver };

type MountRequest = {
  host: HTMLElement;
  stepElements: HTMLElement[];
  spec: ChartSpec;
  steps: LandingStoryStep[];
  /** The step to show at once: where the reader was when the story is re-created. */
  startAt: number;
  /** True when re-creating mid-story, so the chart arrives drawn instead of drawing in again. */
  quietEntrance: boolean;
  wide: boolean;
  theme: ReturnType<typeof usePageChartTheme>;
  onStep: (index: number) => void;
  /** Checked after the library loads: an effect cleaned up meanwhile must not mount into the shared host. */
  cancelled: () => boolean;
};

/** Mounts the story into the host and drives it from the step elements; null when cancelled first. */
async function mountStory(request: MountRequest): Promise<StoryParts | null> {
  const { createChartStory, createScrollDriver } = await import(
    "@opendata-ai/openchart-vanilla/story"
  );
  if (request.cancelled()) return null;
  const spec = request.quietEntrance
    ? { ...request.spec, watermark: false, animation: { enter: false } }
    : { ...request.spec, watermark: false };
  const story = createChartStory(
    request.host,
    { spec, steps: request.steps.map((step) => step.change) },
    { theme: request.theme.theme, darkMode: request.theme.darkMode },
  );
  if (request.startAt > 0) story.goTo(request.startAt);
  const driver = createScrollDriver({
    triggerPosition: request.wide ? TRIGGER.wide : TRIGGER.narrow,
  });
  driver.setContainer(request.stepElements[0]?.parentElement ?? null);
  request.stepElements.forEach((element, index) => {
    driver.registerStep(index, element);
  });
  driver.progress.subscribe((frame) => {
    if (frame.step < 0) return;
    story.goTo(frame.step);
    request.onStep(frame.step);
  });
  return { story, driver };
}

function subscribeWide(onChange: () => void): () => void {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True at 1024px and wider, where the chart sits beside the paragraphs. */
function useWideLayout(): boolean {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => true,
  );
}

/** The scroll story: sticky chart, scrolling paragraphs, each with a plain line on what it changed. */
export function ChartStoryScroll({ spec, steps, notes, children }: ChartStoryScrollProps) {
  const host = useRef<HTMLDivElement>(null);
  const stepElements = useRef<HTMLElement[]>([]);
  const [current, setCurrent] = useState(-1);
  const [live, setLive] = useState(false);
  const theme = usePageChartTheme();
  const wide = useWideLayout();
  const currentRef = useRef(current);
  currentRef.current = current;
  const mountedOnce = useRef(false);

  useEffect(() => {
    const target = host.current;
    if (!target) return;
    let parts: StoryParts | null = null;
    let cancelled = false;
    mountStory({
      host: target,
      stepElements: stepElements.current,
      spec,
      steps,
      startAt: Math.max(currentRef.current, 0),
      quietEntrance: mountedOnce.current,
      wide,
      theme,
      onStep: setCurrent,
      cancelled: () => cancelled,
    }).then(
      (mounted) => {
        if (!mounted) return;
        if (cancelled) {
          mounted.driver.destroy();
          mounted.story.destroy();
          return;
        }
        parts = mounted;
        mountedOnce.current = true;
        setLive(true);
      },
      (error: unknown) => {
        console.error("The story chart could not be mounted; showing the finished chart.", error);
      },
    );
    return () => {
      cancelled = true;
      parts?.driver.destroy();
      parts?.story.destroy();
    };
  }, [spec, steps, theme, wide]);

  return (
    <div className="story-layout">
      <div className="story-panel" data-story-chart>
        <div className="story-stage">
          <div ref={host} className="story-host" />
          {live ? null : <div className="story-static">{children}</div>}
        </div>
      </div>
      <ol className="story-steps">
        {steps.map((step, index) => {
          const change = notes[index] ?? null;
          return (
            <li
              key={step.id}
              ref={(element) => {
                if (element) stepElements.current[index] = element;
              }}
              className="story-step"
              data-story-step={step.id}
              data-current={current === -1 ? undefined : String(current === index)}
              aria-current={current === index ? "step" : undefined}
            >
              <p className="story-prose">{step.prose}</p>
              {change === null ? null : <p className="story-change">{change}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
