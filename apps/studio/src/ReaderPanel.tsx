import type { ChartSpec, ReaderSelection } from '@opendata-ai/openchart-core';
import { compareObservations } from '@opendata-ai/openchart-engine';
import type { SupportedSpec } from './Preview';

export function ReaderPanel({
  selection,
  spec,
  onClose,
}: {
  selection: ReaderSelection;
  spec: SupportedSpec;
  onClose: () => void;
}) {
  const observations = selection.pinned.length
    ? selection.pinned
    : selection.preview
      ? [selection.preview]
      : [];
  const chart = !('type' in spec) ? (spec as ChartSpec) : null;
  const channel = chart?.encoding.y?.type === 'quantitative' ? chart.encoding.y : chart?.encoding.x;
  const field = channel?.field;
  const metadata = field ? chart?.fields?.[field] : undefined;
  const before = field ? observations[0]?.datum[field] : undefined;
  const after = field ? observations[1]?.datum[field] : undefined;
  const comparison =
    metadata && typeof before === 'number' && typeof after === 'number'
      ? compareObservations(before, after, metadata, metadata)
      : null;
  return (
    <section className="studio-reader" aria-label="Observation details">
      <div className="studio-section-heading">
        <h2>{selection.pinned.length ? 'Pinned evidence' : 'Inspect the evidence'}</h2>
        {observations.length > 0 && (
          <button type="button" onClick={onClose}>
            Close ×
          </button>
        )}
      </div>
      <output className="studio-sr-only">{selection.announcement}</output>
      {!observations.length && (
        <p className="studio-muted">
          {chart
            ? 'Hover to preview. Click or tap to pin up to two observations. Use arrow keys to inspect, Enter to pin, and Escape to close.'
            : 'Click or tap a row or region to pin its current values. Use Close to dismiss. Selection clears when the document changes.'}
        </p>
      )}
      <div className="studio-observations">
        {observations.map((item) => (
          <dl key={item.observation}>
            {item.kind === 'aggregate' && (
              <div>
                <dt>Observation</dt>
                <dd>Aggregated group</dd>
              </div>
            )}
            {item.state === 'filtered' && (
              <div>
                <dt>Status</dt>
                <dd>Filtered out</dd>
              </div>
            )}
            {Object.entries(item.datum)
              .filter(([key]) => spec.fields?.[key]?.role !== 'identity')
              .map(([key, value]) => (
                <div key={key}>
                  <dt>
                    {spec.fields?.[key]?.label ?? key}
                    {spec.fields?.[key]?.unit ? ` (${spec.fields[key].unit})` : ''}
                  </dt>
                  <dd>
                    {item.previous && item.previous[key] !== value
                      ? `${String(item.previous[key] ?? 'Missing')} → `
                      : ''}
                    {value == null
                      ? 'Missing'
                      : Array.isArray(value)
                        ? value.join(', ')
                        : String(value)}
                  </dd>
                </div>
              ))}
          </dl>
        ))}
      </div>
      {comparison && (
        <p className="studio-comparison">
          Change:{' '}
          <strong>
            {comparison.absolute.toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
            {comparison.unit}
          </strong>
          {comparison.relative !== undefined && (
            <> · {(comparison.relative * 100).toFixed(1)}% relative change</>
          )}
        </p>
      )}
      {observations.length === 2 && !comparison && (
        <p className="studio-muted">Comparison requires the same declared measure and units.</p>
      )}
    </section>
  );
}
