import type {
  RaceTableCell,
  RaceTableColumn,
  RaceTableGeometry,
  RaceTableStatic,
} from '@opendata-ai/openchart-core';
import type { RaceRendererFactory } from './renderers';

function cellElement<T extends 'th' | 'td'>(doc: Document, tag: T, column: RaceTableColumn) {
  const cell = doc.createElement(tag);
  cell.className = `oc-race-table-cell oc-race-table-${column}`;
  cell.setAttribute('role', tag === 'th' ? 'columnheader' : 'cell');
  return cell;
}

function createCell(doc: Document, column: RaceTableColumn, width: number) {
  const cell = cellElement(doc, 'td', column);
  const text = column === 'name' ? doc.createElement('span') : cell;
  let mark: HTMLElement | undefined;
  if (column === 'bar' || column === 'name') {
    mark = doc.createElement(column === 'bar' ? 'div' : 'span');
    mark.className = column === 'bar' ? 'oc-race-table-fill' : 'oc-race-table-chip';
    mark.setAttribute('aria-hidden', 'true');
    if (column === 'bar') mark.style.width = `${width}px`;
    cell.append(mark);
  }
  if (column === 'name') cell.append(text);
  const last: { text: string; color?: string; direction?: string; transform?: string } = {
    text: '',
  };
  return { cell, text, mark, width, last };
}

function drawCell(
  { cell, text, mark, width, last }: ReturnType<typeof createCell>,
  geometry: RaceTableCell,
) {
  if (mark && 'color' in geometry && last.color !== geometry.color) {
    mark.style.backgroundColor = geometry.color;
    last.color = geometry.color;
  }
  if (geometry.column === 'bar') {
    const transform = `translateX(${geometry.x}px) scaleX(${width > 0 ? geometry.width / width : 0})`;
    if (mark && last.transform !== transform) {
      mark.style.transform = transform;
      last.transform = transform;
    }
    return;
  }
  if (geometry.column === 'change' && last.direction !== geometry.direction) {
    cell.dataset.direction = geometry.direction;
    last.direction = geometry.direction;
  }
  if (last.text !== geometry.text) {
    text.textContent = geometry.text;
    last.text = geometry.text;
  }
}

function contentOffsets(
  rows: RaceTableGeometry['rows'],
  { rowHeight, fontSize }: RaceTableStatic,
  bodyHeight: number,
): Map<string, number> {
  const paintHeight = Math.max(0, rowHeight - 1);
  const textHeight = Math.min(paintHeight, fontSize * 1.2);
  const inset = (paintHeight - textHeight) / 2;
  const visible = rows
    .filter(({ opacity, atEdge }) => opacity > 0 && !atEdge)
    .sort((a, b) => (a.rank !== undefined && b.rank !== undefined ? a.rank - b.rank : a.y - b.y));
  const last = visible.length - 1;
  const edgeRoom = rows.some(({ atEdge }) => atEdge) ? rowHeight : 0;
  const bottom = Math.max(0, bodyHeight - edgeRoom - textHeight);
  const gap = Math.min(rowHeight, textHeight + 2, bottom / Math.max(1, last));
  const tops = visible.map(({ y }) => y + inset);

  // Pool neighbors that would cross in displayed value order. A fading row
  // takes more of the displacement, leaving room for it without jolting its peers.
  const blocks: Array<{ start: number; end: number; total: number; weight: number }> = [];
  for (const [index, row] of visible.entries()) {
    const block = {
      start: index,
      end: index,
      total: (tops[index] - index * gap) * row.opacity,
      weight: row.opacity,
    };
    let previous = blocks.at(-1);
    while (previous && previous.total / previous.weight > block.total / block.weight) {
      block.start = previous.start;
      block.total += previous.total;
      block.weight += previous.weight;
      blocks.pop();
      previous = blocks.at(-1);
    }
    blocks.push(block);
  }

  const offsets = new Map<string, number>();
  for (const block of blocks) {
    const base = Math.max(0, Math.min(bottom - last * gap, block.total / block.weight));
    for (let index = block.start; index <= block.end; index++) {
      const offset = base + index * gap - tops[index];
      if (Math.abs(offset) > 0.001) offsets.set(visible[index].key, offset);
    }
  }
  return offsets;
}

/** Appends an HTML table and reuses its keyed rows when the playhead moves. */
export const createRaceTableRenderer: RaceRendererFactory<'table'> = (host, stat) => {
  const doc = host.ownerDocument;
  const hostHeight = Number.parseFloat(host.style.height);
  const bodyHeight = Number.isFinite(hostHeight)
    ? Math.max(0, hostHeight - stat.headerHeight)
    : Infinity;
  const table = doc.createElement('table');
  table.className = 'oc-race-table-grid';
  table.setAttribute('role', 'table');
  table.style.fontSize = `${stat.fontSize}px`;
  table.style.setProperty(
    '--oc-race-table-columns',
    stat.columns.map(({ width }) => `${width}px`).join(' '),
  );

  const head = doc.createElement('thead');
  head.setAttribute('role', 'rowgroup');
  const header = doc.createElement('tr');
  header.setAttribute('role', 'row');
  header.style.height = `${stat.headerHeight}px`;
  for (const { column } of stat.columns) {
    const cell = cellElement(doc, 'th', column);
    cell.scope = 'col';
    cell.textContent = stat.labels[column];
    header.append(cell);
  }
  head.append(header);

  const body = doc.createElement('tbody');
  body.setAttribute('role', 'rowgroup');
  body.style.setProperty('--oc-race-table-row-height', `${stat.rowHeight}px`);
  table.append(head, body);
  host.append(table);

  function createRow() {
    const element = doc.createElement('tr');
    element.setAttribute('role', 'row');
    element.style.height = `${stat.rowHeight}px`;
    const cells = stat.columns.map(({ column, width }) => createCell(doc, column, width));
    element.append(...cells.map(({ cell }) => cell));
    const last: { y?: number; opacity?: number; contentOffset: number } = { contentOffset: 0 };
    return { element, cells, last };
  }

  const rows = new Map<string, ReturnType<typeof createRow>>();
  let destroyed = false;
  return {
    draw(geometry) {
      if (destroyed) return;
      const offsets = contentOffsets(geometry.rows, stat, bodyHeight);
      const active = new Set<string>();
      let next = body.firstElementChild;
      for (const row of geometry.rows) {
        const nodes = rows.get(row.key) ?? createRow();
        rows.set(row.key, nodes);
        active.add(row.key);
        if (nodes.element === next) next = next.nextElementSibling;
        else body.insertBefore(nodes.element, next);

        if (nodes.last.y !== row.y) {
          nodes.element.style.transform = `translateY(${row.y}px)`;
          nodes.last.y = row.y;
        }
        if (nodes.last.opacity !== row.opacity) {
          nodes.element.style.opacity = String(row.opacity);
          nodes.last.opacity = row.opacity;
        }
        const offset = offsets.get(row.key) ?? 0;
        if (nodes.last.contentOffset !== offset) {
          nodes.element.style.setProperty('--oc-race-table-content-offset', `${offset}px`);
          nodes.last.contentOffset = offset;
        }
        row.cells.forEach((cell, index) => {
          drawCell(nodes.cells[index], cell);
        });
      }
      for (const [key, { element }] of rows) {
        if (active.has(key)) continue;
        element.remove();
        rows.delete(key);
      }
    },
    destroy() {
      destroyed = true;
      rows.clear();
      table.remove();
    },
  };
};
