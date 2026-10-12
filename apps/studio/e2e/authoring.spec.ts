import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

async function inspector(page: Page) {
  const edit = page.getByRole('button', { name: 'Edit', exact: true });
  if (await edit.isVisible()) await edit.click();
  const panel = page
    .getByRole('dialog', { name: 'Refine your visualization' })
    .or(page.locator('.studio-inspector:visible'));
  await panel.getByRole('tab', { name: 'Design', exact: true }).click();
  return panel;
}
async function closeSheet(page: Page) {
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible()) await dialog.getByRole('button', { name: /^Close / }).click();
}
async function importData(page: Page, data: string) {
  await page.getByRole('button', { name: 'Import data' }).click();
  await page.getByLabel('Or paste data').fill(data);
  await page.getByLabel('Import action').selectOption('new');
  await page.getByRole('button', { name: 'Preview your data →' }).click();
}
async function projectBackup(page: Page) {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Studio project' }).click();
  return JSON.parse(await readFile((await (await download).path())!, 'utf8'));
}
test.beforeEach(async ({ page }, info) => {
  if (info.project.metadata.cpuThrottle) {
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  await page.goto('./');
});

test('summaries retain source data, export/reopen, and compose into an annotated chart', async ({
  page,
}, info) => {
  await importData(
    page,
    'region,year,value\nNorth,2024,10\nNorth,2025,\nSouth,2024,20\nSouth,2025,40',
  );
  await page.getByRole('combobox', { name: 'Summary', exact: true }).selectOption('mean');
  await page.getByLabel('Summarize field').selectOption('value');
  await page.getByRole('group', { name: 'Group by' }).getByLabel('region', { exact: true }).check();
  await page.getByRole('button', { name: 'Apply preparation' }).click();
  await page.getByRole('button', { name: 'Prepared data', exact: true }).click();
  await expect(page.locator('.studio-prepared-table tbody tr')).toHaveText(['North10', 'South30']);
  await page.getByRole('button', { name: 'JSON document' }).click();
  await page.getByRole('button', { name: 'Apply document' }).click();
  const backup = await projectBackup(page);
  expect(backup.source).toHaveLength(4);
  expect(backup.preparation.summary.op).toBe('mean');
  await importData(page, JSON.stringify(backup));
  await page.getByRole('button', { name: 'Prepared data', exact: true }).click();
  await expect(page.locator('.studio-prepared-table tbody tr')).toHaveText(['North10', 'South30']);
  const panel = await inspector(page);
  await panel.getByText('Change composition', { exact: true }).click();
  await panel.getByRole('combobox', { name: 'Composition', exact: true }).selectOption('bar');
  await panel.getByLabel('Horizontal field').selectOption('value');
  await panel.getByLabel('Vertical field').selectOption('region');
  await panel.getByRole('button', { name: 'Apply composition' }).click();
  await panel.getByText('Annotations & reference lines', { exact: true }).click();
  await panel.getByLabel('Reference axis').selectOption('x');
  await panel.getByLabel('X anchor').fill('20');
  await panel.getByLabel('Annotation text').fill('Target');
  await panel.getByRole('button', { name: 'Add annotation' }).click();
  await closeSheet(page);
  await page.getByRole('button', { name: 'Canvas', exact: true }).click();
  await expect(page.locator('.studio-paper')).toContainText('Target');
  const svg = page.waitForEvent('download');
  await page.getByLabel('Export format').selectOption('svg');
  await page.getByRole('button', { name: 'Export ↗' }).click();
  expect(await readFile((await (await svg).path())!, 'utf8')).toContain('Target');
  const final = await projectBackup(page);
  expect(final.source).toHaveLength(4);
  expect(final.spec.data.map((row: { value: number }) => row.value)).toEqual([10, 30]);
  await page.screenshot({ path: info.outputPath('authored-comparison.png'), fullPage: true });
});

test('replacement data can remap columns while retaining design and undoing the transaction', async ({
  page,
}) => {
  await importData(page, 'region,value\nA,10\nB,30');
  const panel = await inspector(page);
  await panel.getByRole('textbox', { name: 'Headline', exact: true }).fill('A reusable comparison');
  await panel.getByRole('textbox', { name: 'Headline', exact: true }).press('Tab');
  await closeSheet(page);
  await page.getByRole('button', { name: 'Import data' }).click();
  await page.getByLabel('Or paste data').fill('area,amount\nC,70\nD,90');
  await page.getByLabel('Import action').selectOption('replace');
  const mapping = page.getByRole('group', { name: 'Match replacement columns' });
  await mapping.getByRole('combobox', { name: 'region', exact: true }).selectOption('area');
  await mapping.getByRole('combobox', { name: 'value', exact: true }).selectOption('amount');
  await page.getByRole('button', { name: 'Preview your data →' }).click();
  await expect(page.getByLabel('region, row 1', { exact: true })).toHaveValue('C');
  let backup = await projectBackup(page);
  expect(backup.spec.chrome.title).toBe('A reusable comparison');
  expect(backup.spec.type).toBe('table');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByLabel('region, row 1', { exact: true })).toHaveValue('A');
  backup = await projectBackup(page);
  expect(backup.source.map((row: { value: number }) => row.value)).toEqual([10, 30]);
});

