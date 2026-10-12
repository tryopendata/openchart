import { expect, test, type Page } from '@playwright/test';

async function openInspector(page: Page) {
  const edit = page.getByRole('button', { name: 'Edit', exact: true });
  if (await edit.isVisible()) await edit.click();
  return page
    .getByRole('dialog', { name: 'Refine your visualization' })
    .or(page.locator('.studio-inspector:visible'));
}

async function closeSheet(page: Page) {
  const sheet = page.getByRole('dialog');
  if (await sheet.isVisible()) await sheet.getByRole('button', { name: /^Close / }).click();
}

async function choosePattern(page: Page, name: string) {
  const patterns = page.getByRole('button', { name: 'Patterns', exact: true });
  if (await patterns.isVisible()) await patterns.click();
  await page
    .getByRole('button', { name: new RegExp(name) })
    .filter({ visible: true })
    .click();
}

test.beforeEach(async ({ page }, info) => {
  if (info.project.metadata.cpuThrottle) {
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Import data' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
});

test('all eight compositions render within the viewport and keep stable height', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const patterns = [
    'Change over time',
    'A clear comparison',
    'Parts of the whole',
    'Spread & outliers',
    'Before & after',
    'A geographic lens',
    'The details matter',
    'Build a narrative',
  ];
  for (const [index, name] of patterns.entries()) {
    await choosePattern(page, name);
    const paper = page.locator('.studio-paper');
    await expect(paper).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect
      .poll(async () => paper.evaluate((el) => el.getBoundingClientRect().height))
      .toBeGreaterThan(200);
    // The renderer removes its entrance state after the finite settling window.
    // Do not await every document Animation.finished: Chromium can suspend those
    // promises for sparklines inside closed mobile-table details.
    await expect(paper.locator('.oc-animate')).toHaveCount(0);
    await page.evaluate(async () => {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    });
    const height = await paper.evaluate((el) => el.getBoundingClientRect().height);
    expect(height).toBeLessThan(1800);
    await page.evaluate(async () => {
      for (let i = 0; i < 8; i++)
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });
    expect(
      Math.abs((await paper.evaluate((el) => el.getBoundingClientRect().height)) - height),
    ).toBeLessThan(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
    if (index === 2)
      await expect(paper.locator('svg text').filter({ hasText: /^2022$/ })).toBeVisible();
    if (index === 5) await expect(paper.locator('.oc-map-feature').first()).toBeVisible();
    if (index === 0)
      await expect(paper.locator('svg text').filter({ hasText: /^2024$/ })).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`composition-${index + 1}.png`),
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});

test('imports, corrects data, recommends a chart, edits, undoes, reloads, and exports without JSON', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Import data' }).click();
  await page
    .getByLabel('Or paste data')
    .fill('country,value,code\nJapan,84.7,001\nBrazil,75.8,002');
  await page.getByRole('button', { name: 'Preview your data' }).click();
  await expect(page.getByLabel('code, row 1')).toHaveValue('001');
  await page.getByLabel('Type of value').selectOption('text');
  await expect(page.getByLabel('Type of value')).toHaveValue('text');
  await page.getByLabel('Type of value').selectOption('number');
  await page.getByLabel('value, row 1').fill('85.1');
  await page.getByLabel('value, row 1').press('Tab');
  await expect(page.getByLabel('value, row 1')).toHaveValue('85.1');
  const inspector = await openInspector(page);
  await inspector.getByRole('tab', { name: 'Suggest' }).click();
  await inspector
    .getByRole('combobox', { name: 'Categories', exact: true })
    .selectOption('country');
  await inspector.getByRole('combobox', { name: 'Measure', exact: true }).selectOption('value');
  await inspector
    .getByRole('article')
    .filter({ hasText: 'Compare on a shared baseline' })
    .getByRole('button', { name: 'Use this composition' })
    .click();
  await inspector.getByRole('tab', { name: 'Design', exact: true }).click();
  await inspector
    .getByRole('textbox', { name: 'Headline', exact: true })
    .fill('A considered comparison');
  await inspector.getByRole('textbox', { name: 'Headline', exact: true }).press('Tab');
  await closeSheet(page);
  await page.getByRole('button', { name: 'Canvas', exact: true }).click();
  await expect(page.locator('.studio-paper')).toContainText('A considered comparison');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.studio-paper')).toContainText('What does your data show?');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.getByText('Saved in this browser', { exact: true })).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.studio-paper')).toContainText('A considered comparison');
  await page.getByLabel('Export format').selectOption('svg');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export ↗', exact: true }).click();
  const exported = await download;
  expect(await exported.failure()).toBeNull();
  const stream = await exported.createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const svg = Buffer.concat(chunks).toString();
  expect(svg).toContain('A considered comparison');
  expect(svg).toContain('85.1');
  expect(svg).not.toContain('NaN');
});

