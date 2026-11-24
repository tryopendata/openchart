/**
 * Writes e2e/shard-timings.json from a Playwright JSON report, so
 * scripts/e2e-shards.mjs can split CI's browser tests into shards of equal run
 * time. `make e2e-timings` runs the suite and then this script.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { timingsFromReport } from "./e2e-shards.mjs";

const [reportPath] = process.argv.slice(2);
if (!reportPath) {
  console.error("Usage: node scripts/e2e-timings.mjs <playwright-json-report>");
  process.exit(1);
}
const timings = timingsFromReport(JSON.parse(readFileSync(reportPath, "utf8")));
const sorted = Object.fromEntries(
  Object.keys(timings)
    .sort()
    .map((project) => [
      project,
      Object.fromEntries(Object.entries(timings[project]).sort(([a], [b]) => a.localeCompare(b))),
    ]),
);
writeFileSync("e2e/shard-timings.json", `${JSON.stringify(sorted, null, 2)}\n`);
console.log(`Wrote e2e/shard-timings.json for ${Object.keys(sorted).join(", ")}.`);
