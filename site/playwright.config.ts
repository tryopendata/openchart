import { readdirSync, readFileSync } from "node:fs";
import { defineConfig, devices, type Project } from "@playwright/test";
import { parseShard, shardFiles } from "./scripts/e2e-shards.mjs";

const port = Number(process.env.PORT_E2E ?? 4322);
const baseURL = `http://127.0.0.1:${port}`;
const testDir = "./e2e";

const projects: Project[] = [
  { name: "desktop", use: { browserName: "chromium", viewport: { width: 1280, height: 800 } } },
  { name: "mobile", use: { ...devices["Pixel 7"], browserName: "chromium" } },
];

/**
 * E2E_SHARD ("2/4") runs one CI shard: each project keeps only the spec files
 * scripts/e2e-shards.mjs assigns to that shard by recorded run time.
 */
function shardProjects(value: string | undefined): Project[] {
  if (!value) return projects;
  const files = readdirSync(testDir).filter((file) => file.endsWith(".spec.ts"));
  const timings = JSON.parse(readFileSync(`${testDir}/shard-timings.json`, "utf8"));
  const assigned = shardFiles({
    projects: projects.map((project) => project.name ?? ""),
    files,
    timings,
    shard: parseShard(value),
  });
  return projects
    .map((project) => ({
      ...project,
      testMatch: (assigned.get(project.name ?? "") ?? []).map((file) => `**/${file}`),
    }))
    .filter((project) => project.testMatch.length > 0);
}

export default defineConfig({
  testDir,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  use: { baseURL, trace: "retain-on-failure" },
  projects: shardProjects(process.env.E2E_SHARD),
  webServer: {
    // scripts/e2e.mjs builds first when dist/ is missing; this serves it the way a static host does.
    command: `bunx --no-install astro preview --host 127.0.0.1 --port ${port} --ignore-lock`,
    url: baseURL,
    reuseExistingServer: false,
  },
});
