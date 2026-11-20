/**
 * Demos for the slope and bump page (docs/change-over-time/slope-bump). The
 * slope and bump specs are the recipes in docs/ranking-and-change.md, which
 * carry their own data and citations; the rank-from-scores demo applies that
 * page's window transform to a dataset module.
 */
import { indexTotalReturns } from "@datasets/index-total-returns";
import { defineDemo } from "../types";
import { sourceOf } from "./source";

const SMARTPHONE_SOURCE = {
  label: "IDC Worldwide Quarterly Mobile Phone Tracker",
};

const smartphoneShipments = [
  { year: "2019", brand: "Samsung", share: 0.216 },
  { year: "2024", brand: "Samsung", share: 0.19 },
  { year: "2019", brand: "Huawei", share: 0.176 },
  { year: "2024", brand: "Huawei", share: 0.043 },
  { year: "2019", brand: "Apple", share: 0.139 },
  { year: "2024", brand: "Apple", share: 0.187 },
  { year: "2019", brand: "Xiaomi", share: 0.092 },
  { year: "2024", brand: "Xiaomi", share: 0.136 },
  { year: "2019", brand: "Oppo", share: 0.083 },
  { year: "2024", brand: "Oppo", share: 0.087 },
];

export const slopeChart = defineDemo({
  id: "change-over-time/slope",
  title: "Smartphone shipment share, 2019 and 2024",
  source: SMARTPHONE_SOURCE,
  height: 440,
  spec: {
    mark: "line",
    data: smartphoneShipments,
    encoding: {
      x: { field: "year", type: "ordinal" },
      y: { field: "share", type: "quantitative", axis: false, scale: { zero: false } },
      color: { field: "brand", type: "nominal" },
    },
    endpointLabels: { ends: "both", content: "label value", format: ".0%" },
    legend: { show: false },
    chrome: {
      title: "Apple and Xiaomi split what Huawei lost",
      subtitle: "Share of global smartphone shipments, 2019 vs 2024",
    },
  },
});

export const slopeSplitLabels = defineDemo({
  id: "change-over-time/slope-labels",
  title: "Smartphone shipment share with split labels",
  source: SMARTPHONE_SOURCE,
  height: 440,
  spec: {
    mark: "line",
    data: smartphoneShipments,
    encoding: {
      x: { field: "year", type: "ordinal" },
      y: { field: "share", type: "quantitative", axis: false, scale: { zero: false } },
      color: { field: "brand", type: "nominal" },
    },
    endpointLabels: {
      ends: "both",
      content: { leading: "label value", trailing: "value" },
      format: ".0%",
    },
    legend: { show: false },
    chrome: {
      title: "Name and value on the left, value alone on the right",
      subtitle: "Share of global smartphone shipments, 2019 vs 2024",
    },
  },
});

const constructorStandings = [
  { season: "2019", team: "Mercedes", position: 1 },
  { season: "2020", team: "Mercedes", position: 1 },
  { season: "2021", team: "Mercedes", position: 1 },
  { season: "2022", team: "Mercedes", position: 3 },
  { season: "2023", team: "Mercedes", position: 2 },
  { season: "2024", team: "Mercedes", position: 4 },
  { season: "2019", team: "Red Bull", position: 3 },
  { season: "2020", team: "Red Bull", position: 2 },
  { season: "2021", team: "Red Bull", position: 2 },
  { season: "2022", team: "Red Bull", position: 1 },
  { season: "2023", team: "Red Bull", position: 1 },
  { season: "2024", team: "Red Bull", position: 3 },
  { season: "2019", team: "Ferrari", position: 2 },
  { season: "2020", team: "Ferrari", position: 6 },
  { season: "2021", team: "Ferrari", position: 3 },
  { season: "2022", team: "Ferrari", position: 2 },
  { season: "2023", team: "Ferrari", position: 3 },
  { season: "2024", team: "Ferrari", position: 2 },
  { season: "2019", team: "McLaren", position: 4 },
  { season: "2020", team: "McLaren", position: 3 },
  { season: "2021", team: "McLaren", position: 4 },
  { season: "2022", team: "McLaren", position: 5 },
  { season: "2023", team: "McLaren", position: 4 },
  { season: "2024", team: "McLaren", position: 1 },
  { season: "2019", team: "Alpine", position: 5 },
  { season: "2020", team: "Alpine", position: 5 },
  { season: "2021", team: "Alpine", position: 5 },
  { season: "2022", team: "Alpine", position: 4 },
  { season: "2023", team: "Alpine", position: 6 },
  { season: "2024", team: "Alpine", position: 6 },
];

export const bumpChart = defineDemo({
  id: "change-over-time/bump",
  title: "Constructors championship position by season",
  source: { label: "FIA official standings" },
  height: 460,
  spec: {
    mark: { type: "line", interpolate: "monotone", point: true },
    data: constructorStandings,
    encoding: {
      x: { field: "season", type: "ordinal" },
      y: {
        field: "position",
        type: "quantitative",
        scale: { reverse: true, zero: false },
        axis: { values: [1, 2, 3, 4, 5, 6], format: "ordinal" },
      },
      color: { field: "team", type: "nominal" },
    },
    endpointLabels: { ends: "both", content: "label", showMarker: false },
    legend: { show: false },
    chrome: {
      title: "McLaren went from midfield to champions",
      subtitle: "Formula 1 constructors championship, final position by season",
    },
  },
});

export const rankedBump = defineDemo({
  id: "change-over-time/bump-rank",
  title: "Index rank by cumulative total return",
  source: sourceOf(indexTotalReturns),
  height: 440,
  spec: {
    mark: { type: "line", interpolate: "monotone", point: true },
    data: [...indexTotalReturns.data],
    transform: [
      {
        window: [{ op: "rank", field: "totalReturn", as: "position" }],
        sort: [{ field: "totalReturn", order: "descending" }],
        groupby: ["date"],
      },
    ],
    encoding: {
      x: { field: "date", type: "temporal", axis: { format: "%b '%y", tickCount: 6 } },
      y: {
        field: "position",
        type: "quantitative",
        scale: { reverse: true, zero: false },
        axis: { values: [1, 2, 3, 4], format: "ordinal" },
      },
      color: { field: "index", type: "nominal" },
    },
    endpointLabels: { ends: "both", content: "label", showMarker: false },
    legend: { show: false },
    chrome: {
      title: "The window transform turns scores into ranks",
      subtitle: "Rank of cumulative total return among four US equity indices, quarterly",
    },
  },
});
