/**
 * Tests the browser-test shard split in site/scripts/e2e-shards.mjs: shards are
 * balanced by recorded run time, every (project, spec file) pair lands in
 * exactly one shard, and bad E2E_SHARD values fail loudly.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  packShards,
  parseShard,
  shardFiles,
  timingsFromReport,
} from "../../site/scripts/e2e-shards.mjs";

describe("parseShard", () => {
  test("reads a 1-based index and total", () => {
    assert.deepEqual(parseShard("2/4"), { index: 2, total: 4 });
  });

  for (const bad of ["0/4", "5/4", "2", "a/b", "2/0", ""]) {
    test(`rejects "${bad}"`, () => {
      assert.throws(() => parseShard(bad), /E2E_SHARD must look like "2\/4"/);
    });
  }
});

describe("packShards", () => {
  test("balances by time, not count", () => {
    const units = [
      { project: "p", file: "slow.spec.ts", seconds: 100 },
      ...Array.from({ length: 10 }, (_, i) => ({ project: "p", file: `quick-${i}.spec.ts`, seconds: 10 })),
    ];
    const shards = packShards(units, 2);
    assert.deepEqual(
      shards.map((shard) => shard.seconds),
      [100, 100],
    );
    assert.deepEqual(
      shards[0].units.map((unit) => unit.file),
      ["slow.spec.ts"],
    );
  });
});

describe("shardFiles", () => {
  const projects = ["desktop", "mobile"];
  const files = ["a.spec.ts", "b.spec.ts", "c.spec.ts", "new.spec.ts"];
  const timings = {
    desktop: { "a.spec.ts": 50, "b.spec.ts": 20, "c.spec.ts": 10 },
    mobile: { "a.spec.ts": 40, "b.spec.ts": 30, "c.spec.ts": 10 },
  };

  test("every project and file runs in exactly one shard, a new file included", () => {
    const total = 3;
    const seen = [];
    for (let index = 1; index <= total; index++) {
      for (const [project, assigned] of shardFiles({ projects, files, timings, shard: { index, total } })) {
        for (const file of assigned) seen.push(`${project}:${file}`);
      }
    }
    assert.deepEqual(seen.sort(), projects.flatMap((p) => files.map((f) => `${p}:${f}`)).sort());
  });

  test("gives the same split on every call", () => {
    const shard = { index: 2, total: 3 };
    assert.deepEqual(
      shardFiles({ projects, files, timings, shard }),
      shardFiles({ projects, files, timings, shard }),
    );
  });
});

describe("timingsFromReport", () => {
  test("sums retries and nested suites per project and file", () => {
    const report = {
      suites: [
        {
          file: "a.spec.ts",
          specs: [
            {
              tests: [
                { projectName: "desktop", results: [{ duration: 1000 }, { duration: 500 }] },
                { projectName: "mobile", results: [{ duration: 250 }] },
              ],
            },
          ],
          suites: [{ specs: [{ tests: [{ projectName: "desktop", results: [{ duration: 2000 }] }] }] }],
        },
      ],
    };
    assert.deepEqual(timingsFromReport(report), {
      desktop: { "a.spec.ts": 3.5 },
      mobile: { "a.spec.ts": 0.3 },
    });
  });
});
