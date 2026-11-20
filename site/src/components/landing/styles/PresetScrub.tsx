/**
 * The PresetScrub island: one chart restyled through the library's house-style
 * presets and then dark mode, with the theme lines that changed beside it. At
 * 900px and wider, with motion allowed, the scrub pins and the scroll picks the
 * stop; otherwise the stops are buttons. The chart is one `<Chart>` whose spec
 * changes, so each change is the library's own transition. Before the chart
 * module loads, and without JavaScript, the build's static SVG of the first
 * stop stands in.
 */
import type { ChartSpec, ThemeConfig } from "@opendata-ai/openchart-core";
import type { Chart as ChartComponent } from "@opendata-ai/openchart-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { type MotionTools, withMotion } from "../../../scripts/motion";
import { crossfadeLines } from "./diff-motion";
import type { ThemeDiffLine } from "./house-styles";
import { pinScrub } from "./preset-pin";
import { progressOf } from "./scrub-progress";

/** One stop as the island receives it: computed at build time by Styles.astro. */
export type ScrubStop = {
  id: string;
  label: string;
  preset: string;
  theme: ThemeConfig;
  dark: boolean;
  diff: ThemeDiffLine[];
};

export type PresetScrubProps = {
  stops: ScrubStop[];
  spec: ChartSpec;
  /** The first stop drawn at build time, shown until the live chart loads. */
  initialSvg: string;
};

type Pin = { start: number; end: number };

function DiffLines({ stop }: { stop: ScrubStop }) {
  return stop.diff.flatMap((line) => [
    ...(line.before === undefined
      ? []
      : [
          <li key={`${line.path}-`} className="scrub-line" data-sign="-">
            <span className="scrub-sign" aria-hidden="true">
              −
            </span>
            <span className="sr-only">removed: </span>
            {line.path}: {line.before}
          </li>,
        ]),
    ...(line.after === undefined
      ? []
      : [
          <li key={`${line.path}+`} className="scrub-line" data-sign="+">
            <span className="scrub-sign" aria-hidden="true">
              +
            </span>
            <span className="sr-only">added: </span>
            {line.path}: {line.after}
          </li>,
        ]),
  ]);
}

export function PresetScrub({ stops, spec, initialSvg }: PresetScrubProps) {
  const [index, setIndex] = useState(0);
  const [previous, setPrevious] = useState<number | null>(null);
  const [pin, setPin] = useState<Pin | null>(null);
  const [Chart, setChart] = useState<typeof ChartComponent | null>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const nameRef = useRef<HTMLParagraphElement>(null);
  const linesRef = useRef<HTMLOListElement>(null);
  const outgoingRef = useRef<HTMLOListElement>(null);
  const motion = useRef<MotionTools | null>(null);
  const fade = useRef<{ kill(): unknown } | null>(null);
  const shown = useRef(0);

  const show = useCallback((next: number) => {
    if (next === shown.current) return;
    setPrevious(motion.current ? shown.current : null);
    shown.current = next;
    setIndex(next);
  }, []);

  useEffect(() => {
    import("@opendata-ai/openchart-react")
      .then((module) => setChart(() => module.Chart))
      .catch((error: unknown) => {
        console.error("The house-style chart could not load; the static chart stays.", error);
      });
  }, []);

  useEffect(() => {
    const root = pinRef.current;
    const progress = progressRef.current;
    if (!root || !progress) return;
    return withMotion((tools) => {
      motion.current = tools;
      const unpin = pinScrub(
        tools,
        { root, progress, count: stops.length },
        { onPin: setPin, onStop: show },
      );
      return () => {
        unpin();
        motion.current = null;
      };
    });
  }, [stops.length, show]);

  // Runs before paint, so the new lines never flash at full strength first.
  useLayoutEffect(() => {
    const tools = motion.current;
    if (!tools || previous === null) return;
    fade.current?.kill();
    fade.current = crossfadeLines(
      tools,
      {
        name: nameRef.current,
        incoming: [...(linesRef.current?.children ?? [])],
        outgoing: outgoingRef.current,
      },
      () => setPrevious(null),
    );
  }, [previous]);

  const stop = stops[index] ?? stops[0];
  const liveSpec = useMemo<ChartSpec>(
    () => ({ ...spec, theme: stop?.theme, watermark: false }),
    [spec, stop],
  );
  if (!stop) return null;

  const choose = (next: number) => {
    // While pinned, the scroll owns the stop: scroll to the middle of that stop's stretch.
    if (pin)
      window.scrollTo({ top: pin.start + progressOf(next, stops.length) * (pin.end - pin.start) });
    else show(next);
  };
  const outgoing = previous === null ? undefined : stops[previous];

  return (
    <div className="scrub">
      <div ref={pinRef} className="scrub-pinned" data-pinned={pin ? "" : undefined}>
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
        <div className="scrub-body">
          <div className="scrub-notes">
            <p ref={nameRef} className="scrub-name" data-preset-name>
              {stop.label}
            </p>
            <p className="scrub-context">
              theme: <span className="text-ink">{stop.preset}</span>
              {stop.dark ? ", darkMode: force" : ""}
            </p>
            <div className="scrub-diff">
              <ol ref={linesRef} className="scrub-lines" aria-label="Theme values changed here">
                <DiffLines stop={stop} />
              </ol>
              {outgoing ? (
                <ol ref={outgoingRef} className="scrub-lines scrub-lines-out" aria-hidden="true">
                  <DiffLines stop={outgoing} />
                </ol>
              ) : null}
            </div>
          </div>
          <div className="scrub-chart">
            {Chart ? (
              <Chart
                spec={liveSpec}
                darkMode={stop.dark ? "force" : "off"}
                className="scrub-host"
              />
            ) : (
              // Build-time SVG of the first stop, from the library's own static renderer.
              <div className="scrub-static" dangerouslySetInnerHTML={{ __html: initialSvg }} />
            )}
          </div>
        </div>
        <p className="sr-only" aria-live="polite">
          House style: {stop.label}
        </p>
      </div>
    </div>
  );
}
