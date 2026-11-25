/**
 * Race accessibility DOM: the figure's name and description, the hidden period
 * table and the leaders announcement. The live region and its announce policy
 * come from the shared playback announcer.
 */
import type { A11yMetadata, RaceFrame } from '@opendata-ai/openchart-core';
import { type RaceModel, raceA11y, raceA11yLeaders } from '@opendata-ai/openchart-engine';
import { applySrOnlyStyles } from '../dom-helpers';
import { createPlaybackAnnouncer } from '../playback/announcer';
import { pageIdScope } from '../svg-ids';
import type { RaceShell } from './shell';

type RaceA11y = {
  attach(shell: RaceShell, model: RaceModel): boolean;
  announce(frame: RaceFrame): void;
  destroy(): void;
};

function raceName(model: RaceModel): string {
  return model.spec.chrome.title?.text?.trim() || 'Race chart';
}

function sameMetadata(a: A11yMetadata, b: A11yMetadata): boolean {
  const rows = b.dataTableFallback;
  return (
    a.altText === b.altText &&
    a.hidden === b.hidden &&
    a.totalRows === b.totalRows &&
    a.dataTableFallback.length === rows.length &&
    a.dataTableFallback.every(
      (row, index) =>
        row.length === rows[index].length &&
        row.every((cell, column) => cell === rows[index][column]),
    )
  );
}

/** Name up to three current leaders, prefixed with the period unless the reader is scrubbing. */
function describeLeaders(model: RaceModel, shell: RaceShell, frame: RaceFrame): string {
  // Fades can leave an exact leader out of the visual frame's items.
  const leaders = raceA11yLeaders(model, frame.t);
  const message = leaders.length
    ? `${leaders.join(', ')} ${leaders.length === 1 ? 'leads' : 'lead'}`
    : 'No ranked entries';
  const active = shell.root.ownerDocument.activeElement;
  const scrubberFocused =
    active?.matches('input[type="range"]') && shell.controlsSlot.contains(active);
  return scrubberFocused ? message : `${frame.period.label}: ${message}`;
}

function appendPeriodTable(wrapper: HTMLElement, name: string, metadata: A11yMetadata): void {
  const [headers, ...rows] = metadata.dataTableFallback;
  if (!headers) return;

  const table = wrapper.ownerDocument.createElement('table');
  const caption = table.createCaption();
  caption.textContent = `${name} by period.`;
  if (metadata.totalRows !== undefined) {
    caption.textContent += ` Showing ${rows.length} of ${metadata.totalRows} periods, evenly sampled.`;
  }
  const heading = table.createTHead().insertRow();
  for (const label of headers) {
    const cell = wrapper.ownerDocument.createElement('th');
    cell.scope = 'col';
    cell.textContent = String(label);
    heading.append(cell);
  }
  const body = table.createTBody();
  for (const [period, ...values] of rows) {
    const row = body.insertRow();
    const rowHeader = wrapper.ownerDocument.createElement('th');
    rowHeader.scope = 'row';
    rowHeader.textContent = String(period);
    row.append(rowHeader);
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

  let currentModel = model;
  let currentShell = shell;
  // announce() stores the mount's frame before notifying, so describe reads its period label.
  let announcedFrame!: RaceFrame;
  const announcer = createPlaybackAnnouncer({
    host: wrapper,
    describe: () => describeLeaders(currentModel, currentShell, announcedFrame),
  });
  let destroyed = false;
  let detachDescription: (() => void) | undefined;
  function attach(nextShell: RaceShell, nextModel: RaceModel): boolean {
    if (destroyed) return false;
    if (currentModel !== nextModel) {
      if (raceName(nextModel) !== name || !sameMetadata(metadata, raceA11y(nextModel))) {
        return false;
      }
      currentModel = nextModel;
    }
    currentShell = nextShell;
    if (metadata.hidden) return true;

    const { root, svg } = nextShell;
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
    attach,
    announce(frame) {
      if (!detachDescription) return;
      announcedFrame = frame;
      // The mount announces only while paused.
      announcer.notify('seek', { t: frame.t, playing: false });
    },
    destroy() {
      destroyed = true;
      detachDescription?.();
      detachDescription = undefined;
      announcer.destroy();
      wrapper.remove();
    },
  };
  attach(shell, model);
  return a11y;
}
