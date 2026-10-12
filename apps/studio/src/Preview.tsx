import type {
  ChartSpec,
  DataRow,
  DesignDiagnostic,
  ElementEdit,
  ReaderSelection,
  VizSpec,
} from '@opendata-ai/openchart-core';
import { diagnoseChart } from '@opendata-ai/openchart-engine';
import {
  type ChartInstance,
  createChart,
  createGeoMap,
  createReader,
  createTable,
  exportCSV,
  type GeoMapInstance,
  type ReaderController,
  type TableInstance,
} from '@opendata-ai/openchart-vanilla';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { applyElementEdit } from './edit';

export type SupportedSpec = ChartSpec | Extract<VizSpec, { type: 'table' | 'map' }>;
export function isSupported(spec: VizSpec): spec is SupportedSpec {
  return !('type' in spec) ? 'mark' in spec : spec.type === 'table' || spec.type === 'map';
}
export interface PreviewHandle {
  export(format: 'svg' | 'png' | 'csv'): string | Promise<Blob> | Promise<string>;
  clearSelection(): void;
}
interface PreviewProps {
  spec: SupportedSpec;
  /** Canonical document; a filtered preview must never replace authored rows. */
  editSource?: SupportedSpec;
  replay: number;
  editing?: boolean;
  onReview?: (diagnostics: DesignDiagnostic[]) => void;
  onChange: (spec: VizSpec) => void;
  onInspect: (state: ReaderSelection) => void;
}

export const Preview = forwardRef<PreviewHandle, PreviewProps>(function Preview(
  { spec, editSource = spec, replay, editing = false, onReview, onChange, onInspect },
  ref,
) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<ChartInstance | TableInstance | GeoMapInstance | null>(null);
  const reader = useRef<ReaderController | null>(null);
  const latest = useRef({ spec, editSource, onChange, onInspect, onReview });
  latest.current = { spec, editSource, onChange, onInspect, onReview };
  const [error, setError] = useState('');
  const kind = 'type' in spec ? spec.type : 'chart';
  const mountedSpec = useRef(spec);
  const retryMount = useRef<(() => void) | null>(null);
  const review = useCallback(() => {
    const current = latest.current.editSource;
    if (!instance.current || !latest.current.onReview) return;
    if (!('type' in current))
      latest.current.onReview(diagnoseChart(current, (instance.current as ChartInstance).layout));
    else
      latest.current.onReview([
        {
          code: 'review.scope',
          severity: 'info',
          status: 'uncheckable',
          origin: 'default',
          path: '/',
          viewport: {
            width: Math.round(container.current?.clientWidth ?? 0),
            height: Math.round(container.current?.clientHeight ?? 0),
          },
          message:
            'Geometry review currently covers Cartesian charts. Check this map or table at each preview size and with keyboard input.',
        },
      ]);
  }, []);
  useImperativeHandle(
    ref,
    () => ({
      export(format) {
        if (!instance.current || error)
          throw new Error(error || 'The visualization has not rendered yet.');
        if (kind === 'table' && format !== 'csv') throw new Error('Tables support CSV export.');
        if (format === 'csv') return exportCSV(latest.current.spec.data);
        if (kind === 'map') return (instance.current as GeoMapInstance).export(format);
        if (format === 'svg') return (instance.current as ChartInstance).export('svg');
        return (instance.current as ChartInstance).export('png');
      },
      clearSelection() {
        reader.current?.clear();
        latest.current.onInspect({
          preview: null,
          pinned: [],
          announcement: 'Selection dismissed.',
        });
      },
    }),
    [kind, error],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: kind and replay intentionally recreate the imperative renderer.
  useEffect(() => {
    if (!container.current) return;
    const mount = () => {
      if (!container.current) return;
      const current = latest.current.spec;
      latest.current.onInspect({ preview: null, pinned: [], announcement: '' });
      const inspectRow = (datum: DataRow) =>
        latest.current.onInspect({
          preview: null,
          pinned: [
            { observation: JSON.stringify(datum), persistent: false, datum, state: 'visible' },
          ],
          announcement: 'Observation pinned.',
        });
      const edit = (change: ElementEdit) => {
        try {
          if (!('type' in latest.current.editSource))
            latest.current.onChange(applyElementEdit(latest.current.editSource, change));
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      };
      try {
        if ('type' in current && current.type === 'table')
          instance.current = createTable(container.current, current, {
            onRowClick: inspectRow,
            darkMode: 'off',
          });
        else if ('type' in current && current.type === 'map')
          instance.current = createGeoMap(container.current, current, {
            onMarkClick: (event) => {
              if (event.data)
                inspectRow(event.name ? { Region: event.name, ...event.data } : event.data);
            },
            darkMode: 'off',
          });
        else {
          const chart = createChart(container.current, current as ChartSpec, {
            darkMode: 'off',
            editable: editing,
            ...(editing ? { onEdit: edit } : {}),
          });
          instance.current = chart;
          if (!editing)
            reader.current = createReader(container.current, chart, current as ChartSpec, (state) =>
              latest.current.onInspect(state),
            );
        }
        mountedSpec.current = current;
        setError('');
        review();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
      }
    };
    retryMount.current = mount;
    mount();
    // The renderer increments this generation after resize/font/layout work.
    // Review the actual layout; never substitute a requested preview width.
    const observer = new MutationObserver(review);
    observer.observe(container.current, {
      attributes: true,
      attributeFilter: ['data-oc-render-gen'],
    });
    return () => {
      observer.disconnect();
      retryMount.current = null;
      reader.current?.destroy();
      reader.current = null;
      instance.current?.destroy();
      instance.current = null;
    };
  }, [kind, replay, editing, review]);
  useEffect(() => {
    if (spec === mountedSpec.current) return;
    if (!instance.current) {
      retryMount.current?.();
      return;
    }
    try {
      if ('type' in spec && spec.type === 'table') (instance.current as TableInstance).update(spec);
      else if ('type' in spec && spec.type === 'map')
        (instance.current as GeoMapInstance).update(spec);
      else {
        (instance.current as ChartInstance).update(spec as ChartSpec);
        reader.current?.update(spec as ChartSpec);
      }
      if ('type' in spec)
        latest.current.onInspect({
          preview: null,
          pinned: [],
          announcement:
            'The visualization changed. Select an observation to inspect its current values.',
        });
      mountedSpec.current = spec;
      setError('');
      review();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }, [spec, review]);
  return (
    <>
      {error && (
        <div className="studio-error" role="alert">
          {error}
        </div>
      )}
      <div className="studio-chart" data-kind={kind} ref={container} />
    </>
  );
});
