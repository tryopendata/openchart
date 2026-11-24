/**
 * Splits the browser tests into CI shards of about equal run time.
 *
 * Playwright's own `--shard` splits by test count, and the landing and gallery
 * specs are slow enough that count-based shards differ by almost 3x. This packs
 * each (project, spec file) pair into the shard with the least time so far,
 * using the durations recorded in `e2e/shard-timings.json`. A spec with no
 * recorded time counts as the median, so a new spec still lands somewhere.
 * Refresh the timings with `make e2e-timings` when shards drift apart.
 */

/** Parses `E2E_SHARD` ("2/4") into a 1-based index and a total. */
export function parseShard(value) {
  const match = /^(\d+)\/(\d+)$/.exec(String(value).trim());
  const index = Number(match?.[1]);
  const total = Number(match?.[2]);
  if (!match || total < 1 || index < 1 || index > total) {
    throw new Error(`E2E_SHARD must look like "2/4" (1-based, at most the total); got "${value}".`);
  }
  return { index, total };
}

function median(values) {
  if (values.length === 0) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Packs units ({ project, file, seconds }) into `total` shards, longest first,
 * each into the shard with the least time so far. Ties keep a stable order, so
 * every runner computes the same split.
 */
export function packShards(units, total) {
  const shards = Array.from({ length: total }, () => ({ seconds: 0, units: [] }));
  const ordered = [...units].sort(
    (a, b) =>
      b.seconds - a.seconds || a.project.localeCompare(b.project) || a.file.localeCompare(b.file),
  );
  for (const unit of ordered) {
    const lightest = shards.reduce((min, shard) => (shard.seconds < min.seconds ? shard : min));
    lightest.seconds += unit.seconds;
    lightest.units.push(unit);
  }
  return shards;
}

/**
 * The spec files each project runs in one shard, as a Map from project name to
 * file names. `timings` maps project name to { file: seconds }.
 *
 * @param {{ projects: string[], files: string[], timings: Record<string, Record<string, number>>, shard: { index: number, total: number } }} input
 * @returns {Map<string, string[]>}
 */
export function shardFiles({ projects, files, timings, shard }) {
  const known = Object.values(timings).flatMap((byFile) => Object.values(byFile));
  const fallback = median(known);
  const units = projects.flatMap((project) =>
    files.map((file) => ({ project, file, seconds: timings[project]?.[file] ?? fallback })),
  );
  const selected = packShards(units, shard.total)[shard.index - 1].units;
  return new Map(
    projects.map((project) => [
      project,
      selected.filter((unit) => unit.project === project).map((unit) => unit.file),
    ]),
  );
}

/** Seconds per project and spec file from a Playwright JSON report, rounded to 0.1s. */
export function timingsFromReport(report) {
  const timings = {};
  const walk = (suite, file) => {
    const current = suite.file ?? file;
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests) {
        const seconds = test.results.reduce((sum, result) => sum + result.duration, 0) / 1000;
        if (!timings[test.projectName]) timings[test.projectName] = {};
        const byFile = timings[test.projectName];
        byFile[current] = (byFile[current] ?? 0) + seconds;
      }
    }
    for (const child of suite.suites ?? []) walk(child, current);
  };
  for (const suite of report.suites ?? []) walk(suite, suite.file);
  for (const byFile of Object.values(timings)) {
    for (const file of Object.keys(byFile)) byFile[file] = Math.round(byFile[file] * 10) / 10;
  }
  return timings;
}
