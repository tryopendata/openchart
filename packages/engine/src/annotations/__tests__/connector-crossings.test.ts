import type { ResolvedLabel } from '@opendata-ai/openchart-core';
import { expect, it } from 'vitest';
import { ConnectorCrossings } from '../connector-crossings';

const connector: NonNullable<ResolvedLabel['connector']> = {
  from: { x: 0, y: 0 },
  to: { x: 100, y: 0 },
  endpoint: { x: 110, y: 0 },
  style: 'straight',
};
it('penalizes unrelated labels and leaders while excluding contact with its target', () => {
  const index = new ConnectorCrossings();
  index.addBox({ x: 95, y: -5, width: 20, height: 10, kind: 'mark' });
  expect(index.score(connector)).toBe(0);
  index.addBox({ x: 45, y: -5, width: 10, height: 10, kind: 'annotation' });
  expect(index.score(connector)).toBeGreaterThan(0);
  const leaders = new ConnectorCrossings();
  leaders.addConnector({ ...connector, from: { x: 50, y: -50 }, to: { x: 50, y: 50 } });
  expect(leaders.score(connector)).toBeGreaterThan(0);
});
it('scores the rendered curve instead of its straight chord and stays deterministic', () => {
  const index = new ConnectorCrossings();
  index.addBox({ x: 40, y: 45, width: 20, height: 10, kind: 'annotation' });
  expect(index.score(connector)).toBe(0);
  const curve = { ...connector, style: 'curve' as const, control: { x: 50, y: 100 } };
  expect(index.score(curve)).toBeGreaterThan(0);
  expect(index.score(curve)).toBe(index.score(curve));
});

it('bounds grid work for extreme off-plot coordinates without missing crossings', () => {
  const index = new ConnectorCrossings();
  index.addBox({ x: -1e12, y: -1, width: 2e12, height: 2, kind: 'annotation' });
  expect(index.score(connector)).toBeGreaterThan(0);
  const enormous = { ...connector, from: { x: -1e12, y: 0 }, to: { x: 1e12, y: 0 } };
  expect(index.score(enormous)).toBeGreaterThan(0);
});
