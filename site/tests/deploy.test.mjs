/**
 * Serves the built dist/ through `wrangler pages dev`, Cloudflare's local Pages
 * runtime, reading wrangler.jsonc the way a deploy does. Needs no account.
 * Run after `astro build` (make deploy-check).
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";

// The workspace hoists wrangler to the repository root, so resolve it.
const wrangler = join(
  dirname(createRequire(import.meta.url).resolve("wrangler/package.json")),
  "bin/wrangler.js",
);

let base = "";
let child;
let state = "";
let output = "";

async function freePort() {
  const socket = createServer().listen(0, "127.0.0.1");
  await once(socket, "listening");
  const { port } = socket.address();
  await new Promise((resolve) => socket.close(resolve));
  return port;
}

before(async () => {
  const port = await freePort();
  state = mkdtempSync(join(tmpdir(), "pages-dev-"));
  child = spawn(
    process.execPath,
    [
      wrangler,
      "pages",
      "dev",
      "--ip",
      "127.0.0.1",
      "--port",
      String(port),
      "--inspector-port",
      "0",
      "--persist-to",
      state,
    ],
    {
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, WRANGLER_SEND_METRICS: "false", BROWSER: "none" },
    },
  );
  const keep = (data) => {
    output = (output + data.toString()).slice(-16_000);
  };
  child.stdout.on("data", keep);
  child.stderr.on("data", keep);
  base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 60_000;
  for (;;) {
    if (child.exitCode !== null) {
      assert.fail(`wrangler pages dev exited:\n${output}`);
    }
    try {
      if ((await fetch(base, { signal: AbortSignal.timeout(1_000) })).ok) break;
    } catch {}
    if (Date.now() > deadline) {
      assert.fail(`wrangler pages dev never answered:\n${output}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
});

after(async () => {
  if (child?.exitCode === null && child.pid !== undefined) {
    const closed = once(child, "close");
    process.kill(-child.pid, "SIGTERM");
    const force = setTimeout(() => process.kill(-child.pid, "SIGKILL"), 5_000);
    await closed;
    clearTimeout(force);
  }
  if (state) rmSync(state, { recursive: true, force: true });
});

const get = (path) => fetch(new URL(path, base), { redirect: "manual" });

test("hashed assets are cached for a year as immutable", async () => {
  const asset = readdirSync("dist/_astro").find((name) => name.endsWith(".css"));
  assert.ok(asset, "astro build emitted no CSS under dist/_astro");
  const response = await get(`/_astro/${asset}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "public, max-age=31536000, immutable");
});

test("pages carry the security headers and a revalidating cache", async () => {
  const response = await get("/docs/");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(response.headers.get("cache-control") ?? "", /max-age=0/);
});

test("Pages gives each docs page one trailing-slash URL without redirect rules", async () => {
  for (const path of ["/docs", "/docs/index.html"]) {
    const response = await get(path);
    assert.equal(response.status, 308, path);
    assert.equal(response.headers.get("location"), "/docs/", path);
  }
});

test("Markdown exports and llms.txt are served as files", async () => {
  assert.equal((await get("/llms.txt")).status, 200);
  const exported = readdirSync("dist/docs", { recursive: true, encoding: "utf8" }).find((file) =>
    file.endsWith(".md"),
  );
  assert.ok(exported, "astro build emitted no Markdown export under dist/docs");
  assert.equal((await get(`/docs/${exported}`)).status, 200);
});

/** The rules in dist/_redirects: `[source, destination, status]` per non-comment line. */
function redirectRules() {
  return readFileSync("dist/_redirects", "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split(/\s+/));
}

test("each redirect rule answers 301 with its destination", async () => {
  const rules = redirectRules();
  assert.ok(rules.length > 0, "dist/_redirects holds no rules");
  for (const [source, destination, status] of rules) {
    const splat = "sample/page/";
    const response = await get(source.replace("*", splat));
    assert.equal(response.status, Number(status), source);
    assert.equal(response.headers.get("location"), destination.replace(":splat", splat), source);
  }
});

test("no redirect source is a built file, so no rule hides a page", () => {
  for (const [source] of redirectRules()) {
    const path = join("dist", source.replace(/\*$/, ""));
    assert.ok(!existsSync(path), `${source} is also built as ${path}; a rule would hide that page`);
  }
});

test("the RSS feed is served as XML", async () => {
  const response = await get("/blog/rss.xml");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/rss+xml; charset=utf-8");
  assert.match(await response.text(), /^<\?xml/);
});

test("the search index is served as JavaScript, and revalidates", async () => {
  const response = await get("/pagefind/pagefind.js");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /javascript/);
  assert.match(response.headers.get("cache-control") ?? "", /max-age=0/);
});

test("the examples and blog pages carry the security headers", async () => {
  for (const path of ["/examples/", "/blog/"]) {
    const response = await get(path);
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff", path);
    assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin", path);
    assert.equal(response.headers.get("x-frame-options"), "DENY", path);
  }
});

test("unknown paths get the built 404 page", async () => {
  const response = await get("/no-such-page/");
  assert.equal(response.status, 404);
  assert.match(await response.text(), /Page not found/);
});
