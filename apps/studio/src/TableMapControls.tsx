import { type GeoMapSpec, SEQUENTIAL_PALETTES, type TableSpec } from '@opendata-ai/openchart-core';
import { compileGeoMap } from '@opendata-ai/openchart-engine';
import { useMemo } from 'react';
import { NumberFormat } from './ChartControls';
import { fieldChannel, visibleFields } from './composition';
import { fieldType } from './document';

export function TableControls({
  spec,
  onChange,
}: {
  spec: TableSpec;
  onChange: (spec: TableSpec) => void;
}) {
  return (
    <details className="studio-control-section" open>
      <summary>Table columns & reading</summary>
      <label className="studio-check">
        <input
          type="checkbox"
          checked={!!spec.search}
          onChange={(e) => onChange({ ...spec, search: e.target.checked })}
        />
        Let readers search
      </label>
      <label className="studio-field">
        Rows per page
        <select
          value={
            typeof spec.pagination === 'object'
              ? spec.pagination.pageSize
              : spec.pagination
                ? 25
                : 0
          }
          onChange={(e) =>
            onChange({
              ...spec,
              pagination: Number(e.target.value) ? { pageSize: Number(e.target.value) } : false,
            })
          }
        >
          {[0, 5, 10, 25, 50].map((count) => (
            <option key={count} value={count}>
              {count || 'All rows'}
            </option>
          ))}
        </select>
      </label>
      <label className="studio-field">
        Phone layout
        <select
          value={spec.mobileLayout ?? 'cards'}
          onChange={(e) =>
            onChange({ ...spec, mobileLayout: e.target.value as TableSpec['mobileLayout'] })
          }
        >
          <option value="priority">Priority columns + details</option>
          <option value="cards">Cards</option>
          <option value="scroll">Horizontal scroll</option>
        </select>
      </label>
      {spec.columns.map((column, index) => {
        const update = (patch: Partial<typeof column>) =>
          onChange({
            ...spec,
            columns: spec.columns.map((item, i) => (i === index ? { ...item, ...patch } : item)),
          });
        const numeric = fieldType(spec.data, column.key, spec.fields) === 'number';
        return (
          <details key={column.key}>
            <summary>{column.label ?? column.key}</summary>
            <label className="studio-field">
              Column heading
              <input
                key={column.label}
                defaultValue={column.label ?? column.key}
                onBlur={(e) => {
                  if (e.target.value !== (column.label ?? column.key))
                    update({ label: e.target.value });
                }}
              />
            </label>
            <label className="studio-field">
              Mobile priority
              <select
                value={column.priority ?? (index === 0 ? 1 : 2)}
                onChange={(e) => update({ priority: Number(e.target.value) as 1 | 2 | 3 })}
              >
                <option value={1}>Essential · always visible</option>
                <option value={2}>Supporting</option>
                <option value={3}>Secondary · details</option>
              </select>
            </label>
            <label className="studio-check">
              <input
                type="checkbox"
                checked={column.sortable !== false}
                onChange={(e) => update({ sortable: e.target.checked })}
              />
              Allow sorting
            </label>
            {numeric && (
              <>
                <NumberFormat value={column.format} onChange={(format) => update({ format })} />
                <label className="studio-field">
                  Cell visualization
                  <select
                    value={
                      column.bar
                        ? 'bar'
                        : column.heatmap
                          ? 'heatmap'
                          : column.delta
                            ? 'delta'
                            : 'plain'
                    }
                    onChange={(e) =>
                      update({
                        bar: undefined,
                        heatmap: undefined,
                        delta: undefined,
                        sparkline: undefined,
                        image: undefined,
                        flag: undefined,
                        categoryColors: undefined,
                        ...(e.target.value === 'plain' ? {} : { [e.target.value]: {} }),
                      })
                    }
                  >
                    <option value="plain">Text</option>
                    <option value="bar">Inline bar</option>
                    <option value="heatmap">Heatmap</option>
                    <option value="delta">Change chip</option>
                  </select>
                </label>
              </>
            )}
            <button
              type="button"
              disabled={index === 0}
              onClick={() => {
                const columns = [...spec.columns];
                [columns[index - 1], columns[index]] = [columns[index], columns[index - 1]];
                onChange({ ...spec, columns });
              }}
            >
              Move column earlier
            </button>
          </details>
        );
      })}
    </details>
  );
}
export function MapControls({
  spec,
  onChange,
}: {
  spec: GeoMapSpec;
  onChange: (spec: GeoMapSpec) => void;
}) {
  const fields = visibleFields(spec);
  const report = useMemo(() => {
    try {
      const layout = compileGeoMap(spec, { width: 640, height: 360, onWarn: () => {} });
      return { warnings: layout.warnings, features: layout.features.length };
    } catch (error) {
      return { error: (error as Error).message };
    }
  }, [spec]);
  return (
    <details className="studio-control-section" open>
      <summary>Map data & appearance</summary>
      <p className="studio-muted">
        Use the map’s exact geographic identifiers. Resolve repeated places in Data with a filter or
        an explicit summary before publishing.
      </p>
      <label className="studio-field">
        Place identifier
        <select
          value={spec.encoding.key?.field ?? ''}
          onChange={(e) =>
            onChange({
              ...spec,
              encoding: { ...spec.encoding, key: { field: e.target.value, type: 'nominal' } },
            })
          }
        >
          <option value="" disabled>
            Choose a field
          </option>
          {fields.map((field) => (
            <option key={field}>{field}</option>
          ))}
        </select>
      </label>
      <label className="studio-field">
        Feature identifier
        <input
          key={spec.geo.idField}
          defaultValue={spec.geo.idField ?? 'id'}
          onBlur={(e) => {
            if (e.target.value.trim() && e.target.value !== (spec.geo.idField ?? 'id'))
              onChange({ ...spec, geo: { ...spec.geo, idField: e.target.value.trim() } });
          }}
        />
      </label>
      <label className="studio-field">
        Map measure
        <select
          value={spec.encoding.color?.field ?? ''}
          onChange={(e) =>
            onChange({
              ...spec,
              encoding: {
                ...spec.encoding,
                color: fieldChannel(spec, e.target.value, spec.encoding.color),
              },
            })
          }
        >
          <option value="" disabled>
            Choose a field
          </option>
          {fields.map((field) => (
            <option key={field}>{field}</option>
          ))}
        </select>
      </label>
      {spec.encoding.color?.type === 'quantitative' && (
        <>
          <NumberFormat
            value={spec.encoding.color.format}
            onChange={(format) =>
              onChange({
                ...spec,
                encoding: { ...spec.encoding, color: { ...spec.encoding.color!, format } },
              })
            }
          />
          <label className="studio-field">
            Map palette
            <select
              value={spec.encoding.color.scale?.scheme ?? ''}
              onChange={(e) =>
                onChange({
                  ...spec,
                  encoding: {
                    ...spec.encoding,
                    color: {
                      ...spec.encoding.color!,
                      scale: {
                        ...spec.encoding.color?.scale,
                        range: undefined,
                        scheme: e.target.value || undefined,
                      },
                    },
                  },
                })
              }
            >
              <option value="">Authored / automatic</option>
              {Object.keys(SEQUENTIAL_PALETTES).map((palette) => (
                <option key={palette}>{palette}</option>
              ))}
            </select>
          </label>
        </>
      )}
      <label className="studio-check">
        <input
          type="checkbox"
          checked={!!spec.geo.zoom}
          onChange={(e) => onChange({ ...spec, geo: { ...spec.geo, zoom: e.target.checked } })}
        />
        Allow reader zoom & pan
      </label>
      <section className="studio-map-report" aria-label="Join report">
        <h3>Join report</h3>
        {report.error ? (
          <p>{report.error}</p>
        ) : (
          <>
            <p>
              {spec.data.length} data rows · {report.features} geographic shapes
            </p>
            {report.warnings
              ?.filter((warning) => /KEYS|UNMATCHED/.test(warning.code))
              .map((warning) => (
                <p key={warning.code}>{warning.message}</p>
              ))}
            {!report.warnings?.some((warning) => /KEYS|UNMATCHED/.test(warning.code)) && (
              <p>Every data key matched a feature.</p>
            )}
          </>
        )}
      </section>
    </details>
  );
}
