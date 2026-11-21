/**
 * Live visualization stage for the hero desk. Shows the build-time static SVG
 * pair (passed as children) until `@opendata-ai/openchart-react` has loaded
 * lazily via `loadChartLibrary()`, then renders either `<DataTable>` for the
 * table form or `<Chart>` (keyed by editorial form) for the chart forms, in the
 * site's active light/dark chart theme and with `watermark: false`.
 */
import type { AnimationConfig, TableSpec } from "@opendata-ai/openchart-core";
import { type ReactNode, useMemo } from "react";
import { HERO_FUELS, type HeroFormId, type HeroFuel, type HeroSpec } from "../../../landing/hero";
import { Mounted, useChartModule } from "../../shared/LiveChart";
import { usePageChartTheme } from "../../shared/page-theme";

/**
 * Critically damped physics springs calibrated via `springDuration`:
 * - Enter (`800 / 57`): settles at 465ms with an 18ms cascade across series.
 * - Update (`1100 / 67`): settles at 405ms for responsive spotlight switching.
 */
const HERO_ENTER_SPRING = { stiffness: 800, damping: 57, mass: 1 } as const;
const HERO_UPDATE_SPRING = { stiffness: 1100, damping: 67, mass: 1 } as const;
const HERO_ENTER_STAGGER_MS = 18;

/** Props for `HeroStage`. */
export type HeroStageProps = {
  /** Active editorial form, mirrored onto `data-hero-kind` and used to key `<Chart>`. */
  form: HeroFormId;
  /** Compiled spec for the active `(form, spotlight)` pair. */
  spec: HeroSpec;
  /** True once `HeroDesk` has upgraded the tabs to `role="tablist"` with matching tab ids. */
  interactive: boolean;
  /** False on initial static-to-live handoff so the SSR SVG swaps without a redundant redraw. */
  animateEnter: boolean;
  /** DOM id of the stage container, referenced by tab `aria-controls`. */
  panelId: string;
  /** DOM id of the active tab, referenced by `aria-labelledby` once interactive. */
  activeTabId: string;
  /** Called once the live library component has mounted. Keep its identity stable. */
  onMounted: () => void;
  /** Called when the reader clicks a fuel row in the data table form. */
  onRowSelectFuel: (fuel: HeroFuel) => void;
  /** Static SSR SVG pair shown until the live library finishes loading. */
  children?: ReactNode;
};

/** Runtime-import-free guard distinguishing the table form from chart specs. */
function isTableHeroSpec(spec: HeroSpec): spec is TableSpec {
  return "type" in spec && spec.type === "table";
}

/** Validates a clicked table row's `source` value before dispatching a spotlight toggle. */
function isHeroFuel(value: unknown): value is HeroFuel {
  return typeof value === "string" && (HERO_FUELS as readonly string[]).includes(value);
}

/** Builds the hero stage's critically damped spring animation config. */
function heroAnimation(animateEnter: boolean): AnimationConfig {
  return {
    enter: animateEnter
      ? {
          spring: HERO_ENTER_SPRING,
          stagger: { delay: HERO_ENTER_STAGGER_MS },
          trigger: "mount",
        }
      : false,
    update: { spring: HERO_UPDATE_SPRING },
    annotationDelay: 0,
  };
}

/** Lazily loaded hero chart/table stage with static SSR SVG fallback. */
export function HeroStage({
  form,
  spec,
  interactive,
  animateEnter,
  panelId,
  activeTabId,
  onMounted,
  onRowSelectFuel,
  children,
}: HeroStageProps) {
  const module = useChartModule();
  const { theme, darkMode } = usePageChartTheme();

  // The engine writes defaults into the spec it compiles, so the live component gets its own copy.
  // Motion tuning is applied here rather than in `hero.ts` so the inspectable JSON spec stays pure.
  const liveSpec = useMemo<HeroSpec>(
    () => ({
      ...structuredClone(spec),
      watermark: false,
      animation: heroAnimation(animateEnter),
    }),
    [spec, animateEnter],
  );

  const stageBody = !module ? (
    <div className="hero-chart-live">{children}</div>
  ) : (
    <>
      <div
        key={form}
        className={animateEnter ? "hero-chart-live hero-stage-enter" : "hero-chart-live"}
      >
        {isTableHeroSpec(liveSpec) ? (
          <module.DataTable
            spec={liveSpec}
            theme={theme}
            darkMode={darkMode}
            className="hero-chart-live"
            onRowClick={(row) => {
              if (isHeroFuel(row.source)) onRowSelectFuel(row.source);
            }}
          />
        ) : (
          <module.Chart
            spec={liveSpec}
            theme={theme}
            darkMode={darkMode}
            className="hero-chart-live"
          />
        )}
      </div>
      <Mounted onMounted={onMounted} />
    </>
  );

  if (!interactive) {
    return (
      <div id={panelId} className="hero-chart" data-hero-chart data-hero-kind={form}>
        {stageBody}
      </div>
    );
  }

  return (
    <div
      id={panelId}
      className="hero-chart"
      data-hero-chart
      data-hero-kind={form}
      role="tabpanel"
      aria-labelledby={activeTabId}
    >
      {stageBody}
    </div>
  );
}
