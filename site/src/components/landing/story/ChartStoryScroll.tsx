/**
 * The scroll story island: paragraphs scroll past a sticky chart, and each one
 * that crosses the trigger line moves the chart to its step through the
 * library's own scrollytelling (`createChartStory`, driven by the library's
 * `createScrollDriver`). The island only owns layout and which paragraph reads
 * as current; the story API applies the patches and animates the chart.
 *
 * Server and pre-hydration render: every paragraph in full ink and the static
 * SVG of the finished chart (children), so the story reads without JavaScript.
 * Story.astro sets the whole story in a PublishedFigure, which carries the source.
 */
import type { ChartSpec } from "@opendata-ai/openchart-core";
import type { ChartStoryInstance, ScrollDriver } from "@opendata-ai/openchart-vanilla/story";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { LandingStoryStep } from "../../../landing/story";
import { usePageChartTheme } from "../../shared/page-theme";
import { changeExcerpt } from "./story-change";

/** Where the step trigger line sits, as a fraction of the viewport: below the sticky chart on narrow screens. */
const TRIGGER = { wide: 0.5, narrow: 0.78 };
const WIDE_QUERY = "(min-width: 1024px)";

export type ChartStoryScrollProps = {
  spec: ChartSpec;
  steps: LandingStoryStep[];
  /** The static SVGs of the finished chart. */
  children?: ReactNode;
};

type StoryParts = { story: ChartStoryInstance; driver: ScrollDriver };

/**
 * Mounts the story into `host` and drives it from the step elements. Returns
 * its teardown. `startAt` restores the step after a theme change re-creates it.
 */
async function mountStory(
  host: HTMLElement,
  stepElements: HTMLElement[],
  props: { spec: ChartSpec; steps: LandingStoryStep[]; startAt: number },
  options: { theme: ReturnType<typeof usePageChartTheme>; onStep: (index: number) => void },
): Promise<StoryParts> {
  const { createChartStory, createScrollDriver } = await import(
    "@opendata-ai/openchart-vanilla/story"
  );
  const wide = window.matchMedia(WIDE_QUERY).matches;
  const story = createChartStory(
    host,
    { spec: { ...props.spec, watermark: false }, steps: props.steps.map((step) => step.change) },
    { theme: options.theme.theme, darkMode: options.theme.darkMode },
  );
  if (props.startAt > 0) story.goTo(props.startAt);
  const driver = createScrollDriver({ triggerPosition: wide ? TRIGGER.wide : TRIGGER.narrow });
  driver.setContainer(stepElements[0]?.parentElement ?? null);
  stepElements.forEach((element, index) => {
    driver.registerStep(index, element);
  });
  driver.progress.subscribe((frame) => {
    if (frame.step < 0) return;
    story.goTo(frame.step);
    options.onStep(frame.step);
  });
  return { story, driver };
}

/** The scroll story: sticky chart, scrolling paragraphs, each with the spec field it sets. */
export function ChartStoryScroll({ spec, steps, children }: ChartStoryScrollProps) {
  const host = useRef<HTMLDivElement>(null);
  const stepElements = useRef<HTMLElement[]>([]);
  const [current, setCurrent] = useState(-1);
  const [live, setLive] = useState(false);
  const theme = usePageChartTheme();
  const currentRef = useRef(current);
  currentRef.current = current;

  useEffect(() => {
    const target = host.current;
    if (!target) return;
    let parts: StoryParts | null = null;
    let cancelled = false;
    mountStory(
      target,
      stepElements.current,
      { spec, steps, startAt: Math.max(currentRef.current, 0) },
      { theme, onStep: setCurrent },
    ).then(
      (mounted) => {
        if (cancelled) {
          mounted.driver.destroy();
          mounted.story.destroy();
          return;
        }
        parts = mounted;
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
  }, [spec, steps, theme]);

  return (
    <div className="story-layout">
      <div className="story-panel">
        <div className="story-stage">
          <div ref={host} className="story-host" />
          {live ? null : <div className="story-static">{children}</div>}
        </div>
      </div>
      <ol className="story-steps">
        {steps.map((step, index) => (
          <li
            key={step.id}
            ref={(element) => {
              if (element) stepElements.current[index] = element;
            }}
            className="story-step"
            data-story-step={step.id}
            data-current={current === -1 ? undefined : String(current === index)}
          >
            <p className="story-prose">{step.prose}</p>
            <pre className="story-excerpt">
              <code>
                {changeExcerpt(
                  steps.map((item) => item.change),
                  index,
                ).join("\n")}
              </code>
            </pre>
          </li>
        ))}
      </ol>
    </div>
  );
}
