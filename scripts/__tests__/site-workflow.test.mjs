/**
 * Guards the Site workflow (.github/workflows/site.yml) and the site Makefile's
 * deploy targets against changes that would leak secrets, run untrusted input in
 * a shell, deploy from the wrong branch or skip the checks. Reads the workflow as
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

const DEPLOY_JOBS = ["deploy-production", "deploy-preview"];
const WRANGLER_DEPLOY = "bunx --no-install wrangler pages deploy";
const jobs = Object.entries(workflow.jobs ?? {});
const steps = jobs.flatMap(([id, job]) => (job.steps ?? []).map((step) => ({ job: id, step })));

/** The exact `if:` each deploy job must carry, with whitespace collapsed. */
const EXPECTED_CONDITIONS = {
  "deploy-production": [
    "vars.SITE_DEPLOY_ENABLED == 'true' &&",
    "(github.event_name == 'push' || github.event_name == 'workflow_dispatch') &&",
    "github.ref == format('refs/heads/{0}', github.event.repository.default_branch)",
  ].join(" "),
  "deploy-preview": [
    "vars.SITE_DEPLOY_ENABLED == 'true' &&",
    "github.event_name == 'pull_request' &&",
    "github.event.pull_request.head.repo.full_name == github.repository &&",
    "github.head_ref != github.event.repository.default_branch",
  ].join(" "),
};

/** The job's `if:` condition with whitespace collapsed, so line breaks don't matter. */
function condition(jobId) {
  return String(workflow.jobs[jobId]?.if ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/** True for the one step allowed to hold the Cloudflare secrets: the wrangler upload. */
function isWranglerDeploy(step) {
  return typeof step.run === "string" && step.run.startsWith(WRANGLER_DEPLOY);
}

/**
 * The job with the wrangler deploy step's `env` removed, so whatever still
 * mentions `secrets.` sits somewhere secrets must not be.
 */
function withoutDeployEnv(job) {
  const deploySteps = (job.steps ?? []).map((step) => {
    if (!isWranglerDeploy(step)) return step;
    const { env: _env, ...rest } = step;
    return rest;
  });
  return { ...job, steps: deploySteps };
}

describe("site workflow", () => {
  test("both deploy jobs wait for the checks job", () => {
    for (const id of DEPLOY_JOBS) {
      const needs = [workflow.jobs[id]?.needs].flat();
      assert.ok(needs.includes("checks"), `${id} must have needs: checks, got ${needs}`);
    }
  });

  test("each deploy job runs only under its exact condition", () => {
    for (const id of DEPLOY_JOBS) {
      assert.equal(condition(id), EXPECTED_CONDITIONS[id], `${id} has a changed if:`);
    }
  });

  test("runs are serialized per ref and main never cancels", () => {
    assert.deepEqual(workflow.concurrency, {
      group: "${{ github.workflow }}-${{ github.ref }}",
      "cancel-in-progress": "${{ github.ref != 'refs/heads/main' }}",
    });
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

  test("secrets reach only the env of each deploy job's wrangler upload", () => {
    const { jobs: _jobs, ...topLevel } = workflow;
    const scrubbed = [
      ["top level", topLevel],
      ...jobs.map(([id, job]) => [id, DEPLOY_JOBS.includes(id) ? withoutDeployEnv(job) : job]),
    ];
    const leaks = scrubbed.filter(([, value]) => JSON.stringify(value).includes("secrets."));
    assert.deepEqual(
      leaks.map(([id]) => id),
      [],
    );

    for (const id of DEPLOY_JOBS) {
      const uploads = (workflow.jobs[id]?.steps ?? []).filter(isWranglerDeploy);
      assert.equal(uploads.length, 1, `${id} must have one step running ${WRANGLER_DEPLOY}`);
      assert.deepEqual(
        Object.keys(uploads[0].env ?? {}).filter((name) => name.startsWith("CLOUDFLARE_")),
        ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"],
        id,
      );
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
