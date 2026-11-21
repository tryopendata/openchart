/**
 * Colors and subtitles shared by the spec and framing demos, so a dataset is
 * described the same way on every page that charts it.
 */
import { TEMPERATURE_BASELINE } from "../style/temperature";

/** The site accent, for the series a figure is about. */
export const ACCENT = "#0e7490";
/** Context series and secondary bars. */
export const GREY = "#7a858f";
/** Warm counterpart to the accent: highs, warmer-than-average readings. */
export const WARM = "#c2410c";
/** Cool blue for cooler-than-average readings. */
export const COOL = "#2b6cb0";

/** us-inflation: the measure, unit and span. */
export const INFLATION_SUBTITLE =
  "Consumer price index, % change from a year earlier, quarterly, 2019–2024";

/** electricity-mix-matrix: `share` is a percent of the six-source total, not of all US generation. */
export const ELECTRICITY_SUBTITLE =
  "Share of US generation from coal, gas, nuclear, hydro, wind and solar (%)";

/** gistemp-global-annual: the baseline and the uneven last step. */
export const ANOMALY_SUBTITLE = `Global surface temperature against the ${TEMPERATURE_BASELINE} (°C), one reading per decade from 1900, then 2025`;

/** nyc-temperature-range: where and when. */
export const CENTRAL_PARK_2023 = "Central Park, New York, 2023 (°C)";