test('phone inspector preserves unfinished composition and annotation choices', async ({
  page,
}) => {
  let panel = await inspector(page);
  await panel.getByText('Change composition', { exact: true }).click();
  await panel.getByRole('combobox', { name: 'Composition', exact: true }).selectOption('point');
  await panel.getByLabel('Horizontal field').selectOption('revenue');
  await panel.getByText('Annotations & reference lines', { exact: true }).click();
  await panel.getByLabel('Y anchor').fill('300');
  await panel.getByLabel('Annotation text').fill('Unfinished annotation');
  await closeSheet(page);
  panel = await inspector(page);
  if (!(await panel.getByRole('combobox', { name: 'Composition', exact: true }).isVisible()))
    await panel.getByText('Change composition', { exact: true }).click();
  if (!(await panel.getByLabel('Annotation text').isVisible()))
    await panel.getByText('Annotations & reference lines', { exact: true }).click();
  await expect(panel.getByRole('combobox', { name: 'Composition', exact: true })).toHaveValue(
    'point',
  );
  await expect(panel.getByLabel('Horizontal field')).toHaveValue('revenue');
  await expect(panel.getByLabel('Y anchor')).toHaveValue('300');
  await expect(panel.getByLabel('Annotation text')).toHaveValue('Unfinished annotation');
  await closeSheet(page);
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByLabel('Filter field').selectOption('company');
  await importData(page, 'region,value\nNew,10');
  await expect(page.getByLabel('Filter field')).toHaveValue('');
});

test('prepared tables align sparse JSON rows and counts discard percentage formatting', async ({
  page,
}, info) => {
  await importData(
    page,
    JSON.stringify({
      type: 'table',
      data: [
        { name: 'A', value: 0.2 },
        { value: 0.3, name: 'A', note: 'estimate' },
        { name: 'B', note: 'missing' },
      ],
      fields: { value: { type: 'number', unit: '%', representation: 'proportion' } },
      columns: [{ key: 'name' }, { key: 'value', format: '.1%' }],
      pagination: true,
    }),
  );
  await page.getByRole('button', { name: 'Prepared data', exact: true }).click();
  await expect(page.locator('.studio-prepared-table thead')).toHaveText('namevaluenote');
  await expect(page.locator('.studio-prepared-table tbody tr')).toHaveText([
    'A0.2—',
    'A0.3estimate',
    'B—missing',
  ]);
  await page.getByRole('combobox', { name: 'Summary', exact: true }).selectOption('count');
  await page.getByRole('group', { name: 'Group by' }).getByLabel('name', { exact: true }).check();
  await page.getByRole('button', { name: 'Apply preparation' }).click();
  const panel = await inspector(page);
  await expect(panel.getByLabel('Rows per page')).toHaveValue('25');
  await expect(panel.getByLabel('Phone layout')).toHaveValue('cards');
  await closeSheet(page);
  await page.getByRole('button', { name: 'Canvas', exact: true }).click();
  await expect(page.locator('.studio-paper')).toContainText('Row count');
  await expect(page.locator('.studio-paper')).not.toContainText('%');
  await page.screenshot({ path: info.outputPath('count-table.png'), fullPage: true });
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByRole('button', { name: 'Restore all source rows' }).click();
  const backup = await projectBackup(page);
  expect(backup.spec.columns).toHaveLength(2);
  expect(backup.spec.columns[1].format).toBe('.1%');
});

test('map palette controls change actual fills and keep missing-data hatches valid during updates', async ({
  page,
}, info) => {
  const patterns = page.getByRole('button', { name: 'Patterns', exact: true });
  if (await patterns.isVisible()) await patterns.click();
  await page.getByRole('button', { name: /A geographic lens/ }).click();
  const country = page.locator('.oc-map-feature[data-feature-id="840"]');
  const before = await country.getAttribute('fill');
  const panel = await inspector(page);
  await panel.getByRole('combobox', { name: 'Map palette', exact: true }).selectOption('teal');
  await panel.getByRole('combobox', { name: 'Number format', exact: true }).selectOption('$,.0f');
  await closeSheet(page);
  const invalidPaint = await page.evaluate(async () => {
    const failures: string[] = [];
    for (let i = 0; i < 30; i++) {
      await new Promise(requestAnimationFrame);
      for (const mark of document.querySelectorAll('.oc-map-feature[data-nodata]')) {
        const fill = mark.getAttribute('fill') ?? '';
        const id = /^url\(#(.+)\)$/.exec(fill)?.[1];
        if (!id || !document.getElementById(id)) failures.push(fill);
      }
    }
    return failures;
  });
  expect(invalidPaint).toEqual([]);
  await expect(country).not.toHaveAttribute('fill', before!);
  const labels = await page
    .locator('.studio-paper svg text')
    .evaluateAll((nodes) =>
      nodes
        .filter((node) => /^\$[\d,]+$/.test(node.textContent ?? ''))
        .map((node) => ({
          text: node.textContent,
          left: node.getBoundingClientRect().left,
          right: node.getBoundingClientRect().right,
          top: node.getBoundingClientRect().top,
        })),
    );
  expect(labels.length).toBeGreaterThan(0);
  for (let i = 1; i < labels.length; i++)
    if (Math.abs(labels[i].top - labels[i - 1].top) < 1)
      expect(labels[i].left).toBeGreaterThan(labels[i - 1].right);
  await page.screenshot({ path: info.outputPath('authored-map.png'), fullPage: true });
});

test('table search keeps keyboard focus after filtering changes the preview height', async ({
  page,
}) => {
  const patterns = page.getByRole('button', { name: 'Patterns', exact: true });
  if (await patterns.isVisible()) await patterns.click();
  await page.getByRole('button', { name: /The details matter/ }).click();
  const search = page.getByRole('searchbox', { name: 'Search table' });
  await search.fill('MSFT');
  await expect(page.locator('.studio-paper tbody tr')).toHaveCount(1);
  // The table's ResizeObserver follows the debounced search render by 100 ms.
  await page.waitForTimeout(250);
  await expect(search).toBeFocused();
  await search.press('Backspace');
  await expect(search).toHaveValue('MSF');
});
