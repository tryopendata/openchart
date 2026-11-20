/**
 * Demos for the parliament page (docs/part-to-whole/parliament). The first
 * follows the Ladle parliament demo; the majority line options are the ones in
 * the MarkOptions type. Both seat datasets are labelled illustrative by their
 * modules.
 *
 * Every seat is an SVG element in the page, so a 435 or 705 seat chamber would
 * pass the page weight limit. Each demo draws one dot per five seats instead,
 * computed from the dataset's seat counts.
 */
import { euParliament, usHouse } from "@datasets/parliament-seats";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

const SEATS_PER_DOT = 5;

/** A seat count as a number of dots, one per `SEATS_PER_DOT` seats, rounded. */
function dotsFor(seats: number): number {
  return Math.round(seats / SEATS_PER_DOT);
}

const houseDots = usHouse.data.map((row) => ({ party: row.party, dots: dotsFor(row.seats) }));
const euGroupDots = euParliament.data.map((row) => ({
  group: row.group,
  dots: dotsFor(row.seats),
}));
const euColors = {
  domain: euParliament.data.map((row) => row.group),
  range: [...euParliament.colors],
};

export const basicParliament = defineDemo({
  id: "part-to-whole/parliament-basic",
  title: "US House seats by party",
  source: sourceOf(usHouse),
  height: 400,
  spec: {
    mark: { type: "parliament", majorityLine: { seats: dotsFor(218), label: "218 seats to win" } },
    data: houseDots,
    encoding: {
      theta: { field: "dots", type: "quantitative" },
      color: {
        field: "party",
        type: "nominal",
        scale: { domain: ["Democratic", "Republican"], range: [...usHouse.colors] },
      },
    },
    chrome: {
      title: "Republicans hold a narrow House majority",
      subtitle: "US House of Representatives, 435 seats. Each dot is five seats.",
    },
  },
});

export const multiPartyParliament = defineDemo({
  id: "part-to-whole/parliament-groups",
  title: "A chamber with eight groups",
  source: sourceOf(euParliament),
  height: 420,
  spec: {
    mark: { type: "parliament", majorityLine: false },
    data: euGroupDots,
    encoding: {
      theta: { field: "dots", type: "quantitative" },
      color: { field: "group", type: "nominal", scale: euColors },
    },
    chrome: {
      title: "No group holds a majority alone",
      subtitle: "705 seats ordered left to right by political group. Each dot is five seats.",
    },
  },
});

export const supermajorityParliament = defineDemo({
  id: "part-to-whole/parliament-threshold",
  title: "A two-thirds threshold",
  source: sourceOf(euParliament),
  height: 420,
  spec: {
    mark: {
      type: "parliament",
      majorityLine: { seats: dotsFor(470), label: "470 seats for two-thirds" },
    },
    data: euGroupDots,
    encoding: {
      theta: { field: "dots", type: "quantitative" },
      color: { field: "group", type: "nominal", scale: euColors },
    },
    chrome: {
      title: "The line can mark a supermajority instead",
      subtitle: "705 seats with the threshold set to 470. Each dot is five seats.",
    },
  },
});
