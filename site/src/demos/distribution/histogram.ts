/**
 * Demos for the histogram page (docs/distribution/histogram). Specs follow the
 * overlapping-histogram story in the Ladle scatter and distribution gallery.
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

export const basicHistogram = defineDemo({
  id: "distribution/histogram-basic",
  title: "Contribution sizes, small donors",
  source: ILLUSTRATIVE,
  caption: `A seeded sample of ${SMALL_GIFTS} invented small gifts.`,
  spec: {
    mark: { type: "histogram", binCount: 24 },
    data: smallDonations,
    encoding: {
      x: { field: "amount", type: "quantitative", axis: amountAxis },
    },
    chrome: {
      title: "Most small gifts are under $100",
      subtitle: "Individual contributions by size, 24 bins",
    },
  },
});

export const coarseHistogram = defineDemo({
  id: "distribution/histogram-bins",
  title: "Contribution sizes in eight bins",
  source: ILLUSTRATIVE,
  caption: `The same ${SMALL_GIFTS} invented small gifts as the first figure.`,
  spec: {
    mark: { type: "histogram", binCount: 8 },
    data: smallDonations,
    encoding: {
      x: { field: "amount", type: "quantitative", axis: amountAxis },
    },
    chrome: {
      title: "Fewer bins smooth the shape and hide detail",
      subtitle: "Individual contributions by size, 8 bins",
    },
  },
});

export const overlappingHistogram = defineDemo({
  id: "distribution/histogram-overlap",
  title: "Two donor groups, overlapping",
  source: ILLUSTRATIVE,
  caption,
  spec: {
    mark: { type: "histogram", binCount: 24 },
    data: campaignDonations,
    encoding: {
      x: { field: "amount", type: "quantitative", axis: amountAxis },
      color: { field: "candidate", type: "nominal" },
    },
    chrome: {
      title: "Two campaigns, two donor bases",
      subtitle: "Individual contributions by size",
    },
  },
});

export const normalizedHistogram = defineDemo({
  id: "distribution/histogram-normalized",
  title: "Two donor groups, as shares",
  source: ILLUSTRATIVE,
  caption,
  spec: {
    mark: { type: "histogram", binCount: 24, normalize: true },
    data: campaignDonations,
    encoding: {
      x: { field: "amount", type: "quantitative", axis: amountAxis },
      color: { field: "candidate", type: "nominal" },
    },
    chrome: {
      title: "Each group's bars sum to 100%",
      subtitle: "Share of each group's contributions by size",
    },
  },
});