test('invalid imports are actionable and do not replace the current document', async ({ page }) => {
  await page.getByRole('button', { name: 'Import data' }).click();
  await page.getByLabel('Or paste data').fill('value,value\n10,20');
  await page.getByRole('button', { name: 'Preview your data' }).click();
  await expect(page.getByRole('alert')).toContainText('unique');
  await closeSheet(page);
  await expect(page.locator('.studio-paper')).toContainText('Amazon pulls away');
});

test('keyboard inspection pins exact source values and Escape dismisses them', async ({ page }) => {
  const chart = page.locator('.studio-chart');
  await chart.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  const details = page.getByRole('region', { name: 'Observation details' });
  await expect(details).toContainText('Pinned evidence');
  await expect(details).toContainText('280');
  await expect(details).toContainText('Amazon');
  await page.keyboard.press('Escape');
  await expect(details).toContainText('Inspect the evidence');
});

test('reduced motion and resize round trips preserve the terminal chart', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: /Replay/ }).click();
  const svg = page.locator('.studio-paper svg.oc-chart');
  const before = await svg.getAttribute('viewBox');
  await page.getByLabel('Preview width').selectOption('320');
  await expect.poll(() => svg.getAttribute('viewBox')).not.toBeNull();
  await page.getByLabel('Preview width').selectOption('768');
  await expect(svg).toHaveAttribute('viewBox', before!);
  await expect(page.locator('.studio-paper svg text').filter({ hasText: /^2024$/ })).toBeVisible();
});

test('mobile inspector choices survive dismissal and data-view exports retain preview geometry', async ({
  page,
}) => {
  let inspector = await openInspector(page);
  await inspector.getByRole('tab', { name: 'Suggest' }).click();
  await inspector
    .getByRole('combobox', { name: 'What do you want to show?' })
    .selectOption('change');
  await inspector.getByRole('combobox', { name: 'Date', exact: true }).selectOption('year');
  await closeSheet(page);
  inspector = await openInspector(page);
  await expect(inspector.getByRole('combobox', { name: 'Date', exact: true })).toHaveValue('year');
  await closeSheet(page);
  const svg = page.locator('.studio-paper svg.oc-chart');
  const width = (await svg.getAttribute('viewBox'))!.split(' ')[2];
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByLabel('revenue, row 1', { exact: true }).fill('281');
  await page.getByLabel('revenue, row 1', { exact: true }).press('Tab');
  await expect.poll(async () => (await svg.getAttribute('viewBox'))!.split(' ')[2]).toBe(width);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export ↗', exact: true }).click();
  const stream = await (await download).createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  expect(Buffer.concat(chunks).toString()).toContain(`viewBox="0 0 ${width} `);
  await page.getByRole('button', { name: 'Canvas', exact: true }).click();
  const slider = page.getByRole('slider', { name: 'Preview through year' });
  await slider.fill('2');
  await page.getByLabel('Export format').selectOption('csv');
  const csvDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export ↗', exact: true }).click();
  const csvStream = await (await csvDownload).createReadStream();
  const csvChunks = [];
  for await (const chunk of csvStream!) csvChunks.push(chunk);
  const csv = Buffer.concat(csvChunks).toString();
  expect(csv).toContain('2024-01-01');
  expect(csv.trim().split('\n')).toHaveLength(31);
  await slider.fill('5');
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await expect(page.getByLabel('revenue, row 1', { exact: true })).toHaveValue('281');
});

