import type {
  Annotation,
  ChartSpec,
  Encoding,
  EncodingChannel,
  LabelSpec,
} from '@opendata-ai/openchart-core';
import { useMemo, useState } from 'react';
import { useAuthoringDraft } from './AuthoringDrafts';
import {
  type Composition,
  type CompositionRoles,
  compose,
  compositionNames,
  fieldChannel,
  visibleFields,
} from './composition';
import type { SupportedSpec } from './Preview';
import { changeSeriesColor, seriesColors } from './series-style';

export function CompositionControl({
  spec,
  onChange,
}: {
  spec: SupportedSpec;
  onChange: (spec: SupportedSpec) => void;
}) {
  const fields = visibleFields(spec);
  const chart = !('type' in spec) ? spec : null;
  const [kind, setKind] = useAuthoringDraft<Composition>('composition.kind', 'bar');
  const [roles, setRoles] = useAuthoringDraft<CompositionRoles>('composition.roles', {
    x: chart?.encoding.x?.field ?? fields[0] ?? '',
    y: chart?.encoding.y?.field ?? fields[1] ?? '',
    series:
      chart?.encoding.color && 'field' in chart.encoding.color ? chart.encoding.color.field : '',
    end: chart?.encoding.x2?.field ?? '',
  });
  const [error, setError] = useState('');
  return (
    <details className="studio-control-section">
      <summary>Change composition</summary>
      <p className="studio-muted">
        Keep your data, headline and source. Choose roles explicitly. Axes, labels and annotations
        are reset for the new composition; Undo restores them. Lines use dates or ordered categories
        along X.
      </p>
      <label className="studio-field">
        Composition
        <select value={kind} onChange={(e) => setKind(e.target.value as Composition)}>
          {Object.entries(compositionNames).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {kind !== 'table' &&
        (
          [
            'x',
            ...(kind === 'histogram' ? [] : ['y']),
            'series',
            ...(kind === 'range' ? ['end'] : []),
          ] as Array<keyof CompositionRoles>
        ).map((role) => (
          <label className="studio-field" key={role}>
            {
              {
                x: 'Horizontal field',
                y: 'Vertical field',
                series: 'Series field (optional)',
                end: 'Interval endpoint',
              }[role]
            }
            <select
              value={roles[role]}
              onChange={(e) => setRoles({ ...roles, [role]: e.target.value })}
            >
              <option value="">Choose a field</option>
              {fields.map((field) => (
                <option key={field}>{field}</option>
              ))}
            </select>
          </label>
        ))}
      {error && (
        <p role="alert" className="studio-error">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => {
          try {
            onChange(compose(spec, kind, roles));
            setError('');
          } catch (reason) {
            setError(String(reason instanceof Error ? reason.message : reason));
          }
        }}
      >
        Apply composition
      </button>
    </details>
  );
}
const formats = [
  ['', 'Automatic'],
  [',.0f', 'Whole numbers'],
  [',.2f', 'Two decimals'],
  ['.1%', 'Percent (fraction × 100)'],
  ['.1f', 'Percentage values (0–100)'],
  ['$,.0f', 'US dollars'],
  ['.3~s', 'Compact'],
];
export function NumberFormat({
  value,
  onChange,
  label = 'Number format',
}: {
  value?: string;
  onChange: (value: string | undefined) => void;
  label?: string;
}) {
  return (
    <label className="studio-field">
      {label}
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
        {value && !formats.some(([format]) => format === value) && (
          <option value={value}>Custom · {value}</option>
        )}
        {formats.map(([format, text]) => (
          <option key={format} value={format}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}
export function ChartControls({
  chart,
  onChange,
}: {
  chart: ChartSpec;
  onChange: (spec: ChartSpec) => void;
}) {
  const fields = visibleFields(chart);
  const mark = typeof chart.mark === 'string' ? chart.mark : chart.mark.type;
  const setEncoding = (encoding: Encoding) => onChange({ ...chart, encoding } as ChartSpec);
  const setChannel = (axis: 'x' | 'y', channel: EncodingChannel) =>
    setEncoding({ ...chart.encoding, [axis]: channel });
  const color =
    chart.encoding.color && 'field' in chart.encoding.color ? chart.encoding.color : null;
  const colors = useMemo(() => seriesColors(chart), [chart]);
  const series = color ? [...new Set(chart.data.map((row) => String(row[color.field] ?? '')))] : [];
  return (
    <>
      <details className="studio-control-section" open>
        <summary>Fields & axes</summary>
        {(['x', 'y'] as const).map((axis) => {
          const channel = chart.encoding[axis];
          if (!channel) return null;
          const config = typeof channel.axis === 'object' && channel.axis ? channel.axis : {};
          return (
            <div key={axis}>
              <label className="studio-field">
                {axis.toUpperCase()} axis
                <select
                  value={channel.field}
                  onChange={(e) => setChannel(axis, fieldChannel(chart, e.target.value, channel))}
                >
                  {fields.map((field) => (
                    <option key={field}>{field}</option>
                  ))}
                </select>
              </label>
              <details>
                <summary>{axis.toUpperCase()} axis options</summary>
                <label className="studio-field">
                  {axis.toUpperCase()} axis title
                  <input
                    key={`${channel.field}:${config.title}`}
                    defaultValue={config.title ?? ''}
                    onBlur={(e) => {
                      if (e.target.value !== (config.title ?? ''))
                        setChannel(axis, {
                          ...channel,
                          axis: { ...config, title: e.target.value },
                        });
                    }}
                  />
                </label>
                <label className="studio-check">
                  <input
                    type="checkbox"
                    checked={channel.axis !== false && channel.axis !== null}
                    onChange={(e) =>
                      setChannel(axis, { ...channel, axis: e.target.checked ? {} : false })
                    }
                  />
                  Show axis
                </label>
                {channel.type === 'quantitative' ? (
                  <>
                    <NumberFormat
                      label={`${axis.toUpperCase()} value format`}
                      value={channel.format}
                      onChange={(format) =>
                        setChannel(axis, { ...channel, format, axis: { ...config, format } })
                      }
                    />
                    <label className="studio-field">
                      Zero baseline
                      <select
                        value={
                          channel.scale?.zero === undefined ? 'auto' : String(channel.scale.zero)
                        }
                        onChange={(e) =>
                          setChannel(axis, {
                            ...channel,
                            scale: {
                              ...channel.scale,
                              zero:
                                e.target.value === 'auto' ? undefined : e.target.value === 'true',
                            },
                          })
                        }
                      >
                        <option value="auto">Automatic for this chart</option>
                        <option value="true">Include zero</option>
                        <option value="false">Fit the observations</option>
                      </select>
                    </label>
                  </>
                ) : channel.type === 'nominal' || channel.type === 'ordinal' ? (
                  <label className="studio-field">
                    {axis.toUpperCase()} category order
                    <select
                      value={
                        typeof channel.sort === 'string'
                          ? channel.sort
                          : channel.sort
                            ? 'custom'
                            : 'source'
                      }
                      onChange={(e) =>
                        setChannel(axis, {
                          ...channel,
                          sort:
                            e.target.value === 'source'
                              ? null
                              : (e.target.value as 'ascending' | 'descending'),
                        })
                      }
                    >
                      <option value="source">Source order</option>
                      <option value="ascending">Ascending</option>
                      <option value="descending">Descending</option>
                      {channel.sort && typeof channel.sort !== 'string' && (
                        <option value="custom" disabled>
                          Authored custom order (retained)
                        </option>
                      )}
                    </select>
                  </label>
                ) : null}
              </details>
            </div>
          );
        })}
        {mark === 'range' && (
          <label className="studio-field">
            Interval endpoint
            <select
              value={chart.encoding.x2?.field ?? ''}
              onChange={(e) =>
                setEncoding({
                  ...chart.encoding,
                  x2: { field: e.target.value, type: 'quantitative' },
                })
              }
            >
              {fields.map((field) => (
                <option key={field}>{field}</option>
              ))}
            </select>
          </label>
        )}
      </details>
      <details className="studio-control-section">
        <summary>Series, labels & small multiples</summary>
        <label className="studio-field">
          Color by
          <select
            value={color?.field ?? ''}
            onChange={(e) => {
              const encoding = { ...chart.encoding };
              if (e.target.value) encoding.color = { field: e.target.value, type: 'nominal' };
              else delete encoding.color;
              setEncoding(encoding);
            }}
          >
            <option value="">One color</option>
            {fields.map((field) => (
              <option key={field}>{field}</option>
            ))}
          </select>
        </label>
        {color?.type === 'nominal' &&
          series.length <= 20 &&
          series
            .filter((name) => colors.has(name))
            .map((name) => (
              <label className="studio-color" key={name}>
                {name}
                <input
                  type="color"
                  aria-label={`Color for ${name}`}
                  value={colors.get(name)!}
                  onChange={(e) => onChange(changeSeriesColor(chart, colors, name, e.target.value))}
                />
              </label>
            ))}
        <label className="studio-field">
          Data labels
          <select
            value={
              chart.labels === false
                ? 'none'
                : typeof chart.labels === 'object'
                  ? (chart.labels.density ?? 'auto')
                  : 'auto'
            }
            onChange={(e) =>
              onChange({
                ...chart,
                labels:
                  e.target.value === 'none'
                    ? false
                    : ({
                        ...(typeof chart.labels === 'object' ? chart.labels : {}),
                        density: e.target.value as 'auto' | 'all' | 'endpoints',
                      } as LabelSpec),
              })
            }
          >
            <option value="auto">Automatic</option>
            <option value="none">Hidden</option>
            <option value="all">All values</option>
            <option value="endpoints">Endpoints</option>
          </select>
        </label>
        <label className="studio-field">
          Small multiples
          <select
            value={chart.encoding.facet?.field ?? ''}
            onChange={(e) => {
              const encoding = { ...chart.encoding };
              if (e.target.value) encoding.facet = { field: e.target.value, type: 'nominal' };
              else delete encoding.facet;
              setEncoding(encoding);
            }}
          >
            <option value="">Single panel</option>
            {fields.map((field) => (
              <option key={field}>{field}</option>
            ))}
          </select>
        </label>
        {mark === 'area' && (
          <label className="studio-field">
            Area comparison
            <select
              value={
                chart.encoding.y?.stack === null || chart.encoding.y?.stack === false
                  ? 'overlap'
                  : chart.encoding.y?.stack === 'normalize'
                    ? 'normalize'
                    : 'zero'
              }
              onChange={(e) =>
                chart.encoding.y &&
                setChannel('y', {
                  ...chart.encoding.y,
                  stack:
                    e.target.value === 'overlap' ? null : (e.target.value as 'zero' | 'normalize'),
                })
              }
            >
              <option value="zero">Stacked totals</option>
              <option value="normalize">Share of total</option>
              <option value="overlap">Overlapping series</option>
            </select>
          </label>
        )}
      </details>
      <AnnotationControls chart={chart} onChange={onChange} />
    </>
  );
}
function AnnotationControls({
  chart,
  onChange,
}: {
  chart: ChartSpec;
  onChange: (spec: ChartSpec) => void;
}) {
  const [kind, setKind] = useAuthoringDraft<'refline' | 'text'>('annotation.kind', 'refline');
  const [axis, setAxis] = useAuthoringDraft<'x' | 'y'>('annotation.axis', 'y');
  const [x, setX] = useAuthoringDraft('annotation.x', '');
  const [y, setY] = useAuthoringDraft('annotation.y', '');
  const [text, setText] = useAuthoringDraft('annotation.text', '');
  const [error, setError] = useState('');
  const coordinate = (key: 'x' | 'y', value: string) => {
    if (!value.trim()) throw new Error('Enter an anchor value.');
    if (chart.encoding[key]?.type === 'quantitative') {
      if (!Number.isFinite(Number(value)))
        throw new Error('Use a numeric anchor on a numeric axis.');
      return Number(value);
    }
    return value;
  };
  return (
    <details className="studio-control-section">
      <summary>Annotations & reference lines</summary>
      {chart.annotations?.map((annotation, index) => (
        <div className="studio-annotation" key={annotation.id ?? index}>
          <span>
            {annotation.type === 'text' ? annotation.text : (annotation.label ?? annotation.type)}
          </span>
          <button
            type="button"
            aria-label={`Remove annotation ${index + 1}`}
            onClick={() =>
              onChange({ ...chart, annotations: chart.annotations!.filter((_, i) => i !== index) })
            }
          >
            Remove
          </button>
        </div>
      ))}
      <label className="studio-field">
        Annotation type
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="refline">Reference line</option>
          <option value="text">Text callout</option>
        </select>
      </label>
      {kind === 'refline' && (
        <label className="studio-field">
          Reference axis
          <select value={axis} onChange={(e) => setAxis(e.target.value as typeof axis)}>
            <option value="y">Y · horizontal line</option>
            <option value="x">X · vertical line</option>
          </select>
        </label>
      )}
      {(kind === 'text' || axis === 'x') && (
        <label className="studio-field">
          X anchor
          <input value={x} onChange={(e) => setX(e.target.value)} />
        </label>
      )}
      {(kind === 'text' || axis === 'y') && (
        <label className="studio-field">
          Y anchor
          <input value={y} onChange={(e) => setY(e.target.value)} />
        </label>
      )}
      <label className="studio-field">
        Annotation text
        <input value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      {error && <p role="alert">{error}</p>}
      <button
        type="button"
        disabled={!text.trim()}
        onClick={() => {
          try {
            const annotation: Annotation =
              kind === 'text'
                ? {
                    id: crypto.randomUUID(),
                    type: 'text',
                    x: coordinate('x', x),
                    y: coordinate('y', y),
                    text,
                    responsive: false,
                  }
                : {
                    id: crypto.randomUUID(),
                    type: 'refline',
                    [axis]: coordinate(axis, axis === 'x' ? x : y),
                    label: text,
                    style: 'dashed',
                    responsive: false,
                  };
            onChange({ ...chart, annotations: [...(chart.annotations ?? []), annotation] });
            setError('');
            setText('');
          } catch (reason) {
            setError((reason as Error).message);
          }
        }}
      >
        Add annotation
      </button>
    </details>
  );
}
