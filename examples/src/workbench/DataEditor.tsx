import type { DataRow, FieldMetadata } from '@opendata-ai/openchart-core';
import { useState } from 'react';
import { coerceField, type FieldType, fieldType } from './document';

export function DataEditor({
  data,
  fields,
  onChange,
}: {
  data: DataRow[];
  fields?: Record<string, FieldMetadata>;
  onChange: (rows: DataRow[], fields?: Record<string, FieldMetadata>) => void;
}) {
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const columns = [...new Set(data.flatMap(Object.keys))].filter(
    (key) => fields?.[key]?.role !== 'identity',
  );
  const start = Math.min(page * 20, Math.max(0, Math.floor((data.length - 1) / 20) * 20));
  const changeType = (key: string, type: FieldType) => {
    try {
      onChange(
        data.map((row) => ({ ...row, [key]: coerceField(row[key], type) })),
        { ...fields, [key]: { ...fields?.[key], type } },
      );
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };
  return (
    <section className="studio-data-editor" aria-label="Data editor">
      <div className="studio-section-heading">
        <h2>Your data</h2>
        <span>
          {data.length} rows · {columns.length} fields
        </span>
      </div>
      <p className="studio-muted">
        Edit a value or correct a field type. Blank cells remain missing observations.
      </p>
      {error && (
        <p role="alert" className="studio-error">
          {error}
        </p>
      )}
      <div className="studio-data-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((key) => (
                <th key={key} scope="col">
                  <span>{key}</span>
                  <select
                    aria-label={`Type of ${key}`}
                    value={fieldType(data, key, fields)}
                    onChange={(event) => changeType(key, event.target.value as FieldType)}
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                  </select>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(start, start + 20).map((row, index) => (
              <tr key={String(row._rowId ?? start + index)}>
                {columns.map((key) => (
                  <td key={key}>
                    {Array.isArray(row[key]) ? (
                      <span>{JSON.stringify(row[key])}</span>
                    ) : (
                      <input
                        key={String(row[key])}
                        aria-label={`${key}, row ${start + index + 1}`}
                        defaultValue={String(row[key] ?? '')}
                        onBlur={(event) => {
                          if (event.target.value === String(row[key] ?? '')) return;
                          try {
                            const next = [...data];
                            next[start + index] = {
                              ...row,
                              [key]: coerceField(event.target.value, fieldType(data, key, fields)),
                            };
                            onChange(next, fields);
                            setError('');
                          } catch (reason) {
                            setError(reason instanceof Error ? reason.message : String(reason));
                          }
                        }}
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data.length && <p>No observations. Import data to start a visualization.</p>}
      <div className="studio-pagination">
        <button
          type="button"
          disabled={start === 0}
          onClick={() => setPage(Math.max(0, Math.floor(start / 20) - 1))}
        >
          Previous
        </button>
        <span>
          {data.length ? start + 1 : 0}–{Math.min(start + 20, data.length)} of {data.length}
        </span>
        <button
          type="button"
          disabled={start + 20 >= data.length}
          onClick={() => setPage(Math.floor(start / 20) + 1)}
        >
          Next
        </button>
      </div>
    </section>
  );
}
