/** Interactive QA fixture for the existing renderers' lifecycle and input contracts. */
import type {
  BarListSpec,
  ChartSpec,
  GeoMapSpec,
  SankeySpec,
  TableSpec,
  TileMapSpec,
} from '@opendata-ai/openchart-core';
import {
  createBarList,
  createChart,
  createGeoMap,
  createSankey,
  createTable,
  createTileMap,
} from '@opendata-ai/openchart-vanilla';
import { useEffect, useRef, useState } from 'react';
import usStatesTopo from 'us-atlas/states-albers-10m.json';
import { energyFlow } from '../data/energy-flow';
import { stateEconomies } from '../data/state-economies';
import { usStateUnemployment } from '../data/us-state-unemployment';
import './library-contracts.css';

export default { title: 'Testing / Library Contracts' };

type Kind = 'Bar' | 'Bar list' | 'Map' | 'Tile map' | 'Sankey' | 'Table';
interface Controls {
  update(): void;
  reject(): void;
  resize(): void;
  export(): void;
  destroy(): void;
}
const kinds: Kind[] = ['Bar', 'Bar list', 'Map', 'Tile map', 'Sankey', 'Table'];

export function Lifecycle() {
  const host = useRef<HTMLDivElement>(null);
  const controls = useRef<Controls | null>(null);
  const [kind, setKind] = useState<Kind>('Tile map');
  const [narrow, setNarrow] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [evidence, setEvidence] = useState('No selection');
  const [dark, setDark] = useState(false);

  useEffect(() => {
    if (!host.current) return;
    const options = { darkMode: dark ? ('force' as const) : ('off' as const) };
    const clicked = (data: unknown) => setEvidence(JSON.stringify(data));
    const chrome = {
      title: `${kind}: interaction and resize check`,
      subtitle: 'Use Tab, arrows, Enter and Escape. Updates retain the last valid chart.',
    };
    const common = { animation: true as const, chrome };
    const economies = stateEconomies.data.map((row) => ({ ...row }));
    const bar: ChartSpec = {
      ...common,
      mark: 'bar',
      data: economies,
      encoding: {
        x: { field: 'gdp', type: 'quantitative' },
        y: { field: 'state', type: 'nominal' },
        key: { field: 'state', type: 'nominal' },
      },
    };
    const barlist: BarListSpec = {
      ...common,
      type: 'barlist',
      data: economies,
      encoding: {
        label: { field: 'state', type: 'nominal' },
        value: { field: 'gdp', type: 'quantitative' },
      },
    };
    const map: GeoMapSpec = {
      ...common,
      type: 'map',
      geo: { features: usStatesTopo, idField: 'name', zoom: true },
      data: economies,
      encoding: {
        key: { field: 'state', type: 'nominal' },
        color: { field: 'gdp', type: 'quantitative' },
      },
    };
    const tilemap: TileMapSpec = {
      ...common,
      type: 'tilemap',
      data: { ...usStateUnemployment.data },
    };
    const sankey: SankeySpec = {
      ...common,
      type: 'sankey',
      data: energyFlow.data.map((row) => ({ ...row })),
      encoding: {
        source: { field: 'source', type: 'nominal' },
        target: { field: 'target', type: 'nominal' },
        value: { field: 'value', type: 'quantitative' },
      },
    };
    const table: TableSpec = {
      ...common,
      type: 'table',
      data: economies,
      rowKey: 'state',
      search: true,
      mobileLayout: 'priority',
      columns: [
        { key: 'state', label: 'State', sortable: true, priority: 1 },
        { key: 'gdp', label: 'GDP ($tn)', sortable: true, priority: 1 },
        { key: 'pop', label: 'Population (m)', priority: 2 },
      ],
    };
    const spec = {
      Bar: bar,
      'Bar list': barlist,
      Map: map,
      'Tile map': tilemap,
      Sankey: sankey,
      Table: table,
    }[kind];
    const instance =
      kind === 'Bar'
        ? createChart(host.current, bar, { ...options, onMarkClick: clicked })
        : kind === 'Bar list'
          ? createBarList(host.current, barlist, { ...options, onRowClick: clicked })
          : kind === 'Map'
            ? createGeoMap(host.current, map, { ...options, onMarkClick: clicked })
            : kind === 'Tile map'
              ? createTileMap(host.current, tilemap, { ...options, onTileClick: clicked })
              : kind === 'Sankey'
                ? createSankey(host.current, sankey, {
                    ...options,
                    onNodeClick: clicked,
                    onLinkClick: clicked,
                  })
                : createTable(host.current, table, { ...options, onRowClick: clicked });
    // The selected factory/spec pair is fixed for this fixture's mounted lifetime.
    const update = (next: typeof spec) => instance.update(next as never);
    let revision = 0;
    controls.current = {
      update: () => {
        revision += 1;
        update({ ...spec, chrome: { ...chrome, title: `${kind}: revision ${revision}` } });
        setStatus(`Updated revision ${revision}`);
      },
      reject: () => {
        try {
          update({ ...spec, data: null } as unknown as typeof spec);
          setStatus('Unexpectedly accepted invalid data');
        } catch {
          setStatus('Invalid data rejected; previous view preserved');
        }
      },
      resize: () => instance.resize(),
      export: () => {
        const text =
          kind === 'Table'
            ? (instance as ReturnType<typeof createTable>).export('csv')
            : ((instance as ReturnType<typeof createTileMap>).export('svg') as string);
        const blob = new Blob([text], { type: kind === 'Table' ? 'text/csv' : 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `openchart-${kind.toLowerCase().replaceAll(' ', '-')}.${kind === 'Table' ? 'csv' : 'svg'}`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setStatus('Exported settled view');
      },
      destroy: () => instance.destroy(),
    };
    setStatus('Ready');
    setEvidence('No selection');
    return () => {
      instance.destroy();
      controls.current = null;
    };
  }, [kind, dark]);

  return (
    <main className={`library-contracts ${dark ? 'library-contracts--dark' : ''}`}>
      <h1>Library interaction checks</h1>
      <div className="library-contracts-controls">
        <label>
          Renderer{' '}
          <select value={kind} onChange={(event) => setKind(event.target.value as Kind)}>
            {kinds.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => setNarrow(!narrow)}>
          {narrow ? 'Wide preview' : 'Narrow preview'}
        </button>
        <button type="button" onClick={() => controls.current?.update()}>
          Update
        </button>
        <button type="button" onClick={() => controls.current?.reject()}>
          Reject invalid update
        </button>
        <button type="button" onClick={() => setDark(!dark)}>
          {dark ? 'Light theme' : 'Dark theme'}
        </button>
        <button type="button" onClick={() => controls.current?.export()}>
          Export
        </button>
      </div>
      <output>{status}</output>
      <button type="button">Before visualization</button>
      <div className={`library-contracts-host ${narrow ? 'library-contracts-host--narrow' : ''}`}>
        <div ref={host} data-testid="library-host" className="library-contracts-canvas" />
      </div>
      <button type="button">After visualization</button>
      <pre data-testid="selected-evidence">{evidence}</pre>
    </main>
  );
}
