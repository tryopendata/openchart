/**
 * A small data table for the demo system's tests and the `/fixtures/demo/` page.
 * Tables have no static renderer, so this one exercises the client-only mount.
 */
import { defineDemo } from "../types";

/** Three illustrative rows, few enough that snippets keep the data inline. */
export const fixtureTable = defineDemo({
  id: "fixtures/table",
  title: "Fixture table",
  caption: "Orders and returns by region",
  source: { label: "Illustrative data" },
  height: 240,
  spec: {
    type: "table",
    data: [
      { region: "North", orders: 42, returns: 3 },
      { region: "South", orders: 31, returns: 5 },
      { region: "East", orders: 27, returns: 2 },
    ],
    columns: [
      { key: "region", label: "Region" },
      { key: "orders", label: "Orders" },
      { key: "returns", label: "Returns" },
    ],
  },
});
