/** Draws a race's final frame as a build-time picture using the engine's race geometry. */
import {
  type Point,
  type RaceBarGeometry,
  type RaceLayout,
  type RaceLineGeometry,
  type RaceSpec,
  type RaceTableGeometry,
  type ResolvedChromeElement,
  textAscent,
  truncateToWidth,
  wrapText,
} from "@opendata-ai/openchart-core";
import {
  layoutRace,
  prepareRace,
  raceFrameAt,
  raceGeometryAt,
} from "@opendata-ai/openchart-engine";
import { escapeElementText, escapeHtml } from "./escape-html";
import type { StaticSvgOptions } from "./static-svg";

type Attributes = Record<string, string | number>;

function attrs(values: Attributes): string {
  return Object.entries(values)
    .map(
      ([key, value]) =>
        ` ${key}="${typeof value === "number" ? +value.toFixed(2) : escapeHtml(value)}"`,
    )
    .join("");
}

const text = (x: number, y: number, label: string, style: Attributes = {}) =>
  `<text${attrs({ ...style, x, y })}>${escapeElementText(label)}</text>`;

function chromeText(element: ResolvedChromeElement, offset: number): string {
  const { style, x, y, maxWidth, maxLines } = element;
  const { fontFamily, fontSize, fontWeight, fill, lineHeight } = style;
  const lines = wrapText(element.text, fontSize, fontWeight, maxWidth);
  if (maxLines !== undefined && lines.length > maxLines) {
    lines.length = maxLines;
    if (maxLines > 0) {
      lines[maxLines - 1] = truncateToWidth(`${lines.at(-1)}…`, maxWidth, fontSize, fontWeight);
    }
  }
  const baseline = offset + y + textAscent(fontSize);
  return lines
    .map((line, index) =>
      text(x, baseline + index * fontSize * lineHeight, line, {
        fill,
        "font-family": fontFamily,
        "font-size": fontSize,
        "font-weight": fontWeight,
        "text-anchor": style.textAnchor ?? "start",
        "dominant-baseline": style.dominantBaseline ?? "auto",
      }),
    )
    .join("");
}

function raceChrome({ chrome, area }: RaceLayout): string {
  const bottom = chrome.bottomAnchorY ?? area.y + area.height;
  const top = [chrome.eyebrow, chrome.title, chrome.subtitle];
  const foot = [chrome.source, chrome.byline, chrome.footer, chrome.brand];
  const rule = chrome.rule;
  return [
    rule
      ? `<rect${attrs({ x: rule.x, y: rule.y, width: rule.width, height: rule.thickness, fill: rule.color })}/>`
      : "",
    ...top.map((item) => (item ? chromeText(item, 0) : "")),
    ...foot.map((item) => (item ? chromeText(item, bottom) : "")),
  ].join("");
}

function bars(layout: Extract<RaceLayout, { mark: "bar" }>, geometry: RaceBarGeometry): string {
  const { plot, axisY, tickFontSize, cornerRadius } = layout.static;
  const { axis, gridline } = layout.theme.colors;
  const ticks = geometry.ticks.map(
    ({ position: x, label, opacity }) =>
      `<g${attrs({ opacity })}><line${attrs({ x1: x, x2: x, y1: plot.y, y2: plot.y + plot.height, stroke: gridline })}/>${text(x, axisY, label, { "text-anchor": "middle", "font-size": tickFontSize, fill: axis })}</g>`,
  );
  const rows = geometry.rows.map(
    ({ bar, color, name, value, opacity }) =>
      `<g${attrs({ opacity, "dominant-baseline": "central" })}><rect${attrs({ ...bar, rx: cornerRadius, fill: color })}/>${text(name.x, name.y, name.text, { "text-anchor": "end" })}${text(value.x, value.y, value.text, { "text-anchor": value.anchor })}</g>`,
  );
  const { period, summary } = geometry;
  return [
    ...ticks,
    ...rows,
    period
      ? text(period.x, period.y, period.text, {
          "font-size": period.fontSize,
          "text-anchor": "end",
          fill: axis,
        })
      : "",
    summary ? text(summary.x, summary.y, summary.text, { "text-anchor": "end" }) : "",
  ].join("");
}

function linePath(points: Array<Point | null>): string {
  return points
    .map((point, i) =>
      point ? `${points[i - 1] ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}` : "",
    )
    .join("");
}

