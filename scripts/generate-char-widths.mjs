#!/usr/bin/env node
/**
 * Measure per-character advance widths for Inter at weights 400 and 700.
 * Outputs a TypeScript snippet to stdout for pasting into text-measure.ts.
 *
 * Usage: npx playwright install chromium && node scripts/generate-char-widths.mjs
 */

import { chromium } from '@playwright/test';

const WEIGHTS = [400, 700];
const EXTRAS = '₹ ₩ ¥ ￥ € £ ¢ § © ® ™ ° – — ‘ ’ “ ” … ± × ÷'.split(' ');

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  </style>
</head>
<body>
  <canvas id="c" width="2000" height="200"></canvas>
  <script>
    async function measure() {
      await document.fonts.ready;
      const canvas = document.getElementById('c');
      const ctx = canvas.getContext('2d');
      const results = {};

      for (const weight of [400, 700]) {
        ctx.font = weight + ' 100px Inter, sans-serif';
        const table = {};
        // ASCII 32-126
        for (let code = 32; code <= 126; code++) {
          const ch = String.fromCharCode(code);
          const w = ctx.measureText(ch).width / 100;
          table[ch] = Math.round(w * 1000) / 1000;
        }
        // Extra characters
        const extras = ${JSON.stringify(EXTRAS)};
        for (const ch of extras) {
          const w = ctx.measureText(ch).width / 100;
          table[ch] = Math.round(w * 1000) / 1000;
        }
        // Average across ASCII 33-126 (skip space)
        let sum = 0;
        let count = 0;
        for (let code = 33; code <= 126; code++) {
          sum += table[String.fromCharCode(code)];
          count++;
        }
        results[weight] = { table, avg: Math.round((sum / count) * 1000) / 1000 };
      }
      return results;
    }
    window.__measureResult = measure();
  </script>
</body>
</html>`;

  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__measureResult);
  const results = await page.evaluate(() => window.__measureResult);

  await browser.close();

  // Output TypeScript snippet
  for (const weight of WEIGHTS) {
    const { table, avg } = results[weight];
    const entries = Object.entries(table)
      .map(([ch, w]) => {
        const escaped = ch === "'" ? "\\'" : ch === '\\' ? '\\\\' : ch;
        return `  '${escaped}': ${w}`;
      })
      .join(',\n');
    console.log(`const CHAR_WIDTHS_${weight}: Record<string, number> = {`);
    console.log(entries);
    console.log(`};\n`);
    console.log(`const AVG_CHAR_WIDTH_${weight} = ${avg};\n`);
  }

  // Print sanity check
  const t400 = results[400].table;
  console.log('// Sanity check (weight 400):');
  console.log(`//   i: ${t400['i']}, W: ${t400['W']}, 0: ${t400['0']}, space: ${t400[' ']}`);
  console.log(`//   avg 400: ${results[400].avg}, avg 700: ${results[700].avg}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
