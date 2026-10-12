import { visibleFields } from './composition';
import type { SupportedSpec } from './Preview';

/** A read-only snapshot shares one column order across sparse or reordered rows. */
export function PreparedTable({ spec }: { spec: SupportedSpec }) {
  const columns = visibleFields(spec);
  const identity = !('type' in spec)
    ? spec.encoding.key?.field
    : spec.type === 'table'
      ? spec.rowKey
      : undefined;
  return (
    <div className="studio-prepared-table">
      <p>{spec.data.length} prepared rows. Edit Source data to change values.</p>
      <div className="studio-data-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((key) => (
                <th key={key} scope="col">
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {spec.data.slice(0, 50).map((row, index) => (
              <tr key={`${String(identity ? row[identity] : 'row')}:${index}`}>
                {columns.map((key) => (
                  <td key={key}>{String(row[key] ?? '—')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {spec.data.length > 50 && <p>Showing first 50 rows. Download plotted CSV for all rows.</p>}
    </div>
  );
}
