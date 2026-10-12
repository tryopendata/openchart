/** Run against an unmodified Ladle server before changing production rendering. */
import { chromium, webkit } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const base = process.env.OPENCHART_BASE_URL ?? 'http://localhost:6006';
const output = process.env.OPENCHART_BASELINE_DIR ?? 'design-baseline-artifacts';
const references = [
  ['ranking', 'showcase--showcase', 'full-chrome-bar'],
  ['line', 'showcase--showcase', 'multi-series-line'],
  ['composition', 'showcase--showcase', 'stacked-area'],
  ['distribution', 'charts--scatter-and-distribution', 'strip-plot'],
  ['change', 'charts--scatter-and-distribution', 'range-dumbbell'],
  ['map', 'showcase--showcase', 'world-choropleth'],
  ['table', 'showcase--showcase', 'data-table'],
  ['narrative', 'features--scrollytelling', 'narrative'],
];
await mkdir(output, { recursive: true });
const report = {
  timestamp: new Date().toISOString(),
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  host: { platform: os.platform(), release: os.release(), arch: os.arch(), cpu: os.cpus()[0]?.model, cores: os.cpus().length, memory: os.totalmem() },
  profiles: [],
  humanStudies: 'Not conducted. See docs/design-evolution.md for the protocol.',
};
for (const [name, engine, width, throttle] of [
  ['desktop-chromium', chromium, 1280, 1],
  ['mobile-chromium', chromium, 390, 4],
  ['mobile-webkit', webkit, 390, 1],
]) {
  const browser = await engine.launch();
  const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1, colorScheme: 'light', recordVideo: { dir: `${output}/${name}/video` } });
  const page = await context.newPage();
  if (throttle > 1) await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: throttle });
  const profile = { name, browser: browser.version(), width, throttle, captures: [] };
  try {
    for (const [id, story, anchor] of references) {
      await page.goto(`${base}/?story=${story}&mode=preview#${anchor}`);
      const target = page.locator(`#${anchor}`).first();
      await target.waitFor({ timeout: 60000 });
      await target.scrollIntoViewIfNeeded();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1800);
      await target.screenshot({ path: `${output}/${name}/${id}.png` });
      const bounds = await target.boundingBox();
      if (bounds) await page.mouse.move(bounds.x + bounds.width * 0.6, bounds.y + Math.min(bounds.height * 0.5, 400));
      await page.keyboard.press('Tab');
      await page.keyboard.press('ArrowRight');
      profile.captures.push({ id, story, anchor, bounds });
    }
  } finally {
    await context.close();
    await browser.close();
  }
  report.profiles.push(profile);
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
}
console.log(`Baseline recorded in ${output}`);
