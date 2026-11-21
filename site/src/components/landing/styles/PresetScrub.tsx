/**
 * The PresetScrub island: one chart set in each of the library's house styles
 * and then in dark mode. The chart is the story and takes most of the width;
 * beside it are the style's name, one sentence on the look, and, behind a
 * disclosure, the theme values that changed. Where the pinned block fits and
 * motion is allowed, the section pins and the scroll picks the stop; otherwise
 * the stops are buttons. The chart is the shared LiveChart whose spec changes,
 * so each change is the library's own transition. Before the island runs, the
 * page shows the first stop with its static chart (the children) and no buttons.
 */
import type { ChartSpec, ThemeConfig } from "@opendata-ai/openchart-core";
import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { LiveChart } from "../../shared/LiveChart";
import { useHydrated } from "../../shared/use-hydrated";
import { useMotionTools } from "../../shared/use-motion-tools";
import { type Crossfade, crossfade } from "./diff-motion";
import type { ThemeDiffLine } from "./house-styles";
import { pinScrub } from "./preset-pin";
import { progressOf } from "./scrub-progress";

/** One stop as the island receives it: computed at build time by Styles.astro. */
export type ScrubStop = {
  id: string;
  label: string;
  preset: string;
  variant?: string;
  description: string;
  theme: ThemeConfig;
  dark: boolean;
  diff: ThemeDiffLine[];
};

export type PresetScrubProps = {
  stops: ScrubStop[];
  spec: ChartSpec;
  /** The first stop's static SVG, shown until the live chart loads. */
  children?: ReactNode;
};

type Pin = { start: number; end: number };

/** The house style is the chart's own theme, so the page theme is not laid over it. */
const HOUSE_LIGHT = { theme: undefined, darkMode: "off" } as const;
const HOUSE_DARK = { theme: undefined, darkMode: "force" } as const;

function Notes({
  stop,
  named,
  panelRef,
}: {
  stop: ScrubStop;
  /** Only the current stop's copy carries the name hook; the outgoing copy is decoration. */
  named: boolean;
  panelRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={panelRef}
      className={named ? "scrub-panel" : "scrub-panel scrub-out"}
      aria-hidden={named ? undefined : true}
    >
      <p className="scrub-name" data-preset-name={named ? "" : undefined}>
        {stop.label}
      </p>
      {stop.variant ? <p className="scrub-variant">{stop.variant}</p> : null}
      <p className="scrub-description">{stop.description}</p>
    </div>
  );
}

function DiffList({
  stop,
  named,
  listRef,
}: {
  stop: ScrubStop;
  named: boolean;
  listRef: RefObject<HTMLOListElement | null>;
}) {
  return (
    <ol
      ref={listRef}
      className={named ? "scrub-lines" : "scrub-lines scrub-out"}
      aria-hidden={named ? undefined : true}
    >
      {stop.diff.map((line) => (
        <li key={line.path} className="scrub-line">
          <span className="scrub-path">{line.path}</span> {line.before ?? "(unset)"}
          <span aria-hidden="true"> → </span>
          <span className="sr-only">becomes </span>
          {line.after ?? "(unset)"}
        </li>
      ))}
    </ol>
  );
}

export function PresetScrub({ stops, spec, children }: PresetScrubProps) {
  const [index, setIndex] = useState(0);
  const [previous, setPrevious] = useState<number | null>(null);
  const [pin, setPin] = useState<Pin | null>(null);
  const ready = useHydrated();
  const tools = useMotionTools();
  const animated = useRef(false);
  const blockRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const outPanelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const outListRef = useRef<HTMLOListElement>(null);
  const fade = useRef<Crossfade | null>(null);
  const shown = useRef(0);

  useEffect(() => {
    animated.current = tools !== null;
  }, [tools]);

  const show = useCallback((next: number) => {
    if (next === shown.current) return;
    setPrevious(animated.current ? shown.current : null);
    shown.current = next;
    setIndex(next);
  }, []);

  useEffect(() => {
    const block = blockRef.current;
    const progress = progressRef.current;
    if (!tools || !ready || !block || !progress) return;
    return pinScrub(
      tools,
      { block, progress, count: stops.length },
      { onPin: setPin, onStop: show },
    );
  }, [tools, ready, stops.length, show]);

  // Runs before paint, so the new copy never flashes at full strength first.
  useLayoutEffect(() => {
    if (!tools || previous === null) return;
    fade.current?.finish();
    fade.current = crossfade(
      tools,
      [
        { incoming: panelRef.current, outgoing: outPanelRef.current },
        { incoming: listRef.current, outgoing: outListRef.current },
      ],
      () => setPrevious(null),
    );
  }, [tools, previous]);

  const stop = stops[index] ?? stops[0];
  // The static chart stands in until the library loads, so the live chart skips its
  // entrance; every later change still runs the library's update transition.
  const liveSpec = useMemo<ChartSpec>(
    () => ({ ...spec, theme: stop?.theme, animation: { enter: false } }),
    [spec, stop],
  );
  if (!stop) return null;

  const choose = (next: number) => {
    // While pinned, the scroll owns the stop: jump to the middle of that stop's stretch.
    if (pin) {
      const top = pin.start + progressOf(next, stops.length) * (pin.end - pin.start);
      window.scrollTo({ top, behavior: "instant" });
    } else {
      show(next);
    }
  };
  const outgoing = previous === null ? undefined : stops[previous];

  return (
    <div className="scrub" style={{ "--stops": stops.length } as CSSProperties}>
      <div ref={blockRef} className="scrub-block" data-pinned={pin ? "" : undefined}>
        {ready ? (
          <div className="scrub-index">
            <fieldset className="scrub-stops">
              <legend className="sr-only">House style</legend>
              {stops.map((candidate, position) => (
                <button
                  key={candidate.id}
                  type="button"
                  className="scrub-stop"
                  aria-pressed={position === index}
                  onClick={() => choose(position)}
                >
                  {candidate.label}
                </button>
              ))}
            </fieldset>
            <div className="scrub-axis" aria-hidden="true">
              <span ref={progressRef} className="scrub-axis-fill" />
            </div>
          </div>
        ) : null}
        <div className="scrub-body">
          <div className="scrub-notes">
            <div className="scrub-layers">
              <Notes stop={stop} named panelRef={panelRef} />
              {outgoing ? <Notes stop={outgoing} named={false} panelRef={outPanelRef} /> : null}
            </div>
            <details className="scrub-details">
              <summary>What changed in the theme</summary>
              <div className="scrub-layers">
                <DiffList stop={stop} named listRef={listRef} />
                {outgoing ? <DiffList stop={outgoing} named={false} listRef={outListRef} /> : null}
              </div>
            </details>
          </div>
          <div className="scrub-chart">
            <LiveChart
              spec={liveSpec}
              className="scrub-host"
              themeOverride={stop.dark ? HOUSE_DARK : HOUSE_LIGHT}
            >
              {children}
            </LiveChart>
          </div>
        </div>
        <p className="sr-only" aria-live="polite">
          House style: {stop.variant ?? stop.label}
        </p>
      </div>
    </div>
  );
}
