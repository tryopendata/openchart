import type { RaceTableCell, RaceTableColumn } from '@opendata-ai/openchart-core';
import type { RaceRendererFactory } from './renderers';

function textContent(element: HTMLElement, text: string) {
  if (element.textContent !== text) element.textContent = text;
}

function cellElement<T extends 'th' | 'td'>(doc: Document, tag: T, column: RaceTableColumn) {
  const cell = doc.createElement(tag);
  cell.className = `oc-race-table-cell oc-race-table-${column}`;
  cell.setAttribute('role', tag === 'th' ? 'columnheader' : 'cell');
  return cell;
}

function createCell(doc: Document, column: RaceTableColumn) {
  const cell = cellElement(doc, 'td', column);
  const text = column === 'name' ? doc.createElement('span') : cell;
  let mark: HTMLElement | undefined;
  if (column === 'bar' || column === 'name') {
    mark = doc.createElement(column === 'bar' ? 'div' : 'span');
    mark.className = column === 'bar' ? 'oc-race-table-fill' : 'oc-race-table-chip';
    mark.setAttribute('aria-hidden', 'true');
    cell.append(mark);
  }
  if (column === 'name') cell.append(text);
  return { cell, text, mark };
}

function drawCell({ cell, text, mark }: ReturnType<typeof createCell>, geometry: RaceTableCell) {
  if (geometry.column === 'bar' && mark) {
    mark.style.left = `${geometry.x}px`;
    mark.style.width = `${geometry.width}px`;
    mark.style.backgroundColor = geometry.color;
    return;
  }
  if (geometry.column === 'change') cell.dataset.direction = geometry.direction;
  if (geometry.column === 'name' && mark) mark.style.backgroundColor = geometry.color;
  if ('text' in geometry) textContent(text, geometry.text);
}

/** Appends an HTML table and reuses its keyed rows when the playhead moves. */
export const createRaceTableRenderer: RaceRendererFactory<'table'> = (host, stat) => {
  const doc = host.ownerDocument;
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
  table.append(head, body);
  host.append(table);

  function createRow() {
    const element = doc.createElement('tr');
    element.setAttribute('role', 'row');
    element.style.height = `${stat.rowHeight}px`;
    const cells = stat.columns.map(({ column }) => createCell(doc, column));
    element.append(...cells.map(({ cell }) => cell));
    return { element, cells };
  }

  const rows = new Map<string, ReturnType<typeof createRow>>();
  let destroyed = false;
  return {
    draw(geometry) {
      if (destroyed) return;
      const active = new Set<string>();
      let next = body.firstElementChild;
      for (const row of geometry.rows) {
        const nodes = rows.get(row.key) ?? createRow();
        rows.set(row.key, nodes);
        active.add(row.key);
        if (nodes.element === next) next = next.nextElementSibling;
        else body.insertBefore(nodes.element, next);

        nodes.element.style.transform = `translateY(${row.y}px)`;
        nodes.element.style.opacity = String(row.opacity);
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
