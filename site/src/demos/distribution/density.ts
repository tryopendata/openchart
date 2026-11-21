/**
 * Demos for the density page (docs/distribution/density). Specs follow the
 * overlapping-density story in the Ladle scatter and distribution gallery.
 */
import { defineDemo } from "../types";
import {
  campaignDonations,
  ILLUSTRATIVE,
  LARGE_CHECKS,
  SMALL_GIFTS,
  smallDonations,
} from "./shared";

const caption = `A seeded sample of ${campaignDonations.length} invented contributions: ${SMALL_GIFTS} small gifts and ${LARGE_CHECKS} large checks.`;

const amountAxis = { title: "Contribution ($)" };

export const basicDensity = defineDemo({
  id: "distribution/density-basic",
  title: "Contribution sizes, small donors",
  source: ILLUSTRATIVE,
  caption: `A seeded sample of ${SMALL_GIFTS} invented small gifts.`,
  spec: {
    mark: { type: "density" },
    data: smallDonations,
    encoding: {
      x: { field: "amount", type: "quantitative", axis: amountAxis },
    },
    chrome: {
      title: "Small gifts cluster under $100",
      subtitle: "Kernel density estimate of contribution size",
    },
  },
});

export const groupedDensity = defineDemo({
  id: "distribution/density-grouped",
  title: "Two donor groups, smoothed",
  source: ILLUSTRATIVE,
  caption,
  spec: {
    mark: { type: "density" },
    data: campaignDonations,
    encoding: {
      x: { field: "amount", type: "quantitative", axis: amountAxis },
      color: { field: "candidate", type: "nominal" },
    },
    chrome: {
      title: "The same two distributions, smoothed",
      subtitle: "Kernel density estimate by group",
    },
  },
});

export const narrowDensity = defineDemo({
  id: "distribution/density-bandwidth",
  title: "Two donor groups, narrow bandwidth",
  source: ILLUSTRATIVE,
  caption,
  spec: {
    mark: { type: "density", bandwidth: 15 },
    data: campaignDonations,
    encoding: {
      x: { field: "amount", type: "quantitative", axis: amountAxis },
      color: { field: "candidate", type: "nominal" },
    },
    chrome: {
      title: "A narrow bandwidth follows every bump",
      subtitle: "Kernel density estimate by group, bandwidth 15",
    },
  },
});

export const cumulativeDensity = defineDemo({
  id: "distribution/density-cumulative",
  title: "Two donor groups, cumulative",
  source: ILLUSTRATIVE,
  caption,
  spec: {
    mark: { type: "density", cumulative: true },
    data: campaignDonations,
    encoding: {
      x: { field: "amount", type: "quantitative", axis: amountAxis },
      color: { field: "candidate", type: "nominal" },
    },
    chrome: {
      title: "Where each group's gifts accumulate",
      subtitle: "Cumulative distribution of contribution size",
    },
  },
});
