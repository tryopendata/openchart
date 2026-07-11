/**
 * React scrollytelling shell around the vanilla `createChartStory`.
 *
 * The chart panel is sticky-pinned; the narrative column scrolls past it and
 * each step block advances the story. The heavy lifting (cumulative patch
 * application, mark morphing, crossfade fallback, camera) lives in the vanilla
 * story driver: this component owns only React lifecycle and the sticky layout.
 *
 * Self-driving by default (the vanilla `ScrollDriver` reads step positions),
 * or controlled by passing `step={n}` to drive it externally.
 */

import type { ChartSpec, DataRow, GraphSpec, LayerSpec } from '@opendata-ai/openchart-core';
import type { MountOptions } from '@opendata-ai/openchart-vanilla';
import {
  type ChartStoryInstance,
  type ChartStoryOptions,
  createChartStory,
} from '@opendata-ai/openchart-vanilla/story';
import type { Ref } from 'react';
import { type CSSProperties, type ReactNode, useEffect, useImperativeHandle, useRef } from 'react';

export interface ChartStoryHandle {
  /** Jump the story to a step index (applies patches 0..n, animates the diff). */
  goTo(index: number): void;
  /** The underlying vanilla story instance, or null before mount. */
  readonly instance: ChartStoryInstance | null;
}

export interface ChartStoryProps<TData extends DataRow = DataRow> {
  /** Base spec the story drives. */
  spec: ChartSpec<TData> | LayerSpec<TData> | GraphSpec;
  /** Ordered step patches. `steps[i]` is applied cumulatively onto the base. */
  steps: ChartStoryOptions<TData>['steps'];
  /**
   * Narrative content per step: `narrative[i]` renders in the scrolling column
   * beside the sticky chart and triggers step `i` when it crosses the trigger
   * line. Length should match `steps`.
   */
  narrative: ReactNode[];
  /**
   * Controlled step index. When provided, the built-in scroll driver is left
   * in place but `goTo` is called on change so an external scroller can drive.
   * Omit for self-driving scroll.
   */
  step?: number;
  /** Fraction of viewport height where the scroll trigger sits. Default 0.4. */
  triggerPosition?: number;
  /** Camera driving mode. Default 'step'. */
  cameraMode?: 'step' | 'scrub';
  /** Options forwarded to the underlying chart mount (theme, dark mode, etc.). */
  mountOptions?: MountOptions;
  /** Class on the outer section. */
  className?: string;
  /** Inline styles merged onto the outer section. */
  style?: CSSProperties;
  ref?: Ref<ChartStoryHandle>;
}

const sectionStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 26rem) minmax(0, 1fr)',
  gap: '3rem',
  alignItems: 'start',
};

const narrativeColumnStyle: CSSProperties = {
  position: 'relative',
};

const stepStyle: CSSProperties = {
  minHeight: '80vh',
  display: 'flex',
  alignItems: 'center',
};

const panelStyle: CSSProperties = {
  position: 'sticky',
  top: '2rem',
  height: 'calc(100vh - 4rem)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const chartMountStyle: CSSProperties = {
  width: '100%',
};

export function ChartStory<TData extends DataRow = DataRow>({
  spec,
  steps,
  narrative,
  step,
  triggerPosition,
  cameraMode,
  mountOptions,
  className,
  style,
  ref,
}: ChartStoryProps<TData>) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const chartMountRef = useRef<HTMLDivElement | null>(null);
  const stepRefs = useRef<Array<HTMLDivElement | null>>([]);
  const storyRef = useRef<ChartStoryInstance | null>(null);

  // Mount once; the vanilla driver owns updates so React never re-mounts on
  // spec/step churn (matching the <Chart /> imperative-update pattern).
  const optionsRef = useRef<{
    spec: typeof spec;
    steps: typeof steps;
    triggerPosition?: number;
    cameraMode?: 'step' | 'scrub';
    mountOptions?: MountOptions;
  }>({ spec, steps, triggerPosition, cameraMode, mountOptions });
  optionsRef.current = { spec, steps, triggerPosition, cameraMode, mountOptions };

  useEffect(() => {
    const mount = chartMountRef.current;
    const section = sectionRef.current;
    if (!mount) return;

    const opts = optionsRef.current;
    const story = createChartStory(
      mount,
      {
        spec: opts.spec,
        steps: opts.steps,
        triggerPosition: opts.triggerPosition,
        cameraMode: opts.cameraMode,
      },
      opts.mountOptions,
    );
    storyRef.current = story;

    if (section) story.setContainer(section);
    stepRefs.current.forEach((el, i) => {
      if (el) story.registerStep(i, el);
    });

    return () => {
      story.destroy();
      storyRef.current = null;
    };
    // Mount-once: options are read from the ref so changing them doesn't
    // remount. Spec/step diffing at runtime is out of scope for v1.
  }, []);

  // Controlled mode: drive the story when `step` changes.
  useEffect(() => {
    if (step === undefined) return;
    storyRef.current?.goTo(step);
  }, [step]);

  useImperativeHandle(
    ref,
    () => ({
      goTo(index: number) {
        storyRef.current?.goTo(index);
      },
      get instance() {
        return storyRef.current;
      },
    }),
    [],
  );

  return (
    <section ref={sectionRef} className={className} style={{ ...sectionStyle, ...style }}>
      <div style={narrativeColumnStyle}>
        {narrative.map((content, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: steps are a fixed ordered list; index is the stable identity
            key={i}
            ref={(el) => {
              stepRefs.current[i] = el;
            }}
            data-oc-story-step={i}
            style={stepStyle}
          >
            <div style={{ maxWidth: '36rem' }}>{content}</div>
          </div>
        ))}
      </div>
      <div style={panelStyle}>
        <div ref={chartMountRef} style={chartMountStyle} />
      </div>
    </section>
  );
}
