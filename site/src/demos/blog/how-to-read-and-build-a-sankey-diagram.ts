/**
 * The figures in the blog post "How to read and build a Sankey diagram": a
 * three-stage subset covering US electricity generation, then the full 42-link
 * LLNL 2024 US energy flow. Titles compute their shares and totals from the
 * rows so they cannot drift from the data. The post's `json demo` fence repeats
 * `energySankeyElectricity.spec` verbatim, and a test holds the two together.
 */
import { usEnergyFlow2024 } from "@datasets/us-energy-flow-2024";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

const ELECTRICITY = "Electricity generation";
const REJECTED = "Rejected energy";
const SERVICES = "Energy services";

const source = sourceOf(usEnergyFlow2024);
const fullRows = usEnergyFlow2024.data.map((row) => ({ ...row }));
const electricityRows = fullRows.filter(
  (row) => row.source === ELECTRICITY || row.target === ELECTRICITY,
);

const sumValues = (rows: readonly { value: number }[]) =>
  rows.reduce((total, row) => total + row.value, 0);

const electricityOut = sumValues(electricityRows.filter((row) => row.source === ELECTRICITY));
const electricityRejected =
  electricityRows.find((row) => row.source === ELECTRICITY && row.target === REJECTED)?.value ?? 0;
const electricityRejectedPct = Math.round((electricityRejected / electricityOut) * 100);

const fullRejected = sumValues(fullRows.filter((row) => row.target === REJECTED));
const fullServices = sumValues(fullRows.filter((row) => row.target === SERVICES));
const fullTotal = fullRejected + fullServices;
const fullRejectedPct = Math.round((fullRejected / fullTotal) * 100);

const flowEncoding = {
  source: { field: "source", type: "nominal" },
  target: { field: "target", type: "nominal" },
  value: { field: "value", type: "quantitative", format: ".2f" },
} as const;

export const energySankeyElectricity = defineDemo({
  id: "blog/energy-sankey-electricity",
  title: "US electricity generation flow, 2024",
  source,
  height: 460,
  spec: {
    type: "sankey",
    data: electricityRows,
    encoding: flowEncoding,
    chrome: {
      title: `Electricity generation lost ${electricityRejectedPct}% of its ${electricityOut.toFixed(2)} quads as rejected energy`,
      subtitle:
        "Primary fuels entering US electricity generation and their outputs, 2024 (quadrillion BTU)",
    },
  },
});

export const energySankeyFull = defineDemo({
  id: "blog/energy-sankey-full",
  title: "US energy flow from fuel source to end use, 2024",
  source,
  height: 620,
  spec: {
    type: "sankey",
    data: fullRows,
    encoding: flowEncoding,
    linkStyle: "source",
    chrome: {
      title: `Rejected energy was ${fullRejectedPct}% of the ${fullTotal.toFixed(2)} quads used in 2024`,
      subtitle:
        "US energy from primary fuels through electricity generation and end-use sectors, 2024 (quadrillion BTU)",
    },
  },
});
