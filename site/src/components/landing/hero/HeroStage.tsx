/**
 * Live visualization stage for the hero desk. Shows the build-time static SVG
 * pair (passed as children) until `@opendata-ai/openchart-react` has loaded
 * lazily via `loadChartLibrary()`, then renders either `<DataTable>` for the
 * table form or `<Chart>` (keyed by editorial form) for the chart forms, in the
 * site's active light/dark chart theme and with `watermark: false`.
 */
import type { TableSpec } from "@opendata-ai/openchart-core";
import { type ReactNode, useMemo } from "react";
import { HERO_FUELS, type HeroFormId, type HeroFuel, type HeroSpec } from "../../../landing/hero";
import { Mounted, useChartModule } from "../../shared/LiveChart";
import { usePageChartTheme } from "../../shared/page-theme";

/** Props for `HeroStage`. */
export type HeroStageProps = {
  /** Active editorial form, mirrored onto `data-hero-kind` and used to key `<Chart>`. */
  form: HeroFormId;
  /** Compiled spec for the active `(form, spotlight)` pair. */
  spec: HeroSpec;
  /** True once `HeroDesk` has upgraded the tabs to `role="tablist"` with matching tab ids. */
  interactive: boolean;
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

/** Lazily loaded hero chart/table stage with static SSR SVG fallback. */
export function HeroStage({
  form,
  spec,
  interactive,
  panelId,
  activeTabId,
  onMounted,
  onRowSelectFuel,
  children,
}: HeroStageProps) {
  const module = useChartModule();
  const { theme, darkMode } = usePageChartTheme();

  // The engine writes defaults into the spec it compiles, so the live component gets its own copy.
  // No attribution link inside the figure: this is the library's own site.
  const liveSpec = useMemo<HeroSpec>(
    () => ({ ...structuredClone(spec), watermark: false }),
    [spec],
  );

  const stageBody = !module ? (
    <div className="hero-chart-live">{children}</div>
  ) : (
    <>
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
          key={form}
          spec={liveSpec}
          theme={theme}
          darkMode={darkMode}
          className="hero-chart-live"
        />
      )}
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
