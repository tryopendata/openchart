/**
 * Guards the Site workflow (.github/workflows/site.yml) and the site Makefile's
 * deploy targets against changes that would leak secrets, run untrusted input in
 * a shell, deploy from the wrong branch or skip the checks. Reads both files as
 * they are committed; nothing here contacts GitHub or Cloudflare.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const workflowPath = ".github/workflows/site.yml";
const workflow = parse(readFileSync(join(root, workflowPath), "utf8"));
const makefile = readFileSync(join(root, "site/Makefile"), "utf8");

const DEPLOY_JOBS = ["deploy-production", "deploy-preview"];
const jobs = Object.entries(workflow.jobs ?? {});
const steps = jobs.flatMap(([id, job]) => (job.steps ?? []).map((step) => ({ job: id, step })));

/** The job's `if:` condition with whitespace collapsed, so line breaks don't matter. */
function condition(jobId) {
  return String(workflow.jobs[jobId]?.if ?? "").replace(/\s+/g, " ");
}

describe("site workflow", () => {
  test("both deploy jobs wait for the checks job", () => {
    for (const id of DEPLOY_JOBS) {
      const needs = [workflow.jobs[id]?.needs].flat();
      assert.ok(needs.includes("checks"), `${id} must have needs: checks, got ${needs}`);
    }
  });

  test("both deploy jobs stay off until SITE_DEPLOY_ENABLED is 'true'", () => {
    for (const id of DEPLOY_JOBS) {
      assert.match(condition(id), /vars\.SITE_DEPLOY_ENABLED == 'true'/, id);
    }
  });

  test("production deploys only from the default branch", () => {
    assert.match(
      condition("deploy-production"),
      /github\.ref == format\('refs\/heads\/\{0\}', github\.event\.repository\.default_branch\)/,
    );
    assert.doesNotMatch(condition("deploy-production"), /pull_request/);
  });

  test("previews deploy only for pull requests from this repository", () => {
    assert.match(
      condition("deploy-preview"),
      /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/,
    );
  });

  test("no run script interpolates pull request input", () => {
    const untrusted = [
      /\$\{\{\s*github\.head_ref/,
      /\$\{\{\s*github\.event\.pull_request\.title/,
      /\.head\.ref\s*\}\}/,
      /\$\{\{[^}]*github\.event\.pull_request\.head/,
    ];
    const offenders = steps.filter(
      ({ step }) => typeof step.run === "string" && untrusted.some((re) => re.test(step.run)),
    );
    assert.deepEqual(
      offenders.map(({ job, step }) => `${job}: ${step.name ?? step.run}`),
      [],
      "pass pull request values to run scripts through env, not ${{ }} expressions",
    );
  });

  test("every third-party action is pinned to a full commit SHA", () => {
    const unpinned = steps
      .map(({ step }) => step.uses)
      .filter((uses) => typeof uses === "string" && !uses.startsWith("./"))
      .filter((uses) => !/^[^@\s]+@[0-9a-f]{40}$/.test(uses));
    assert.deepEqual(unpinned, []);
  });

  test("permissions start empty and only deployments may be written", () => {
    assert.deepEqual(workflow.permissions, {});
    const grants = jobs.flatMap(([id, job]) => {
      if (job.permissions === undefined) return [];
      assert.equal(typeof job.permissions, "object", `${id} must list permissions by scope`);
      return Object.entries(job.permissions).map(([scope, level]) => ({ id, scope, level }));
    });
    const writes = grants.filter(({ scope, level }) => level === "write" && scope !== "deployments");
    assert.deepEqual(writes, []);
  });

  test("no trigger runs with secrets on code from a fork", () => {
    const triggers = Object.keys(workflow.on ?? {});
    assert.ok(triggers.length > 0, `${workflowPath} has no triggers`);
    for (const forbidden of ["workflow_run", "pull_request_target"]) {
      assert.ok(!triggers.includes(forbidden), `${forbidden} must not trigger the Site workflow`);
    }
  });

  test("Cloudflare secrets appear only in the deploy jobs", () => {
    const { jobs: _jobs, ...topLevel } = workflow;
    const withSecrets = [
      ["top level", topLevel],
      ...jobs.filter(([id]) => !DEPLOY_JOBS.includes(id)),
    ].filter(([, value]) => JSON.stringify(value).includes("secrets."));
    assert.deepEqual(
      withSecrets.map(([id]) => id),
      [],
    );
  });

  test("release commits are not skipped", () => {
    const skipping = jobs.filter(([, job]) => String(job.if ?? "").includes("release:"));
    assert.deepEqual(
      skipping.map(([id]) => id),
      [],
    );
  });
});

describe("site Makefile", () => {
  test("declares the deploy targets phony", () => {
    const phony = [...makefile.matchAll(/^\.PHONY:(.*)$/gm)].flatMap((m) => m[1].trim().split(/\s+/));
    for (const target of ["deploy-check", "deploy-preview", "deploy"]) {
      assert.ok(phony.includes(target), `.PHONY is missing ${target}`);
    }
  });
});
