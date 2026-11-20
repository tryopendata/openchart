/**
 * Guards the Site workflow (.github/workflows/site.yml), the site Makefile's
 * manual deploy targets and the build command documented in site/AGENTS.md.
 * Cloudflare's Git integration deploys the site, so the workflow only checks:
 * it must hold no secrets and no deploy step. Reads the workflow and the doc as
 * committed and dry-runs the Makefile with `make -n`, which prints recipes
 * without running them; nothing here contacts GitHub or Cloudflare.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const workflowPath = ".github/workflows/site.yml";
const workflow = parse(readFileSync(join(root, workflowPath), "utf8"));

const WRANGLER_DEPLOY = "bunx --no-install wrangler pages deploy";
const jobs = Object.entries(workflow.jobs ?? {});
const steps = jobs.flatMap(([id, job]) => (job.steps ?? []).map((step) => ({ job: id, step })));

/**
 * The build command the Deploy section of site/AGENTS.md documents for the
 * Pages project: the first code span on the "Build command:" line.
 */
function documentedBuildCommand() {
  const doc = readFileSync(join(root, "site", "AGENTS.md"), "utf8");
  const deploy = doc.slice(doc.indexOf("\n## Deploy\n"));
  const line = deploy.split("\n").find((l) => l.startsWith("- Build command:"));
  assert.ok(line, "site/AGENTS.md Deploy section has no '- Build command:' line");
  const command = /`([^`]+)`/.exec(line)?.[1];
  assert.ok(command, `no code span on the build command line: ${line}`);
  return command;
}

describe("site workflow", () => {
  test("the workflow only checks: no secrets and no wrangler deploy", () => {
    assert.ok(!readFileSync(join(root, workflowPath), "utf8").includes("secrets."), "secrets. must not appear");
    const deploys = steps.filter(({ step }) => typeof step.run === "string" && step.run.includes("wrangler pages deploy"));
    assert.deepEqual(
      deploys.map(({ job, step }) => `${job}: ${step.name ?? step.run}`),
      [],
    );
    assert.deepEqual(Object.keys(workflow.jobs), ["checks"]);
  });

  test("runs are serialized per ref and main never cancels", () => {
    assert.deepEqual(workflow.concurrency, {
      group: "${{ github.workflow }}-${{ github.ref }}",
      "cancel-in-progress": "${{ github.ref != 'refs/heads/main' }}",
    });
  });

  test("runs on the paths the site is built from", () => {
    const expected = [
      "site/**",
      "docs/**",
      "packages/**",
      "examples/src/data/**",
      "bun.lock",
      "package.json",
      "bunfig.toml",
      ".github/workflows/site.yml",
      ".github/actions/setup-bun/**",
    ];
    assert.deepEqual(workflow.on.push.paths, expected);
    assert.deepEqual(workflow.on.pull_request.paths, expected);
  });

  test("no run script contains an expression", () => {
    const offenders = steps.filter(({ step }) => typeof step.run === "string" && step.run.includes("${{"));
    assert.deepEqual(
      offenders.map(({ job, step }) => `${job}: ${step.name ?? step.run}`),
      [],
      "pass values to run scripts through env, not ${{ }} expressions",
    );
  });

  test("every third-party action is pinned to a full commit SHA", () => {
    const unpinned = steps
      .map(({ step }) => step.uses)
      .filter((uses) => typeof uses === "string" && !uses.startsWith("./"))
      .filter((uses) => !/^[^@\s]+@[0-9a-f]{40}$/.test(uses));
    assert.deepEqual(unpinned, []);
  });

  test("permissions start empty and nothing is granted write access", () => {
    assert.deepEqual(workflow.permissions, {});
    const writes = jobs.flatMap(([id, job]) => {
      if (job.permissions === undefined) return [];
      if (typeof job.permissions !== "object") return [`${id}: ${job.permissions}`];
      return Object.entries(job.permissions)
        .filter(([, level]) => level !== "read" && level !== "none")
        .map(([scope, level]) => `${id}: ${scope}: ${level}`);
    });
    assert.deepEqual(writes, []);
  });

  test("no trigger runs with secrets on code from a fork", () => {
    const triggers = Object.keys(workflow.on ?? {});
    assert.ok(triggers.length > 0, `${workflowPath} has no triggers`);
    for (const forbidden of ["workflow_run", "pull_request_target"]) {
      assert.ok(!triggers.includes(forbidden), `${forbidden} must not trigger the Site workflow`);
    }
  });

  test("release commits are not skipped", () => {
    const skipping = jobs.filter(([, job]) => String(job.if ?? "").includes("release:"));
    assert.deepEqual(
      skipping.map(([id]) => id),
      [],
    );
  });
});

describe("documented Pages build command", () => {
  test("runs the root install, the root library build and astro build in that order", () => {
    const parts = documentedBuildCommand()
      .split("&&")
      .map((part) => part.trim());
    assert.deepEqual(parts, [
      "cd ..",
      "bun install --frozen-lockfile",
      "bun run build",
      "cd site",
      "bunx astro build",
    ]);
  });
});

const CLOUDFLARE = { CLOUDFLARE_API_TOKEN: "dummy-token", CLOUDFLARE_ACCOUNT_ID: "dummy-account" };

/**
 * Dry-runs a site Makefile target. `-n` prints the recipe without running it
 * and `-o build` skips the build prerequisite; the environment holds only PATH
 * plus `env`, so a Cloudflare variable in the caller's shell can't leak in.
 */
function dryRun(args, env = {}) {
  const result = spawnSync("make", ["-C", join(root, "site"), "--no-print-directory", "-n", "-o", "build", ...args], {
    env: { PATH: process.env.PATH, ...env },
    encoding: "utf8",
  });
  if (result.error) throw new Error(`could not run make: ${result.error.message}`);
  return { status: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

describe("site Makefile deploy targets", () => {
  test("deploy stops and names CLOUDFLARE_API_TOKEN when no variable is set", () => {
    const { status, stdout, stderr } = dryRun(["deploy"]);
    assert.notEqual(status, 0);
    assert.equal(stdout, "");
    assert.match(stderr, /CLOUDFLARE_API_TOKEN is not set/);
  });

  test("deploy stops and names CLOUDFLARE_ACCOUNT_ID when only the token is set", () => {
    const { status, stdout, stderr } = dryRun(["deploy"], { CLOUDFLARE_API_TOKEN: "dummy-token" });
    assert.notEqual(status, 0);
    assert.equal(stdout, "");
    assert.match(stderr, /CLOUDFLARE_ACCOUNT_ID is not set/);
  });

  test("deploy-preview stops without BRANCH", () => {
    const { status, stdout, stderr } = dryRun(["deploy-preview"], CLOUDFLARE);
    assert.notEqual(status, 0);
    assert.equal(stdout, "");
    assert.match(stderr, /BRANCH is not set/);
  });

  test("deploy-preview refuses the production branch", () => {
    const { status, stdout, stderr } = dryRun(["deploy-preview", "BRANCH=main"], CLOUDFLARE);
    assert.notEqual(status, 0);
    assert.equal(stdout, "");
    assert.match(stderr, /BRANCH=main is the Pages production branch: use make deploy/);
  });

  test("deploy uploads to the production branch", () => {
    assert.deepEqual(dryRun(["deploy"], CLOUDFLARE), {
      status: 0,
      stdout: `${WRANGLER_DEPLOY} dist --project-name openchart --branch main`,
      stderr: "",
    });
  });

  test("deploy-preview uploads to the given branch", () => {
    assert.deepEqual(dryRun(["deploy-preview", "BRANCH=feat"], CLOUDFLARE), {
      status: 0,
      stdout: `${WRANGLER_DEPLOY} dist --project-name openchart --branch "feat"`,
      stderr: "",
    });
  });
});