test('table pins never display stale evidence after corrections or imports', async ({ page }) => {
  await choosePattern(page, 'The details matter');
  const paper = page.locator('.studio-paper');
  await expect(paper.locator('table')).toBeVisible();
  await expect(paper.locator('.oc-animate')).toHaveCount(0);
  const more = page.locator('.studio-paper summary').first();
  if (page.viewportSize()!.width < 600) {
    await expect(more).toBeVisible();
    // Resize can rebuild priority details. Measure both boxes atomically and
    // retry missing controls rather than dereferencing a detached element.
    await expect
      .poll(() =>
        paper.evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          const control = element.querySelector('summary')?.getBoundingClientRect();
          return !!control && control.width > 0 && control.right <= bounds.right;
        }),
      )
      .toBe(true);
    await more.click();
    await expect(page.locator('.studio-paper details[open]')).toContainText('Company');
    await more.click();
  }
  await page.locator('.studio-paper').getByText('MSFT', { exact: true }).first().click();
  await expect(page.getByRole('region', { name: 'Observation details' })).toContainText(
    'Pinned evidence',
  );
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByLabel('price, row 2', { exact: true }).fill('1');
  await page.getByLabel('price, row 2', { exact: true }).press('Tab');
  await page.getByRole('button', { name: 'Canvas', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Observation details' })).not.toContainText(
    '378.91',
  );
  await expect(page.getByRole('region', { name: 'Observation details' })).toContainText(
    'Inspect the evidence',
  );
  await page.locator('.studio-paper').getByText('MSFT', { exact: true }).first().click();
  await expect(page.getByRole('region', { name: 'Observation details' })).toContainText(
    'Pinned evidence',
  );
  await page.getByRole('button', { name: 'Import data' }).click();
  await page.getByLabel('Or paste data').fill('name,value\nNew row,7');
  await page.getByRole('button', { name: 'Preview your data' }).click();
  await page.getByRole('button', { name: 'Canvas', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Observation details' })).not.toContainText('MSFT');
});

test('malformed chrome imports and saved drafts are recoverable', async ({ page }) => {
  const malformed = JSON.stringify({
    mark: 'bar',
    data: [{ name: 'A', value: 1 }],
    encoding: {
      x: { field: 'name', type: 'nominal' },
      y: { field: 'value', type: 'quantitative' },
    },
    chrome: { title: { text: { bad: true } } },
  });
  await page.getByRole('button', { name: 'Import data' }).click();
  await page.getByLabel('Or paste data').fill(malformed);
  await page.getByRole('button', { name: 'Preview your data' }).click();
  await expect(page.getByRole('alert')).toContainText('string text');
  await closeSheet(page);
  await expect(page.locator('.studio-paper')).toContainText('Amazon pulls away');
  await page.evaluate((raw) => localStorage.setItem('openchart.studio.draft.v1', raw), malformed);
  await page.reload();
  await expect(
    page.getByText('The saved draft could not be opened.', { exact: false }),
  ).toBeVisible();
  await expect(page.locator('.studio-paper')).toContainText('Amazon pulls away');
  expect(await page.evaluate(() => localStorage.getItem('openchart.studio.draft.v1'))).toBe(
    malformed,
  );
  await page.getByRole('button', { name: 'Import data' }).click();
  await page.getByLabel('Or paste data').fill('name,value\nRecovered,1');
  await page.getByRole('button', { name: 'Preview your data' }).click();
  await expect(page.getByLabel('name, row 1', { exact: true })).toHaveValue('Recovered');
});

test('map PNG exports preserve the authored background and meaningful country details', async ({
  page,
}) => {
  await choosePattern(page, 'A geographic lens');
  await page
    .getByRole('listitem', { name: 'United States of America: $80,035', exact: true })
    .click();
  const details = page.getByRole('region', { name: 'Observation details' });
  await expect(details).toContainText('United States of America');
  await expect(details).toContainText('GDP per capita (USD)');
  await page.getByLabel('Export format').selectOption('png');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export ↗', exact: true }).click();
  const stream = await (await download).createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const pixel = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    return Array.from(context.getImageData(1, 1, 1, 1).data);
  }, Buffer.concat(chunks).toString('base64'));
  expect(pixel).toEqual([255, 255, 255, 255]);
});
