import type { A11yMetadata, RaceFrame } from '@opendata-ai/openchart-core';
import { type RaceModel, raceA11y, raceA11yLeaders } from '@opendata-ai/openchart-engine';
import { applySrOnlyStyles } from '../dom-helpers';
import { pageIdScope } from '../svg-ids';
import type { RaceShell } from './shell';

type RaceA11y = { announce(frame: RaceFrame): void; destroy(): void };

const attachByA11y = new WeakMap<RaceA11y, (shell: RaceShell, model: RaceModel) => boolean>();

/** Move the existing accessibility nodes if the new view exposes the same name and metadata. */
export function moveRaceA11y(a11y: RaceA11y, shell: RaceShell, model: RaceModel): boolean {
  return attachByA11y.get(a11y)?.(shell, model) ?? false;
}

function raceName(model: RaceModel): string {
  return model.spec.chrome.title?.text?.trim() || 'Race chart';
}

function appendPeriodTable(wrapper: HTMLElement, name: string, metadata: A11yMetadata): void {
  const [headers, ...rows] = metadata.dataTableFallback;
  if (!headers) return;

  const table = wrapper.ownerDocument.createElement('table');
  table.setAttribute('aria-label', `Data table: ${name}`);
  if (metadata.totalRows !== undefined) {
    table.createCaption().textContent = `Showing ${rows.length} of ${metadata.totalRows} periods, evenly sampled across the race.`;
  }
  const heading = table.createTHead().insertRow();
  for (const label of headers) {
    const cell = wrapper.ownerDocument.createElement('th');
    cell.scope = 'col';
    cell.textContent = String(label);
    heading.append(cell);
  }
  const body = table.createTBody();
  for (const values of rows) {
    const row = body.insertRow();
    for (const value of values) row.insertCell().textContent = String(value);
  }
  wrapper.append(table);
}

/** Attach the race description, period table and polite live region. */
export function createRaceA11y(shell: RaceShell, model: RaceModel): RaceA11y {
  const metadata = raceA11y(model);
  const doc = shell.root.ownerDocument;
  const name = raceName(model);
  const wrapper = doc.createElement('div');
  wrapper.className = 'oc-sr-only';
  applySrOnlyStyles(wrapper);

  const description = doc.createElement('p');
  description.id = pageIdScope.next('oc-race-description');
  description.hidden = true;
  description.textContent = metadata.altText;
  wrapper.append(description);
  appendPeriodTable(wrapper, name, metadata);

  const live = doc.createElement('div');
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('aria-atomic', 'true');
  wrapper.append(live);

  let currentModel = model;
  let metadataSignature: string | undefined;
  let detachDescription: (() => void) | undefined;
  function attach({ root, svg }: RaceShell, nextModel: RaceModel): boolean {
    if (currentModel !== nextModel) {
      metadataSignature ??= JSON.stringify(metadata);
      if (
        raceName(nextModel) !== name ||
        JSON.stringify(raceA11y(nextModel)) !== metadataSignature
      ) {
        return false;
      }
      currentModel = nextModel;
    }
    if (metadata.hidden) return true;

    detachDescription?.();
    const label = svg.getAttribute('aria-label');
    const describedBy = svg.getAttribute('aria-describedby');
    svg.setAttribute('aria-label', name);
    svg.setAttribute('aria-describedby', [describedBy, description.id].filter(Boolean).join(' '));
    root.append(wrapper);
    detachDescription = () => {
      if (label === null) svg.removeAttribute('aria-label');
      else svg.setAttribute('aria-label', label);
      if (describedBy === null) svg.removeAttribute('aria-describedby');
      else svg.setAttribute('aria-describedby', describedBy);
    };
    return true;
  }

  const a11y: RaceA11y = {
    announce(frame) {
      if (!detachDescription) return;
      // Fades can leave an exact leader out of the visual frame's items.
      const leaders = raceA11yLeaders(currentModel, frame.t);
      const message = leaders.length
        ? `${leaders.join(', ')} ${leaders.length === 1 ? 'leads' : 'lead'}`
        : 'No ranked entries';
      live.textContent = `${frame.period.label}: ${message}`;
    },
    destroy() {
      detachDescription?.();
      detachDescription = undefined;
      attachByA11y.delete(a11y);
      wrapper.remove();
    },
  };
  attach(shell, model);
  attachByA11y.set(a11y, attach);
  return a11y;
}