function lines(layout: Extract<RaceLayout, { mark: "line" }>, geometry: RaceLineGeometry): string {
  const { plot, tickFontSize, yAxisX, window } = layout.static;
  const { axis, gridline } = layout.theme.colors;
  const xTicks = geometry.xTicks.map(({ position, value, label, opacity }) => {
    const anchor = window === "reveal" ? "middle" : value === 0 ? "end" : "start";
    return text(position, plot.y + plot.height + tickFontSize + 2, label, {
      "text-anchor": anchor,
      opacity,
    });
  });
  const yTicks = geometry.yTicks.map(
    ({ position: y, label, opacity }) =>
      `<g${attrs({ opacity })}><line${attrs({ x1: yAxisX, x2: plot.x + plot.width, y1: y, y2: y, stroke: gridline })}/>${text(yAxisX - 4, y, label, { "text-anchor": "end", "dominant-baseline": "central" })}</g>`,
  );
  const paths = geometry.series.map(
    ({ points, color, opacity }) =>
      `<path${attrs({ d: linePath(points), fill: "none", stroke: color, "stroke-width": 2, opacity })}/>`,
  );
  const labels = geometry.series.map(({ endLabel: label, color, opacity }) => {
    const { x, y, leader } = label;
    const alpha = label.opacity ?? opacity;
    const connector = leader
      ? `<line${attrs({ x1: leader.x, y1: leader.y, x2: x - 1, y2: y, stroke: color, opacity: alpha * 0.45 })}/>`
      : "";
    const name = `<tspan${attrs({ fill: color })}>${escapeElementText(label.text)}</tspan>`;
    const value = escapeElementText(label.text && label.value ? ` ${label.value}` : label.value);
    return `${connector}<text${attrs({ x, y, opacity: alpha, "dominant-baseline": "central" })}>${name}${value}</text>`;
  });
  return `<g${attrs({ "font-size": tickFontSize, fill: axis })}>${[...xTicks, ...yTicks].join("")}</g>${[...paths, ...labels].join("")}`;
}

function table(
  layout: Extract<RaceLayout, { mark: "table" }>,
  geometry: RaceTableGeometry,
): string {
  const { columns, labels, headerHeight, rowHeight, fontSize } = layout.static;
  const { area, theme } = layout;
  const cellText = ({ column, x, width }: (typeof columns)[number], y: number, label: string) =>
    column === "name" || column === "bar"
      ? text(x + 5, y, label)
      : text(x + width - 5, y, label, { "text-anchor": "end" });
  const header = columns.map((column) =>
    cellText(column, area.y + headerHeight / 2, labels[column.column]),
  );
  const rows = geometry.rows.map((row) => {
    // The live renderer orders rows for painting. In the final picture, use their positions.
    const top = area.y + headerHeight + row.y;
    const y = top + rowHeight / 2;
    const rule = `<line${attrs({ x1: area.x, x2: area.x + area.width, y1: top, y2: top, stroke: theme.colors.hairline })}/>`;
    const cells = columns.map((column, i) => {
      const cell = row.cells[i];
      if (!cell) return "";
      const { x } = column;
      if (cell.column === "bar") {
        return `<rect${attrs({ x: x + cell.x, y: y - 3, width: cell.width, height: 6, fill: cell.color })}/>`;
      }
      if (cell.column === "name") {
        return `<circle${attrs({ cx: x + 9, cy: y, r: 3, fill: cell.color })}/>${text(x + 19, y, cell.text)}`;
      }
      return cellText(column, y, cell.text);
    });
    return rule + cells.join("");
  });
  return `<g${attrs({ "font-size": fontSize, "dominant-baseline": "central" })}><g font-weight="600">${header.join("")}</g>${rows.join("")}</g>`;
}

/** A race's final period in the docs theme, with no player controls or DOM dependency. */
export function raceStaticSvg(
  spec: RaceSpec,
  { width, height, dark, theme, idPrefix }: StaticSvgOptions,
): string {
  const model = prepareRace({ ...spec, watermark: false }, {});
  const t = model.timeline.periodCount - 1;
  const frame = raceFrameAt(model, t);
  const period = frame.period.label;
  const layout = layoutRace(model, {
    width,
    height: Math.max(0, height - 24),
    darkMode: dark,
    theme,
  });
  const geometry = raceGeometryAt(model, layout, t);
  let marks: string;
  if (layout.mark === "bar" && geometry.mark === "bar") marks = bars(layout, geometry);
  else if (layout.mark === "line" && geometry.mark === "line") marks = lines(layout, geometry);
  else if (layout.mark === "table" && geometry.mark === "table") marks = table(layout, geometry);
  else
    throw new Error(
      `Race geometry for "${geometry.mark}" cannot draw a "${layout.mark}" snapshot.`,
    );

  const { colors, fonts, spacing } = layout.theme;
  const descriptionId = `${idPrefix}-rankings`;
  const rankings = [...frame.items]
    .filter(({ rank }) => rank < model.timeline.top)
    .sort((a, b) => a.rank - b.rank)
    .map(({ label, valueLabel, rank }) => `${rank + 1}. ${label}, ${valueLabel}.`)
    .join(" ");
  const description = layout.a11y.hidden
    ? ""
    : `<desc${attrs({ id: descriptionId })}>${escapeElementText([spec.a11y?.description, rankings].filter(Boolean).join(" "))}</desc>`;
  const accessible: Attributes = layout.a11y.hidden
    ? { "aria-hidden": "true" }
    : {
        role: "img",
        "aria-label": `${layout.chrome.title?.text || "Race chart"} (${period})`,
        "aria-describedby": descriptionId,
      };
  const periodLabel =
    (geometry.mark === "bar" && geometry.period) || spec.race?.period === false
      ? ""
      : text(width - spacing.padding, height - 8, period, {
          "text-anchor": "end",
          fill: colors.axis,
        });
  return `<svg${attrs({ viewBox: `0 0 ${width} ${height}`, "data-theme": dark ? "dark" : "light", "font-family": fonts.family, "font-size": fonts.sizes.body, fill: colors.text, ...accessible })}>${description}${raceChrome(layout)}${marks}${periodLabel}</svg>`;
}
