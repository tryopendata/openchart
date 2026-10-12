import type { TableLayout } from '@opendata-ai/openchart-core';

/** Keep identifying/priority columns comparable; reveal secondary evidence per row. */
export function applyPriorityTable(
  wrapper: HTMLElement,
  layout: TableLayout,
  enabled: boolean,
): void {
  wrapper.classList.toggle('oc-table--priority', enabled);
  for (const old of wrapper.querySelectorAll('.oc-table-details')) old.remove();
  const secondary = layout.columns.flatMap((column, index) => (column.priority > 1 ? [index] : []));
  const hidden = new Set(secondary);
  for (const row of wrapper.querySelectorAll('thead tr, tbody tr, tfoot tr')) {
    const cells = Array.from(row.children) as HTMLElement[];
    cells.forEach((cell, index) => {
      cell.hidden = enabled && hidden.has(index);
    });
    if (!enabled || !secondary.length) continue;
    const cell = document.createElement(row.parentElement?.tagName === 'THEAD' ? 'th' : 'td');
    cell.className = 'oc-table-details';
    if (cell.tagName === 'TH') {
      cell.textContent = 'Details';
      cell.setAttribute('scope', 'col');
    } else if (row.parentElement?.tagName === 'TBODY') {
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = 'More';
      summary.setAttribute('aria-label', `More details for ${cells[0]?.textContent ?? 'row'}`);
      details.appendChild(summary);
      const list = document.createElement('dl');
      for (const index of secondary) {
        const term = document.createElement('dt');
        term.textContent = layout.columns[index].label;
        const description = document.createElement('dd');
        // Clone cell content, not the td: table semantics stay valid.
        for (const child of Array.from(cells[index]?.childNodes ?? []))
          description.appendChild(child.cloneNode(true));
        list.append(term, description);
      }
      details.appendChild(list);
      details.addEventListener('click', (event) => event.stopPropagation());
      cell.appendChild(details);
    }
    row.appendChild(cell);
  }
}
